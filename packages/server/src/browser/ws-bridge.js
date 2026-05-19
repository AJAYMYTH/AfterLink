const http = require('http');
const { Frame, FrameTypes, Serializer, compression } = require('@afterlink/core');

function createWsBridge(server, config) {
  const { port, path = '/ws', cors = { origins: [] } } = config;

  const httpServer = http.createServer((req, res) => {
    if (req.url === path) return;
    res.writeHead(404);
    res.end('Not Found');
  });

  const WebSocketServer = require('ws').WebSocketServer;
  const wss = new WebSocketServer({
    server: httpServer,
    path,
    verifyClient: (info, cb) => {
      if (cors.origins === '*') {
        return cb(true);
      }

      const origin = info.req.headers.origin;
      if (!origin) {
        return cb(false, 403, 'Forbidden');
      }

      if (Array.isArray(cors.origins) && cors.origins.includes(origin)) {
        return cb(true);
      }

      cb(false, 403, 'Forbidden');
    },
  });

  wss.on('connection', (ws, req) => {
    handleWsConnection(ws, req, server);
  });

  wss.on('error', (err) => {
    console.error('[AfterLink] WebSocket bridge error:', err.message);
  });

  httpServer.listen(port, server.config.host, () => {
    console.log(`[AfterLink] WebSocket bridge listening on ${server.config.host}:${port}${path}`);
  });

  return httpServer;
}

function handleWsConnection(ws, req, server) {
  const router = server.router;
  const sessionId = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const session = {
    id: sessionId,
    version: 'AL/1.1',
    capabilities: ['streaming', 'pubsub'],
    connectedAt: new Date().toISOString(),
    remoteAddress: req.socket.remoteAddress || 'unknown',
    compression: 'none',
  };

  let buffer = Buffer.alloc(0);
  let handshakeComplete = false;

  ws.on('message', (data) => {
    if (!Buffer.isBuffer(data)) {
      data = Buffer.from(data);
    }

    if (!handshakeComplete) {
      handleWsHandshake(data, ws, session, (err) => {
        if (err) {
          ws.close(1008, err.message);
          return;
        }
        handshakeComplete = true;
      });
      return;
    }

    buffer = Buffer.concat([buffer, data]);

    while (buffer.length >= 10) {
      const frame = Frame.decode(buffer);
      if (!frame) break;

      buffer = buffer.slice(frame.totalSize);
      handleWsFrame(frame, ws, session, router, server);
    }
  });

  ws.on('close', () => {
    router.onDisconnect({ session, isActive: () => false });
  });

  ws.on('error', (err) => {
    if (err.code !== 'ECONNRESET') {
      console.error(`[AfterLink] WS ${sessionId} error:`, err.message);
    }
  });
}

function handleWsHandshake(data, ws, session, callback) {
  try {
    const frame = Frame.decode(data);
    if (!frame || frame.type !== FrameTypes.HELLO) {
      callback(new Error('Send HELLO frame first'));
      return;
    }

    const helloData = Serializer.decode(frame.payload);
    session.version = helloData.version || 'AL/1.1';
    session.capabilities = helloData.capabilities || [];

    const ackPayload = Serializer.encode({
      session_id: session.id,
      server_version: 'AL/1.1',
      capabilities: ['streaming', 'pubsub', 'compression'],
      compression: 'none',
    });

    const ackFrame = Frame.encode(FrameTypes.HELLO_ACK, 0, frame.messageId, ackPayload);
    ws.send(ackFrame, { binary: true });
    callback(null);
  } catch (err) {
    callback(err);
  }
}

function handleWsFrame(frame, ws, session, router, server) {
  if (frame.type === FrameTypes.REQUEST) {
    handleWsRequest(frame, ws, session, router, server);
  } else if (frame.type === FrameTypes.SUBSCRIBE) {
    handleWsSubscribe(frame, ws, session, router);
  } else if (frame.type === FrameTypes.UNSUBSCRIBE) {
    handleWsUnsubscribe(frame, ws, session, router);
  } else if (frame.type === FrameTypes.PUBLISH) {
    handleWsPublish(frame, ws, session, router);
  } else if (frame.type === FrameTypes.PING) {
    const pongFrame = Frame.encode(FrameTypes.PONG, 0, 0, Buffer.alloc(0));
    ws.send(pongFrame, { binary: true });
  } else {
    const errorPayload = Serializer.encode({
      code: 'UNKNOWN_FRAME_TYPE',
      message: `Frame type 0x${frame.type.toString(16)} not supported over WebSocket`,
    });
    const errorFrame = Frame.encode(FrameTypes.ERROR, 0, frame.messageId, errorPayload);
    ws.send(errorFrame, { binary: true });
  }
}

