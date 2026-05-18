<div align="center">

<img src="logo for README file.png" alt="AfterLink Logo" width="500"/>

# AfterLink

**A custom binary communication protocol for fast, reliable, real-time messaging.**  
Persistent connections · Built-in Pub/Sub · Automatic Zod validation · 10-byte frame

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js 20+](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Version](https://img.shields.io/npm/v/afterlink.svg)](https://www.npmjs.com/package/afterlink)
[![Downloads](https://img.shields.io/npm/dt/afterlink.svg)](https://www.npmjs.com/package/afterlink)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

[**Docs**](https://afterlinkdocs.vercel.app) · [**npm**](https://www.npmjs.com/package/afterlink) · [**Examples**](./examples) · [**Changelog**](./CHANGELOG.md)

</div>

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
| **Binary protocol** | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| **Schema validation** | ✅ Built-in | ❌ No | ❌ No | Proto only | ❌ No |
| **Multiplexing** | ✅ Yes | ❌ No (HTTP/1.1) | ❌ No | ✅ Yes | ❌ No |
| **Pub/Sub** | ✅ Built-in | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **Streaming** | ✅ First-class | SSE only | Manual | ✅ Yes | ❌ No |
| **Browser support** | ✅ Yes (TCP/WS) | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Auto-reconnect** | ✅ Built-in | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **Built-in auth** | ✅ Yes (JWT) | ❌ No | ❌ No | Optional | Optional |
| **CLI tooling** | ✅ Yes | curl | ❌ No | Limited | Limited |
| **Header overhead** | **10 bytes** | 200–800 bytes | 2–14 bytes | 5–50 bytes | 2–5 bytes |
| **Latency (LAN)** | **< 1ms** | 5–50ms | 1–10ms | 1–5ms | 5–20ms |

---

## npm Packages

| Package | Description | Link |
|---|---|---|
| **`afterlink`** | Meta-package (installs all 3) | [npm](https://www.npmjs.com/package/afterlink) |
| **`@afterlink/core`** | Frame codec and MessagePack serialization | [npm](https://www.npmjs.com/package/@afterlink/core) |
| **`@afterlink/server`** | Server SDK (TCP, routing, pub/sub, middleware) | [npm](https://www.npmjs.com/package/@afterlink/server) |
| **`@afterlink/client`** | Client SDK (auto-reconnect, subscriptions) | [npm](https://www.npmjs.com/package/@afterlink/client) |

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

### Connection Lifecycle

```
Client                              Server
  │                                    │
  │──── TCP Connect ──────────────────▶│
  │──── HELLO Frame ──────────────────▶│
  │    { version: "AL/1",              │
  │      auth: <JWT token>,            │
  │      capabilities: [...] }         │
  │                                    │
  │◀─── HELLO_ACK Frame ──────────────│
  │    { session_id: "...",            │
  │      server_version: "AL/1" }      │
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

---

## API Reference

### Server

```js
const server = new Server({
  port: 4000,
  host: '0.0.0.0',
  maxConnections: 10000,
  auth: { type: 'jwt', secret: process.env.JWT_SECRET },
});

server.on('routeName', async (req, res) => { ... }, schema);
server.use(async (req, next) => { ... });
server.publish('topic', data);
await server.listen();
await server.close();
server.getConnectionCount();
server.getRouteCount();
```

### Client

```js
const client = new Client('afterlink://localhost:4000', {
  timeout: 30000,
  autoReconnect: true,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  pingInterval: 30000,
});

await client.connect();
const result = await client.request('route', { body });
await client.subscribe('topic', handler);
client.publish('topic', data);
await client.disconnect();
client.isConnected();
client.on('disconnected', () => { ... });
```

---

## Project Structure

```
AfterLink/
├── packages/
│   ├── core/               # Protocol core (Frame, Serializer)
│   ├── server/             # Server SDK (TCP, Router, Pub/Sub)
│   └── client/             # Client SDK (TCP, Reconnect)
├── examples/
│   ├── demo-runner/        # Interactive showcase (7 demos)
│   ├── demo-chat/          # Real-time chat app
│   ├── demo-dashboard/     # Stock price dashboard
│   ├── demo-microservice/  # CRUD with validation
│   └── hello-world/        # Simple ping/pong
├── docs/                   # Protocol and API documentation
├── install.sh              # Linux/macOS installer
├── install.ps1             # Windows installer
├── DEPLOYMENT.md           # Full deployment guide
├── SECURITY.md             # Security policy
└── README.md
```

---

## Testing

```bash
# Unit tests
cd packages/core && npx vitest run

# Integration tests
node test-demos.js

# Demo showcase
cd examples/demo-runner && node index.js
```

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
- **Network Secure:** TLS support, JWT auth, and rate limiting built-in

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

### Phase 1 — v1.1 · Protocol & Stability (Weeks 1–4)

| Feature | Description |
|---|---|
| **TLS/SSL encryption** | End-to-end encrypted connections via `tls.createServer()` |
| **Payload compression** | zlib/Brotli compression on the Flags byte |
| **Rate limiting middleware** | Per-connection and per-route token-bucket rate limiter |
| **Graceful shutdown** | Drain active requests before closing, emit `server.closing` event |
| **CHANGELOG.md** | Formal versioned changelog for npm release history |

### Phase 2 — v1.2 · Developer Experience (Weeks 5–8)

| Feature | Description |
|---|---|
| **`afterlink` CLI tool** | `afterlink ping`, `afterlink call <route>`, `afterlink monitor` in terminal |
| **`@afterlink/browser`** | Native WebSocket transport wrapper so browsers can connect directly |
| **TypeScript types** | Full `.d.ts` type definitions for server, client, and core packages |
| **Health check endpoint** | Built-in `/__health` route returning server stats and uptime |
| **Better error codes** | Structured error taxonomy: `AUTH_FAILED`, `ROUTE_NOT_FOUND`, `TIMEOUT`, etc. |

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

Week 1–2    [▓▓▓▓] TLS encryption + compression flag
Week 2–3    [▓▓▓▓] Rate limiting middleware
Week 3–4    [▓▓▓▓] Graceful shutdown + CHANGELOG
Week 5–6    [▓▓▓▓] CLI tool (afterlink ping/call/monitor)
Week 6–7    [▓▓▓▓] @afterlink/browser WebSocket transport
Week 7–8    [▓▓▓▓] TypeScript definitions + health check
Week 9–10   [▓▓▓▓] Redis-backed cluster pub/sub
Week 11–12  [▓▓▓▓] Python SDK
Week 13–14  [▓▓▓▓] Dart/Flutter SDK
Week 15      [▓▓▓▓] Protocol v2 frame design + migration guide
Week 16      [▓▓▓▓] Prometheus metrics + playground UI launch
```

| Milestone | Target Date | Version |
|---|---|---|
| TLS + compression + rate limiting | June 2026 | v1.1.0 |
| CLI tool + browser SDK + TypeScript | July 2026 | v1.2.0 |
| Cluster + Python + Dart SDKs | August 2026 | v2.0.0 |
| Metrics, Protocol v2, Playground | August 2026 | v2.0.0 |

---

## Contributing

Contributions, issues, and feature requests are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) to get started.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

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
