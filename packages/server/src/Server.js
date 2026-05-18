const { createServerTransport, isTLSSocket, getTLSInfo } = require('./transport/tls');

const Connection = require('./Connection');
const Router = require('./Router');

class Server {
  constructor(config = {}) {
    this.config = {
      port: 4000,
      host: '0.0.0.0',
      maxConnections: 10000,
      ...config,
    };
    this.router = new Router();
    this.connections = new Set();
    this.transport = null;
    this._listening = false;
    this._tlsEnabled = !!config.tls?.enabled;
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
    });

    // Attach TLS info if available
    if (isTLSSocket(socket)) {
      conn.tlsInfo = getTLSInfo(socket);
    }

    this.connections.add(conn);
    socket.on('close', () => this.connections.delete(conn));
  }

  close() {
    return new Promise((resolve) => {
      if (!this.transport || !this._listening) {
        return resolve();
      }

      this._listening = false;

      for (const conn of this.connections) {
        conn.destroy();
      }

      this.transport.close(() => resolve());
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
}

module.exports = Server;