function handleWsRequest(frame, ws, session, router, server) {
  let route, body;
  try {
    const decoded = Serializer.decode(frame.payload);
    route = decoded.route;
    body = decoded.body || {};
  } catch {
    const errorPayload = Serializer.encode({ code: 'MALFORMED_PAYLOAD', message: 'Invalid request payload' });
    ws.send(Frame.encode(FrameTypes.ERROR, 0, frame.messageId, errorPayload), { binary: true });
    return;
  }

  const routeConfig = router.routes.get(route);
  if (!routeConfig) {
    const errorPayload = Serializer.encode({ code: 'ROUTE_NOT_FOUND', message: `Route '${route}' not found` });
    ws.send(Frame.encode(FrameTypes.ERROR, 0, frame.messageId, errorPayload), { binary: true });
    return;
  }

  if (routeConfig.schema) {
    try {
      routeConfig.schema.parse(body);
    } catch (err) {
      const { ValidationError } = require('@afterlink/core/errors');
      const validationErr = ValidationError.fromZodError(err, { requestId: frame.messageId });
      ws.send(Frame.encode(FrameTypes.ERROR, 0, frame.messageId, Serializer.encode(validationErr.toJSON())), { binary: true });
      return;
    }
  }

  let responseSent = false;
  const req = { body, session, route, connection: { session, getRemoteAddress: () => session.remoteAddress } };
  const res = {
    send: (data) => {
      if (responseSent) return;
      responseSent = true;
      const responsePayload = Serializer.encode({ status: 'ok', body: data });
      ws.send(Frame.encode(FrameTypes.RESPONSE, 0, frame.messageId, responsePayload), { binary: true });
    },
    error: (code, message, details) => {
      if (responseSent) return;
      responseSent = true;
      const errorPayload = Serializer.encode({ code, message, details });
      ws.send(Frame.encode(FrameTypes.ERROR, 0, frame.messageId, errorPayload), { binary: true });
    },
  };

  router._runMiddlewares(req, async () => {
    await routeConfig.handler(req, res);
  }).catch((err) => {
    if (!responseSent) {
      const errorPayload = Serializer.encode({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
      ws.send(Frame.encode(FrameTypes.ERROR, 0, frame.messageId, errorPayload), { binary: true });
    }
  });
}

function handleWsSubscribe(frame, ws, session, router) {
  let topic;
  try {
    topic = Serializer.decode(frame.payload).topic;
  } catch {
    const errorPayload = Serializer.encode({ code: 'MALFORMED_PAYLOAD', message: 'Invalid subscribe payload' });
    ws.send(Frame.encode(FrameTypes.ERROR, 0, frame.messageId, errorPayload), { binary: true });
    return;
  }

  if (!topic || typeof topic !== 'string') {
    const errorPayload = Serializer.encode({ code: 'VALIDATION_ERROR', message: 'Topic must be a non-empty string' });
    ws.send(Frame.encode(FrameTypes.ERROR, 0, frame.messageId, errorPayload), { binary: true });
    return;
  }

  const wsConn = {
    session,
    isActive: () => ws.readyState === 1,
    send: (type, flags, msgId, payload) => {
      ws.send(Frame.encode(type, flags, msgId, payload), { binary: true });
    },
  };

  router.pubSubBroker.subscribe(topic, wsConn);
  const ackPayload = Serializer.encode({ topic, sub_id: `s_${Date.now()}` });
  ws.send(Frame.encode(FrameTypes.RESPONSE, 0, frame.messageId, ackPayload), { binary: true });
}

function handleWsUnsubscribe(frame, ws, session, router) {
  let topic;
  try {
    topic = Serializer.decode(frame.payload).topic;
  } catch {
    return;
  }

  const wsConn = {
    session,
    isActive: () => ws.readyState === 1,
    send: () => {},
  };

  router.pubSubBroker.unsubscribe(topic, wsConn);
  const ackPayload = Serializer.encode({ topic });
  ws.send(Frame.encode(FrameTypes.RESPONSE, 0, frame.messageId, ackPayload), { binary: true });
}

function handleWsPublish(frame, ws, session, router) {
  let topic, data;
  try {
    const decoded = Serializer.decode(frame.payload);
    topic = decoded.topic;
    data = decoded.data;
  } catch {
    return;
  }

  router.pubSubBroker.publish(topic, data);
}

module.exports = { createWsBridge };
