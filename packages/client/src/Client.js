const net = require('net');
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
      autoReconnect: true,
      maxReconnectAttempts: 10,
      reconnectDelay: 1000,
      pingInterval: 30000,
      ...options,
    };
    this.pending = new PendingRequests(this.options.timeout);
    this._msgId = 0;
    this._connected = false;
    this._reconnectAttempts = 0;
    this._pingTimer = null;
    this._handlers = new Map();
    this._eventListeners = new Map();
  }

  _nextId() {
    return (++this._msgId) >>> 0;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const port = parseInt(this.url.port, 10) || 4000;
      this.socket = net.connect({
        host: this.url.hostname,
        port,
      });

      this.socket.on('data', (d) => this._handleData(d));
      this.socket.once('connect', () => {
        this._connected = true;
        this._reconnectAttempts = 0;
        this._startPingInterval();
        this._doHandshake().then(resolve).catch(reject);
      });
      this.socket.once('error', (err) => {
        this._connected = false;
        reject(err);
      });
      this.socket.on('close', () => this._onDisconnect());
    });
  }

  async _doHandshake() {
    return new Promise((resolve, reject) => {
      const id = this._nextId();
      const payload = Serializer.encode({
        version: 'AL/1',
        auth: this.options.auth || null,
        capabilities: ['streaming', 'pubsub', 'compression'],
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

      this.socket.write(frame);
    });
  }

  async request(route, body = {}) {
    if (!this._connected) throw new Error('Not connected');

    const id = this._nextId();
    const payload = Serializer.encode({ route, body });
    const frame = Frame.encode(REQUEST, 0, id, payload);

    return new Promise((resolve, reject) => {
      this.pending.add(id, (data) => resolve(data), reject);
      this.socket.write(frame);
    });
  }

  subscribe(topic, handler) {
    if (!this._connected) throw new Error('Not connected');

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
    if (!this._connected) return;

    this._stopPingInterval();
    this.pending.clear();

    return new Promise((resolve) => {
      const id = this._nextId();
      const frame = Frame.encode(CLOSE, 0, id, Buffer.alloc(0));
      this.socket.write(frame);

      const timeout = setTimeout(() => {
        this.socket.destroy();
        resolve();
      }, 2000);

      this.socket.once('close', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  _handleData(data) {
    if (!this.accumulator) {
      this.accumulator = Buffer.alloc(0);
    }
    this.accumulator = Buffer.concat([this.accumulator, data]);

    while (true) {
      const frame = Frame.decode(this.accumulator);
      if (!frame) break;

      this.accumulator = this.accumulator.slice(frame.totalSize);
      this._handleFrame(frame);
    }
  }

  _handleFrame(frame) {
    const { type, messageId, payload } = frame;

    switch (type) {
      case RESPONSE:
      case HELLO_ACK: {
        const data = Serializer.decode(payload);
        this.pending.resolve(messageId, data);
        break;
      }
      case ERROR: {
        const err = Serializer.decode(payload);
        this.pending.reject(messageId, Object.assign(new Error(err.message), err));
        break;
      }
      case PUBLISH: {
        const { topic, data } = Serializer.decode(payload);
        const handlers = this._handlers.get(topic);
        if (handlers) {
          for (const handler of handlers) {
            handler(data);
          }
        }
        this._emit('message', { topic, data });
        break;
      }
      case PING: {
        const pongFrame = Frame.encode(PONG, 0, 0, Buffer.alloc(0));
        this.socket.write(pongFrame);
        break;
      }
      case PONG:
        break;
      case CLOSE: {
        const ackFrame = Frame.encode(CLOSE_ACK, 0, messageId, Buffer.alloc(0));
        this.socket.write(ackFrame);
        this.socket.end();
        break;
      }
    }
  }

  _startPingInterval() {
    this._stopPingInterval();
    this._pingTimer = setInterval(() => {
      if (this._connected) {
        const frame = Frame.encode(PING, 0, 0, Buffer.alloc(0));
        this.socket.write(frame);
      }
    }, this.options.pingInterval);
  }

  _stopPingInterval() {
    if (this._pingTimer) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
  }

  _onDisconnect() {
    this._connected = false;
    this._stopPingInterval();
    this.pending.clear();
    this._emit('disconnected');

    if (this.options.autoReconnect && this._reconnectAttempts < this.options.maxReconnectAttempts) {
      this._reconnect();
    }
  }

  _reconnect() {
    this._reconnectAttempts++;
    const delay = this.options.reconnectDelay * Math.pow(2, this._reconnectAttempts - 1);
    const jitter = Math.random() * delay * 0.3;

    this._emit('reconnecting', { attempt: this._reconnectAttempts, delay: delay + jitter });

    setTimeout(async () => {
      try {
        await this.connect();
        this._emit('reconnected');
      } catch {
        this._reconnect();
      }
    }, delay + jitter);
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
        listener(data);
      }
    }
  }

  isConnected() {
    return this._connected;
  }
}

module.exports = Client;
