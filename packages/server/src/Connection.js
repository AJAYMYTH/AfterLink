const {
  Frame,
  FrameTypes: { HELLO, HELLO_ACK, ERROR },
  Serializer,
} = require('@afterlink/core');
const FrameAccumulator = require('./FrameAccumulator');

class Connection {
  constructor(socket, router, options = {}) {
    this.socket = socket;
    this.router = router;
    this.session = null;
    this.options = options;
    this.accumulator = new FrameAccumulator(this._handleFrame.bind(this));
    this._id = `conn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    socket.on('data', (data) => this.accumulator.push(data));
    socket.on('close', () => this.router.onDisconnect(this));
    socket.on('error', (err) => this._onError(err));
  }

  getId() {
    return this._id;
  }

  _handleFrame(frame) {
    if (frame.type === HELLO && !this.session) {
      this._handleHandshake(frame);
    } else if (this.session) {
      this.router.dispatch(frame, this);
    } else {
      this.sendError('AUTH_REQUIRED', 'Send HELLO first');
      this.socket.destroy();
    }
  }

  _handleHandshake(frame) {
    try {
      const data = Serializer.decode(frame.payload);
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      if (this.options.auth && data.auth) {
        this._validateAuth(data.auth);
      }

      this.session = {
        id: sessionId,
        version: data.version || 'AL/1',
        capabilities: data.capabilities || [],
        connectedAt: new Date().toISOString(),
      };

      const ackPayload = Serializer.encode({
        session_id: sessionId,
        server_version: 'AL/1',
        capabilities: ['streaming', 'pubsub', 'compression'],
      });
      this.send(HELLO_ACK, 0, frame.messageId, ackPayload);
    } catch (err) {
      this.sendError('AUTH_INVALID', err.message);
      this.socket.destroy();
    }
  }

  _validateAuth(token) {
    if (this.options.auth?.type === 'jwt' && this.options.auth.secret) {
      const { jwtVerify } = require('jose');
      return jwtVerify(token, new TextEncoder().encode(this.options.auth.secret));
    }
  }

  send(type, flags, messageId, payload) {
    const frame = Frame.encode(type, flags, messageId, payload);
    this.socket.write(frame);
  }

  sendError(code, message, messageId = 0) {
    const payload = Serializer.encode({ code, message });
    this.send(ERROR, 0, messageId, payload);
  }

  _onError(err) {
    console.error(`Connection ${this._id} error:`, err.message);
  }

  destroy() {
    this.socket.destroy();
  }
}

module.exports = Connection;
