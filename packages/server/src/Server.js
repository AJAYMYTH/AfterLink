const { createServerTransport, isTLSSocket, getTLSInfo } = require('./transport/tls');
const { TokenBucket, createRateLimitMiddleware } = require('./middleware/rate-limit');
const { GracefulShutdown } = require('./shutdown/graceful');

const Connection = require('./Connection');
const Router = require('./Router');

class Server {
  constructor(config = {}) {
    this.config = {
      port: 4000,
      host: '0.0.0.0',
      maxConnections: 10000,
      compression: {
        enabled: false,
        algorithm: 'zlib',
        threshold: 1024,
        level: 6,
      },
      rateLimit: {
        enabled: false,
        requestsPerSecond: 100,
        burstSize: 200,
        closeAfterViolations: null,
        errorMessage: 'Rate limit exceeded. Please slow down.',
        onLimited: null,
      },
      shutdown: {
        drainTimeout: 5000,
        reason: 'planned_restart',
        notifyClients: true,
      },
      ...config,
    };
    // Merge nested configs deeply
    if (config.compression) {
      this.config.compression = { ...this.config.compression, ...config.compression };
    }
    if (config.rateLimit) {
      this.config.rateLimit = { ...this.config.rateLimit, ...config.rateLimit };
    }
    if (config.shutdown) {
      this.config.shutdown = { ...this.config.shutdown, ...config.shutdown };
    }

    this.router = new Router();
    this.connections = new Set();
    this.transport = null;
    this._listening = false;
    this._tlsEnabled = !!config.tls?.enabled;
    this._shutdown = null;
    this._eventListeners = new Map();

    // Initialize graceful shutdown handler
    this._shutdown = new GracefulShutdown(this, this.config.shutdown);
  }

  on(route, handler, schema = null) {
    this.router.register(route, handler, schema);
    return this;
  }

  use(middleware) {
    this.router.addMiddleware(middleware);
    return this;
  }

  publish(topic, data) {
    this.router.publish(topic, data);
    return this;
  }

  listen(port = this.config.port) {
    return new Promise((resolve, reject) => {
      if (this._listening) {
        return reject(new Error('Server is already listening'));
      }

      try {
        this.transport = createServerTransport(this.config);
      } catch (err) {
        return reject(err);
      }

      // Auto-add rate limiting middleware if enabled
      if (this.config.rateLimit.enabled) {
        const rateLimitMiddleware = createRateLimitMiddleware(this.config.rateLimit);
        if (rateLimitMiddleware) {
          this.router.addMiddleware(rateLimitMiddleware);
        }
      }

      this.transport.on('secureConnection', (socket) => {
        this._handleConnection(socket);
      });

      this.transport.on('connection', (socket) => {
        // For TLS servers, skip the raw connection event (handled by secureConnection)
        if (this._tlsEnabled) return;
        this._handleConnection(socket);
      });

      this.transport.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${port} is already in use`));
        } else if (err.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
          const tlsErr = new Error('TLS certificate does not match hostname');
          tlsErr.code = 'TLS_CERT_ERROR';
          reject(tlsErr);
        } else {
          console.error('[AfterLink] Server error:', err.message);
        }
      });

      this.transport.listen(port, this.config.host, () => {
        this._listening = true;
        const proto = this._tlsEnabled ? 'TLS' : 'TCP';
        console.log(`[AfterLink] ${proto} Server listening on ${this.config.host}:${port}`);
        resolve(this);
      });
    });
  }

  _handleConnection(socket) {
    if (this.connections.size >= this.config.maxConnections) {
      socket.destroy();
      return;
    }

    socket.setKeepAlive(true, 60000);
    socket.setNoDelay(true);

    const conn = new Connection(socket, this.router, {
      auth: this.config.auth,
      compression: this.config.compression,
      rateLimit: this.config.rateLimit,
    });

    // Attach rate bucket if rate limiting is enabled
    if (this.config.rateLimit.enabled) {
      const { requestsPerSecond, burstSize } = this.config.rateLimit;
      conn._rateBucket = new TokenBucket(burstSize, requestsPerSecond / 1000);
    }

    // Attach TLS info if available
    if (isTLSSocket(socket)) {
      conn.tlsInfo = getTLSInfo(socket);
    }

    this.connections.add(conn);
    socket.on('close', () => this.connections.delete(conn));
  }

  on(routeOrEvent, handlerOrListener, schema = null) {
    // Check if this is route registration (handler is a function with route pattern)
    if (typeof routeOrEvent === 'string' && typeof handlerOrListener === 'function' && !this._eventListeners.has(routeOrEvent)) {
      // Route registration
      this.router.register(routeOrEvent, handlerOrListener, schema);
      return this;
    }
    
    // Event listener
    const event = routeOrEvent;
    const listener = handlerOrListener;
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, new Set());
    }
    this._eventListeners.get(event).add(listener);
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

  async close(options = {}) {
    return new Promise((resolve) => {
      if (!this.transport || !this._listening) {
        return resolve();
      }

      this._listening = false;

      if (options.force) {
        // Force close - skip drain
        for (const conn of this.connections) {
          conn.destroy();
        }
        this.transport.close(() => {
          this._emit('closed');
          resolve();
        });
        return;
      }

      // Graceful shutdown
      this._shutdown.initiate().then(() => {
        this.transport.close(() => {
          this._emit('closed');
          resolve();
        });
      });
    });
  }

  getConnectionCount() {
    return this.connections.size;
  }

  getRouteCount() {
    return this.router.getRouteCount();
  }

  isListening() {
    return this._listening;
  }

  isTLS() {
    return this._tlsEnabled;
  }

  handleProcessSignals() {
    process.on('SIGTERM', async () => {
      console.log('[AfterLink] SIGTERM received — shutting down gracefully');
      await this.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('[AfterLink] SIGINT received — shutting down gracefully');
      await this.close();
      process.exit(0);
    });

    return this;
  }
}

module.exports = Server;
