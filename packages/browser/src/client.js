const { Frame, FrameTypes, Serializer, compression } = require('@ajaymyth/core');

class BrowserClient {
  constructor(url, options = {}) {
    this.url = url;
    this.options = {
      autoReconnect: true,
      maxReconnectAttempts: 10,
      reconnectDelay: 1000,
      timeout: 30000,
      pingInterval: 30000,
      protocols: ['afterlink'],
      ...options,
    };

    this.ws = null;
    this._connected = false;
    this._connecting = false;
    this._reconnectAttempts = 0;
    this._reconnectTimer = null;
    this._pingTimer = null;
    this._pending = new Map();
    this._handlers = new Map();
    this._eventListeners = new Map();
    this._msgId = 0;
    this.sessionId = null;
    this._serverClosing = false;
    this._compression = { enabled: false, algorithm: 'none', level: 6, threshold: 1024 };
  }

  _nextId() {
    return (++this._msgId) >>> 0;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this._connected) {
        return reject(new Error('Already connected'));
      }
      if (this._connecting) {
        return reject(new Error('Connection in progress'));
      }

      this._connecting = true;
      this._serverClosing = false;

      try {
        this.ws = new WebSocket(this.url, this.options.protocols);
      } catch (err) {
        this._connecting = false;
        return reject(err);
      }

      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this._connecting = false;
        this._connected = true;
        this._reconnectAttempts = 0;
        this._doHandshake().then(resolve).catch((err) => {
          this._connected = false;
          reject(err);
        });
      };

      this.ws.onmessage = (event) => {
        this._handleData(event.data);
      };

      this.ws.onclose = (event) => {
        this._onDisconnect(event);
      };

      this.ws.onerror = (err) => {
        if (!this._connected) {
          this._connecting = false;
          reject(new Error(`WebSocket connection failed: ${err.message || 'unknown error'}`));
        }
      };
    });
  }

  async _doHandshake() {
    return new Promise((resolve, reject) => {
      const id = this._nextId();
      const capabilities = ['streaming', 'pubsub'];

      const payload = Serializer.encode({
        version: 'AL/1.1',
        auth: this.options.auth || null,
        capabilities,
        compression: this.options.compression?.enabled
          ? (this.options.compression.algorithm || 'zlib')
          : 'none',
      });

      const frame = Frame.encode(FrameTypes.HELLO, 0, id, payload);

      const timeout = setTimeout(() => {
        this._pending.delete(id);
        reject(new Error('Handshake timed out'));
      }, 5000);

      this._pending.set(id, {
        resolve: (data) => {
          clearTimeout(timeout);
          this.sessionId = data.session_id;
          const negotiated = data.compression || 'none';
          this._compression.enabled = negotiated !== 'none';
          this._compression.algorithm = negotiated;
          resolve(data);
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });

      this.ws.send(frame, { binary: true });
    });
  }

  _handleData(data) {
    const buffer = data instanceof ArrayBuffer ? Buffer.from(data) : (Buffer.isBuffer(data) ? data : Buffer.from(data));
    const frame = Frame.decode(buffer);
    if (!frame) return;

    this._handleFrame(frame);
  }

  _handleFrame(frame) {
    const { type, messageId, payload, flags } = frame;

    let decodedPayload = payload;
    if (compression.isCompressed(flags)) {
      try {
        decodedPayload = compression.decompress(payload, true, this._compression.algorithm);
      } catch (err) {
        this._reject(messageId, new Error(`Failed to decompress: ${err.message}`));
        return;
      }
    }

    switch (type) {
      case FrameTypes.RESPONSE: {
        try {
          const data = Serializer.decode(decodedPayload);
          this._resolve(messageId, data.body || data);
        } catch (err) {
          this._reject(messageId, new Error(`Failed to decode response: ${err.message}`));
        }
        break;
      }
      case FrameTypes.HELLO_ACK: {
        try {
          const data = Serializer.decode(decodedPayload);
          this._resolve(messageId, data);
        } catch (err) {
          this._reject(messageId, new Error(`Failed to decode handshake: ${err.message}`));
        }
        break;
      }
      case FrameTypes.ERROR: {
        const { fromFramePayload } = require('@ajaymyth/core/errors');
        const err = fromFramePayload(decodedPayload, messageId);
        this._reject(messageId, err);
        break;
      }
      case FrameTypes.PUBLISH: {
        try {
          const { topic, data } = Serializer.decode(decodedPayload);
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
      case FrameTypes.PING: {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          const pongFrame = Frame.encode(FrameTypes.PONG, 0, 0, Buffer.alloc(0));
          this.ws.send(pongFrame, { binary: true });
        }
        break;
      }
      case FrameTypes.PONG:
        break;
      case FrameTypes.SERVER_CLOSING: {
        try {
          const data = Serializer.decode(decodedPayload);
          this._emit('server-closing', data);
          this._serverClosing = true;
        } catch {
          // Ignore malformed frames
        }
        break;
      }
    }
  }

  request(route, body = {}) {
    if (!this._connected) throw new Error('Not connected');

    const id = this._nextId();
    const payload = Serializer.encode({ route, body });
    const frame = Frame.encode(FrameTypes.REQUEST, 0, id, payload);

    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      this.ws.send(frame, { binary: true });
    });
  }

  subscribe(topic, handler) {
    if (!this._connected) throw new Error('Not connected');
    if (typeof handler !== 'function') throw new TypeError('Handler must be a function');

    const id = this._nextId();
    const payload = Serializer.encode({ topic });
    const frame = Frame.encode(FrameTypes.SUBSCRIBE, 0, id, payload);

    if (!this._handlers.has(topic)) {
      this._handlers.set(topic, new Set());
    }
    this._handlers.get(topic).add(handler);

    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      this.ws.send(frame, { binary: true });
    });
  }

  unsubscribe(topic) {
    if (!this._connected) throw new Error('Not connected');

    this._handlers.delete(topic);

    const id = this._nextId();
    const payload = Serializer.encode({ topic });
    const frame = Frame.encode(FrameTypes.UNSUBSCRIBE, 0, id, payload);
    this.ws.send(frame, { binary: true });
  }

  publish(topic, data) {
    if (!this._connected) throw new Error('Not connected');

    const payload = Serializer.encode({ topic, data });
    const frame = Frame.encode(FrameTypes.PUBLISH, 0, 0, payload);
    this.ws.send(frame, { binary: true });
  }

  disconnect() {
    this._clearReconnect();
    this._stopPingInterval();

    if (!this._connected && !this._connecting) return Promise.resolve();

    this._pending.clear();

    return new Promise((resolve) => {
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this._cleanup();
        return resolve();
      }

      const id = this._nextId();
      const frame = Frame.encode(FrameTypes.CLOSE, 0, id, Buffer.alloc(0));

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.ws.close();
          this._cleanup();
          resolve();
        }
      }, 2000);

      this.ws.onclose = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          this._cleanup();
          resolve();
        }
      };

      try {
        this.ws.send(frame, { binary: true });
      } catch {
        this.ws.close();
      }
    });
  }

  _resolve(id, data) {
    const pending = this._pending.get(id);
    if (pending) {
      this._pending.delete(id);
      pending.resolve(data);
    }
  }

  _reject(id, err) {
    const pending = this._pending.get(id);
    if (pending) {
      this._pending.delete(id);
      pending.reject(err);
    }
  }

  _onDisconnect(event) {
    this._connected = false;
    this._connecting = false;
    this._stopPingInterval();
    this._pending.clear();
    this._emit('disconnected', {
      graceful: event.wasClean,
      reason: event.reason,
      code: event.code,
    });

    if (this.options.autoReconnect && this._reconnectAttempts < this.options.maxReconnectAttempts) {
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    this._clearReconnect();

    this._reconnectAttempts++;
    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(2, this._reconnectAttempts - 1),
      30000
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
    this._pending.clear();
    this.ws = null;
  }

  _startPingInterval() {
    this._stopPingInterval();
    this._pingTimer = setInterval(() => {
      if (this._connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          const frame = Frame.encode(FrameTypes.PING, 0, 0, Buffer.alloc(0));
          this.ws.send(frame, { binary: true });
        } catch {
          // Socket may have closed between checks
        }
      }
    }, this.options.pingInterval);
  }

  _stopPingInterval() {
    if (this._pingTimer) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
  }

  on(event, listener) {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, new Set());
    }
    this._eventListeners.get(event).add(listener);

    // Start ping interval on connect
    if (event === 'connected') {
      this._startPingInterval();
    }

    return this;
  }

  off(event, listener) {
    const listeners = this._eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
    return this;
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
}

module.exports = { Client: BrowserClient };
