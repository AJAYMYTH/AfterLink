const { createClientTransport, isTLSUrl } = require('./transport/tls');
const {
  Frame,
  FrameTypes: {
    REQUEST,
    RESPONSE,
    ERROR,
    HELLO,
    HELLO_ACK,
    CLOSE,
    CLOSE_ACK,
    SUBSCRIBE,
    UNSUBSCRIBE,
    PUBLISH,
    PING,
    PONG,
  },
  Serializer,
} = require('@afterlink/core');
const PendingRequests = require('./PendingRequests');

class Client {
  constructor(url, options = {}) {
    this.url = new URL(url);
    this.options = {
      timeout: 30000,
      autoReconnect: false,
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
      reconnectMaxDelay: 30000,
      pingInterval: 30000,
      connectTimeout: 5000,
      ...options,
    };
    this.pending = new PendingRequests(this.options.timeout);
    this._msgId = 0;
    this._connected = false;
    this._connecting = false;
    this._reconnectAttempts = 0;
    this._reconnectTimer = null;
    this._pingTimer = null;
    this._handlers = new Map();
    this._eventListeners = new Map();
    this._buffer = Buffer.alloc(0);
    this.socket = null;
    this.sessionId = null;
    this._tlsEnabled = isTLSUrl(url);
  }

  _nextId() {
    return (++this._msgId) >>> 0;
  }

  async connect() {
    if (this._connected) {
      throw new Error('Already connected');
    }
    if (this._connecting) {
      throw new Error('Connection in progress');
    }

    this._connecting = true;
    this._buffer = Buffer.alloc(0);

    return new Promise((resolve, reject) => {
      const port = parseInt(this.url.port, 10) || (this._tlsEnabled ? 443 : 4000);
      const connectTimeout = setTimeout(() => {
        this._connecting = false;
        if (this.socket) {
          this.socket.destroy();
          this.socket = null;
        }
        reject(new Error(`Connection to ${this.url.hostname}:${port} timed out`));
      }, this.options.connectTimeout);

      try {
        this.socket = createClientTransport(this.url, this.options);
      } catch (err) {
        this._connecting = false;
        clearTimeout(connectTimeout);
        reject(err);
        return;
      }

      this.socket.on('data', (d) => this._handleData(d));
      this.socket.once('connect', () => {
        clearTimeout(connectTimeout);
        this._connected = true;
        this._connecting = false;
        this._reconnectAttempts = 0;
        this._startPingInterval();
        this._doHandshake().then(resolve).catch((err) => {
          this._connected = false;
          reject(err);
        });
      });
      this.socket.once('error', (err) => {
        clearTimeout(connectTimeout);
        this._connecting = false;
        this._connected = false;
        if (err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || err.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
          const tlsErr = new Error(`TLS certificate verification failed: ${err.message}`);
          tlsErr.code = 'TLS_CERT_UNTRUSTED';
          reject(tlsErr);
        } else if (err.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
          const tlsErr = new Error(`TLS certificate hostname mismatch`);
          tlsErr.code = 'TLS_CERT_ERROR';
          reject(tlsErr);
        } else {
          reject(err);
        }
      });
      this.socket.on('close', () => this._onDisconnect());
    });
  }

  async _doHandshake() {
    return new Promise((resolve, reject) => {
      const id = this._nextId();
      const capabilities = ['streaming', 'pubsub'];
      if (this._tlsEnabled) capabilities.push('tls');
      if (this.options.compression?.enabled) capabilities.push('compression');

      const payload = Serializer.encode({
        version: 'AL/1.1',
        auth: this.options.auth || null,
        capabilities,
        compression: this.options.compression?.algorithm || 'none',
      });
      const frame = Frame.encode(HELLO, 0, id, payload);

      const timeout = setTimeout(() => {
        this.pending.reject(id, new Error('Handshake timed out'));
        reject(new Error('Handshake timed out'));
      }, 5000);

      this.pending.add(id, (data) => {
        clearTimeout(timeout);
        this.sessionId = data.session_id;
        resolve(data);
      }, reject);

      if (this.socket && !this.socket.destroyed) {
        this.socket.write(frame);
      } else {
        clearTimeout(timeout);
        reject(new Error('Socket closed before handshake'));
      }
    });
  }

  async request(route, body = {}) {
    if (!this._connected) throw new Error('Not connected');
    if (!this.socket || this.socket.destroyed) throw new Error('Socket destroyed');

    const id = this._nextId();
    const payload = Serializer.encode({ route, body });
    const frame = Frame.encode(REQUEST, 0, id, payload);

    return new Promise((resolve, reject) => {
      this.pending.add(id, resolve, reject);
      this.socket.write(frame);
    });
  }

  async subscribe(topic, handler) {
    if (!this._connected) throw new Error('Not connected');
    if (typeof handler !== 'function') throw new TypeError('Handler must be a function');

    const id = this._nextId();
    const payload = Serializer.encode({ topic });
    const frame = Frame.encode(SUBSCRIBE, 0, id, payload);

    if (!this._handlers.has(topic)) {
      this._handlers.set(topic, new Set());
    }
    this._handlers.get(topic).add(handler);

    return new Promise((resolve, reject) => {
      this.pending.add(id, resolve, reject);
      this.socket.write(frame);
    });
  }

