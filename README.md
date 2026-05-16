<p align="center">
  <img src="logo.png" alt="AfterLink Logo" width="120" height="120">
  <h1 align="center">AfterLink</h1>
  <p align="center">Communication Protocol for Reliable and Fast Communication</p>
  <p align="center">
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
    <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-20+-green.svg" alt="Node.js 20+"></a>
    <a href="https://github.com/AJAYMYTH/AfterLink"><img src="https://img.shields.io/badge/version-1.0.0-orange.svg" alt="Version 1.0.0"></a>
    <a href="https://github.com/AJAYMYTH/AfterLink/actions"><img src="https://img.shields.io/badge/tests-15%2F15%20passing-brightgreen.svg" alt="Tests"></a>
  </p>
</p>

---

## What is AfterLink?

AfterLink is a **custom application-layer binary communication protocol** designed to be a faster, simpler, and more developer-friendly alternative to HTTP for modern applications. It provides structured request/response, real-time pub/sub, automatic schema validation, and persistent connections — all over a compact **10-byte binary frame**.

Built for developers who spend too much time on HTTP boilerplate and want a protocol that just works.

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
| Complex setup for REST APIs | **5 lines** to define a server with routes |

---

## Feature Comparison

| Feature | AfterLink | HTTP/REST | WebSocket | gRPC | MQTT |
|---|:---:|:---:|:---:|:---:|:---:|
| **Setup complexity** | Very Easy | Easy | Medium | Hard | Medium |
| **Binary protocol** | Yes | No | Yes | Yes | Yes |
| **Schema validation** | Built-in | No | No | Proto only | No |
| **Multiplexing** | Yes | No (HTTP/1.1) | No | Yes | No |
| **Pub/Sub** | Built-in | No | No | No | Yes |
| **Streaming** | First-class | SSE only | Manual | Yes | No |
| **Browser support** | Yes (TCP/WS) | Yes | Yes | No | No |
| **Auto-reconnect** | Built-in | No | No | No | Yes |
| **Built-in auth** | Yes (JWT) | No | No | Optional | Optional |
| **CLI tooling** | Yes | curl | No | Limited | Limited |
| **Header overhead** | **10 bytes** | 200-800 bytes | 2-14 bytes | 5-50 bytes | 2-5 bytes |
| **Latency (LAN)** | **< 1ms** | 5-50ms | 1-10ms | 1-5ms | 5-20ms |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AfterLink Ecosystem                       │
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────────────┐   │
│  │ Browser  │    │  Mobile  │    │   IoT / Microservices    │   │
│  │ (JS SDK) │    │ (Dart)   │    │   (Node.js / Python)     │   │
│  └────┬─────┘    └────┬─────┘    └────────────┬─────────────┘   │
│       │ WebSocket     │ TCP                    │ TCP             │
│       └───────────────┼────────────────────────┘                 │
│                       │                                          │
│              ┌────────▼──────────┐                               │
│              │  AfterLink Server  │                               │
│              │                    │                               │
│              │  ┌──────────────┐  │    ┌─────────────────────┐   │
│              │  │ Frame Router │──┼───▶│  Your Backend       │   │
│              │  └──────┬───────┘  │    │  (Supabase,         │   │
│              │         │          │    │   InsForge,          │   │
│              │  ┌──────▼───────┐  │    │   Firebase, AWS,     │   │
│              │  │  Middleware  │  │    │   MongoDB, etc.)     │   │
│              │  └──────┬───────┘  │    └─────────────────────┘   │
│              │         │          │                               │
│              │  ┌──────▼───────┐  │    ┌─────────────────────┐   │
│              │  │ Route Handler│  │    │  Pub/Sub Broker     │   │
│              │  └──────────────┘  │    │  (In-process)       │   │
│              └────────────────────┘    └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/AJAYMYTH/AfterLink.git
cd AfterLink

# Install dependencies
npm install -g pnpm
pnpm install
```

### Hello World (5 minutes)

**Server** — `server.js`
```javascript
const { Server } = require('@afterlink/server');

const server = new Server({ port: 4000 });

server.on('ping', async (req, res) => {
  res.send({ message: 'pong', timestamp: Date.now() });
});

server.listen();
```

**Client** — `client.js`
```javascript
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

```javascript
const { z } = require('zod');

server.on('createUser',
  async (req, res) => {
    // This only runs if validation passes
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

Client receives automatic error:
```json
{ "code": "VALIDATION_ERROR", "message": "String must contain at least 2 character(s)" }
```

### 2. Middleware Chain

Express-style middleware for auth, logging, rate limiting:

```javascript
// Auth middleware
server.use(async (req, next) => {
  if (!req.session?.userId) {
    throw new Error('Not authenticated');
  }
  await next();
});

