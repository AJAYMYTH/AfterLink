const net = require('net');
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
    this.tcp = null;
    this._listening = false;
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

      this.tcp = net.createServer((socket) => {
        if (this.connections.size >= this.config.maxConnections) {
          socket.destroy();
          return;
        }

        socket.setKeepAlive(true, 60000);
        socket.setNoDelay(true);

        const conn = new Connection(socket, this.router, {
          auth: this.config.auth,
        });
        this.connections.add(conn);
        socket.on('close', () => this.connections.delete(conn));
      });

      this.tcp.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${port} is already in use`));
        } else {
          console.error('[AfterLink] Server error:', err.message);
        }
      });

      this.tcp.listen(port, this.config.host, () => {
        this._listening = true;
        console.log(`[AfterLink] Server listening on ${this.config.host}:${port}`);
        resolve(this);
      });
    });
  }

  close() {
    return new Promise((resolve) => {
      if (!this.tcp || !this._listening) {
        return resolve();
      }

      this._listening = false;

      for (const conn of this.connections) {
        conn.destroy();
      }

      this.tcp.close(() => resolve());
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
}

module.exports = Server;