  unsubscribe(topic) {
    if (!this._connected) throw new Error('Not connected');

    this._handlers.delete(topic);

    const id = this._nextId();
    const payload = Serializer.encode({ topic });
    const frame = Frame.encode(UNSUBSCRIBE, 0, id, payload);
    this.socket.write(frame);
  }

  publish(topic, data) {
    if (!this._connected) throw new Error('Not connected');

    const payload = Serializer.encode({ topic, data });
    const frame = Frame.encode(PUBLISH, 0, 0, payload);
    this.socket.write(frame);
  }

  async disconnect() {
    this._clearReconnect();

    if (!this._connected && !this._connecting) return;

    this._stopPingInterval();
    this.pending.clear();

    return new Promise((resolve) => {
      if (!this.socket || this.socket.destroyed) {
        this._cleanup();
        return resolve();
      }

      const id = this._nextId();
      const frame = Frame.encode(CLOSE, 0, id, Buffer.alloc(0));

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.socket.destroy();
          this._cleanup();
          resolve();
        }
      }, 2000);

      this.socket.once('close', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          this._cleanup();
          resolve();
        }
      });

      try {
        this.socket.write(frame);
      } catch {
        this.socket.destroy();
      }
    });
  }

  _handleData(data) {
    this._buffer = Buffer.concat([this._buffer, data]);

    while (this._buffer.length > 0) {
      const frame = Frame.decode(this._buffer);
      if (!frame) break;

      this._buffer = this._buffer.slice(frame.totalSize);
      this._handleFrame(frame);
    }
  }

  _handleFrame(frame) {
    const { type, messageId, payload } = frame;

    switch (type) {
      case RESPONSE: {
        try {
          const data = Serializer.decode(payload);
          this.pending.resolve(messageId, data.body || data);
        } catch (err) {
          this.pending.reject(messageId, new Error(`Failed to decode response: ${err.message}`));
        }
        break;
      }
      case HELLO_ACK: {
        try {
          const data = Serializer.decode(payload);
          this.pending.resolve(messageId, data);
        } catch (err) {
          this.pending.reject(messageId, new Error(`Failed to decode handshake: ${err.message}`));
        }
        break;
      }
      case ERROR: {
        try {
          const err = Serializer.decode(payload);
          this.pending.reject(messageId, Object.assign(new Error(err.message), err));
        } catch {
          this.pending.reject(messageId, new Error('Unknown server error'));
        }
        break;
      }
      case PUBLISH: {
        try {
          const { topic, data } = Serializer.decode(payload);
          const handlers = this._handlers.get(topic);
          if (handlers) {
            for (const handler of handlers) {
              try {
                handler(data);
              } catch (err) {
                console.error(`[AfterLink] Handler error for topic '${topic}':`, err.message);
              }
            }
          }
          this._emit('message', { topic, data });
        } catch {
          // Ignore malformed publish frames
        }
        break;
      }
      case PING: {
        if (this.socket && !this.socket.destroyed) {
          const pongFrame = Frame.encode(PONG, 0, 0, Buffer.alloc(0));
          this.socket.write(pongFrame);
        }
        break;
      }
      case PONG:
        break;
      case CLOSE: {
        if (this.socket && !this.socket.destroyed) {
          const ackFrame = Frame.encode(CLOSE_ACK, 0, messageId, Buffer.alloc(0));
          this.socket.write(ackFrame);
          this.socket.end();
        }
        break;
      }
    }
  }

  _startPingInterval() {
    this._stopPingInterval();
    this._pingTimer = setInterval(() => {
      if (this._connected && this.socket && !this.socket.destroyed) {
        try {
          const frame = Frame.encode(PING, 0, 0, Buffer.alloc(0));
          this.socket.write(frame);
        } catch {
          // Socket may have closed between checks
        }
      }
    }, this.options.pingInterval);
    if (this._pingTimer.unref) this._pingTimer.unref();
  }

  _stopPingInterval() {
    if (this._pingTimer) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
  }

  _onDisconnect() {
    this._connected = false;
    this._connecting = false;
    this._stopPingInterval();
    this.pending.clear();
    this._emit('disconnected');

    if (this.options.autoReconnect && this._reconnectAttempts < this.options.maxReconnectAttempts) {
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    this._clearReconnect();

    this._reconnectAttempts++;
    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(2, this._reconnectAttempts - 1),
      this.options.reconnectMaxDelay
    );
    const jitter = Math.random() * delay * 0.3;

    this._emit('reconnecting', { attempt: this._reconnectAttempts, delay: delay + jitter });

    this._reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
        this._emit('reconnected');
      } catch {
        this._scheduleReconnect();
      }
    }, delay + jitter);
  }

  _clearReconnect() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  _cleanup() {
    this._connected = false;
    this._connecting = false;
    this._stopPingInterval();
    this._clearReconnect();
    this.pending.clear();
    this.socket = null;
    this._buffer = Buffer.alloc(0);
  }

  on(event, listener) {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, new Set());
    }
    this._eventListeners.get(event).add(listener);
  }

  off(event, listener) {
    const listeners = this._eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  _emit(event, data) {
    const listeners = this._eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data);
        } catch (err) {
          console.error(`[AfterLink] Event listener error for '${event}':`, err.message);
        }
      }
    }
  }

  isConnected() {
    return this._connected;
  }

  getSessionId() {
    return this.sessionId;
  }

  isTLS() {
    return this._tlsEnabled;
  }
}

module.exports = Client;