// Logging middleware
server.use(async (req, next) => {
  const start = Date.now();
  await next();
  console.log(`[${req.route}] ${Date.now() - start}ms`);
});
```

### 3. Real-time Pub/Sub

Broadcast to all subscribers over the same connection:

```javascript
// Server: publish to topic
server.on('sendMessage', async (req, res) => {
  const msg = await db.save(req.body);
  server.publish('chat.newMessage', msg); // Broadcast
  res.send({ ok: true });
});

// Client: subscribe to topic
await client.subscribe('chat.newMessage', (msg) => {
  console.log(`[${msg.from}] ${msg.text}`);
});
```

### 4. Auto-Reconnect

Clients recover from network drops automatically:

```javascript
const client = new Client('afterlink://api.example.com', {
  autoReconnect: true,
  maxReconnectAttempts: 10,
  reconnectDelay: 1000,
});

client.on('reconnecting', ({ attempt, delay }) => {
  console.log(`Reconnecting (attempt ${attempt}) in ${delay}ms`);
});

client.on('reconnected', () => {
  console.log('Connection restored');
});
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
|:----:|:----:|:---------:|:------------|
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
  │                                    │
  │──── HELLO Frame ──────────────────▶│
  │    { version: "AL/1",             │
  │      auth: <JWT token>,           │
  │      capabilities: [...] }        │
  │                                    │
  │◀─── HELLO_ACK Frame ──────────────│
  │    { session_id: "...",           │
  │      server_version: "AL/1" }     │
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

AfterLink is a **communication layer**, not a database. It works with **any** backend provider:

```javascript
const { Server } = require('@afterlink/server');

// Choose YOUR backend — AfterLink doesn't care:
// const supabase = require('@supabase/supabase-js').createClient(url, key);
// const insforge = require('@insforge/sdk').createClient(config);
// const firebase = require('firebase-admin');
// const { DynamoDB } = require('@aws-sdk/client-dynamodb');

const server = new Server({ port: 4000 });

server.on('getUser', async (req, res) => {
  // Call your backend of choice:
  // const { data } = await supabase.from('users').eq('id', req.body.id);
  // const user = await insforge.db.get('users', req.body.id);
  res.send({ user: data });
});

// Broadcast backend changes to all connected clients
server.on('createOrder', async (req, res) => {
  // const { data } = await supabase.from('orders').insert(req.body);
  server.publish('orders.created', data);
  res.send({ order: data });
});

await server.listen();
```

| Your Backend | SDK | AfterLink Role |
|---|---|---|
| **Supabase** | `@supabase/supabase-js` | Real-time layer + auth gateway |
| **InsForge** | `@insforge/sdk` | Fast binary transport + pub/sub |
| **Firebase** | `firebase-admin` | Multi-client sync layer |
| **AWS** | `@aws-sdk/*` | Persistent connection manager |
| **MongoDB** | `mongodb` | Real-time change broadcasting |
| **PostgreSQL** | `pg` | Connection pooling + routing |
| **Custom REST** | `node-fetch` | Protocol upgrade layer |

**Switch backends without changing any client code.**

---

## Demos

Run the interactive showcase to see all features in action:

```bash
cd examples/demo-runner
node index.js
```

| Demo | What it Shows | Command |
|---|---|---|
| **Request/Response** | Basic RPC calls | `examples/demo-runner` |
| **Schema Validation** | Zod validation | `examples/demo-microservice` |
| **Middleware** | Logging, auth chains | `examples/demo-runner` |
| **Pub/Sub** | Real-time broadcast | `examples/demo-chat` |
| **Multiple Topics** | Selective subscriptions | `examples/demo-dashboard` |
| **Error Handling** | Structured errors | `examples/demo-runner` |
| **Connections** | Track active sessions | `examples/demo-runner` |

---

## API Reference

### Server

```javascript
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

```javascript
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
├── install.sh              # Linux/macOS installer
├── install.ps1             # Windows installer
├── LICENSE                 # MIT License
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

## Security

AfterLink is designed to be secure by default. See [SECURITY.md](SECURITY.md) for details.

* **Supply Chain Safe:** Minimal dependencies, locked versions, no postinstall scripts.
* **Protocol Hardened:** Strict frame validation, buffer limits, and MessagePack deserialization.
* **Network Secure:** TLS support, JWT auth, and rate limiting built-in.

To verify your installation:
```bash
pnpm audit --prod
```

## Production Deployment

See the complete [Deployment Guide](DEPLOYMENT.md) for:

| Platform | Time | Difficulty |
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

```bash
docker build -t afterlink-server .
docker run -d -p 4000:4000 afterlink-server
```

### Docker
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

## Performance Targets

| Metric | Target |
|---|---|
| Requests/second (single core) | > 100,000 |
| Round-trip latency (LAN) | < 1ms p50 |
| Memory per idle connection | < 50KB |
| Frame decode time | < 10µs |
| Header overhead | 10 bytes |

---

## Author

**Ajju** (Javali Ajayakumar)

## License

[MIT](LICENSE) — Free for personal and commercial use.

---

<p align="center">
  <sub>Built with precision. Designed for speed.</sub>
</p>
