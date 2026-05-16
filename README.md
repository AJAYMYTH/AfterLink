# AfterLink Communication Protocol

**For Reliable and Fast Communication**

AfterLink is a custom application-layer binary communication protocol designed for high-performance, developer-friendly communication between services, clients, and devices.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)

## Features

| Feature | Description |
|---|---|
| **Binary Protocol** | 10-byte frame header with MessagePack serialization |
| **Request/Response** | RPC-style calls with automatic correlation via message IDs |
| **Pub/Sub** | Real-time topic-based publish/subscribe |
| **Schema Validation** | Automatic payload validation with Zod |
| **Middleware** | Express-style middleware chain for auth, logging, rate limiting |
| **Auto-Reconnect** | Exponential backoff with jitter for connection resilience |
| **Multiplexing** | Multiple concurrent requests over a single TCP connection |
| **Keep-Alive** | Built-in PING/PONG for connection health monitoring |

## Quick Start

### Prerequisites

- **Node.js 20+** ([Download](https://nodejs.org/))
- **pnpm** (installed automatically by the install script)

### Installation

**Option 1: Install Script (Recommended)**

```bash
# Windows (PowerShell)
.\install.ps1

# Linux/macOS
bash install.sh
```

**Option 2: Manual Installation**

```bash
# Clone the repository
git clone https://github.com/AJAYMYTH/AfterLink.git
cd AfterLink

# Install pnpm if not already installed
npm install -g pnpm

# Install dependencies
pnpm install
```

### Run the Demo Showcase

The fastest way to see AfterLink in action:

```bash
cd examples/demo-runner
node index.js
```

This runs 7 automated demos showing:
1. Basic Request/Response
2. Schema Validation with Zod
3. Middleware Chain
4. Publish/Subscribe
5. Multiple Topics
6. Error Handling
7. Connection Management

## Demos

### 1. Real-time Chat Application

```bash
# Terminal 1 - Start server
cd examples/demo-chat
node server.js

# Terminal 2 - Client 1
node client.js --name Alice

# Terminal 3 - Client 2
node client.js --name Bob
```

### 2. Stock Price Dashboard

```bash
# Terminal 1 - Server (generates simulated prices)
cd examples/demo-dashboard
node server.js

# Terminal 2 - Client (displays live dashboard)
node client.js
```

### 3. Microservice RPC with Validation

```bash
# Terminal 1 - Server
cd examples/demo-microservice
node server.js

# Terminal 2 - Client (automated CRUD demo)
node client.js
```

## Backend-Agnostic Architecture

AfterLink is a **communication layer**, not a database or backend provider. It works as a universal protocol that sits between your clients and **any** backend service.

### How It Works

```
┌─────────────┐    AfterLink Protocol    ┌──────────────┐    Any Backend
│   Client    │ ────────────────────────▶ │  AfterLink   │ ───────────────▶
│  (Mobile)   │ ◀──────────────────────── │   Server     │ ◀───────────────
├─────────────┤    Binary TCP Frames     ├──────────────┤    Your Choice
│   Client    │ ────────────────────────▶ │  (Routes,    │ ───────────────▶
│  (Browser)  │ ◀──────────────────────── │   Auth,      │ ◀───────────────
├─────────────┤                          │   Pub/Sub)   │
│   Client    │ ────────────────────────▶ │              │ ───────────────▶
│  (Desktop)  │ ◀──────────────────────── │              │ ◀───────────────
└─────────────┘                          └──────────────┘
                                              │
                                              │ Connects to ANY backend:
                                              │
                                              │  • Supabase
                                              │  • InsForge
                                              │  • Firebase
                                              │  • AWS (DynamoDB, RDS, Lambda)
                                              │  • MongoDB / PostgreSQL / MySQL
                                              │  • Custom REST APIs
                                              │  • gRPC services
                                              │  • Redis / NATS / RabbitMQ
                                              ▼
```

### Pattern: AfterLink + Any Backend

```javascript
const { Server } = require('@afterlink/server');

// Import your backend SDK of choice
// const { createClient } = require('@supabase/supabase-js');
// const { InsForge } = require('@insforge/sdk');
// const admin = require('firebase-admin');
// const { DynamoDB } = require('@aws-sdk/client-dynamodb');

const server = new Server({ port: 4000 });

// Example: AfterLink route that calls Supabase
server.on('getUser', async (req, res) => {
  // Replace with your backend call:
  // const { data } = await supabase.from('users').select().eq('id', req.body.id);
  // const user = await insforge.db.get('users', req.body.id);
  // const user = await firebaseDb.collection('users').doc(req.body.id).get();

  res.send({ user: { id: req.body.id, name: 'Example' } });
});

// Example: AfterLink Pub/Sub that broadcasts backend changes
server.on('createOrder', async (req, res) => {
  // const { data } = await supabase.from('orders').insert(req.body);
  // Broadcast to all subscribers
  server.publish('orders.created', data);
  res.send({ order: data });
});

await server.listen();
```

### Supported Backend Providers

| Provider | How to Connect | Use Case |
|---|---|---|
| **Supabase** | `@supabase/supabase-js` | PostgreSQL, Auth, Realtime, Storage |
| **InsForge** | `@insforge/sdk` | Database, Auth, Functions, AI |
| **Firebase** | `firebase-admin` | Firestore, Auth, Cloud Functions |
| **AWS** | `@aws-sdk/*` | DynamoDB, RDS, Lambda, SQS |
| **MongoDB** | `mongodb` | Document database |
| **PostgreSQL** | `pg` | Relational database |
| **Redis** | `ioredis` | Cache, Pub/Sub, Sessions |
| **Custom REST** | `node-fetch` / `axios` | Any HTTP API |

AfterLink does not lock you into any provider. Switch backends without changing your client code.

## Writing Your Own AfterLink Application

### Server

```javascript
const { Server } = require('@afterlink/server');
const { z } = require('zod'); // optional, for validation

const server = new Server({ port: 4000 });

// Simple route
server.on('ping', async (req, res) => {
  res.send({ message: 'pong', timestamp: Date.now() });
});

// Route with schema validation
server.on(
  'createUser',
  async (req, res) => {
    const user = { id: Date.now(), ...req.body };
    res.send({ user });
  },
  z.object({
    name: z.string().min(2),
    email: z.string().email(),
  })
);

// Middleware (runs before every route)
server.use(async (req, next) => {
  const start = Date.now();
  await next();
  console.log(`[LOG] ${req.route} - ${Date.now() - start}ms`);
});

// Publish to a topic (broadcast to subscribers)
server.publish('alerts', { message: 'System update' });

await server.listen();
console.log('Server running on port 4000');
```

### Client

```javascript
const { Client } = require('@afterlink/client');

const client = new Client('afterlink://localhost:4000');

// Connect
await client.connect();

// Request/Response
const result = await client.request('ping', {});
console.log(result.message); // "pong"

// Subscribe to a topic
await client.subscribe('alerts', (data) => {
  console.log('Alert:', data.message);
});

// Publish to a topic
client.publish('chat', { text: 'Hello!' });

// Disconnect
await client.disconnect();
```

## Protocol Specification

### Frame Format

```
 0               1               2               3
 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7
├───────────────┼───────────────┼───────────────────────────────────┤
│  Frame Type   │     Flags     │         Message ID (4 bytes)      │
├───────────────┴───────────────┴───────────────────────────────────┤
│                    Payload Length (4 bytes)                        │
├───────────────────────────────────────────────────────────────────┤
│                    Payload (variable, MessagePack)                 │
└───────────────────────────────────────────────────────────────────┘
```

**Header size:** 10 bytes  
**Max payload:** 16 MB (configurable)  
**Serialization:** MessagePack

### Frame Types

| Code | Type | Direction | Description |
|------|------|-----------|-------------|
| `0x01` | REQUEST | Client → Server | Request to a named route |
| `0x02` | RESPONSE | Server → Client | Response to a request |
| `0x03` | STREAM_START | Server → Client | Begin streaming |
| `0x04` | STREAM_DATA | Server → Client | Stream chunk |
| `0x05` | STREAM_END | Server → Client | End of stream |
| `0x06` | ERROR | Both | Error response |
| `0x07` | PING | Both | Keep-alive ping |
| `0x08` | PONG | Both | Keep-alive pong |
| `0x09` | BROADCAST | Server → Client | Push to all clients |
| `0x0A` | SUBSCRIBE | Client → Server | Subscribe to topic |
| `0x0B` | UNSUBSCRIBE | Client → Server | Unsubscribe from topic |
| `0x0C` | PUBLISH | Both | Publish to topic |
| `0x0D` | CLOSE | Both | Graceful close |
| `0x0E` | CLOSE_ACK | Both | Close acknowledgment |
| `0x0F` | HELLO | Client → Server | Handshake |
| `0x10` | HELLO_ACK | Server → Client | Handshake acknowledgment |

### Connection Lifecycle

```
Client                              Server
  │                                    │
  │──── TCP Connect ──────────────────▶│
  │                                    │
  │──── HELLO Frame ──────────────────▶│
  │    { version: "AL/1",             │
  │      auth: <token>,               │
  │      capabilities: [...] }        │
  │                                    │
  │◀─── HELLO_ACK Frame ──────────────│
  │    { session_id: "...",           │
  │      server_version: "AL/1" }     │
  │                                    │
  │◀──▶  REQUEST / RESPONSE frames     │
  │◀──▶  PUBLISH / SUBSCRIBE frames    │
  │                                    │
  │──── CLOSE Frame ─────────────────▶│
  │◀─── CLOSE_ACK ────────────────────│
```

## Server Configuration

```javascript
const server = new Server({
  port: 4000,                 // TCP port
  host: '0.0.0.0',           // Bind address
  maxConnections: 10000,     // Max concurrent connections
  auth: {                    // Optional JWT auth
    type: 'jwt',
    secret: process.env.JWT_SECRET,
  },
});
```

## Client Configuration

```javascript
const client = new Client('afterlink://localhost:4000', {
  timeout: 30000,            // Request timeout (ms)
  autoReconnect: false,      // Auto-reconnect on disconnect
  maxReconnectAttempts: 5,   // Max reconnect attempts
  reconnectDelay: 1000,      // Initial reconnect delay (ms)
  reconnectMaxDelay: 30000,  // Max reconnect delay (ms)
  pingInterval: 30000,       // PING interval (ms)
  connectTimeout: 5000,      // Connection timeout (ms)
});
```

## Project Structure

```
AfterLink/
├── packages/
│   ├── core/                  # Protocol core
│   │   ├── src/
│   │   │   ├── Frame.js       # Binary frame encode/decode
│   │   │   ├── FrameTypes.js  # Frame type constants
│   │   │   └── Serializer.js  # MessagePack wrapper
│   │   └── test/              # Unit tests
│   ├── server/                # Server SDK
│   │   ├── src/
│   │   │   ├── Server.js      # TCP server
│   │   │   ├── Connection.js  # Per-client connection
│   │   │   ├── Router.js      # Route dispatch + Pub/Sub
│   │   │   └── FrameAccumulator.js
│   └── client/                # Client SDK
│       ├── src/
│       │   ├── Client.js      # TCP client
│       │   └── PendingRequests.js
├── examples/
│   ├── demo-runner/           # Interactive showcase (7 demos)
│   ├── demo-chat/             # Real-time chat app
│   ├── demo-dashboard/        # Stock price dashboard
│   ├── demo-microservice/     # CRUD with validation
│   └── hello-world/           # Simple ping/pong
├── docs/                      # Protocol documentation
├── install.sh                 # Linux/macOS installer
├── install.ps1                # Windows installer
└── README.md
```

## Testing

```bash
# Run all tests
pnpm test

# Run core tests only
cd packages/core && npx vitest run
```

## Production Deployment

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start server
pm2 start server.js --name afterlink-server

# Monitor
pm2 monit

# Save and startup
pm2 save
pm2 startup
```

### Using Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ packages/
RUN npm install -g pnpm && pnpm install --prod
COPY server.js .
EXPOSE 4000
CMD ["node", "server.js"]
```

### Environment Variables

```env
AFTERLINK_PORT=4000
AFTERLINK_HOST=0.0.0.0
AFTERLINK_MAX_CONNECTIONS=10000
AFTERLINK_JWT_SECRET=your-secret-here
NODE_ENV=production
```

## API Reference

### Server

| Method | Description |
|---|---|
| `new Server(config)` | Create a new server instance |
| `server.on(route, handler, schema?)` | Register a route handler |
| `server.use(middleware)` | Add middleware |
| `server.publish(topic, data)` | Publish to all subscribers |
| `server.listen(port?)` | Start listening |
| `server.close()` | Stop the server |
| `server.getConnectionCount()` | Get active connections |
| `server.getRouteCount()` | Get registered routes |

### Client

| Method | Description |
|---|---|
| `new Client(url, options?)` | Create a new client |
| `client.connect()` | Connect to server |
| `client.request(route, body)` | Send a request |
| `client.subscribe(topic, handler)` | Subscribe to a topic |
| `client.unsubscribe(topic)` | Unsubscribe from a topic |
| `client.publish(topic, data)` | Publish to a topic |
| `client.disconnect()` | Disconnect |
| `client.isConnected()` | Check connection status |
| `client.on(event, listener)` | Listen for events |

## Author

**Ajju** (Javali Ajayakumar)

## License

MIT
