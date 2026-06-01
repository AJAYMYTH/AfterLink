
<div align="center">

<img width="1774" height="887" alt="AfterLink README.md File Logo" src="https://github.com/user-attachments/assets/86d02a7b-628b-4096-9784-a63f178643d6" />

# AfterLink

**A custom binary communication protocol for fast, reliable, real-time messaging.**  
Persistent connections · Built-in Pub/Sub · Automatic Zod validation · 10-byte frame

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Code of Conduct](https://img.shields.io/badge/Code%20of%20Conduct-Contributor%20Covenant-purple.svg)](./CODE_OF_CONDUCT.md)
[![Node.js 20+](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Version](https://img.shields.io/npm/v/afterlink.svg)](https://www.npmjs.com/package/afterlink)
[![Downloads](https://img.shields.io/npm/dt/afterlink.svg)](https://www.npmjs.com/package/afterlink)
[![TLS](https://img.shields.io/badge/TLS-1.2%2F1.3-brightgreen.svg)](./CHANGELOG.md)
[![Compression](https://img.shields.io/badge/Compression-zlib%2FBrotli-orange.svg)](./CHANGELOG.md)
[![CLI](https://img.shields.io/badge/CLI-afterlink-yellow.svg)](./docs/cli.md)
[![Browser](https://img.shields.io/badge/Browser-WebSocket-blue.svg)](./docs/browser.md)
[![Agent Skill](https://img.shields.io/badge/Agent_Skill-npx_skills_add-blue)](https://github.com/AJAYMYTH/afterlink-skill)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

[**Docs**](https://afterlinkdocs.vercel.app) · [**npm**](https://www.npmjs.com/package/afterlink) · [**Examples**](./examples) · [**Benchmarks**](./BENCHMARKS.md) · [**Discussions**](https://github.com/AJAYMYTH/AfterLink/discussions) · [**Changelog**](./CHANGELOG.md)

</div>

---

## AI Agent Skill

AfterLink has an official skill for AI coding agents. Install it once and your agent automatically knows how to build AfterLink apps — server setup, pub/sub, streaming, middleware, TLS, browser bridges, testing, and error handling — without reading docs.

```bash
npx skills add AJAYMYTH/afterlink-skill
```

**Supported agents:** Claude Code, Cursor, GitHub Copilot, Windsurf, OpenCode, and 40+ more.

The skill covers 10 task areas: scaffolding servers, pub/sub patterns, streaming, middleware, TLS, WebSocket bridges, health endpoints, rate limiting, project integration, and writing tests.

→ [Skill repository](https://github.com/AJAYMYTH/afterlink-skill) · [skills.sh directory](https://skills.sh)

---

## What is AfterLink?

AfterLink is a **custom application-layer binary communication protocol** built for developers who are tired of HTTP boilerplate. It combines structured request/response, real-time pub/sub, automatic schema validation, and persistent connections — all over a compact **10-byte binary frame**.

It is faster, simpler, and more developer-friendly than HTTP for modern real-time applications. You write 5 lines of code. AfterLink handles the rest.

---

## Why AfterLink?

| Problem with HTTP | AfterLink Solution |
|---|---|
| Verbose text headers add overhead | **10-byte binary header** — 90% smaller |
| Stateless — every request rebuilds context | **Persistent TCP connections** with session state |
| No built-in real-time — need WebSockets separately | **Pub/Sub built-in** — same protocol, same connection |
| No schema validation — manual checks everywhere | **Automatic Zod validation** — invalid payloads rejected before your code runs |
| One connection per request (HTTP/1.1) | **Multiplexing** — hundreds of concurrent requests over one connection |
| No binary support — need base64 workarounds | **Native binary** via MessagePack serialization |
| Complex setup for REST APIs | **5 lines** to spin up a full server with routes |

---

## Feature Comparison

| Feature | AfterLink | HTTP/REST | WebSocket | gRPC | MQTT |
|---|---|---|---|---|---|
| **Setup complexity** | Very Easy | Easy | Medium | Hard | Medium |
| **Binary protocol** | Yes | No | Yes | Yes | Yes |
| **TLS encryption** | Yes | Yes | Yes | Yes | Yes |
| **Payload compression** | zlib/Brotli | gzip | No | Yes | No |
| **Schema validation** | Yes | No | No | Proto only | No |
| **Multiplexing** | Yes | No (HTTP/1.1) | No | Yes | No |
| **Pub/Sub** | Yes | No | No | No | Yes |
| **Streaming** | Yes | SSE only | Manual | Yes | No |
| **Browser support** | Yes (TCP/WS) | Yes | Yes | No | No |
| **Auto-reconnect** | Yes | No | No | No | Yes |
| **Rate limiting** | Yes | No | No | No | No |
| **Graceful shutdown** | Yes | Yes | No | Yes | No |
| **Built-in auth** | Yes (JWT) | No | No | Optional | Optional |
| **CLI tooling** | Yes | curl | No | Limited | Limited |
| **Header overhead** | **10 bytes** | 200–800 bytes | 2–14 bytes | 5–50 bytes | 2–5 bytes |
| **Latency (LAN)** | **< 1ms** | 5–50ms | 1–10ms | 1–5ms | 5–20ms |

---

## npm Packages

| Package | Description | Link |
|---|---|---|
| **`afterlink`** | Meta-package (installs all 3) | [npm](https://www.npmjs.com/package/afterlink) |
| **`@afterlink/core`** | Frame codec, error taxonomy, MessagePack serialization, **TcpClient** | [npm](https://www.npmjs.com/package/@afterlink/core) |
| **`@afterlink/server`** | Server SDK (TCP, routing, pub/sub, health, WS bridge) | [npm](https://www.npmjs.com/package/@afterlink/server) |
| **`@afterlink/client`** | Client SDK (auto-reconnect, subscriptions, TLS) | [npm](https://www.npmjs.com/package/@afterlink/client) |
| **`@afterlink/browser`** | Browser SDK (WebSocket transport, auto-reconnect) | [npm](https://www.npmjs.com/package/@afterlink/browser) |
| **`@afterlink/cli`** | CLI tool (ping, call, inspect, monitor) | [npm](https://www.npmjs.com/package/@afterlink/cli) |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        AfterLink Ecosystem                            │
│                                                                       │
│  ┌──────────┐    ┌──────────┐    ┌────────────────────────────────┐  │
│  │ Browser  │    │  Mobile  │    │   IoT / Microservices           │  │
│  │ (JS SDK) │    │ (Dart)   │    │   (Node.js / Python)           │  │
│  └────┬─────┘    └────┬─────┘    └────────────┬───────────────────┘  │
│       │ WebSocket     │ TCP                    │ TCP                  │
│       └───────────────┼────────────────────────┘                      │
│                       │                                               │
│              ┌────────▼──────────┐                                    │
│              │  AfterLink Server  │                                    │
│              │                    │    ┌──────────────────────────┐   │
│              │  ┌──────────────┐  │    │  Your Backend             │  │
│              │  │ Frame Router │──┼───▶│  (Supabase / Firebase /   │  │
│              │  └──────┬───────┘  │    │   MongoDB / AWS / pg)     │  │
│              │         │          │    └──────────────────────────┘   │
│              │  ┌──────▼───────┐  │                                   │
│              │  │  Middleware  │  │    ┌──────────────────────────┐   │
│              │  └──────┬───────┘  │    │  Pub/Sub Broker           │  │
│              │         │          │    │  (In-process)             │  │
│              │  ┌──────▼───────┐  │    └──────────────────────────┘   │
│              │  │ Route Handler│  │                                    │
│              │  └──────────────┘  │                                    │
│              └────────────────────┘                                    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Installation

```bash
# Install all packages (recommended)
npm install afterlink

# Or install individual packages
npm install @afterlink/core @afterlink/server @afterlink/client
```

**From source:**

```bash
git clone https://github.com/AJAYMYTH/AfterLink.git
cd AfterLink
npm install -g pnpm
pnpm install
```

### Hello World (5 minutes)

**Server** — `server.js`

```js
const { Server } = require('@afterlink/server');

const server = new Server({ port: 4000 });

server.on('ping', async (req, res) => {
  res.send({ message: 'pong', timestamp: Date.now() });
});

server.listen();
```

**Client** — `client.js`

```js
const { Client } = require('@afterlink/client');

async function main() {
  const client = new Client('afterlink://localhost:4000');
  await client.connect();

  const result = await client.request('ping', {});
  console.log(result); // { message: 'pong', timestamp: ... }

  await client.disconnect();
}

main();
```

**Run it:**

```bash
node server.js   # Terminal 1
node client.js   # Terminal 2
```

### TLS/SSL Encryption

```js
// Server with TLS
const { Server, generateDevCerts } = require('@afterlink/server');
const { key, cert } = await generateDevCerts({ commonName: 'my-server' });

const server = new Server({
  port: 4443,
  tls: { enabled: true, key, cert, rejectUnauthorized: false },
});

// Client connects via afterlinks:// scheme
const client = new Client('afterlinks://localhost:4443');
```

### Payload Compression

```js
// Server enables compression
const server = new Server({
  port: 4000,
  compression: { enabled: true, algorithm: 'zlib', threshold: 1024 },
});

// Client opts in
const client = new Client('tcp://localhost:4000', {
  compression: { enabled: true, algorithm: 'zlib' },
});
```

### Rate Limiting

```js
const server = new Server({
  port: 4000,
  rateLimit: {
    enabled: true,
    requestsPerSecond: 100,
    burstSize: 200,
    closeAfterViolations: 10,
  },
});
```

### Graceful Shutdown

```js
const server = new Server({
  port: 4000,
  shutdown: { drainTimeout: 5000, reason: 'planned_restart' },
});

server.handleProcessSignals(); // Auto-handles SIGTERM/SIGINT
await server.listen();
```

---

## Features in Action

### 1. Schema Validation

Invalid payloads are rejected **before** your handler runs:

```js
const { z } = require('zod');

server.on('createUser',
  async (req, res) => {
    const user = await db.create(req.body);
    res.send({ user });
  },
  z.object({
    name: z.string().min(2),
    email: z.string().email(),
    role: z.enum(['user', 'admin']).optional(),
  })
);
```

Client receives automatic error on invalid input:

```json
{ "code": "VALIDATION_ERROR", "message": "String must contain at least 2 character(s)" }
```

### 2. Middleware Chain

Express-style middleware for auth, logging, and rate limiting:

```js
server.use(async (req, next) => {
  if (!req.session?.userId) throw new Error('Not authenticated');
  await next();
});

server.use(async (req, next) => {
  const start = Date.now();
  await next();
  console.log(`[${req.route}] ${Date.now() - start}ms`);
});

// Built-in rate limiting (configured via Server options)
const server = new Server({
  rateLimit: { enabled: true, requestsPerSecond: 100, burstSize: 200 },
});
```

### 3. Real-time Pub/Sub

Broadcast to all subscribers over the same connection:

```js
// Server: publish on event
server.on('sendMessage', async (req, res) => {
  const msg = await db.save(req.body);
  server.publish('chat.newMessage', msg);
  res.send({ ok: true });
});

// Client: subscribe to topic
await client.subscribe('chat.newMessage', (msg) => {
  console.log(`[${msg.from}] ${msg.text}`);
});
```

### 4. Auto-Reconnect

```js
const client = new Client('afterlink://api.example.com', {
  autoReconnect: true,
  maxReconnectAttempts: 10,
  reconnectDelay: 1000,
});

client.on('reconnecting', ({ attempt, delay }) => {
  console.log(`Reconnecting (attempt ${attempt}) in ${delay}ms`);
});

client.on('reconnected', () => console.log('Connection restored'));
```

---

## Protocol Specification

### Binary Frame Format

```
 0               1               2               3
 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7
├───────────────┼───────────────┼───────────────────────────────────┤
│  Frame Type   │     Flags     │         Message ID (4 bytes)      │
├───────────────┴───────────────┴───────────────────────────────────┤
│                    Payload Length (4 bytes)                        │
├───────────────────────────────────────────────────────────────────┤
│                    Payload (MessagePack encoded)                   │
└───────────────────────────────────────────────────────────────────┘
```

| Field | Size | Purpose |
|---|---|---|
| Frame Type | 1 byte | Identifies the frame (REQUEST, RESPONSE, etc.) |
| Flags | 1 byte | Compression, encryption, priority bits |
| Message ID | 4 bytes | Correlates requests with responses (multiplexing) |
| Payload Length | 4 bytes | Size of the payload in bytes |
| Payload | Variable | MessagePack-encoded data |

**Total header: 10 bytes** | **Max payload: 16 MB**

### Frame Types

| Code | Type | Direction | Description |
|---|---|---|---|
| `0x01` | REQUEST | C → S | Client request to a named route |
| `0x02` | RESPONSE | S → C | Server response to a request |
| `0x03` | STREAM_START | S → C | Begin a streaming sequence |
| `0x04` | STREAM_DATA | S → C | A chunk of streamed data |
| `0x05` | STREAM_END | S → C | End of stream |
| `0x06` | ERROR | Both | Error response |
| `0x07` | PING | Both | Keep-alive ping |
| `0x08` | PONG | Both | Keep-alive pong |
| `0x09` | BROADCAST | S → C | Push to all clients |
| `0x0A` | SUBSCRIBE | C → S | Subscribe to a topic |
| `0x0B` | UNSUBSCRIBE | C → S | Unsubscribe from a topic |
| `0x0C` | PUBLISH | Both | Publish message to a topic |
| `0x0D` | CLOSE | Both | Graceful connection close |
| `0x0E` | CLOSE_ACK | Both | Acknowledge close |
| `0x0F` | HELLO | C → S | Initial handshake |
| `0x10` | HELLO_ACK | S → C | Handshake acknowledgment |
| `0x11` | SERVER_CLOSING | S → C | Server shutdown notification |

### Flags Byte

| Bit | Mask | Name | Description |
|---|---|---|---|
| 0 | `0x01` | COMPRESSED | Payload is compressed (zlib/Brotli) |
| 1 | `0x02` | ENCRYPTED | Reserved for future end-to-end encryption |
| 2 | `0x04` | PRIORITY | Reserved for future priority routing |
| 3 | `0x08` | FRAGMENTED | Reserved for future frame fragmentation |
| 4–7 | — | Reserved | Must be 0 |

### Connection Lifecycle

```
Client                              Server
  │                                    │
  │──── TCP Connect ──────────────────▶│
  │──── HELLO Frame ──────────────────▶│
  │    { version: "AL/1.1",            │
  │      auth: <JWT token>,            │
  │      capabilities: [...],          │
  │      compression: "zlib" }         │
  │                                    │
  │◀─── HELLO_ACK Frame ──────────────│
  │    { session_id: "...",            │
  │      server_version: "AL/1.1",     │
  │      compression: "zlib",          │
  │      rateLimit: { rps, burst } }   │
  │                                    │
  │◀──▶  REQUEST / RESPONSE frames     │
  │◀──▶  PUBLISH / SUBSCRIBE frames    │
  │◀──▶  PING / PONG keep-alive        │
  │                                    │
  │──── CLOSE Frame ─────────────────▶│
  │◀─── CLOSE_ACK ────────────────────│
```

---

## Backend-Agnostic

AfterLink is a **communication layer**, not a database. It works with **any** backend:

| Your Backend | SDK | AfterLink Role |
|---|---|---|
| **Supabase** | `@supabase/supabase-js` | Real-time layer + auth gateway |
| **Firebase** | `firebase-admin` | Multi-client sync layer |
| **AWS** | `@aws-sdk/*` | Persistent connection manager |
| **MongoDB** | `mongodb` | Real-time change broadcasting |
| **PostgreSQL** | `pg` | Connection pooling + routing |
| **Custom REST** | `node-fetch` | Protocol upgrade layer |

Switch backends without changing any client code.

---

## Demos

```bash
cd examples/demo-runner
node index.js
```

| Demo | What it Shows |
|---|---|
| `demo-runner` | Interactive showcase — 7 demos in one |
| `demo-chat` | Real-time pub/sub chat app |
| `demo-dashboard` | Live stock price feed |
| `demo-microservice` | CRUD with Zod schema validation |
| `hello-world` | Simple ping/pong starter |
| `tls-example` | TLS server + client with dev certs |
| `compression-example` | zlib/Brotli compression demo |
| `rate-limit-shutdown-example` | Rate limiting + graceful shutdown |
| `browser-example` | Browser WebSocket client + health dashboard |

---

## API Reference

### TcpClient (`@afterlink/core`)

A lightweight Promise-based TCP client — use it for testing, custom integrations,
or any Node.js service that connects to an AfterLink server.

```js
const { TcpClient } = require('@afterlink/core');

const client = new TcpClient({
  host: 'localhost',
  port: 4000,
  connectTimeout: 5000,   // ms to wait for HELLO_ACK
  requestTimeout: 10000,  // ms to wait for RESPONSE
});

// Connect (optionally with JWT auth)
const ack = await client.connect({ auth: process.env.JWT_TOKEN });
console.log(ack.session_id); // 'session_...'

// Make a typed request
const { body } = await client.request('messages/send', { text: 'hello' });

// Listen for events
client.on('disconnect', () => console.log('disconnected'));
client.on('error', (err) => console.error(err));
client.on('closing', ({ reason }) => console.log('server closing:', reason));

client.disconnect();
```

### Server

```js
const server = new Server({
  port: 4000,
  host: '0.0.0.0',
  maxConnections: 10000,
  auth: { type: 'jwt', secret: process.env.JWT_SECRET },
  tls: { enabled: true, key, cert, rejectUnauthorized: false },
  compression: { enabled: true, algorithm: 'zlib', threshold: 1024, level: 6 },
  rateLimit: { enabled: true, requestsPerSecond: 100, burstSize: 200 },
  shutdown: { drainTimeout: 5000, reason: 'planned_restart' },
  health: { enabled: true, port: 4002, token: 'secret', thresholds: {...} },
  browser: { enabled: true, port: 4001, path: '/ws', cors: { origins: '*' } },
});

server.on('routeName', async (req, res) => { ... }, schema);
server.use(async (req, next) => { ... });
server.publish('topic', data);
server.on('closing', ({ activeConnections, activeRequests }) => { ... });
server.on('drained', ({ timedOut }) => { ... });
server.on('closed', () => { ... });
server.handleProcessSignals(); // Auto-handles SIGTERM/SIGINT
await server.listen();
await server.close();           // Graceful shutdown (async)
await server.close({ force: true }); // Force close (skip drain)
server.getConnectionCount();
server.getRouteCount();
server.getStats();              // { connections, requests, uptime, routes }
server.isTLS();
```

### Client

```js
const client = new Client('afterlinks://localhost:4000', {
  timeout: 30000,
  autoReconnect: true,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  pingInterval: 30000,
  compression: { enabled: true, algorithm: 'zlib', level: 6, threshold: 1024 },
  tls: { ca: fs.readFileSync('./ca.cert'), rejectUnauthorized: true },
});

await client.connect();
const result = await client.request('route', { body });
await client.subscribe('topic', handler);
client.publish('topic', data);
client.on('server-closing', ({ drainTimeout, reason }) => { ... });
client.on('disconnected', ({ graceful }) => { ... });
await client.disconnect();
client.isConnected();
client.isTLS();
```

---

## Project Structure

```
AfterLink/
├── packages/
│   ├── core/               # Protocol core (Frame, Serializer, Compression)
│   │   ├── src/codec/      # Compression codec (zlib/Brotli)
│   │   ├── src/errors/     # Error taxonomy (22 typed error classes)
│   │   └── types/          # TypeScript definitions
│   ├── server/             # Server SDK (TCP, Router, Pub/Sub)
│   │   ├── src/middleware/ # Rate limiting middleware
│   │   ├── src/shutdown/   # Graceful shutdown handler
│   │   ├── src/tls/        # Dev certificate generator
│   │   ├── src/health/     # Health endpoint handler
│   │   ├── src/browser/    # WebSocket bridge for browser clients
│   │   └── types/          # TypeScript definitions
│   ├── client/             # Client SDK (TCP, Reconnect, TLS)
│   │   └── types/          # TypeScript definitions
│   ├── browser/            # Browser SDK (WebSocket transport)
│   │   └── types/          # TypeScript definitions
│   └── cli/                # CLI tool (ping, call, inspect, monitor)
│       └── types/          # TypeScript definitions
├── examples/
│   ├── demo-runner/        # Interactive showcase (7 demos)
│   ├── demo-chat/          # Real-time chat app
│   ├── demo-dashboard/     # Stock price dashboard
│   ├── demo-microservice/  # CRUD with validation
│   ├── hello-world/        # Simple ping/pong
│   ├── tls-example/        # TLS server + client demo
│   ├── compression-example/# Compression demo
│   ├── rate-limit-shutdown-example/
│   └── browser-example/    # Browser WebSocket + health dashboard
├── benchmarks/             # Performance benchmarks (vs WebSocket, Socket.IO)
├── docs/                   # Protocol and API documentation
│   ├── cli.md              # CLI reference
│   ├── browser.md          # Browser client guide
│   ├── health.md           # Health endpoint guide
│   └── errors.md           # Error handling guide
├── scripts/                # Release scripts (changelog check)
├── CHANGELOG.md            # Formal versioned changelog
├── install.sh              # Linux/macOS installer
├── install.ps1             # Windows installer
├── DEPLOYMENT.md           # Full deployment guide
├── SECURITY.md             # Security policy
├── BENCHMARKS.md           # Benchmark results and methodology
└── README.md
```

---

## Testing

```bash
# Run all tests (106 tests)
pnpm test

# Individual package tests
pnpm test:core     # 64 tests (Frame, Serializer, Compression, Errors)
pnpm test:server   # 19 tests (Rate Limit, Shutdown, Health)
pnpm test:client   # 6 tests (Client API)
pnpm test:browser  # 9 tests (WebSocket bridge integration)
pnpm test:cli      # 8 tests (CLI integration)

# Integration tests
node test-demos.js

# Demo showcase
cd examples/demo-runner && node index.js
```

---

## Benchmarks

**Environment**: Node.js v24.14.1 · Windows 11 (x64) · 10,000 iterations · localhost

### Latency (Request/Response)

| Library | Avg (ms) | P50 (ms) | P99 (ms) | Throughput |
|---------|----------|----------|----------|------------|
| **AfterLink** | **0.033** | **0.028** | **0.122** | **30,167 msg/s** |
| WebSocket (ws) | 0.058 | 0.037 | 0.199 | 17,054 msg/s |
| Socket.IO | 0.096 | 0.061 | 0.362 | 10,387 msg/s |

**AfterLink is 76.9% faster than WebSocket and 190.4% faster than Socket.IO.**

### Throughput by Payload Size

| Bytes | AfterLink | WebSocket | Socket.IO |
|-------|-----------|-----------|-----------|
| 64 | 15,474 | 16,501 | 9,592 |
| 256 | 10,766 | 13,441 | 8,815 |
| 1,024 | 10,914 | 13,720 | 8,331 |
| 4,096 | 7,450 | 12,959 | 8,736 |
| 16,384 | 4,161 | 5,754 | 3,931 |

See [BENCHMARKS.md](./BENCHMARKS.md) for full methodology and memory usage data.

---

## Performance Targets

| Metric | Target |
|---|---|
| Requests/second (single core) | > 100,000 |
| Round-trip latency (LAN) | < 1ms p50 |
| Memory per idle connection | < 50 KB |
| Frame decode time | < 10 µs |
| Header overhead | 10 bytes |

---

## Security

AfterLink is secure by default. See [SECURITY.md](./SECURITY.md) for full details.

- **Supply Chain Safe:** Minimal dependencies, locked versions, no postinstall scripts
- **Protocol Hardened:** Strict frame validation, buffer limits, and MessagePack deserialization
- **TLS Encryption:** End-to-end encrypted connections with `afterlinks://` scheme
- **Dev Certificates:** `generateDevCerts()` for self-signed certs without external tools
- **Rate Limiting:** Per-connection token-bucket rate limiter prevents abuse
- **JWT Auth:** Built-in JWT validation in HELLO handshake
- **Error Taxonomy:** 22 typed error classes for precise error handling and debugging

```bash
pnpm audit --prod
```

---

## Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full guides.

| Platform | Setup Time | Difficulty |
|---|---|---|
| **PM2** (single server) | 2 min | Easy |
| **Docker** | 5 min | Easy |
| **Railway** | 2 min | Easy |
| **Render** | 3 min | Easy |
| **Fly.io** | 3 min | Easy |
| **AWS EC2** | 5 min | Medium |
| **Kubernetes** | 15 min | Advanced |
| **VPS + Nginx** | 10 min | Medium |

### Quick Start with PM2

```bash
npm install -g pm2
pm2 start server.js --name afterlink
pm2 save && pm2 startup
```

### Quick Start with Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install -g pnpm && pnpm install --prod
EXPOSE 4000
CMD ["node", "server.js"]
```

### Environment Variables

```env
AFTERLINK_PORT=4000
AFTERLINK_HOST=0.0.0.0
AFTERLINK_MAX_CONNECTIONS=10000
AFTERLINK_JWT_SECRET=your-secret
NODE_ENV=production
```

---

## Roadmap

> The following upgrades are planned across three phases. See the [Upgrade Schedule](#upgrade-schedule) below for timeline details.

### ~~Phase 1~~ — v1.1 · Protocol & Stability — **COMPLETE**

| Feature | Description | Status |
|---|---|---|
| **TLS/SSL encryption** | End-to-end encrypted connections via `afterlinks://` | Done |
| **Payload compression** | zlib/Brotli compression on the Flags byte | Done |
| **Rate limiting middleware** | Per-connection token-bucket rate limiter | Done |
| **Graceful shutdown** | Drain active requests, `SERVER_CLOSING` frame | Done |
| **CHANGELOG.md** | Formal versioned changelog | Done |

### ~~Phase 2~~ — v1.2 · Developer Experience — **COMPLETE**

| Feature | Description | Status |
|---|---|---|
| **`afterlink` CLI tool** | `ping`, `call`, `inspect`, `monitor` commands | Done |
| **`@afterlink/browser`** | WebSocket transport with auto-reconnect | Done |
| **TypeScript types** | `.d.ts` for core, server, client, browser, cli | Done |
| **Health check endpoint** | `/__health`, `/__health/live`, `/__health/ready`, `/__health/stats` | Done |
| **Error taxonomy** | 22 typed error classes with `fromError()` and `fromFramePayload()` | Done |

### Phase 3 — v2.0 · Scale & Ecosystem (Weeks 9–16)

| Feature | Description |
|---|---|
| **`@afterlink/cluster`** | Multi-process clustering with shared pub/sub via Redis adapter |
| **`@afterlink/python`** | Python client/server SDK (`pip install afterlink`) |
| **`@afterlink/dart`** | Dart/Flutter client for mobile apps |
| **Protocol v2 frame** | Extended header with routing key + priority field |
| **Metrics & observability** | Prometheus-compatible `/metrics` endpoint + OpenTelemetry tracing |
| **Playground UI** | Browser-based interactive demo at `afterlinkdocs.vercel.app/playground` |

---

## Upgrade Schedule

```
May 2026 ──────────────────────────────────────────────── Aug 2026

Week 1–2    [████] TLS encryption + compression flag
Week 2–3    [████] Rate limiting middleware
Week 3–4    [████] Graceful shutdown + CHANGELOG
Week 5–6    [████] Error taxonomy + TypeScript definitions
Week 6–7    [████] Health endpoint + Browser SDK
Week 7–8    [████] CLI tool + integration tests
Week 9–10   [░░░░] Redis-backed cluster pub/sub
Week 11–12  [░░░░] Python SDK
Week 13–14  [░░░░] Dart/Flutter SDK
Week 15      [░░░░] Protocol v2 frame design + migration guide
Week 16      [░░░░] Prometheus metrics + playground UI launch
```

| Milestone | Target Date | Version | Status |
|---|---|---|---|
| TLS + compression + rate limiting + shutdown | May 2026 | v1.1.0 | Released |
| CLI + browser SDK + TypeScript + health + errors | May 2026 | v1.2.0 | Released |
| JWT auth fixes, TcpClient, ws-bridge hardening | June 2026 | v1.2.1 | Released |
| Cluster + Python + Dart SDKs | August 2026 | v2.0.0 | Planned |
| Metrics, Protocol v2, Playground | August 2026 | v2.0.0 | Planned |

---

## Contributing

Contributions, issues, and feature requests are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) to get started.

Please note that this project is released with a [Contributor Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

**Have a question?** Start a [GitHub Discussion](https://github.com/AJAYMYTH/AfterLink/discussions) — we welcome ideas, Q&A, and project showcases.

---

## Author

**Ajju** (Javali Ajayakumar)  
Diploma in AI & ML · GTTC Magadi, Karnataka  
[GitHub](https://github.com/AJAYMYTH) · [npm](https://www.npmjs.com/~ajaymyth)

---

## License

[MIT](./LICENSE) — Free for personal and commercial use.

---

<div align="center">

**Built with precision. Designed for speed.**

</div>
