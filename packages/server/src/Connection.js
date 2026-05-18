const {
  Frame,
  FrameTypes: { HELLO, HELLO_ACK, ERROR },
  Serializer,
  compression,
} = require('@afterlink/core');
const FrameAccumulator = require('./FrameAccumulator');

class Connection {
  constructor(socket, router, options = {}) {
    this.socket = socket;
    this.router = router;
    this.session = null;
    this.options = options;
    this._id = `conn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this._closed = false;

    // Compression state (negotiated during handshake)
    this._compression = {
      enabled: false,
      algorithm: 'none',
      level: 6,
      threshold: 1024,
    };

    try {
      this.accumulator = new FrameAccumulator(this._handleFrame.bind(this));
    } catch (err) {
      this._onError(err);
      socket.destroy();
      return;
    }

    socket.on('data', (data) => this._onData(data));
    socket.on('close', () => this._onClose());
    socket.on('error', (err) => this._onError(err));
  }

  getId() {
    return this._id;
  }

  getSession() {
    return this.session;
  }

  getRemoteAddress() {
    return this.socket.remoteAddress || 'unknown';
  }

  _onData(data) {
    if (this._closed) return;
    try {
      this.accumulator.push(data);
    } catch (err) {
      this._onError(err);
      this.sendError('PROTOCOL_ERROR', err.message);
      this.socket.destroy();
    }
  }

  _handleFrame(frame) {
    if (this._closed) return;

    if (frame.type === HELLO && !this.session) {
      this._handleHandshake(frame);
    } else if (this.session) {
      // Decompress incoming frame if compressed
      if (compression.isCompressed(frame.flags)) {
        try {
          frame.payload = compression.decompress(
            frame.payload,
            true,
            this._compression.algorithm
          );
        } catch (err) {
          this.sendError('DECOMPRESSION_ERROR', 'Failed to decompress payload');
          return;
        }
      }
      this.router.dispatch(frame, this).catch((err) => {
        this._onError(err);
      });
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

      // Negotiate compression
      const serverCompression = this.options.compression || {};
      const clientAlgorithm = data.compression || 'none';
      const serverEnabled = serverCompression.enabled !== false;
      const serverAlgorithm = serverCompression.algorithm || 'zlib';

      // Use client's preferred algorithm if server supports it
      let agreedAlgorithm = 'none';
      if (serverEnabled && clientAlgorithm !== 'none') {
        if (clientAlgorithm === serverAlgorithm || clientAlgorithm === 'brotli') {
          agreedAlgorithm = clientAlgorithm;
        } else if (serverAlgorithm !== 'none') {
          agreedAlgorithm = serverAlgorithm;
        }
      }

      this._compression = {
        enabled: agreedAlgorithm !== 'none',
        algorithm: agreedAlgorithm,
        level: serverCompression.level ?? 6,
        threshold: serverCompression.threshold ?? 1024,
      };

      this.session = {
        id: sessionId,
        version: data.version || 'AL/1',
        capabilities: data.capabilities || [],
        connectedAt: new Date().toISOString(),
        remoteAddress: this.getRemoteAddress(),
        compression: agreedAlgorithm,
      };

      const ackPayload = Serializer.encode({
        session_id: sessionId,
        server_version: 'AL/1.1',
        capabilities: ['streaming', 'pubsub', 'compression'],
        compression: agreedAlgorithm,
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
    if (this._closed || this.socket.destroyed) return;
    try {
      // Compress payload if enabled and above threshold
      let finalPayload = payload;
      let finalFlags = flags;
      if (this._compression.enabled && this.session) {
        const { data, compressed } = compression.compress(
          payload,
          this._compression.algorithm,
          this._compression.level,
          this._compression.threshold
        );
        finalPayload = data;
        finalFlags = compression.setCompressedFlag(flags, compressed);
      }

      const frame = Frame.encode(type, finalFlags, messageId, finalPayload);
      this.socket.write(frame);
    } catch (err) {
      this._onError(err);
    }
  }

  sendError(code, message, messageId = 0) {
    if (this._closed || this.socket.destroyed) return;
    try {
      const payload = Serializer.encode({ code, message });
      this.send(ERROR, 0, messageId, payload);
    } catch (err) {
      this._onError(err);
    }
  }

  _onError(err) {
    if (err.code === 'ECONNRESET' || err.code === 'EPIPE') return;
    console.error(`[AfterLink] Connection ${this._id} error:`, err.message);
  }

  _onClose() {
    this._closed = true;
    this.router.onDisconnect(this);
  }

  destroy() {
    this._closed = true;
    if (!this.socket.destroyed) {
      this.socket.destroy();
    }
  }

  isActive() {
    return !this._closed && !this.socket.destroyed && this.session !== null;
  }
}

module.exports = Connection;
