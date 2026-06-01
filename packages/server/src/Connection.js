const {
  Frame,
  FrameTypes: { HELLO, HELLO_ACK, ERROR, PING, PONG, REQUEST },
  Serializer,
  compression,
  errors: {
    AuthRequiredError,
    AuthFailedError,
    DecompressionFailedError,
    MalformedPayloadError,
    fromError,
  },
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

    // Rate limiting bucket (attached by server if enabled)
    this._rateBucket = null;

    // Active request tracking for graceful shutdown
    this._activeRequests = new Set();

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
      this.sendError('INVALID_FRAME', err.message);
      this.socket.destroy();
    }
  }

  _handleFrame(frame) {
    if (this._closed) return;

    if (frame.type === HELLO && !this.session) {
      this._handleHandshake(frame);
    } else if (frame.type === PING && this.session) {
      // Respond to PING with PONG
      const pongPayload = frame.payload.length > 0 ? frame.payload : Serializer.encode({ timestamp: Date.now() });
      this.send(PONG, 0, frame.messageId, pongPayload);
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
          this.sendError('DECOMPRESSION_FAILED', 'Failed to decompress payload');
          return;
        }
      }

      // Track active requests for graceful shutdown
      if (frame.type === REQUEST) {
        this._activeRequests.add(frame.messageId);
      }

      this.router.dispatch(frame, this).catch((err) => {
        this._activeRequests.delete(frame.messageId);
        this._onError(err);
      });
    } else {
      this.sendError('AUTH_REQUIRED', 'Send HELLO first');
      this.socket.destroy();
    }
  }

  // FIX (Problems 2, 3, 4): _handleHandshake is now async so it can properly
  // await _validateAuth before constructing the session. This prevents a race
  // condition where the JWT promise resolves after session creation, which
  // caused session.user to always be null.
  async _handleHandshake(frame) {
    try {
      const data = Serializer.decode(frame.payload);
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // FIX (Problem 4): await the auth validation so the JWT payload is
      // available before we build this.session below.
      if (this.options.auth && data.auth) {
        await this._validateAuth(data.auth);
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
        // FIX (Problem 3): store the decoded JWT payload as session.user so
        // authenticated routes can access req.session.user.
        user: this._jwtPayload || null,
      };

      const ackPayload = Serializer.encode({
        session_id: sessionId,
        server_version: 'AL/1.1',
        capabilities: ['streaming', 'pubsub', 'compression', 'rate-limit'],
        compression: agreedAlgorithm,
        rateLimit: this.options.rateLimit?.enabled
          ? {
              requestsPerSecond: this.options.rateLimit.requestsPerSecond,
              burstSize: this.options.rateLimit.burstSize,
            }
          : undefined,
      });
      this.send(HELLO_ACK, 0, frame.messageId, ackPayload);
    } catch (err) {
      if (err instanceof AuthFailedError) {
        this.sendError(err.code, err.message);
      } else {
        this.sendError('AUTH_FAILED', err.message);
      }
      this.socket.destroy();
    }
  }

  // FIX (Problem 2): _validateAuth is now async and uses dynamic import('jose')
  // instead of require('jose'). jose v6+ is an ESM-only package — synchronous
  // CJS require() crashes with ERR_REQUIRE_ESM (or ReferenceError: TextEncoder
  // is not defined on older Node). Dynamic import() works correctly in both
  // CJS and ESM contexts.
  //
  // FIX (Problem 3): the decoded payload is stored on this._jwtPayload so
  // _handleHandshake can attach it to session.user after awaiting this method.
  async _validateAuth(token) {
    if (this.options.auth?.type === 'jwt' && this.options.auth.secret) {
      // Dynamic import works for ESM-only packages inside a CJS module.
      const { jwtVerify } = await import('jose');
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(this.options.auth.secret)
      );
      // Store decoded payload so _handleHandshake can attach it to session.user.
      this._jwtPayload = payload;
      return payload;
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

      // Track response sent - remove from active requests
      const { RESPONSE, ERROR } = require('@afterlink/core').FrameTypes;
      if (type === RESPONSE || type === ERROR) {
        this._activeRequests.delete(messageId);
      }
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
