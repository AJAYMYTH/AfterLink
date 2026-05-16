const {
  FrameTypes: {
    REQUEST,
    RESPONSE,
    ERROR,
    SUBSCRIBE,
    UNSUBSCRIBE,
    PUBLISH,
  },
  Serializer,
} = require('@afterlink/core');

class Router {
  constructor() {
    this.routes = new Map();
    this.middlewares = [];
    this.pubSubBroker = new PubSubBroker();
  }

  register(route, handler, schema = null) {
    if (typeof handler !== 'function') {
      throw new TypeError(`Handler for route '${route}' must be a function`);
    }
    this.routes.set(route, { handler, schema });
  }

  addMiddleware(middleware) {
    if (typeof middleware !== 'function') {
      throw new TypeError('Middleware must be a function');
    }
    this.middlewares.push(middleware);
  }

  async dispatch(frame, connection) {
    const { type, messageId, payload } = frame;

    switch (type) {
      case REQUEST:
        await this._handleRequest(payload, messageId, connection);
        break;
      case SUBSCRIBE:
        this._handleSubscribe(payload, messageId, connection);
        break;
      case UNSUBSCRIBE:
        this._handleUnsubscribe(payload, messageId, connection);
        break;
      case PUBLISH:
        this._handlePublish(payload, connection);
        break;
      default:
        connection.sendError('PROTOCOL_ERROR', `Unexpected frame type: 0x${type.toString(16)}`, messageId);
    }
  }

  async _handleRequest(payload, messageId, connection) {
    let route, body;
    try {
      const decoded = Serializer.decode(payload);
      route = decoded.route;
      body = decoded.body || {};
    } catch (err) {
      connection.sendError('PROTOCOL_ERROR', 'Invalid request payload', messageId);
      return;
    }

    const routeConfig = this.routes.get(route);
    if (!routeConfig) {
      connection.sendError('ROUTE_NOT_FOUND', `Route '${route}' not found`, messageId);
      return;
    }

    if (routeConfig.schema) {
      try {
        routeConfig.schema.parse(body);
      } catch (err) {
        const message = err.errors?.[0]?.message || err.message;
        connection.sendError('VALIDATION_ERROR', message, messageId);
        return;
      }
    }

    let responseSent = false;
    const req = { body, session: connection.session, route };
    const res = {
      send: (data) => {
        if (responseSent) return;
        responseSent = true;
        try {
          const responsePayload = Serializer.encode({ status: 'ok', body: data });
          connection.send(RESPONSE, 0, messageId, responsePayload);
        } catch (err) {
          connection.sendError('INTERNAL_ERROR', 'Failed to encode response', messageId);
        }
      },
    };

    try {
      await this._runMiddlewares(req, async () => {
        await routeConfig.handler(req, res);
      });
    } catch (err) {
      if (!responseSent) {
        connection.sendError('INTERNAL_ERROR', err.message, messageId);
      }
    }
  }

  async _runMiddlewares(req, next) {
    let index = 0;
    const run = async () => {
      if (index >= this.middlewares.length) {
        return next();
      }
      const middleware = this.middlewares[index++];
      await middleware(req, run);
    };
    await run();
  }

  _handleSubscribe(payload, messageId, connection) {
    let topic;
    try {
      topic = Serializer.decode(payload).topic;
    } catch {
      connection.sendError('PROTOCOL_ERROR', 'Invalid subscribe payload', messageId);
      return;
    }

    if (!topic || typeof topic !== 'string') {
      connection.sendError('VALIDATION_ERROR', 'Topic must be a non-empty string', messageId);
      return;
    }

    this.pubSubBroker.subscribe(topic, connection);
    const ackPayload = Serializer.encode({ topic, sub_id: `s_${Date.now()}` });
    connection.send(RESPONSE, 0, messageId, ackPayload);
  }

  _handleUnsubscribe(payload, messageId, connection) {
    let topic;
    try {
      topic = Serializer.decode(payload).topic;
    } catch {
      connection.sendError('PROTOCOL_ERROR', 'Invalid unsubscribe payload', messageId);
      return;
    }

    this.pubSubBroker.unsubscribe(topic, connection);
    const ackPayload = Serializer.encode({ topic });
    connection.send(RESPONSE, 0, messageId, ackPayload);
  }

  _handlePublish(payload, connection) {
    let topic, data;
    try {
      const decoded = Serializer.decode(payload);
      topic = decoded.topic;
      data = decoded.data;
    } catch {
      return;
    }

    this.pubSubBroker.publish(topic, data, connection);
  }

  publish(topic, data) {
    this.pubSubBroker.publishToAll(topic, data);
  }

  onDisconnect(connection) {
    this.pubSubBroker.cleanupConnection(connection);
  }

  getRouteCount() {
    return this.routes.size;
  }

  getSubscribers(topic) {
    const subs = this.pubSubBroker.topics.get(topic);
    return subs ? subs.size : 0;
  }
}

class PubSubBroker {
  constructor() {
    this.topics = new Map();
  }

  subscribe(topic, connection) {
    if (!this.topics.has(topic)) {
      this.topics.set(topic, new Set());
    }
    this.topics.get(topic).add(connection);
  }

  unsubscribe(topic, connection) {
    const subs = this.topics.get(topic);
    if (subs) {
      subs.delete(connection);
      if (subs.size === 0) {
        this.topics.delete(topic);
      }
    }
  }

  publish(topic, data, excludeConnection) {
    const subs = this.topics.get(topic);
    if (!subs || subs.size === 0) return;

    let payload;
    try {
      payload = Serializer.encode({ topic, data });
    } catch {
      return;
    }

    for (const conn of subs) {
      if (conn !== excludeConnection && conn.isActive()) {
        conn.send(PUBLISH, 0, 0, payload);
      }
    }
  }

  publishToAll(topic, data) {
    const subs = this.topics.get(topic);
    if (!subs || subs.size === 0) return;

    let payload;
    try {
      payload = Serializer.encode({ topic, data });
    } catch {
      return;
    }

    for (const conn of subs) {
      if (conn.isActive()) {
        conn.send(PUBLISH, 0, 0, payload);
      }
    }
  }

  cleanupConnection(connection) {
    for (const [topic, subs] of this.topics) {
      subs.delete(connection);
      if (subs.size === 0) {
        this.topics.delete(topic);
      }
    }
  }
}

module.exports = Router;
