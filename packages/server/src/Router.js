const {
  FrameTypes: {
    REQUEST,
    RESPONSE,
    ERROR,
    STREAM_START,
    STREAM_DATA,
    STREAM_END,
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
    this.routes.set(route, { handler, schema });
  }

  addMiddleware(middleware) {
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
        connection.sendError('PROTOCOL_ERROR', `Unexpected frame type: ${type}`, messageId);
    }
  }

  async _handleRequest(payload, messageId, connection) {
    const { route, body } = Serializer.decode(payload);
    const routeConfig = this.routes.get(route);

    if (!routeConfig) {
      connection.sendError('ROUTE_NOT_FOUND', `Route '${route}' not found`, messageId);
      return;
    }

    if (routeConfig.schema) {
      try {
        routeConfig.schema.parse(body);
      } catch (err) {
        connection.sendError('VALIDATION_ERROR', err.errors?.[0]?.message || err.message, messageId);
        return;
      }
    }

    const req = { body, session: connection.session, route };
    const res = {
      send: (data) => {
        const responsePayload = Serializer.encode({ status: 'ok', body: data });
        connection.send(RESPONSE, 0, messageId, responsePayload);
      },
    };

    try {
      await this._runMiddlewares(req, async () => {
        await routeConfig.handler(req, res);
      });
    } catch (err) {
      connection.sendError('INTERNAL_ERROR', err.message, messageId);
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
    const { topic } = Serializer.decode(payload);
    this.pubSubBroker.subscribe(topic, connection);
    const ackPayload = Serializer.encode({ topic, sub_id: `s_${Date.now()}` });
    connection.send(RESPONSE, 0, messageId, ackPayload);
  }

  _handleUnsubscribe(payload, messageId, connection) {
    const { topic } = Serializer.decode(payload);
    this.pubSubBroker.unsubscribe(topic, connection);
    const ackPayload = Serializer.encode({ topic });
    connection.send(RESPONSE, 0, messageId, ackPayload);
  }

  _handlePublish(payload, connection) {
    const { topic, data } = Serializer.decode(payload);
    this.pubSubBroker.publish(topic, data, connection);
  }

  publish(topic, data) {
    this.pubSubBroker.publishToAll(topic, data);
  }

  onDisconnect(connection) {
    this.pubSubBroker.cleanupConnection(connection);
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
    if (!subs) return;

    const payload = Serializer.encode({ topic, data });
    for (const conn of subs) {
      if (conn !== excludeConnection) {
        conn.send(PUBLISH, 0, 0, payload);
      }
    }
  }

  publishToAll(topic, data) {
    const subs = this.topics.get(topic);
    if (!subs) return;

    const payload = Serializer.encode({ topic, data });
    for (const conn of subs) {
      conn.send(PUBLISH, 0, 0, payload);
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
