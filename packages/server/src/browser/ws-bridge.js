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

      // FIX (Problem 9): Allow connections with no Origin header so that
      // Node.js test clients (which don't set Origin by default) can connect
      // during development. To keep this secure in production, set
      // cors.origins to an explicit list and remove this bypass.
      if (!origin) {
        // If origins list is empty or explicitly allows '*', permit no-origin.
        if (!Array.isArray(cors.origins) || cors.origins.length === 0) {
          return cb(true);
        }
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
    // FIX (Problem 5): user is populated after HELLO auth is validated below.
    user: null,
  };

  // FIX (Problem 6): maintain a persistent binary buffer across all 'message'
  // events so that coalesced TCP frames (e.g. HELLO + REQUEST in one packet)
  // are all decoded correctly instead of silently dropping trailing frames.
  let buffer = Buffer.alloc(0);
  let handshakeComplete = false;

  ws.on('message', async (data) => {
    if (!Buffer.isBuffer(data)) {
      data = Buffer.from(data);
    }

    if (!handshakeComplete) {
      // Accumulate data into the buffer so we can decode the HELLO frame.
      buffer = Buffer.concat([buffer, data]);

      // Try to decode a complete HELLO frame from the buffer.
      const helloFrame = Frame.decode(buffer);
      if (!helloFrame) {
        // Incomplete frame — wait for more data.
        return;
      }

      if (helloFrame.type !== FrameTypes.HELLO) {
        ws.close(1008, 'Send HELLO frame first');
        return;
      }

      // FIX (Problem 6): advance past the HELLO frame so any remaining bytes
      // (e.g. a REQUEST coalesced in the same TCP packet) are preserved and
      // processed below after the handshake is marked complete.
      const remaining = buffer.slice(helloFrame.totalSize);

      try {
        // FIX (Problem 5): parse the auth field from the HELLO payload and
        // verify the JWT so that session.user is populated correctly.
        await handleWsHandshake(helloFrame, ws, session, server.config.auth);
      } catch (err) {
        ws.close(1008, err.message);
        return;
      }

      handshakeComplete = true;

      // FIX (Problem 6): reset the buffer to whatever arrived after the HELLO
      // frame; fall through to the regular frame-processing loop below.
      buffer = remaining;
    } else {
      buffer = Buffer.concat([buffer, data]);
    }

    // Drain all complete frames from the buffer.
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

// FIX (Problem 5): handleWsHandshake is now async and accepts the server auth
// config. It verifies the JWT from the HELLO auth field using dynamic
// import('jose') (fixes the ESM-in-CJS crash), then stores the decoded payload
// on session.user so every downstream route handler has access to it.
async function handleWsHandshake(frame, ws, session, authConfig) {
  const helloData = Serializer.decode(frame.payload);
  session.version = helloData.version || 'AL/1.1';
  session.capabilities = helloData.capabilities || [];

  // Authenticate the connection if the server is configured with JWT auth.
  if (authConfig?.type === 'jwt' && authConfig.secret && helloData.auth) {
    // FIX (Problem 2): use dynamic import() so jose v6 (ESM-only) loads
    // correctly inside this CJS module without crashing.
    const { jwtVerify } = await import('jose');
    const { payload } = await jwtVerify(
      helloData.auth,
      new TextEncoder().encode(authConfig.secret)
    );
    // FIX (Problem 5): attach the verified JWT payload as session.user so
    // middleware and route handlers can authorise based on the token claims.
    session.user = payload;
  }

  const ackPayload = Serializer.encode({
    session_id: session.id,
    server_version: 'AL/1.1',
    capabilities: ['streaming', 'pubsub', 'compression'],
    compression: 'none',
  });

  const ackFrame = Frame.encode(FrameTypes.HELLO_ACK, 0, frame.messageId, ackPayload);
  ws.send(ackFrame, { binary: true });
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
  // FIX (Problem 5): pass the fully-populated session (including session.user)
  // into the req object so middleware and route handlers receive user context.
  const req = {
    body,
    session,
    route,
    connection: { session, getRemoteAddress: () => session.remoteAddress },
  };
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
