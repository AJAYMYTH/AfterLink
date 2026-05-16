# SwiftLink Protocol — Implementation Plan

**Version:** 1.0.0
**Author:** Ajju (Javali Ajayakumar)
**Date:** May 2026
**Status:** Active

---

## Table of Contents

1. [Overview](#1-overview)
2. [Project Structure](#2-project-structure)
3. [Phase 1 — Protocol Core & Node.js MVP](#3-phase-1--protocol-core--nodejs-mvp)
4. [Phase 2 — Developer Experience](#4-phase-2--developer-experience)
5. [Phase 3 — Advanced Features](#5-phase-3--advanced-features)
6. [Phase 4 — Ecosystem & Languages](#6-phase-4--ecosystem--languages)
7. [Day-by-Day Starter Plan (Week 1–4)](#7-day-by-day-starter-plan-week-14)
8. [Code Walkthroughs](#8-code-walkthroughs)
9. [Testing Strategy](#9-testing-strategy)
10. [Deployment Guide](#10-deployment-guide)
11. [Documentation Plan](#11-documentation-plan)
12. [Risk Register](#12-risk-register)

---

## 1. Overview

### What You Are Building

SwiftLink is a custom application-layer binary communication protocol with:
- A binary frame format over TCP / WebSocket
- A Node.js server and client SDK
- A Python SDK
- A CLI tool (`sl`)
- A DevTools browser dashboard
- An HTTP-to-SwiftLink gateway

### Guiding Principles for Implementation

1. **Build the smallest working version first.** Get REQUEST + RESPONSE working over TCP before adding streaming, pub/sub, or auth.
2. **Test every layer.** Write unit tests for frame encoding before building the server.
3. **Document as you go.** Write README sections while the code is fresh.
4. **Use real tools.** Don't reinvent wheels — use `msgpackr` for serialization, `zstd` for compression, `jose` for JWT.

---

## 2. Project Structure

### Repository Layout (Monorepo)

```
swiftlink/
├── packages/
│   ├── core/                  — Shared frame codec (used by server + client)
│   │   ├── src/
│   │   │   ├── Frame.js
│   │   │   ├── FrameTypes.js
│   │   │   └── Serializer.js
│   │   └── package.json
│   │
│   ├── server/                — Node.js server SDK
│   │   ├── src/
│   │   │   ├── Server.js
│   │   │   ├── Connection.js
│   │   │   ├── Router.js
│   │   │   ├── Middleware.js
│   │   │   └── PubSubBroker.js
│   │   └── package.json
│   │
│   ├── client/                — Node.js + browser client SDK
│   │   ├── src/
│   │   │   ├── Client.js
│   │   │   ├── PendingRequests.js
│   │   │   └── Reconnect.js
│   │   └── package.json
│   │
│   ├── cli/                   — `sl` command-line tool
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   └── index.js
│   │   └── package.json
│   │
│   ├── gateway/               — HTTP-to-SwiftLink bridge
│   │   └── src/
│   │
│   └── devtools/              — Browser DevTools dashboard (React)
│       ├── src/
│       └── package.json
│
├── sdks/
│   └── python/                — Python SDK
│       └── swiftlink/
│
├── examples/
│   ├── chat-app/
│   ├── file-stream/
│   └── microservice-rpc/
│
├── docs/
│   ├── protocol-spec.md
│   ├── quickstart.md
│   └── api-reference.md
│
├── tests/
│   └── integration/
│
├── pnpm-workspace.yaml
└── README.md
```

---

## 3. Phase 1 — Protocol Core & Node.js MVP

**Duration:** 6 weeks
**Goal:** A working SwiftLink server and client in Node.js. A developer should be able to define a route and call it from a client.

### Milestone 1.1 — Frame Codec (Week 1)

**Deliverables:**
- `Frame.js` — encode and decode binary frames
- `FrameTypes.js` — constants
- `Serializer.js` — MessagePack wrapper
- Unit tests for all frame types

**Implementation Steps:**

**Step 1.1.1 — Set up the monorepo**

```bash
mkdir swiftlink && cd swiftlink
npm init -y
npm install -g pnpm
pnpm init
mkdir -p packages/core/src
```

Create `pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
  - 'sdks/*'
```

**Step 1.1.2 — Implement FrameTypes.js**

```javascript
// packages/core/src/FrameTypes.js
module.exports = {
  REQUEST:       0x01,
  RESPONSE:      0x02,
  STREAM_START:  0x03,
  STREAM_DATA:   0x04,
  STREAM_END:    0x05,
  ERROR:         0x06,
  PING:          0x07,
  PONG:          0x08,
  BROADCAST:     0x09,
  SUBSCRIBE:     0x0A,
  UNSUBSCRIBE:   0x0B,
  PUBLISH:       0x0C,
  CLOSE:         0x0D,
  CLOSE_ACK:     0x0E,
  HELLO:         0x0F,
  HELLO_ACK:     0x10,

  FLAGS: {
    COMPRESSED:   0b10000000,
    ENCRYPTED:    0b01000000,
    FINAL:        0b00100000,
    PRIORITY:     0b00010000,
    ACK_REQUIRED: 0b00001000,
  }
};
```

**Step 1.1.3 — Implement Frame.js**

```javascript
// packages/core/src/Frame.js
const HEADER_SIZE = 10; // 1 type + 1 flags + 4 msgId + 4 length

class Frame {
  static encode(type, flags, messageId, payload) {
    const header = Buffer.allocUnsafe(HEADER_SIZE);
    header.writeUInt8(type,      0);
    header.writeUInt8(flags,     1);
    header.writeUInt32BE(messageId, 2);
    header.writeUInt32BE(payload.length, 6);
    return Buffer.concat([header, payload]);
  }

  static decode(buffer) {
    if (buffer.length < HEADER_SIZE) return null;
    const type      = buffer.readUInt8(0);
    const flags     = buffer.readUInt8(1);
    const messageId = buffer.readUInt32BE(2);
    const length    = buffer.readUInt32BE(6);
    if (buffer.length < HEADER_SIZE + length) return null; // incomplete
    const payload = buffer.slice(HEADER_SIZE, HEADER_SIZE + length);
    return { type, flags, messageId, payload, totalSize: HEADER_SIZE + length };
  }
}

module.exports = Frame;
```

**Step 1.1.4 — Implement Serializer.js**

```javascript
// packages/core/src/Serializer.js
const { pack, unpack } = require('msgpackr');

module.exports = {
  encode: (data) => Buffer.from(pack(data)),
  decode: (buffer) => unpack(buffer),
};
```

**Step 1.1.5 — Install dependencies**

```bash
cd packages/core
pnpm add msgpackr
pnpm add -D vitest
```

**Step 1.1.6 — Write Frame Unit Tests**

```javascript
// packages/core/test/Frame.test.js
import { describe, it, expect } from 'vitest';
import Frame from '../src/Frame.js';
import { REQUEST, RESPONSE } from '../src/FrameTypes.js';

describe('Frame', () => {
  it('encodes and decodes a REQUEST frame', () => {
    const payload = Buffer.from('{"route":"hello"}');
    const encoded = Frame.encode(REQUEST, 0, 1, payload);
    const decoded = Frame.decode(encoded);

    expect(decoded.type).toBe(REQUEST);
    expect(decoded.messageId).toBe(1);
    expect(decoded.payload.toString()).toBe('{"route":"hello"}');
  });

  it('returns null for incomplete buffer', () => {
    const incomplete = Buffer.from([0x01, 0x00]);
    expect(Frame.decode(incomplete)).toBeNull();
  });
});
```

---

### Milestone 1.2 — TCP Server (Week 2)

**Deliverables:**
- `Server.js` with TCP listener
- `Connection.js` with buffer accumulation and frame parsing
- `Router.js` with route registration and dispatch
- HELLO / HELLO_ACK handshake

**Implementation Steps:**

**Step 1.2.1 — FrameAccumulator (handles TCP fragmentation)**

```javascript
// packages/server/src/FrameAccumulator.js
const Frame = require('@swiftlink/core/Frame');

class FrameAccumulator {
  constructor(onFrame) {
    this.buffer = Buffer.alloc(0);
    this.onFrame = onFrame;
  }

  push(data) {
    this.buffer = Buffer.concat([this.buffer, data]);
    while (true) {
      const frame = Frame.decode(this.buffer);
      if (!frame) break;
      this.buffer = this.buffer.slice(frame.totalSize);
      this.onFrame(frame);
    }
  }
}

module.exports = FrameAccumulator;
```

**Step 1.2.2 — Connection.js**

```javascript
class Connection {
  constructor(socket, router) {
    this.socket = socket;
    this.router = router;
    this.session = null;
    this.accumulator = new FrameAccumulator(this._handleFrame.bind(this));
    socket.on('data', data => this.accumulator.push(data));
    socket.on('close', () => this.router.onDisconnect(this));
  }

  _handleFrame(frame) {
    if (frame.type === HELLO && !this.session) {
      this._handleHandshake(frame);
    } else if (this.session) {
      this.router.dispatch(frame, this);
    } else {
      this.sendError('AUTH_REQUIRED', 'Send HELLO first');
      this.socket.destroy();
    }
  }

  send(type, flags, messageId, payload) {
    const frame = Frame.encode(type, flags, messageId, payload);
    this.socket.write(frame);
  }

  sendError(code, message, messageId = 0) {
    const payload = Serializer.encode({ code, message });
    this.send(ERROR, 0, messageId, payload);
  }
}
```

**Step 1.2.3 — Server.js**

```javascript
const net = require('net');

class Server {
  constructor(config = {}) {
    this.config = { port: 4000, ...config };
    this.router = new Router();
    this.connections = new Set();
  }

  on(route, handler, schema = null) {
    this.router.register(route, handler, schema);
    return this;
  }

  use(middleware) {
    this.router.addMiddleware(middleware);
    return this;
  }

  listen(port = this.config.port) {
    this.tcp = net.createServer(socket => {
      const conn = new Connection(socket, this.router);
      this.connections.add(conn);
      socket.on('close', () => this.connections.delete(conn));
    });
    this.tcp.listen(port, () => {
      console.log(`SwiftLink server listening on port ${port}`);
    });
    return this;
  }
}

module.exports = Server;
```

---

### Milestone 1.3 — Client SDK (Week 3)

**Deliverables:**
- `Client.js` with TCP connect and request/response
- `PendingRequests.js` for multiplexing
- Basic `Reconnect.js`

**Step 1.3.1 — Client.js skeleton**

```javascript
const net = require('net');

class Client {
  constructor(url, options = {}) {
    this.url = new URL(url);
    this.options = { timeout: 30000, ...options };
    this.pending = new PendingRequests(this.options.timeout);
    this._msgId = 0;
  }

  _nextId() {
    return (++this._msgId) >>> 0; // 32-bit unsigned wrap
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.connect({
        host: this.url.hostname,
        port: this.url.port
      });
      this.accumulator = new FrameAccumulator(this._handleFrame.bind(this));
      this.socket.on('data', d => this.accumulator.push(d));
      this.socket.once('connect', () => this._doHandshake().then(resolve).catch(reject));
      this.socket.once('error', reject);
    });
  }

  async request(route, body = {}) {
    const id = this._nextId();
    const payload = Serializer.encode({ route, body });
    const frame = Frame.encode(REQUEST, 0, id, payload);
    return new Promise((resolve, reject) => {
      this.pending.add(id, resolve, reject);
      this.socket.write(frame);
    });
  }

  _handleFrame(frame) {
    if (frame.type === RESPONSE) {
      const data = Serializer.decode(frame.payload);
      this.pending.resolve(frame.messageId, data.body);
    } else if (frame.type === ERROR) {
      const err = Serializer.decode(frame.payload);
      this.pending.reject(frame.messageId, Object.assign(new Error(err.message), err));
    }
  }
}
```

---

### Milestone 1.4 — Hello World Example (Week 4)

By the end of Week 4, this should work:

**server.js:**
```javascript
const { Server } = require('@swiftlink/server');

const server = new Server({ port: 4000 });

server.on('ping', async (req, res) => {
  res.send({ message: 'pong', timestamp: Date.now() });
});

server.listen();
console.log('Server running on port 4000');
```

**client.js:**
```javascript
const { Client } = require('@swiftlink/client');

async function main() {
  const client = new Client('swiftlink://localhost:4000');
  await client.connect();

  const result = await client.request('ping', {});
  console.log(result); // { message: 'pong', timestamp: ... }

  await client.disconnect();
}

main();
```

Run it:
```bash
node server.js
# in another terminal
node client.js
```

---

### Milestone 1.5 — CLI `sl` Tool Basic (Weeks 5–6)

```bash
# Init
sl init my-api
# Outputs: scaffolded project in ./my-api/

# Test a route
sl test --host swiftlink://localhost:4000 --route ping
# Outputs: { message: 'pong', timestamp: 1748000000000 }
```

---

## 4. Phase 2 — Developer Experience

**Duration:** Weeks 7–14 (2 months)
**Goal:** Make SwiftLink pleasant and productive to work with.

### Milestone 2.1 — Schema Validation (Week 7–8)

Integrate Zod for automatic schema validation per route:

```javascript
const { z } = require('zod');

server.on('getUser',
  async (req, res) => {
    const user = await db.findById(req.body.id);
    res.send({ user });
  },
  z.object({ id: z.number().int().positive() })  // schema
);
```

If validation fails, SwiftLink automatically sends:
```json
{ "code": "VALIDATION_ERROR", "message": "id: Expected number, received string" }
```

### Milestone 2.2 — Middleware (Week 9)

```javascript
// Auth middleware example
async function authMiddleware(req, next) {
  if (!req.session.userId) {
    throw new AuthError('Not authenticated');
  }
  await next();
}

server.use(authMiddleware);
```

### Milestone 2.3 — Streaming (Weeks 10–11)

First-class streaming:

```javascript
server.stream('getFileLines', async (req, stream) => {
  const file = await fs.open(req.body.path);
  for await (const line of file.readLines()) {
    await stream.write(line);
  }
  await stream.end();
});

// Client
const stream = await client.stream('getFileLines', { path: '/logs/app.log' });
for await (const line of stream) {
  console.log(line);
}
```

### Milestone 2.4 — Auto-Reconnect (Week 12)

Implement the exponential backoff reconnect in `Reconnect.js`. Client emits events:

```javascript
client.on('reconnecting', ({ attempt, delay }) => {
  console.log(`Reconnecting (attempt ${attempt}) in ${delay}ms`);
});
client.on('reconnected', () => {
  console.log('Connection restored');
});
```

### Milestone 2.5 — Python SDK (Weeks 13–14)

```python
import asyncio
from swiftlink import Server, Client

# Server
server = Server(port=4000)

@server.route("ping")
async def ping(req, res):
    await res.send({"message": "pong"})

asyncio.run(server.listen())

# Client
async def main():
    client = Client("swiftlink://localhost:4000")
    await client.connect()
    result = await client.request("ping", {})
    print(result)  # {'message': 'pong'}

asyncio.run(main())
```

---

## 5. Phase 3 — Advanced Features

**Duration:** Weeks 15–22 (2 months)

### Milestone 3.1 — Pub/Sub (Weeks 15–16)

```javascript
// Server
server.on('start', async (req, res) => {
  setInterval(() => {
    server.publish('ticker', { BTC: Math.random() * 70000 });
  }, 1000);
  res.send({ ok: true });
});

// Client
await client.request('start', {});
client.subscribe('ticker', (data) => {
  console.log('BTC price:', data.BTC);
});
```

### Milestone 3.2 — JWT Authentication (Week 17)

```javascript
const server = new Server({
  port: 4000,
  auth: {
    type: 'jwt',
    secret: process.env.JWT_SECRET,
    issuer: 'my-app'
  }
});

// In route handlers, session is available:
server.on('getProfile', async (req, res) => {
  const userId = req.session.sub; // from JWT payload
  const profile = await db.getProfile(userId);
  res.send({ profile });
});
```

### Milestone 3.3 — Rate Limiting (Week 18)

```javascript
const server = new Server({
  port: 4000,
  rateLimit: {
    capacity: 100,          // max tokens in bucket
    refillPerSecond: 10,    // tokens added per second
    perRoute: {
      'uploadFile': { capacity: 5, refillPerSecond: 1 }
    }
  }
});
```

### Milestone 3.4 — HTTP Gateway (Weeks 19–20)

```bash
# Start gateway
sl gateway --target swiftlink://localhost:4000 --port 4080

# Now regular HTTP clients can call SwiftLink routes:
curl -X POST http://localhost:4080/sl/ping
# Returns: {"message":"pong"}
```

### Milestone 3.5 — DevTools Dashboard (Weeks 21–22)

A React app that connects to your SwiftLink server's DevTools API and displays:

- Live connection list with IP and session info
- Message log: route name, latency, payload size, status
- Latency histogram (p50, p95, p99)
- Active subscriptions list
- Manual route tester (like Postman)

---

## 6. Phase 4 — Ecosystem & Languages

**Duration:** Months 7–12

| Month | Deliverable |
|---|---|
| 7 | Go SDK (goroutines, channels) |
| 8 | Rust SDK (tokio async runtime) |
| 9 | Java SDK (netty or virtual threads) |
| 10 | Protocol v1.1 improvements + benchmarks |
| 11 | Official tutorial series (5 projects) |
| 12 | Cloud-hosted DevTools dashboard |

---

## 7. Day-by-Day Starter Plan (Week 1–4)

### Week 1 — Frame Codec

| Day | Task |
|---|---|
| Day 1 | Set up monorepo with pnpm workspaces. Create `packages/core` folder. |
| Day 2 | Write `FrameTypes.js`. Write `Frame.js` encode function. |
| Day 3 | Write `Frame.js` decode function. Handle incomplete buffers. |
| Day 4 | Write `Serializer.js` with msgpackr. Test encode/decode roundtrip. |
| Day 5 | Write unit tests for all frame types. Fix bugs. |
| Day 6 | Add zstd compression to Serializer. Write compression tests. |
| Day 7 | Review, clean code, write core README. |

### Week 2 — TCP Server

| Day | Task |
|---|---|
| Day 8 | Create `packages/server`. Implement `FrameAccumulator.js`. |
| Day 9 | Implement basic `Connection.js` with socket event handlers. |
| Day 10 | Implement `Router.js` — register and dispatch routes. |
| Day 11 | Implement `Server.js` — TCP listener, connection tracking. |
| Day 12 | Implement HELLO / HELLO_ACK handshake. |
| Day 13 | Test server manually using netcat + raw hex frames. |
| Day 14 | Write server integration tests (spawn server, connect socket). |

### Week 3 — Client SDK

| Day | Task |
|---|---|
| Day 15 | Create `packages/client`. Implement `PendingRequests.js`. |
| Day 16 | Implement `Client.js` connect and handshake. |
| Day 17 | Implement `Client.request()` with promise + pending map. |
| Day 18 | Implement `Client.disconnect()` and CLOSE frame. |
| Day 19 | Implement PING/PONG keep-alive in client. |
| Day 20 | Write client unit tests (mock TCP server). |
| Day 21 | Write end-to-end test: server + client together. |

### Week 4 — Integration & CLI Scaffold

| Day | Task |
|---|---|
| Day 22 | Build the "ping / pong" hello world example. |
| Day 23 | Create `packages/cli`. Set up commander.js. |
| Day 24 | Implement `sl init` command with file templates. |
| Day 25 | Implement `sl test` command (connect and send one request). |
| Day 26 | Polish error messages and help text. |
| Day 27 | Write a 5-minute quickstart tutorial in docs/quickstart.md. |
| Day 28 | Demo: build a simple Todo API using SwiftLink. Record it. |

---

## 8. Code Walkthroughs

### 8.1 Complete Working Example — Chat API

**server.js:**
```javascript
const { Server } = require('@swiftlink/server');
const { z } = require('zod');

const server = new Server({ port: 4000 });
const messages = [];

// Route: send a message
server.on('sendMessage',
  async (req, res) => {
    const msg = {
      id: messages.length + 1,
      text: req.body.text,
      from: req.session?.user || 'anonymous',
      at: new Date().toISOString()
    };
    messages.push(msg);
    server.publish('newMessage', msg);  // broadcast to subscribers
    res.send({ ok: true, msg });
  },
  z.object({ text: z.string().min(1).max(500) })
);

// Route: get history
server.on('getHistory', async (req, res) => {
  res.send({ messages: messages.slice(-50) });
});

server.listen(4000);
```

**client.js:**
```javascript
const { Client } = require('@swiftlink/client');

async function main() {
  const client = new Client('swiftlink://localhost:4000');
  await client.connect();

  // Subscribe to new messages
  client.subscribe('newMessage', (msg) => {
    console.log(`[${msg.from}] ${msg.text}`);
  });

  // Get history
  const { messages } = await client.request('getHistory', {});
  console.log('History:', messages);

  // Send a message
  await client.request('sendMessage', { text: 'Hello SwiftLink!' });
}

main().catch(console.error);
```

### 8.2 Streaming File Example

**server.js:**
```javascript
const fs = require('fs');
const readline = require('readline');

server.stream('streamFile', async (req, stream) => {
  const rl = readline.createInterface({
    input: fs.createReadStream(req.body.path)
  });
  for await (const line of rl) {
    await stream.write({ line });
  }
  await stream.end();
});
```

**client.js:**
```javascript
const stream = await client.stream('streamFile', { path: './data.csv' });
let lineCount = 0;
for await (const { line } of stream) {
  lineCount++;
  if (lineCount <= 5) console.log(line);
}
console.log(`Total lines: ${lineCount}`);
```

---

## 9. Testing Strategy

### 9.1 Test Layers

| Layer | Tool | What to Test |
|---|---|---|
| Unit | vitest | Frame encode/decode, Serializer, Router dispatch |
| Integration | vitest + in-process server | Server + Client together, handshake, request/response |
| Protocol | Custom test harness | Raw TCP frames, edge cases, malformed frames |
| Load | autocannon | Throughput and latency under load |
| Security | Manual + jest | Auth failures, oversized payloads, rate limits |

### 9.2 Key Test Cases

- Frame with zero-length payload encodes and decodes correctly
- Frame with maximum payload (16MB) does not crash
- Incomplete frame in buffer does not crash the accumulator
- Two concurrent requests from the same client return the right responses
- Auto-reconnect triggers after server disconnect
- Schema validation rejects invalid payload before handler runs
- Rate limiter blocks after capacity is exceeded
- JWT with expired token is rejected during handshake
- Subscriber receives published message within 50ms

### 9.3 Benchmark Script

```bash
# Run benchmarks
node benchmarks/throughput.js

# Expected output:
# SwiftLink REQUEST/RESPONSE:  112,450 req/s
# HTTP REST (for comparison):   38,200 req/s
# Latency p50: 0.4ms  p99: 2.1ms
```

---

## 10. Deployment Guide

### 10.1 Production Server Setup (Linux)

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# Clone and build
git clone https://github.com/yourname/swiftlink
cd swiftlink
pnpm install
pnpm build

# Start with PM2 for process management
npm install -g pm2
pm2 start packages/server/dist/index.js --name swiftlink-server
pm2 save
pm2 startup
```

### 10.2 Environment Variables

```env
SL_PORT=4000
SL_WS_PORT=4001
SL_JWT_SECRET=your-secret-here
SL_MAX_PAYLOAD_MB=16
SL_RATE_LIMIT_CAPACITY=100
SL_RATE_LIMIT_REFILL=10
SL_TLS_CERT=/etc/ssl/certs/server.pem
SL_TLS_KEY=/etc/ssl/private/server.key
NODE_ENV=production
```

### 10.3 Nginx Reverse Proxy (WebSocket)

```nginx
server {
    listen 443 ssl;
    server_name api.example.com;

    location /swiftlink {
        proxy_pass http://localhost:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
    }
}
```

### 10.4 Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 4000 4001
CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  swiftlink:
    build: .
    ports:
      - "4000:4000"
      - "4001:4001"
    environment:
      - SL_JWT_SECRET=${JWT_SECRET}
      - NODE_ENV=production
    restart: unless-stopped
```

---

## 11. Documentation Plan

### 11.1 Docs Structure

```
docs/
├── quickstart.md          — 5-minute hello world guide
├── concepts.md            — Protocol explanation for beginners
├── protocol-spec.md       — Full binary frame specification
├── server-api.md          — Server SDK reference
├── client-api.md          — Client SDK reference
├── middleware.md          — How to write middleware
├── streaming.md           — Streaming guide
├── pubsub.md              — Pub/Sub guide
├── auth.md                — Authentication guide
├── cli.md                 — CLI tool reference
├── gateway.md             — HTTP Gateway setup
├── devtools.md            — DevTools dashboard guide
├── examples/
│   ├── chat-app.md
│   ├── file-streaming.md
│   └── microservice-rpc.md
└── contributing.md
```

### 11.2 Quickstart Content (docs/quickstart.md summary)

1. Install: `npm install @swiftlink/server @swiftlink/client`
2. Create server with one route (10 lines)
3. Create client and call the route (8 lines)
4. Run both — see the response
5. Link to next steps: schema validation, streaming, pub/sub

---

## 12. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| TCP fragmentation bugs | High | High | Thorough unit tests for FrameAccumulator with random split sizes |
| MessagePack compatibility issues across languages | Medium | Medium | Test all SDKs against the same test vector file |
| Browser WebSocket limitations (no raw TCP) | Certain | Medium | Implement WS transport mode from the start |
| Performance bottleneck in JavaScript | Medium | High | Profile early; use Buffer pooling; offload to worker threads if needed |
| Protocol breaking changes in v1.1 | Low | High | Design version negotiation into the HELLO frame from day 1 |
| Low adoption / discoverability | High | High | Write tutorials, post on Dev.to, submit to Hacker News |
| Security vulnerability in auth implementation | Low | Critical | Use well-tested libraries (jose); write security tests; invite review |
| Scope creep delaying v1 launch | High | Medium | Strict phase boundaries; delay nice-to-haves to Phase 2 |

---

## Appendix A — Dependencies Reference

### Node.js SDK

| Package | Purpose | Install |
|---|---|---|
| msgpackr | MessagePack serialization | `npm i msgpackr` |
| @mongodb-js/zstd | zstd compression | `npm i @mongodb-js/zstd` |
| ws | WebSocket server | `npm i ws` |
| jose | JWT validation | `npm i jose` |
| zod | Schema validation | `npm i zod` |
| commander | CLI argument parsing | `npm i commander` |
| chalk | CLI color output | `npm i chalk` |

### Python SDK

| Package | Purpose | Install |
|---|---|---|
| msgpack | MessagePack | `pip install msgpack` |
| zstandard | zstd compression | `pip install zstandard` |
| websockets | WebSocket client | `pip install websockets` |
| python-jose | JWT | `pip install python-jose` |

---

## Appendix B — Glossary

| Term | Definition |
|---|---|
| Frame | The basic unit of SwiftLink communication. A binary-encoded message with header + payload. |
| Route | A named handler function on the server that responds to REQUEST frames. |
| Session | A per-connection state object containing auth info and metadata. |
| Multiplexing | Sending multiple concurrent requests over one connection using Message IDs. |
| Backpressure | A mechanism to slow the sender when the receiver cannot keep up. |
| Topic | A named pub/sub channel. Clients subscribe; servers or other clients publish. |
| Frame Accumulator | A buffer that assembles complete frames from raw TCP byte streams. |
| Middleware | A function that runs before the route handler to inspect or transform the request. |

---

*Document End — SwiftLink Implementation Plan v1.0*
