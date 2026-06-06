const net = require('net');
const http = require('http');
const { createServerTransport, isTLSSocket, getTLSInfo } = require('./transport/tls');
const { TokenBucket, createRateLimitMiddleware } = require('./middleware/rate-limit');
const { GracefulShutdown } = require('./shutdown/graceful');
const { handleHealthRequest } = require('./health/handler');
const {
  errors: {
    TLSCertInvalidError,
  },
} = require('@ajaymyth/core');

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
      health: {
        enabled: true,
        path: '/__health',
        include: {
          connections: true,
          memory: true,
          uptime: true,
          routes: true,
          rateLimit: true,
        },
      },
      browser: {
        enabled: false,
        port: 4001,
        path: '/ws',
        cors: {
          origins: [],
        },
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
    if (config.health) {
      this.config.health = { ...this.config.health, ...config.health };
      if (config.health.include) {
        this.config.health.include = { ...this.config.health.include, ...config.health.include };
      }
    }
    if (config.browser) {
      this.config.browser = { ...this.config.browser, ...config.browser };
      if (config.browser.cors) {
        this.config.browser.cors = { ...this.config.browser.cors, ...config.browser.cors };
      }
    }

    this.router = new Router();
    this.connections = new Set();
    this.transport = null;
    this._listening = false;
    this._tlsEnabled = !!config.tls?.enabled;
    this._shutdown = null;
    this._eventListeners = new Map();
    this._state = 'initialized';
    this._startTime = null;
    this._totalRequests = 0;
    this._totalErrors = 0;
    this._latencySum = 0;
    this._healthServer = null;
    this._wsServer = null;

    // Initialize graceful shutdown handler
    this._shutdown = new GracefulShutdown(this, this.config.shutdown);

    // Track route stats
    this._routeStats = new Map();
  }

  on(route, handler, schema = null) {
    this.router.register(route, handler, schema);
    this._routeStats.set(route, { totalCalls: 0, latencySum: 0, errorCount: 0 });
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

      const healthEnabled = this.config.health?.enabled !== false;
      const healthPort = this.config.health?.port;

      // If health has a separate port, start a dedicated HTTP server
      if (healthEnabled && healthPort && healthPort !== port) {
        this._startHealthServer(healthPort, () => {
          this._startTransport(port, resolve, reject);
        });
      } else {
        this._startTransport(port, resolve, reject);
      }

      // Start WebSocket bridge if enabled
      if (this.config.browser?.enabled) {
        this._startWsBridge();
      }
    });
  }

  _startTransport(port, resolve, reject) {
    const healthEnabled = this.config.health?.enabled !== false;
    const hasSeparateHealthPort = this.config.health?.port && this.config.health.port !== port;

    this.transport.on('secureConnection', (socket) => {
      if (healthEnabled && !hasSeparateHealthPort) {
        this._handleIncomingSocket(socket);
      } else {
        this._handleConnection(socket);
      }
    });

    this.transport.on('connection', (socket) => {
      if (this._tlsEnabled) return;
      if (healthEnabled && !hasSeparateHealthPort) {
        this._handleIncomingSocket(socket);
      } else {
        this._handleConnection(socket);
      }
    });

    this.transport.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use`));
      } else if (err.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
        reject(new TLSCertInvalidError(`TLS certificate does not match hostname`));
      } else {
        console.error('[AfterLink] Server error:', err.message);
      }
    });

    this.transport.listen(port, this.config.host, () => {
      this._listening = true;
      this._state = 'running';
      this._startTime = Date.now();
      const proto = this._tlsEnabled ? 'TLS' : 'TCP';
      console.log(`[AfterLink] ${proto} Server listening on ${this.config.host}:${port}`);
      resolve(this);
    });
  }

  _handleIncomingSocket(socket) {
    // Protocol detection: wait for first chunk to determine HTTP vs AfterLink
    socket.once('data', (firstChunk) => {
      // AfterLink HELLO frame type byte is 0x0F — never ASCII 'G' (0x47)
      const isHTTP = firstChunk.length >= 4 && firstChunk.slice(0, 4).toString('ascii') === 'GET ';

      if (isHTTP) {
        const str = firstChunk.toString('ascii', 0, Math.min(firstChunk.length, 256));
        if (str.includes('/__health')) {
          return this._handleHealthSocket(socket, firstChunk);
        }
      }

      // Normal AfterLink TCP handshake — prepend the first chunk
      this._handleConnection(socket, firstChunk);
    });
  }

  _handleHealthSocket(socket, firstChunk) {
    socket.setKeepAlive(true, 60000);
    handleHealthRequest(socket, firstChunk, this, this.config.health, this._state);
  }

  _handleConnection(socket, firstChunk = null) {
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

    // If we already read the first chunk, push it to the accumulator
    if (firstChunk) {
      conn.accumulator.push(firstChunk);
    }

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

    // Track request stats via router hook
    conn._onRequestComplete = (route, latencyMs, isError) => {
      this._totalRequests++;
      this._latencySum += latencyMs;
      if (isError) this._totalErrors++;

      const stats = this._routeStats.get(route);
      if (stats) {
        stats.totalCalls++;
        stats.latencySum += latencyMs;
        if (isError) stats.errorCount++;
      }
    };
  }

  _startHealthServer(port, callback) {
    this._healthServer = http.createServer((req, res) => {
      const healthConfig = this.config.health;

      if (healthConfig.token) {
        const authHeader = req.headers['authorization'] || '';
        if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== healthConfig.token) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid or missing authentication token' }));
          return;
        }
      }

      const path = req.url.split('?')[0];
      const stats = this.getStats();
      const { computeHealthStatus, buildHealthResponse } = require('./health/status');

      const healthInfo = computeHealthStatus(stats, this._state, {
        errorRateThreshold: 0.05,
        connectionUtilizationThreshold: 0.9,
        maxConnections: this.config.maxConnections,
      });

      let body;
      switch (path) {
        case '/__health/live': {
          const alive = this._state === 'running';
          res.writeHead(alive ? 200 : 503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ alive }));
          return;
        }
        case '/__health/ready': {
          const ready = this._state === 'running';
          if (!ready) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'unhealthy', reason: 'Server is shutting down', ready: false }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ready: true }));
          }
          return;
        }
        case '/__health/stats': {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
          res.end(JSON.stringify(stats));
          return;
        }
        case '/__health':
        default: {
          body = buildHealthResponse(stats, healthInfo, healthConfig.include);
          res.writeHead(healthInfo.httpStatus, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          });
          res.end(JSON.stringify(body));
          return;
        }
      }
    });

    this._healthServer.listen(port, this.config.host, () => {
      console.log(`[AfterLink] Health endpoint listening on ${this.config.host}:${port}`);
      callback();
    });

    this._healthServer.on('error', (err) => {
      console.error('[AfterLink] Health server error:', err.message);
    });
  }

  _startWsBridge() {
    try {
      const { createWsBridge } = require('./browser/ws-bridge');
      this._wsServer = createWsBridge(this, this.config.browser);
    } catch (err) {
      console.error('[AfterLink] Failed to start WebSocket bridge:', err.message);
    }
  }

  getStats() {
    const uptime = this._startTime ? (Date.now() - this._startTime) / 1000 : 0;
    const requestsPerSec = uptime > 0 ? this._totalRequests / uptime : 0;
    const avgLatencyMs = this._totalRequests > 0 ? this._latencySum / this._totalRequests : 0;
    const errorRate = this._totalRequests > 0 ? this._totalErrors / this._totalRequests : 0;

    const routes = [];
    for (const [name, stats] of this._routeStats) {
      routes.push({
        name,
        totalCalls: stats.totalCalls,
        avgLatencyMs: stats.totalCalls > 0 ? parseFloat((stats.latencySum / stats.totalCalls).toFixed(2)) : 0,
        errorRate: stats.totalCalls > 0 ? parseFloat((stats.errorCount / stats.totalCalls).toFixed(4)) : 0,
      });
    }

    return {
      uptime: parseFloat(uptime.toFixed(2)),
      connections: this.connections.size,
      maxConnections: this.config.maxConnections,
      totalRequests: this._totalRequests,
      requestsPerSec: parseFloat(requestsPerSec.toFixed(2)),
      avgLatencyMs: parseFloat(avgLatencyMs.toFixed(2)),
      errorRate: parseFloat(errorRate.toFixed(4)),
      routes,
      rateLimit: this.config.rateLimit.enabled
        ? {
            enabled: true,
            requestsPerSecond: this.config.rateLimit.requestsPerSecond,
            burstSize: this.config.rateLimit.burstSize,
          }
        : { enabled: false },
    };
  }

  on(routeOrEvent, handlerOrListener, schema = null) {
    // Check if this is route registration (handler is a function with route pattern)
    if (typeof routeOrEvent === 'string' && typeof handlerOrListener === 'function' && !this._eventListeners.has(routeOrEvent)) {
      this.router.register(routeOrEvent, handlerOrListener, schema);
      this._routeStats.set(routeOrEvent, { totalCalls: 0, latencySum: 0, errorCount: 0 });
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
    this._state = 'closing';

    return new Promise((resolve) => {
      if (!this.transport || !this._listening) {
        this._state = 'closed';
        return resolve();
      }

      this._listening = false;

      // Close health server if separate port
      if (this._healthServer) {
        this._healthServer.close();
      }

      // Close WebSocket bridge
      if (this._wsServer) {
        this._wsServer.close();
      }

      if (options.force) {
        for (const conn of this.connections) {
          conn.destroy();
        }
        this.transport.close(() => {
          this._state = 'closed';
          this._emit('closed');
          resolve();
        });
        return;
      }

      // Graceful shutdown
      this._shutdown.initiate().then(() => {
        this.transport.close(() => {
          this._state = 'closed';
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

  getState() {
    return this._state;
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
