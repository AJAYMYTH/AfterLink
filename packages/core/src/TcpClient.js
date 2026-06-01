const net = require('net');
const EventEmitter = require('events');
const Frame = require('./Frame');
const FrameTypes = require('./FrameTypes');
const Serializer = require('./Serializer');

/**
 * TcpClient — a lightweight TCP client for the AfterLink protocol.
 *
 * FIX (Problem 8): @afterlink/core previously exported no Client class,
 * forcing consumers to build raw socket clients from scratch using net.Socket
 * and the low-level Frame utilities. This class encapsulates that boilerplate
 * so testing and custom integrations are straightforward.
 *
 * @example
 * const { TcpClient } = require('@afterlink/core');
 *
 * const client = new TcpClient({ host: 'localhost', port: 4000 });
 * await client.connect({ auth: myJwtToken });
 *
 * const response = await client.request('messages/send', { text: 'hello' });
 * console.log(response); // { status: 'ok', body: { ... } }
 *
 * client.on('disconnect', () => console.log('disconnected'));
 * client.disconnect();
 */
class TcpClient extends EventEmitter {
  /**
   * @param {object} options
   * @param {string} [options.host='localhost']
   * @param {number} [options.port=4000]
   * @param {number} [options.connectTimeout=5000]  ms to wait for HELLO_ACK
   * @param {number} [options.requestTimeout=10000] ms to wait for a RESPONSE
   */
  constructor(options = {}) {
    super();
    this.host = options.host || 'localhost';
    this.port = options.port || 4000;
    this.connectTimeout = options.connectTimeout ?? 5000;
    this.requestTimeout = options.requestTimeout ?? 10000;

    this._socket = null;
    this._buffer = Buffer.alloc(0);
    this._connected = false;
    this._sessionId = null;
    this._msgCounter = 1;
    // Map<messageId, { resolve, reject, timer }>
    this._pending = new Map();
  }

  /**
   * Open the TCP connection and perform the AfterLink HELLO handshake.
   *
   * @param {object} [helloData={}]   Payload sent in the HELLO frame.
   *   Pass `{ auth: '<jwt>' }` for authenticated servers.
   * @returns {Promise<object>}       Resolves with the HELLO_ACK payload.
   */
  connect(helloData = {}) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port });
      this._socket = socket;

      // Timeout if the server never replies with HELLO_ACK.
      const connectTimer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`AfterLink handshake timed out after ${this.connectTimeout}ms`));
      }, this.connectTimeout);

      socket.on('connect', () => {
        // Send HELLO frame.
        const msgId = this._nextMsgId();
        const payload = Serializer.encode({
          version: 'AL/1',
          capabilities: [],
          ...helloData,
        });
        socket.write(Frame.encode(FrameTypes.HELLO, 0, msgId, payload));

        // Wait for HELLO_ACK specifically — handled in _onData below.
        this._pendingHello = { resolve, reject, timer: connectTimer, msgId };
      });

      socket.on('data', (data) => this._onData(data));

      socket.on('close', () => {
        this._connected = false;
        // Reject all pending requests.
        for (const [, pending] of this._pending) {
          clearTimeout(pending.timer);
          pending.reject(new Error('Connection closed'));
        }
        this._pending.clear();
        this.emit('disconnect');
      });

      socket.on('error', (err) => {
        if (this._pendingHello) {
          clearTimeout(this._pendingHello.timer);
          this._pendingHello.reject(err);
          this._pendingHello = null;
        }
        this.emit('error', err);
      });
    });
  }

  /**
   * Send a REQUEST frame and wait for the RESPONSE.
   *
   * @param {string} route      Route path (e.g. 'messages/send')
   * @param {object} [body={}]  Request body.
   * @returns {Promise<object>} Resolves with the response body.
   */
  request(route, body = {}) {
    return new Promise((resolve, reject) => {
      if (!this._connected) {
        return reject(new Error('Not connected — call connect() first'));
      }

      const msgId = this._nextMsgId();
      const payload = Serializer.encode({ route, body });
      this._socket.write(Frame.encode(FrameTypes.REQUEST, 0, msgId, payload));

      const timer = setTimeout(() => {
        this._pending.delete(msgId);
        reject(new Error(`Request to '${route}' timed out after ${this.requestTimeout}ms`));
      }, this.requestTimeout);

      this._pending.set(msgId, { resolve, reject, timer });
    });
  }

  /** Close the connection gracefully. */
  disconnect() {
    if (this._socket && !this._socket.destroyed) {
      this._socket.destroy();
    }
  }

  /** @returns {boolean} Whether the client has an active session. */
  get connected() {
    return this._connected;
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  _nextMsgId() {
    const id = this._msgCounter;
    this._msgCounter = (this._msgCounter + 1) >>> 0; // 32-bit unsigned wrap
    return id;
  }

  _onData(data) {
    this._buffer = Buffer.concat([this._buffer, data]);

    while (this._buffer.length >= Frame.headerSize()) {
      const frame = Frame.decode(this._buffer);
      if (!frame) break; // Incomplete frame — wait for more data.
      this._buffer = this._buffer.slice(frame.totalSize);
      this._handleFrame(frame);
    }
  }

  _handleFrame(frame) {
    switch (frame.type) {
      case FrameTypes.HELLO_ACK: {
        if (this._pendingHello) {
          clearTimeout(this._pendingHello.timer);
          const ackData = Serializer.decode(frame.payload);
          this._sessionId = ackData.session_id;
          this._connected = true;
          this._pendingHello.resolve(ackData);
          this._pendingHello = null;
        }
        break;
      }

      case FrameTypes.RESPONSE: {
        const pending = this._pending.get(frame.messageId);
        if (pending) {
          clearTimeout(pending.timer);
          this._pending.delete(frame.messageId);
          pending.resolve(Serializer.decode(frame.payload));
        }
        break;
      }

      case FrameTypes.ERROR: {
        const pending = this._pending.get(frame.messageId);
        if (pending) {
          clearTimeout(pending.timer);
          this._pending.delete(frame.messageId);
          const errData = Serializer.decode(frame.payload);
          const err = Object.assign(new Error(errData.message || 'AfterLink error'), errData);
          pending.reject(err);
        } else {
          // Unsolicited error (e.g. AUTH_FAILED during handshake).
          if (this._pendingHello) {
            clearTimeout(this._pendingHello.timer);
            const errData = Serializer.decode(frame.payload);
            this._pendingHello.reject(
              Object.assign(new Error(errData.message || 'Handshake failed'), errData)
            );
            this._pendingHello = null;
          }
          this.emit('error', Serializer.decode(frame.payload));
        }
        break;
      }

      case FrameTypes.PING: {
        // Respond to server-initiated PINGs automatically.
        const pongPayload = frame.payload.length > 0
          ? frame.payload
          : Serializer.encode({ timestamp: Date.now() });
        this._socket.write(Frame.encode(FrameTypes.PONG, 0, frame.messageId, pongPayload));
        break;
      }

      case FrameTypes.SERVER_CLOSING: {
        this.emit('closing', Serializer.decode(frame.payload));
        this._socket.destroy();
        break;
      }

      default:
        // Forward unknown frames as events so callers can handle custom types.
        this.emit('frame', frame);
    }
  }
}

module.exports = TcpClient;
