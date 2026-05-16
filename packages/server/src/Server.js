const net = require('net');
const Connection = require('./Connection');
const Router = require('./Router');

class Server {
  constructor(config = {}) {
    this.config = { port: 4000, ...config };
    this.router = new Router();
    this.connections = new Set();
    this.tcp = null;
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
    return new Promise((resolve) => {
      this.tcp = net.createServer((socket) => {
        const conn = new Connection(socket, this.router, {
          auth: this.config.auth,
        });
        this.connections.add(conn);
        socket.on('close', () => this.connections.delete(conn));
      });

      this.tcp.listen(port, () => {
        console.log(`AfterLink server listening on port ${port}`);
        resolve(this);
      });
    });
  }

  close() {
    return new Promise((resolve) => {
      if (this.tcp) {
        for (const conn of this.connections) {
          conn.destroy();
        }
        this.tcp.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  getConnectionCount() {
    return this.connections.size;
  }
}

module.exports = Server;
