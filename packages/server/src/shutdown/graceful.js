const { Frame, Serializer } = require('@afterlink/core');

const SERVER_CLOSING = 0x11;

class GracefulShutdown {
  constructor(server, config = {}) {
    this.server = server;
    this.drainTimeout = config.drainTimeout ?? 5000;
    this.reason = config.reason ?? 'planned_restart';
    this.notifyClients = config.notifyClients !== false;
    this._closing = false;
    this._closed = false;
  }

  async initiate() {
    if (this._closing || this._closed) {
      return;
    }

    this._closing = true;

    const activeConnections = this.server.connections;
    const activeRequests = this._countActiveRequests(activeConnections);

    this.server._emit('closing', {
      activeConnections: activeConnections.size,
      activeRequests,
    });

    if (this.notifyClients) {
      this._broadcastClosing(activeConnections);
    }

    const drainStart = Date.now();
    await this._waitForDrain(activeConnections);

    const drainElapsed = Date.now() - drainStart;
    if (drainElapsed >= this.drainTimeout) {
      this.server._emit('drained', { timedOut: true });
    } else {
      this.server._emit('drained', { timedOut: false });
    }

    this._forceCloseRemaining(activeConnections);
    this._closed = true;
    this._closing = false;
  }

  _countActiveRequests(connections) {
    let total = 0;
    for (const conn of connections) {
      total += conn._activeRequests?.size ?? 0;
    }
    return total;
  }

  _broadcastClosing(connections) {
    const payload = Serializer.encode({
      drainTimeout: this.drainTimeout,
      reason: this.reason,
    });

    for (const conn of connections) {
      try {
        conn.send(SERVER_CLOSING, 0, 0, payload);
      } catch {
        // Ignore send errors during shutdown
      }
    }
  }

  async _waitForDrain(connections) {
    const deadline = Date.now() + this.drainTimeout;

    while (Date.now() < deadline) {
      const active = this._countActiveRequests(connections);
      if (active === 0) {
        return;
      }
      await this._sleep(100);
    }
  }

  _forceCloseRemaining(connections) {
    for (const conn of connections) {
      conn.destroy();
    }
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = { GracefulShutdown, SERVER_CLOSING };
