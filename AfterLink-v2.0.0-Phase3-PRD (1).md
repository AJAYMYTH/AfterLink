# Product Requirements Document
## AfterLink v2.0.0 — Phase 3: Scale & Ecosystem

---

| Field | Detail |
|---|---|
| **Project** | AfterLink — Binary Communication Protocol |
| **Phase** | Phase 3 of 3 |
| **Version Target** | v2.0.0 |
| **Baseline Version** | v1.2.x (Phase 2 complete) |
| **Author** | Ajju (Javali Ajayakumar) |
| **Repo** | https://github.com/AJAYMYTH/AfterLink |
| **npm** | https://www.npmjs.com/package/afterlink |
| **Docs** | https://afterlinkdocs.vercel.app |
| **Status** | Planning |
| **Target Timeline** | Weeks 9–16 (August 2026) |
| **PRD Version** | 1.0 |
| **Created** | May 2026 |
| **Depends On** | Phase 1 PRD (v1.1.0) · Phase 2 PRD (v1.2.0) |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Background & Motivation](#2-background--motivation)
3. [Scope](#3-scope)
4. [Feature 1 — @afterlink/cluster (Redis-Backed Multi-Process Clustering)](#4-feature-1--afterlinkcluster)
5. [Feature 2 — @afterlink/python (Python Client/Server SDK)](#5-feature-2--afterlinkpython)
6. [Feature 3 — @afterlink/dart (Dart/Flutter Client SDK)](#6-feature-3--afterlinkdart)
7. [Feature 4 — Protocol v2 Frame (Extended Header)](#7-feature-4--protocol-v2-frame)
8. [Feature 5 — Metrics & Observability](#8-feature-5--metrics--observability)
9. [Feature 6 — Playground UI](#9-feature-6--playground-ui)
10. [Protocol Changes (Frame Spec v2)](#10-protocol-changes-frame-spec-v2)
11. [API Changes & Backward Compatibility](#11-api-changes--backward-compatibility)
12. [Package & File Structure Changes](#12-package--file-structure-changes)
13. [Cross-SDK Compatibility Matrix](#13-cross-sdk-compatibility-matrix)
14. [Testing Requirements](#14-testing-requirements)
15. [Documentation Requirements](#15-documentation-requirements)
16. [Implementation Schedule (Week-by-Week)](#16-implementation-schedule-week-by-week)
17. [CHANGELOG Entry for v2.0.0](#17-changelog-entry-for-v200)
18. [Definition of Done](#18-definition-of-done)
19. [Risk & Mitigation](#19-risk--mitigation)

---

## 1. Executive Summary

AfterLink v1.2.x (Phase 2) made AfterLink a joy to develop with — a CLI for testing routes, a browser SDK for frontend apps, full TypeScript types, a health endpoint, and structured errors. The developer experience is excellent for single-server applications.

**v2.0.0 makes AfterLink ready for the world.**

Phase 3 is the **scale and ecosystem release**. It answers three types of questions from three different audiences:

**Operations teams:**
> *"Our traffic peaks at 50,000 concurrent connections — one Node.js process isn't enough. Can AfterLink scale horizontally?"*
→ **`@afterlink/cluster`** — multi-process clustering with Redis-backed shared pub/sub

**Enterprise engineering teams:**
> *"Our backend services are Python. Our mobile apps are Flutter. Can we use AfterLink everywhere?"*
→ **`@afterlink/python`** and **`@afterlink/dart`** — first-party SDKs for the two most requested non-Node.js environments

**Platform engineers and SREs:**
> *"We run Prometheus and Grafana. We need latency histograms, error rates, and distributed traces for our incident dashboards."*
→ **Metrics & Observability** — Prometheus `/metrics` endpoint and OpenTelemetry tracing

**Protocol evolution:**
> *"We need to route traffic to specific backend services and control priority queuing."*
→ **Protocol v2 Frame** — extended 16-byte header with a routing key and priority field

**Developer community:**
> *"I want to try AfterLink before installing anything."*
→ **Playground UI** — browser-based interactive demo, zero setup

This is a **major version release** (`v2.0.0`) because Protocol v2 introduces a non-backward-compatible frame header. The `AL/2` protocol is incompatible with `AL/1.x` frame decoding, though the server supports both versions simultaneously via capability negotiation.

---

## 2. Background & Motivation

### Full State After Phase 2 (v1.2.x)

| Capability | Delivered In |
|---|---|
| 10-byte binary frame, MessagePack, REQUEST/RESPONSE | v1.0.0 |
| Pub/Sub, streaming, JWT auth, Zod validation, auto-reconnect | v1.0.0 |
| TLS/SSL (`afterlinks://`), zlib/Brotli compression | v1.1.0 |
| Per-connection rate limiting, graceful shutdown | v1.1.0 |
| `afterlink` CLI (ping, call, subscribe, monitor, inspect) | v1.2.0 |
| `@afterlink/browser` WebSocket transport | v1.2.0 |
| Full TypeScript `.d.ts` declarations | v1.2.0 |
| `/__health` HTTP endpoint with rolling stats | v1.2.0 |
| Structured `AfterLinkError` with 19 typed codes | v1.2.0 |

### What Phase 3 Must Solve

| Limitation | Who Hits It | Business Cost |
|---|---|---|
| Single Node.js process — vertical scaling only | Any team with > ~50K concurrent connections or multi-core servers | Blocks enterprise adoption |
| Node.js-only ecosystem | Python/ML backends, Flutter mobile developers | Blocks cross-language adoption |
| No Prometheus/Grafana integration | SRE/ops teams in companies running standard monitoring stacks | Blocks production observability |
| 10-byte frame has no routing key or priority | Teams doing microservice message routing or SLA-based priority queuing | Limits advanced use cases |
| No interactive demo | Developers evaluating AfterLink on docs site | Increases time-to-evaluate, increases bounce rate |

### Why v2.0.0 and Not v1.3.0

Protocol v2 changes the binary frame header from 10 bytes to 16 bytes. Any AfterLink `AL/1.x` frame decoder that reads a `AL/2` frame will misinterpret the payload length and corrupt the stream. This is a **wire-breaking change** and therefore requires a major version bump per Semantic Versioning.

The server supports both `AL/1.x` and `AL/2` clients simultaneously. Existing v1.x clients continue working without code changes; they simply don't gain the v2-only features (routing key, priority).

---

## 3. Scope

### In Scope

- **`@afterlink/cluster`** — Node.js clustering (Node.js `cluster` module + Redis adapter for shared pub/sub)
- **`@afterlink/python`** — Python client SDK + server SDK (`pip install afterlink`)
- **`@afterlink/dart`** — Dart/Flutter client SDK (`dart pub add afterlink`)
- **Protocol v2 frame** — 16-byte header: `Type` + `Flags` + `Version` + `Priority` + `MessageID` + `RoutingKeyLen` + `PayloadLen` + variable `RoutingKey`
- **`/metrics` Prometheus endpoint** — standard text format, all AfterLink metrics
- **OpenTelemetry tracing** — spans for every request, configurable exporter
- **Playground UI** — live at `afterlinkdocs.vercel.app/playground`, no install required
- **`CHANGELOG.md` v2.0.0** section and migration guide

### New npm Packages

| Package | Registry | Description |
|---|---|---|
| `@afterlink/cluster` | npm | Multi-process cluster manager + Redis pub/sub adapter |
| `@afterlink/python` | PyPI | Python client + server SDK |
| `@afterlink/dart` | pub.dev | Dart/Flutter client SDK |

### Out of Scope (Post-v2.0.0)

- WebAssembly (WASM) SDK
- Go SDK
- Rust SDK
- Protocol v2 fragmentation (FRAGMENTED flag — reserved but not implemented)
- AfterLink message broker (standalone binary)
- Cloud-hosted AfterLink service (AfterLink Cloud)

### New External Dependencies

| Dependency | Package | Version | Purpose |
|---|---|---|---|
| `ioredis` | `@afterlink/cluster` | `^5.3.0` | Redis pub/sub adapter |
| `prom-client` | `@afterlink/server` | `^15.1.0` | Prometheus metrics registry |
| `@opentelemetry/api` | `@afterlink/server` | `^1.8.0` | OTel trace API |
| `@opentelemetry/sdk-node` | `@afterlink/server` | `^0.51.0` | OTel Node.js SDK |
| Python `asyncio` | `@afterlink/python` | stdlib | Async Python client |
| Python `msgpack` | `@afterlink/python` | `^1.0.8` | MessagePack serialization |
| Dart `web_socket_channel` | `@afterlink/dart` | `^3.0.0` | WebSocket transport |
| Dart `messagepack` | `@afterlink/dart` | `^0.2.2` | MessagePack serialization |

---

## 4. Feature 1 — @afterlink/cluster

### 4.1 Overview

`@afterlink/cluster` enables a single AfterLink application to spawn multiple worker processes (one per CPU core) and share pub/sub state across all workers through a Redis adapter. From the outside, a clustered AfterLink deployment looks like a single server — clients connect to any worker and receive pub/sub messages published from any other worker.

Without clustering, a Node.js AfterLink server is limited to a single CPU core. With `@afterlink/cluster`, a 16-core machine runs 16 workers, each handling ~6,250 of 100,000 concurrent connections, with all workers sharing the same pub/sub message space.

### 4.2 User Stories

> As a backend engineer deploying AfterLink on a 16-core production server, I want to run one AfterLink worker per CPU core with shared pub/sub, so that I can handle 10× more concurrent connections than a single-process deployment.

> As a DevOps engineer running multiple AfterLink instances behind a load balancer, I want pub/sub messages published on Worker A to be received by subscribers connected to Worker B or C, so that clients don't need to be pinned to a specific server.

> As a developer running AfterLink in development, I want clustering to be completely opt-in and invisible — a non-clustered app should work identically with zero config changes.

### 4.3 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Clustered AfterLink Deployment                        │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Primary Process                                │    │
│  │  @afterlink/cluster manager                                      │    │
│  │  - Spawns N workers (default: os.cpus().length)                  │    │
│  │  - Health monitors each worker                                   │    │
│  │  - Restarts crashed workers                                      │    │
│  │  - Routes new connections via round-robin                        │    │
│  └───────────────────────┬─────────────────────────────────────────┘    │
│                           │  fork()                                      │
│         ┌─────────────────┼─────────────────────────────────┐           │
│         │                 │                                  │           │
│  ┌──────▼──────┐  ┌───────▼──────┐  ┌───────────────┐      │           │
│  │  Worker 1   │  │  Worker 2    │  │   Worker N    │      │           │
│  │  (TCP :4000)│  │  (TCP :4000) │  │  (TCP :4000)  │      │           │
│  │             │  │              │  │               │      │           │
│  │  Routes     │  │  Routes      │  │  Routes       │      │           │
│  │  Middleware │  │  Middleware  │  │  Middleware   │      │           │
│  │  Pub/Sub ───┼──┼──────────────┼──┼── Pub/Sub     │      │           │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘      │           │
│         │                │                   │              │           │
│         └────────────────┼───────────────────┘              │           │
│                          │  PUBLISH / SUBSCRIBE              │           │
│                          ▼                                              │
│                   ┌─────────────┐                                       │
│                   │    Redis    │  Pub/Sub adapter (shared state)        │
│                   │  (ioredis)  │                                       │
│                   └─────────────┘                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Installation & Configuration

```bash
npm install @afterlink/cluster ioredis
```

**Entry point — `cluster.js` (replaces `server.js` for clustered deployments):**

```js
const { createCluster } = require('@afterlink/cluster');
const { Server } = require('@afterlink/server');

createCluster({
  workers: require('os').cpus().length,   // default: CPU count
  restartOnCrash: true,                    // default: true
  restartDelay: 1000,                      // ms before restarting a crashed worker
  gracefulTimeout: 10000,                  // ms for graceful worker shutdown
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379'),
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true',
    keyPrefix: 'afterlink:',              // Redis key namespace
  },
}, async () => {
  // This function runs in EACH worker process:
  const server = new Server({ port: 4000 });

  server.on('sendMessage', async (req, res) => {
    const msg = { from: req.session.userId, text: req.body.text };
    server.publish('chat.newMessage', msg);  // Broadcasts to ALL workers via Redis
    res.send({ ok: true });
  });

  await server.listen();
  console.log(`Worker ${process.pid} ready`);
});
```

**Console output when started:**

```
[AfterLink Cluster] Primary process 12345 is running
[AfterLink Cluster] Spawning 8 workers...
[AfterLink Cluster] Worker 12346 online (pid 12346)
[AfterLink Cluster] Worker 12347 online (pid 12347)
[AfterLink Cluster] Worker 12348 online (pid 12348)
[AfterLink Cluster] Worker 12349 online (pid 12349)
[AfterLink Cluster] Worker 12350 online (pid 12350)
[AfterLink Cluster] Worker 12351 online (pid 12351)
[AfterLink Cluster] Worker 12352 online (pid 12352)
[AfterLink Cluster] Worker 12353 online (pid 12353)
[AfterLink Cluster] All 8 workers ready. Redis: localhost:6379
```

### 4.5 Redis Pub/Sub Adapter

The Redis adapter intercepts every `server.publish()` call and:
1. Publishes the serialized message to a Redis channel: `afterlink:<keyPrefix>:pubsub:<topic>`
2. Every worker subscribes to the same channel via `ioredis`'s subscribe mode
3. When a worker receives a Redis message, it broadcasts to its local subscribers

```js
// packages/cluster/src/redis-adapter.js — pseudocode

class RedisAdapter {
  constructor(redisConfig) {
    this.pub = new Redis(redisConfig);   // Publisher connection
    this.sub = new Redis(redisConfig);   // Subscriber connection (dedicated)
    this.localBroadcast = null;          // Set by the server after init
  }

  async publish(topic, data) {
    const payload = serialize({ topic, data, pid: process.pid });
    await this.pub.publish(`${this.keyPrefix}pubsub`, payload);
    // Also broadcast locally (for subscribers on THIS worker)
    this.localBroadcast(topic, data);
  }

  async subscribe() {
    await this.sub.subscribe(`${this.keyPrefix}pubsub`);
    this.sub.on('message', (channel, raw) => {
      const { topic, data, pid } = deserialize(raw);
      if (pid !== process.pid) {
        // Only broadcast locally for messages from OTHER workers
        // (this worker already local-broadcast its own publishes above)
        this.localBroadcast(topic, data);
      }
    });
  }
}
```

### 4.6 Rolling Restart (Zero-Downtime Deploys)

```js
// Send SIGUSR2 to primary process for rolling restart
// pm2 reload afterlink   — uses SIGUSR2 internally

// @afterlink/cluster handles SIGUSR2:
process.on('SIGUSR2', async () => {
  console.log('[Cluster] Rolling restart initiated');
  for (const worker of Object.values(cluster.workers)) {
    // Restart one worker at a time
    await restartWorker(worker);
    await sleep(500);  // Brief pause between worker restarts
  }
  console.log('[Cluster] Rolling restart complete — zero connections dropped');
});
```

### 4.7 Worker Health Monitoring

```js
// Primary process monitors workers
cluster.on('exit', (worker, code, signal) => {
  if (config.restartOnCrash && !worker.exitedAfterDisconnect) {
    console.error(`[Cluster] Worker ${worker.process.pid} died (${signal || code}) — restarting in ${config.restartDelay}ms`);
    setTimeout(() => {
      const newWorker = cluster.fork();
      console.log(`[Cluster] Replacement worker ${newWorker.process.pid} spawned`);
    }, config.restartDelay);
  }
});
```

### 4.8 Cluster Health Endpoint

When clustering is active, the `/__health` endpoint aggregates stats from all workers:

```json
{
  "status": "ok",
  "cluster": {
    "enabled": true,
    "workers": 8,
    "workersOnline": 8,
    "primaryPid": 12345,
    "redis": {
      "connected": true,
      "latencyMs": 0.8
    }
  },
  "connections": {
    "active": 8420,      // sum across all workers
    "perWorker": [1052, 1048, 1060, 1055, 1051, 1049, 1058, 1047]
  },
  "requests": {
    "perSecond": 24820,  // sum across all workers
    ...
  }
}
```

### 4.9 Acceptance Criteria

- [ ] `createCluster()` spawns N worker processes (default: `os.cpus().length`)
- [ ] Each worker runs independently and handles TCP connections on the shared port
- [ ] `server.publish('topic', data)` in Worker A delivers to subscribers in Workers B, C, D via Redis
- [ ] Worker crash triggers automatic restart within `restartDelay` ms
- [ ] `SIGUSR2` triggers a rolling restart — no active connections dropped
- [ ] `/__health` aggregates connection counts and request stats across all workers
- [ ] Redis connection failure degrades gracefully (pub/sub falls back to local-only, logs warning)
- [ ] All existing routes, middleware, TLS, rate limiting work identically in clustered mode
- [ ] Benchmark: 8-worker cluster on 8-core machine handles ≥ 800,000 req/min
- [ ] `npm install @afterlink/cluster` without `@afterlink/server` installed prints a helpful peer dependency error
- [ ] Published to npm as `@afterlink/cluster@2.0.0`

---

## 5. Feature 2 — @afterlink/python

### 5.1 Overview

`@afterlink/python` is a first-party Python SDK providing both a **client** (connect to an AfterLink Node.js or Python server) and a **server** (run an AfterLink server in Python using `asyncio`). It speaks the AfterLink binary protocol natively — Python services can communicate with Node.js services using the same protocol, routes, and pub/sub topics.

### 5.2 User Stories

> As a Python/ML engineer running FastAPI services, I want to connect to an AfterLink server from Python using the same patterns as the Node.js client, so that my ML inference service can join the same real-time pub/sub network as our Node.js services.

> As a Python backend developer, I want to run an AfterLink server in Python, so that I can write route handlers in Python and have them accessible to any AfterLink client (Node.js, browser, Dart).

### 5.3 Installation

```bash
pip install afterlink
# Or for faster async performance:
pip install afterlink[uvloop]
```

**Package on PyPI:** `afterlink` (maps to `@afterlink/python` internally)

### 5.4 Python Client API

```python
import asyncio
from afterlink import Client

async def main():
    # Connect to an AfterLink server (Node.js or Python)
    client = Client("afterlink://localhost:4000", options={
        "auto_reconnect": True,
        "max_reconnect_attempts": 10,
        "reconnect_delay": 1.0,  # seconds
        "timeout": 30.0,          # seconds
        "auth": {"token": "your-jwt-token"},
        "compression": {"enabled": True, "algorithm": "zlib"},
        "tls": {
            "enabled": True,
            "ca_cert": "/path/to/ca.pem",
            "verify": True,
        }
    })

    await client.connect()

    # ─── REQUEST / RESPONSE ──────────────────────────────────────────
    result = await client.request("createUser", {
        "name": "Ajju",
        "email": "ajju@example.com"
    })
    print(result)  # {'user': {'id': 'u_01JWX5K', 'name': 'Ajju', ...}}

    # ─── PUB/SUB ─────────────────────────────────────────────────────
    async def on_message(data):
        print(f"[chat] {data['from']}: {data['text']}")

    unsubscribe = await client.subscribe("chat.newMessage", on_message)

    await client.publish("chat.newMessage", {
        "from": "python-service",
        "text": "Hello from Python!"
    })

    # ─── STREAMING ───────────────────────────────────────────────────
    async for chunk in client.stream("exportData", {"format": "csv"}):
        process_chunk(chunk)

    # ─── DISCONNECT ──────────────────────────────────────────────────
    await unsubscribe()
    await client.disconnect()

asyncio.run(main())
```

**Synchronous wrapper (for non-async codebases):**

```python
from afterlink.sync import SyncClient

client = SyncClient("afterlink://localhost:4000")
client.connect()

result = client.request("getUser", {"id": 1})
print(result)

client.disconnect()
```

### 5.5 Python Server API

```python
import asyncio
from afterlink import Server
from afterlink.schema import Schema
import pydantic  # optional — AfterLink schema uses pydantic v2 or dataclasses

class CreateUserBody(pydantic.BaseModel):
    name: str = pydantic.Field(min_length=2)
    email: pydantic.EmailStr

async def main():
    server = Server(port=4000, options={
        "tls": {"enabled": False},
        "compression": {"enabled": True, "algorithm": "zlib"},
        "rate_limit": {"enabled": True, "requests_per_second": 100},
    })

    # ─── ROUTE HANDLER ───────────────────────────────────────────────
    @server.on("createUser", schema=CreateUserBody)
    async def create_user(req, res):
        # req.body is a validated CreateUserBody instance
        user = await db.create_user(req.body.name, req.body.email)
        await res.send({"user": user.dict()})

    @server.on("ping")
    async def ping(req, res):
        await res.send({"pong": True, "ts": asyncio.get_event_loop().time()})

    # ─── MIDDLEWARE ───────────────────────────────────────────────────
    @server.use
    async def auth_middleware(req, next_fn):
        if not req.session.get("user_id"):
            raise AfterLinkError("AUTH_MISSING", "Authentication required")
        await next_fn()

    # ─── PUB/SUB ─────────────────────────────────────────────────────
    @server.on("sendMessage")
    async def send_message(req, res):
        msg = {"from": req.session["user_id"], "text": req.body["text"]}
        server.publish("chat.newMessage", msg)
        await res.send({"ok": True})

    await server.listen()
    print(f"AfterLink Python server listening on port 4000")

asyncio.run(main())
```

### 5.6 Python Error Handling

```python
from afterlink import Client, AfterLinkError

try:
    result = await client.request("createUser", {"name": "A"})

except AfterLinkError as e:
    match e.code:
        case "VALIDATION_ERROR":
            for field in e.meta.get("fields", []):
                print(f"  {field['field']}: {field['message']}")

        case "RATE_LIMITED":
            await asyncio.sleep(e.retry_after / 1000)
            # retry...

        case "AUTH_EXPIRED":
            new_token = await refresh_token()
            await client.reconnect(auth={"token": new_token})

        case _:
            raise  # re-raise unknown errors
```

### 5.7 Python Package Structure

```
afterlink-python/                    (PyPI package: afterlink)
├── pyproject.toml
├── README.md
├── afterlink/
│   ├── __init__.py                  (exports: Client, Server, AfterLinkError)
│   ├── client.py                    (async Client class)
│   ├── server.py                    (async Server class)
│   ├── sync.py                      (SyncClient wrapper)
│   ├── errors.py                    (AfterLinkError class + all 19 codes)
│   ├── schema.py                    (pydantic + dataclass schema integration)
│   ├── protocol/
│   │   ├── frame.py                 (encode/decode 10-byte + 16-byte frames)
│   │   ├── codec.py                 (MessagePack serialize/deserialize)
│   │   └── compression.py           (zlib compress/decompress)
│   └── transport/
│       ├── tcp.py                   (asyncio TCP transport)
│       └── tls.py                   (asyncio TLS transport)
└── tests/
    ├── test_client.py
    ├── test_server.py
    └── test_protocol.py
```

### 5.8 Cross-Language Compatibility Example

```python
# Python client ↔ Node.js AfterLink server
# Node.js server running on port 4000
# Python client connects and calls routes defined in Node.js

from afterlink import Client
import asyncio

async def main():
    client = Client("afterlink://localhost:4000")
    await client.connect()

    # Calling a route defined in Node.js server — identical syntax
    user = await client.request("createUser", {
        "name": "Ajju",
        "email": "ajju@gttc.edu.in"
    })
    print(user)  # same response shape as Node.js client

    # Subscribing to events published by Node.js
    await client.subscribe("orders.new", lambda data: print(f"New order: {data}"))

asyncio.run(main())
```

### 5.9 Acceptance Criteria

- [ ] `pip install afterlink` installs the package from PyPI
- [ ] Python client can connect to a Node.js AfterLink v1.2.x server
- [ ] Python client `request()` / `subscribe()` / `publish()` work with Node.js server
- [ ] Python server accepts connections from Node.js AfterLink clients
- [ ] Python server accepts connections from `@afterlink/browser` clients
- [ ] Schema validation with pydantic BaseModel works (rejects invalid bodies, returns `VALIDATION_ERROR`)
- [ ] Middleware chain works in Python server (auth, logging, rate-limit)
- [ ] `AfterLinkError` raised with all 19 error codes matching Node.js definitions
- [ ] zlib compression negotiated correctly between Python and Node.js
- [ ] TLS (`afterlinks://`) works client-to-server with Python client
- [ ] Auto-reconnect works with correct backoff
- [ ] `SyncClient` wrapper works in synchronous Python code
- [ ] Python 3.10+ supported (for `match` statement)
- [ ] Published to PyPI as `afterlink==2.0.0`
- [ ] `pip install afterlink[uvloop]` installs with uvloop for performance

---

## 6. Feature 3 — @afterlink/dart

### 6.1 Overview

`@afterlink/dart` is a Dart client SDK for connecting to AfterLink servers from **Flutter mobile apps**, **Dart CLI tools**, and **Dart backend services**. It implements the AfterLink binary protocol over TCP (for Dart/Flutter desktop and server) and WebSocket (for Flutter web and when TCP is unavailable).

### 6.2 User Stories

> As a Flutter developer building a real-time chat app, I want to connect to an AfterLink server from my iOS and Android app using the same protocol as my Node.js backend, so that I have a unified real-time communication layer across my entire stack.

> As a Flutter developer, I want the AfterLink Dart SDK to feel idiomatic — using streams, futures, and null safety — so it integrates naturally with my existing Flutter codebase.

### 6.3 Installation

```yaml
# pubspec.yaml
dependencies:
  afterlink: ^2.0.0
```

```bash
dart pub add afterlink
# or
flutter pub add afterlink
```

**Package on pub.dev:** `afterlink`

### 6.4 Dart Client API

```dart
import 'package:afterlink/afterlink.dart';

void main() async {
  final client = AfterLinkClient(
    url: 'afterlink://localhost:4000',
    options: AfterLinkClientOptions(
      autoReconnect: true,
      maxReconnectAttempts: 10,
      reconnectDelay: const Duration(seconds: 1),
      timeout: const Duration(seconds: 30),
      auth: AuthOptions(token: 'your-jwt-token'),
      compression: CompressionOptions(
        enabled: true,
        algorithm: CompressionAlgorithm.zlib,
      ),
      tls: TlsOptions(
        enabled: true,
        verifyCert: true,
      ),
    ),
  );

  await client.connect();

  // ─── REQUEST / RESPONSE ────────────────────────────────────────────
  final result = await client.request<Map<String, dynamic>>(
    'createUser',
    {'name': 'Ajju', 'email': 'ajju@example.com'},
  );
  print(result['user']['id']);  // u_01JWX5K

  // ─── PUB/SUB ──────────────────────────────────────────────────────
  final subscription = await client.subscribe(
    'chat.newMessage',
    (Map<String, dynamic> data) {
      print('[${data['from']}]: ${data['text']}');
    },
  );

  await client.publish('chat.newMessage', {
    'from': 'flutter-app',
    'text': 'Hello from Flutter!',
  });

  // ─── STREAMING ────────────────────────────────────────────────────
  await for (final chunk in client.stream('exportData', {'format': 'csv'})) {
    processChunk(chunk);
  }

  // ─── EVENTS ───────────────────────────────────────────────────────
  client.onConnected.listen((_) => print('Connected'));
  client.onDisconnected.listen((info) => print('Disconnected: ${info.graceful}'));
  client.onReconnecting.listen((info) => print('Reconnecting (attempt ${info.attempt})'));
  client.onServerClosing.listen((info) => print('Server closing in ${info.drainTimeout}ms'));

  // ─── DISCONNECT ───────────────────────────────────────────────────
  await subscription.cancel();
  await client.disconnect();
}
```

### 6.5 Flutter Widget Integration

```dart
import 'package:flutter/material.dart';
import 'package:afterlink/afterlink.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _client = AfterLinkClient(url: 'afterlink://api.example.com:4000');
  final _messages = <Map<String, dynamic>>[];
  AfterLinkSubscription? _subscription;

  @override
  void initState() {
    super.initState();
    _initClient();
  }

  Future<void> _initClient() async {
    await _client.connect();
    _subscription = await _client.subscribe('chat.general', (msg) {
      setState(() => _messages.add(msg));
    });
  }

  Future<void> _sendMessage(String text) async {
    await _client.request('sendMessage', {'text': text, 'room': 'general'});
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _client.disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('AfterLink Chat')),
      body: ListView.builder(
        itemCount: _messages.length,
        itemBuilder: (ctx, i) => ListTile(
          title: Text(_messages[i]['text'] as String),
          subtitle: Text(_messages[i]['from'] as String),
        ),
      ),
    );
  }
}
```

### 6.6 Dart Transport Strategy

| Platform | Transport | Notes |
|---|---|---|
| Android | TCP (raw socket) | Preferred — lowest latency |
| iOS | TCP (raw socket) | Preferred — lowest latency |
| macOS / Windows / Linux | TCP (raw socket) | Native support |
| Flutter Web | WebSocket | Browsers cannot open raw TCP |
| Dart CLI | TCP (raw socket) | Native support |

The SDK detects the platform at runtime and selects the appropriate transport:

```dart
// packages/dart/lib/src/transport/factory.dart
AfterLinkTransport createTransport(String url) {
  if (kIsWeb) {
    // Flutter web: use WebSocket transport
    return WebSocketTransport(url.replaceFirst('afterlink://', 'ws://'));
  } else {
    // Native: use raw TCP transport
    return TcpTransport(url);
  }
}
```

### 6.7 Dart Error Handling

```dart
import 'package:afterlink/afterlink.dart';

try {
  final result = await client.request('createUser', {'name': 'A'});
} on AfterLinkError catch (e) {
  switch (e.code) {
    case AfterLinkErrorCode.validationError:
      for (final field in e.meta['fields'] as List) {
        print('${field['field']}: ${field['message']}');
      }

    case AfterLinkErrorCode.rateLimited:
      await Future.delayed(Duration(milliseconds: e.retryAfter ?? 1000));
      // retry...

    case AfterLinkErrorCode.authExpired:
      final newToken = await refreshAuthToken();
      await client.reconnect(auth: AuthOptions(token: newToken));

    default:
      rethrow;
  }
}
```

### 6.8 Dart Package Structure

```
afterlink-dart/                      (pub.dev package: afterlink)
├── pubspec.yaml
├── README.md
├── CHANGELOG.md
├── lib/
│   ├── afterlink.dart               (main export file)
│   └── src/
│       ├── client.dart              (AfterLinkClient class)
│       ├── errors.dart              (AfterLinkError + AfterLinkErrorCode enum)
│       ├── options.dart             (AfterLinkClientOptions + sub-options)
│       ├── subscription.dart        (AfterLinkSubscription)
│       ├── protocol/
│       │   ├── frame.dart           (encode/decode frames — both v1 and v2)
│       │   ├── codec.dart           (MessagePack serialize/deserialize)
│       │   └── compression.dart     (zlib)
│       └── transport/
│           ├── factory.dart         (platform detection + transport selection)
│           ├── tcp.dart             (dart:io Socket transport)
│           └── websocket.dart       (web_socket_channel transport)
├── test/
│   ├── client_test.dart
│   └── protocol_test.dart
└── example/
    ├── flutter_chat/                (complete Flutter chat app example)
    └── dart_cli/                    (Dart CLI client example)
```

### 6.9 Acceptance Criteria

- [ ] `flutter pub add afterlink` installs from pub.dev
- [ ] Dart/Flutter client connects to Node.js AfterLink server over TCP (mobile/desktop)
- [ ] Dart/Flutter client connects over WebSocket on Flutter web
- [ ] `client.request()` / `subscribe()` / `publish()` / `stream()` all functional
- [ ] `AfterLinkError` raised with typed `AfterLinkErrorCode` enum values
- [ ] Auto-reconnect with exponential backoff works correctly
- [ ] `onConnected` / `onDisconnected` / `onReconnecting` streams fire correctly
- [ ] TLS (`afterlinks://` → `wss://` on web) works
- [ ] zlib compression negotiated correctly
- [ ] Flutter widget lifecycle integration (connect on `initState`, disconnect on `dispose`)
- [ ] Android (API 21+), iOS (14+), macOS, Windows, Linux, Web all supported
- [ ] Dart null safety (`sound null safety`) — no `!` forced on public API
- [ ] Published to pub.dev as `afterlink 2.0.0`

---

## 7. Feature 4 — Protocol v2 Frame

### 7.1 Overview

Protocol v2 extends the 10-byte AfterLink frame header to **16 bytes + variable-length routing key**. Two new fields are added:

- **Routing Key** — a string identifier (e.g. `"user-service"`, `"ml-inference"`) that lets the server route frames to specific backend services without inspecting the payload
- **Priority** — a 1-byte value (0–7) that lets clients signal request urgency; the server can use this for priority queuing

This is the only wire-breaking change in v2.0.0. Protocol v1.x clients and v2 clients can connect to the same v2.0.0 server simultaneously. The server detects the protocol version from the HELLO frame.

### 7.2 User Stories

> As a microservice architect running multiple AfterLink backend services, I want to include a routing key in my frames so the AfterLink gateway can route requests to the correct backend service without parsing the JSON payload.

> As an engineer building an SLA-critical notification system, I want to mark certain requests as high-priority so they are processed before lower-priority requests during traffic spikes.

### 7.3 Protocol v1 Frame (Current — 10 bytes fixed)

```
Byte 0:     Frame Type    (1 byte)
Byte 1:     Flags         (1 byte)  bit0=COMPRESSED, bit1=ENCRYPTED...
Bytes 2–5:  Message ID    (4 bytes, uint32 big-endian)
Bytes 6–9:  Payload Len   (4 bytes, uint32 big-endian)
Bytes 10+:  Payload       (variable, MessagePack)
```

### 7.4 Protocol v2 Frame (New — 16 bytes fixed + variable routing key)

```
 0               1               2               3
 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7
├───────────────┼───────────────┼───────────────┼───────────────────┤
│  Frame Type   │     Flags     │    Version    │    Priority       │
│   (1 byte)    │   (1 byte)    │   (1 byte)    │   (1 byte, 0–7)  │
├───────────────────────────────────────────────────────────────────┤
│                       Message ID (4 bytes)                        │
├───────────────────────────────────────────────────────────────────┤
│                     Routing Key Len (2 bytes)                     │
├───────────────────────────────────────────────────────────────────┤
│                      Payload Len (4 bytes)                        │
├───────────────────────────────────────────────────────────────────┤
│             Routing Key (0–255 bytes, UTF-8 string)               │
├───────────────────────────────────────────────────────────────────┤
│                Payload (MessagePack encoded)                       │
└───────────────────────────────────────────────────────────────────┘
```

**Fixed header: 16 bytes**
**Routing key: 0–255 bytes (uint16 length prefix, max 255 UTF-8 bytes)**
**Total minimum frame: 16 bytes (no routing key, no payload)**

### 7.5 New/Changed Header Fields

| Byte(s) | Field | v1 | v2 | Notes |
|---|---|---|---|---|
| 0 | Frame Type | 1 byte | 1 byte | Unchanged |
| 1 | Flags | 1 byte | 1 byte | `bit2=PRIORITY_SET`, `bit3=HAS_ROUTING_KEY` added |
| 2 | Version | — | 1 byte | `0x01` = v1 (legacy), `0x02` = v2 |
| 3 | Priority | — | 1 byte | `0x00`=lowest, `0x07`=highest; `0x03`=default |
| 4–7 | Message ID | bytes 2–5 | bytes 4–7 | Unchanged (still uint32) |
| 8–9 | Routing Key Len | — | 2 bytes | uint16, 0 = no routing key |
| 10–13 | Payload Len | bytes 6–9 | bytes 10–13 | Unchanged (uint32) |
| 14–N | Routing Key | — | variable | UTF-8 string, 0–255 bytes |
| N+1+ | Payload | bytes 10+ | after routing key | MessagePack |

### 7.6 Flags Byte — v2 Additions

```
Flags byte (v2):
  Bit 0 (0x01): COMPRESSED        (v1.1.0 — unchanged)
  Bit 1 (0x02): ENCRYPTED         (reserved — unchanged)
  Bit 2 (0x04): PRIORITY_SET      (NEW v2 — priority field is meaningful)
  Bit 3 (0x08): HAS_ROUTING_KEY   (NEW v2 — routing key is present)
  Bit 4 (0x10): FRAGMENTED        (reserved — unchanged)
  Bits 5–7:     Reserved
```

### 7.7 Version Field Values

| Value | Meaning |
|---|---|
| `0x01` | Protocol v1 (AL/1.x) — 10-byte header, legacy layout |
| `0x02` | Protocol v2 (AL/2) — 16-byte header, new layout |

The version field is at byte 2 in the v2 frame, but a v1 frame has its Message ID starting at byte 2. The server distinguishes v1 from v2 by reading the HELLO frame's `version` field first, then applies the appropriate frame decoder for the entire session.

### 7.8 Priority Levels

| Value | Label | Use Case |
|---|---|---|
| 0 | LOWEST | Background jobs, analytics |
| 1 | LOW | Non-urgent notifications |
| 2 | BELOW_NORMAL | Default for bulk operations |
| 3 | NORMAL | Default for all requests |
| 4 | ABOVE_NORMAL | User-facing interactive requests |
| 5 | HIGH | Payment processing, auth |
| 6 | CRITICAL | Health checks, system alerts |
| 7 | REAL_TIME | Panic, emergency alerts |

**Server priority queue:** When the server's request processing queue is at capacity (backpressure), higher-priority requests are processed before lower-priority ones. Default: FIFO (no priority queue) unless `priorityQueue: true` is set in server config.

### 7.9 Routing Key Usage

```js
// Node.js client — v2 protocol
const client = new Client('afterlink://gateway:4000', { protocol: 'v2' });
await client.connect();

// Route to "ml-inference" service via routing key
const prediction = await client.request(
  'predict',
  { text: 'Is this spam?' },
  {
    routingKey: 'ml-inference',  // Gateway routes to ML service
    priority: 5,                  // HIGH priority
  }
);

// Route to "user-service"
const user = await client.request(
  'getUser',
  { id: 1 },
  { routingKey: 'user-service', priority: 3 }
);
```

```js
// Server — routing key-based dispatch
const gateway = new Server({
  port: 4000,
  protocol: 'v2',
  routing: {
    enabled: true,
    routes: {
      'ml-inference': { forward: 'afterlink://ml-service:4001' },
      'user-service':  { forward: 'afterlink://user-service:4002' },
      // Default: handle locally
    }
  }
});
```

### 7.10 Protocol Version Negotiation

```
Client                                  Server
  │                                         │
  │── HELLO ───────────────────────────────▶│
  │   { version: "AL/2",                    │
  │     capabilities: ["v2-frame", ...] }   │
  │                                         │
  │◀── HELLO_ACK ───────────────────────────│
  │   { server_version: "AL/2",             │
  │     accepted_protocol: "v2",            │
  │     protocol_features: {                │
  │       routing_key: true,                │
  │       priority_queue: true              │
  │     }                                   │
  │   }                                     │
  │                                         │
  │  [All subsequent frames use v2 layout]  │
```

**v1 client connecting to v2 server:**

```
Client (AL/1.x)                         Server (AL/2.0)
  │                                         │
  │── HELLO ───────────────────────────────▶│
  │   { version: "AL/1.2" }                 │
  │                                         │  Server detects v1 client
  │◀── HELLO_ACK ───────────────────────────│  Sets session.protocol = 'v1'
  │   { accepted_protocol: "v1" }           │  Uses v1 frame decoder for this session
  │                                         │
  │  [v1 frames only — routing/priority N/A]│
```

### 7.11 Backward Compatibility Strategy

| Scenario | Behavior |
|---|---|
| v1 client → v2 server | Works — server uses v1 decoder per session |
| v2 client → v1 server | HELLO_ACK returns `accepted_protocol: "v1"`, client falls back |
| v2 client → v2 server | Full v2 features available |
| v1 frame with `version: 0x02` byte | Server rejects as `PROTOCOL_VERSION_MISMATCH` |

### 7.12 Acceptance Criteria

- [ ] v2 frame encoder produces 16-byte header + variable routing key + MessagePack payload
- [ ] v2 frame decoder reads all fields correctly including variable-length routing key
- [ ] HELLO handshake negotiates protocol version (`AL/1.x` vs `AL/2`)
- [ ] v1 clients connecting to v2 server work identically to v1.2.x behavior
- [ ] v2 clients connecting to v2 server can set `routingKey` and `priority` per request
- [ ] Server priority queue (when `priorityQueue: true`) processes priority 7 before priority 0
- [ ] Routing key-based forwarding sends frames to the correct downstream AfterLink server
- [ ] Routing key max 255 UTF-8 bytes — longer keys rejected with `FRAME_TOO_LARGE`
- [ ] `@afterlink/python` and `@afterlink/dart` implement v2 frame correctly
- [ ] `afterlink inspect` CLI correctly decodes both v1 and v2 frames
- [ ] Frame encode/decode roundtrip: `encode(decode(frame)) === frame` for both versions

---

## 8. Feature 5 — Metrics & Observability

### 8.1 Overview

v2.0.0 adds two complementary observability systems:

1. **Prometheus `/metrics` endpoint** — standard Prometheus text format, scraped by Prometheus server, visualized in Grafana dashboards
2. **OpenTelemetry distributed tracing** — a span is created for every AfterLink request, propagated through the middleware chain, and exportable to Jaeger, Zipkin, Tempo, or any OTLP-compatible collector

Both systems are opt-in via server configuration. When disabled (default), they add zero overhead.

### 8.2 User Stories

> As an SRE running a Prometheus + Grafana stack, I want to scrape AfterLink metrics directly into Prometheus, so that I can build dashboards showing request rates, latency distributions, error rates, and connection counts without writing custom instrumentation code.

> As a backend engineer debugging a latency spike in production, I want distributed traces showing the time spent in each AfterLink middleware and route handler, so that I can identify exactly which part of the request lifecycle is slow.

### 8.3 Prometheus Metrics Endpoint

#### Configuration

```js
const server = new Server({
  port: 4000,
  metrics: {
    enabled: true,
    port: 9090,                   // Prometheus scrape port
    path: '/metrics',              // default: '/metrics'
    auth: process.env.METRICS_TOKEN,  // optional Bearer token
    collectDefaultMetrics: true,   // include Node.js process metrics
    labels: {
      app: 'my-afterlink-app',     // added to all metrics
      env: process.env.NODE_ENV,
    }
  }
});
```

#### Complete Metric Registry

**Connection metrics:**

```
# HELP afterlink_connections_active Number of currently active connections
# TYPE afterlink_connections_active gauge
afterlink_connections_active{transport="tcp"} 18
afterlink_connections_active{transport="websocket"} 5

# HELP afterlink_connections_total Total connections since server start
# TYPE afterlink_connections_total counter
afterlink_connections_total{transport="tcp"} 1847
afterlink_connections_total{transport="websocket"} 423

# HELP afterlink_connections_refused_total Connections refused (rate limit, auth)
# TYPE afterlink_connections_refused_total counter
afterlink_connections_refused_total{reason="rate_limit"} 12
afterlink_connections_refused_total{reason="auth_failed"} 3
```

**Request metrics:**

```
# HELP afterlink_requests_total Total requests handled
# TYPE afterlink_requests_total counter
afterlink_requests_total{route="sendMessage",status="success"} 8241
afterlink_requests_total{route="createUser",status="success"} 819
afterlink_requests_total{route="createUser",status="error",error_code="VALIDATION_ERROR"} 2

# HELP afterlink_request_duration_seconds Request latency histogram
# TYPE afterlink_request_duration_seconds histogram
afterlink_request_duration_seconds_bucket{route="sendMessage",le="0.001"} 7901
afterlink_request_duration_seconds_bucket{route="sendMessage",le="0.005"} 8230
afterlink_request_duration_seconds_bucket{route="sendMessage",le="0.01"} 8240
afterlink_request_duration_seconds_bucket{route="sendMessage",le="+Inf"} 8241
afterlink_request_duration_seconds_sum{route="sendMessage"} 3.124
afterlink_request_duration_seconds_count{route="sendMessage"} 8241

# HELP afterlink_request_errors_total Total request errors by code
# TYPE afterlink_request_errors_total counter
afterlink_request_errors_total{error_code="VALIDATION_ERROR"} 18
afterlink_request_errors_total{error_code="RATE_LIMITED"} 24
afterlink_request_errors_total{error_code="AUTH_EXPIRED"} 4
```

**Pub/Sub metrics:**

```
# HELP afterlink_pubsub_topics_active Currently active pub/sub topics
# TYPE afterlink_pubsub_topics_active gauge
afterlink_pubsub_topics_active 8

# HELP afterlink_pubsub_subscribers_total Total active subscribers
# TYPE afterlink_pubsub_subscribers_total gauge
afterlink_pubsub_subscribers_total 47

# HELP afterlink_pubsub_messages_total Total messages published
# TYPE afterlink_pubsub_messages_total counter
afterlink_pubsub_messages_total{topic="chat.newMessage"} 98421
afterlink_pubsub_messages_total{topic="orders.new"} 1420
```

**Cluster metrics (when `@afterlink/cluster` is active):**

```
# HELP afterlink_cluster_workers Number of active worker processes
# TYPE afterlink_cluster_workers gauge
afterlink_cluster_workers{status="online"} 8
afterlink_cluster_workers{status="crashed"} 0

# HELP afterlink_cluster_redis_latency_seconds Redis pub/sub roundtrip latency
# TYPE afterlink_cluster_redis_latency_seconds histogram
afterlink_cluster_redis_latency_seconds_bucket{le="0.001"} 9842
afterlink_cluster_redis_latency_seconds_bucket{le="0.005"} 10000
```

**Protocol v2 metrics:**

```
# HELP afterlink_frame_priority_total Frames by priority level
# TYPE afterlink_frame_priority_total counter
afterlink_frame_priority_total{priority="3",label="NORMAL"} 14280
afterlink_frame_priority_total{priority="5",label="HIGH"} 420
afterlink_frame_priority_total{priority="7",label="REAL_TIME"} 22

# HELP afterlink_routing_key_requests_total Requests by routing key
# TYPE afterlink_routing_key_requests_total counter
afterlink_routing_key_requests_total{routing_key="ml-inference"} 1240
afterlink_routing_key_requests_total{routing_key="user-service"} 8420
```

#### Prometheus Scrape Config Example

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'afterlink'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: '/metrics'
    bearer_token: 'your-metrics-token'
    scrape_interval: 10s
```

#### Grafana Dashboard

A pre-built Grafana dashboard JSON is shipped in `packages/server/grafana/afterlink-dashboard.json`:

**Panels:**
- Request rate (req/sec) — line chart, by route
- Latency p50/p95/p99 — multi-line chart, by route
- Error rate (%) — single stat + line chart
- Active connections — gauge by transport (TCP / WebSocket)
- Pub/Sub messages/sec — line chart by topic
- Cluster worker health — status table
- Memory usage — line chart (heap used vs total)
- Priority queue distribution — bar chart

### 8.4 OpenTelemetry Distributed Tracing

#### Configuration

```js
const server = new Server({
  port: 4000,
  tracing: {
    enabled: true,
    serviceName: 'my-afterlink-service',   // service.name in OTel
    serviceVersion: '2.0.0',
    exporter: {
      type: 'otlp',                         // 'otlp' | 'jaeger' | 'zipkin' | 'console'
      endpoint: 'http://localhost:4318',    // OTLP HTTP collector endpoint
    },
    sampleRate: 1.0,                        // 0.0–1.0, default: 1.0 (100%)
    propagateContext: true,                 // Read/write W3C TraceContext headers
  }
});
```

#### Trace Structure

Every AfterLink request produces a trace with the following span hierarchy:

```
[Root Span] afterlink.request
├── span.name:      "afterlink.request sendMessage"
├── span.kind:      SERVER
├── attributes:
│   ├── afterlink.route:          "sendMessage"
│   ├── afterlink.session_id:     "sess_9f3a2b"
│   ├── afterlink.message_id:     1
│   ├── afterlink.transport:      "tcp"
│   ├── afterlink.compressed:     true
│   ├── afterlink.priority:       3          (v2 only)
│   ├── afterlink.routing_key:    "chat"     (v2 only)
│   ├── net.peer.address:         "192.168.1.42"
│   └── net.peer.port:            52341
│
├── [Child Span] afterlink.middleware auth_check
│   ├── duration: 0.12ms
│   └── status: OK
│
├── [Child Span] afterlink.middleware rate_limit
│   ├── duration: 0.04ms
│   └── status: OK
│
├── [Child Span] afterlink.validation
│   ├── duration: 0.08ms
│   └── status: OK
│
└── [Child Span] afterlink.handler sendMessage
    ├── duration: 0.82ms
    ├── status: OK
    └── attributes:
        └── afterlink.response_size: 48
```

**Error span:**

```
[Root Span] afterlink.request createUser
└── status: ERROR
    ├── afterlink.error.code:    "VALIDATION_ERROR"
    ├── afterlink.error.message: "name: min 2 chars"
    └── afterlink.error.retryable: false
```

#### Context Propagation (W3C TraceContext)

When `propagateContext: true`, AfterLink reads and writes W3C `traceparent` headers in the HELLO handshake payload, allowing traces to span across service boundaries:

```js
// Client passes trace context
const client = new Client('afterlink://gateway:4000', {
  tracing: {
    propagateContext: true  // attaches current OTel context to HELLO
  }
});
```

#### Manual Instrumentation API

```js
const { getActiveSpan } = require('@afterlink/server/tracing');

server.on('processOrder', async (req, res) => {
  const span = getActiveSpan();  // the current afterlink.handler span
  span.setAttribute('order.id', req.body.orderId);
  span.setAttribute('order.amount', req.body.amount);

  const order = await db.processOrder(req.body.orderId);
  span.setAttribute('order.status', order.status);

  res.send({ order });
});
```

### 8.5 Acceptance Criteria

**Prometheus:**
- [ ] `GET /metrics` returns valid Prometheus text format (parseable by `promtool check metrics`)
- [ ] All listed metrics present and correctly typed (counter, gauge, histogram)
- [ ] `afterlink_request_duration_seconds` histogram has correct bucket boundaries
- [ ] Metrics reset to 0 on server restart (counters start fresh — expected Prometheus behavior)
- [ ] Bearer token auth rejects unauthenticated scrape requests with HTTP 401
- [ ] `collectDefaultMetrics: true` includes Node.js process metrics (heap, event loop lag, GC)
- [ ] Custom `labels` appear on all metrics
- [ ] Grafana dashboard JSON imports without errors into Grafana 10+
- [ ] Metrics endpoint adds < 0.1ms overhead to normal request processing

**OpenTelemetry:**
- [ ] Every REQUEST frame produces a root span with correct attributes
- [ ] Each middleware produces a child span with correct duration
- [ ] Validation and handler each produce child spans
- [ ] Error requests produce spans with `status: ERROR` and `afterlink.error.code`
- [ ] `type: 'otlp'` exporter sends spans to OTLP HTTP endpoint correctly
- [ ] `type: 'console'` exporter prints spans to stdout (useful for dev)
- [ ] `sampleRate: 0.1` traces approximately 10% of requests (± 5%)
- [ ] `getActiveSpan()` returns the current handler span for manual instrumentation
- [ ] Tracing disabled (`tracing.enabled: false`) adds zero overhead

---

## 9. Feature 6 — Playground UI

### 9.1 Overview

The Playground is a **browser-based interactive AfterLink demo** accessible at `afterlinkdocs.vercel.app/playground`. Visitors can interact with a live AfterLink server (hosted specifically for the playground) using a visual terminal interface — no installation, no account, no signup.

The playground demonstrates AfterLink's key features in an engaging, visual way and serves as the single most powerful tool for converting a docs visitor into an active AfterLink user.

### 9.2 User Stories

> As a developer who just discovered AfterLink on GitHub, I want to try it from the browser before installing anything, so that I can evaluate whether it's right for my project in under 5 minutes.

> As a developer reading the AfterLink docs, I want to click "Try it live" on a code example and see it run instantly, so that I understand what the output looks like without setting up a local environment.

### 9.3 Playground Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│               afterlinkdocs.vercel.app/playground                     │
│                                                                        │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │                       Browser (HTML/CSS/JS)                    │    │
│  │                                                                │    │
│  │  Left Panel: Code Editor        Right Panel: Terminal Output   │    │
│  │  ┌──────────────────────┐       ┌──────────────────────────┐  │    │
│  │  │  // Your code here   │       │  > Connecting...          │  │    │
│  │  │  const client = new  │  ───▶ │  > Connected ✓            │  │    │
│  │  │  Client(url, opts)   │  Run  │  > Sending REQUEST...     │  │    │
│  │  │                      │       │  > Response received:     │  │    │
│  │  │  await client        │       │  {                        │  │    │
│  │  │    .connect()        │       │    "pong": true,          │  │    │
│  │  │                      │       │    "ts": 1751366400000    │  │    │
│  │  │  const r = await     │       │  }                        │  │    │
│  │  │    client.request(   │       │                           │  │    │
│  │  │      'ping', {})     │       │  > Round-trip: 1.4ms      │  │    │
│  │  └──────────────────────┘       └──────────────────────────┘  │    │
│  │                                                                │    │
│  │  [Preset Scenarios] ─────────────────────────────────────────  │    │
│  │  [Ping/Pong] [PubSub Chat] [Validation] [Streaming] [Auth]    │    │
│  │                                                                │    │
│  │  [Frame Inspector] ──────────────────────────────────────────  │    │
│  │  Live hex dump of the frames sent/received in real-time        │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                         │  WebSocket                                   │
│                         ▼                                              │
│              ┌──────────────────────┐                                  │
│              │  Playground Server   │  (Hosted on Vercel/Fly.io)       │
│              │  @afterlink/server   │                                  │
│              │  + @afterlink/browser│                                  │
│              │  websocket enabled   │                                  │
│              │                      │                                  │
│              │  Routes:             │                                  │
│              │  ping, echo, chat    │                                  │
│              │  createUser, stream  │                                  │
│              │  (read-only, safe)   │                                  │
│              └──────────────────────┘                                  │
└──────────────────────────────────────────────────────────────────────┘
```

### 9.4 UI Design Specification

**Overall layout:** 100vh, split horizontally into three zones:
- **Top bar:** AfterLink logo, "Playground" label, server status indicator (green dot), GitHub link, "Docs" link
- **Main area:** Two-column split (resizable via drag handle)
  - Left: Code editor panel
  - Right: Terminal output panel
- **Bottom bar:** Preset scenario pills, connection stats (RTT, bytes sent/received)

**Color scheme:** Inherits the site design system — `#0a0c0f` background, `#00d4ff` accent, `Space Mono` font for editor and terminal.

**Resizable split:** The divider between editor and terminal is draggable (mouse + touch). Default: 50/50. Snaps to 30/70 or 70/30 on double-click.

### 9.5 Code Editor Panel

- A `<textarea>` styled as a terminal-aesthetic code editor
- **Line numbers** on the left gutter
- **Syntax highlighting** via Prism.js (already a project dependency from v1.2.0)
- **Auto-indent** on Enter (4 spaces)
- **Tab key** inserts 4 spaces (no focus trap — Shift+Tab exits)
- **Run button** (`▶ Run`) — sends the code to the playground execution engine
- **Reset button** — resets to the current preset's starter code
- **Copy button** — copies editor content to clipboard

### 9.6 Terminal Output Panel

- Fixed-width monospace terminal display
- Lines append from bottom (auto-scroll to latest)
- Each line has a timestamp prefix: `[10:14:38.421]`
- Color-coded line types:
  - `>` prefix in cyan: user actions (connecting, sending)
  - `◆` prefix in green: success responses
  - `✗` prefix in red: errors
  - `⬡` prefix in amber: frame events (PING, PONG, SUBSCRIBE, etc.)
  - `─` in muted gray: separators between request/response pairs
- Max 500 lines — older lines fade and scroll off the top
- **Clear button** — clears terminal history
- **Copy terminal** button — copies all output as plain text

### 9.7 Frame Inspector Panel (Expandable)

A collapsible panel at the bottom of the terminal showing the raw frames being sent and received:

```
[FRAME INSPECTOR]  ▼

→ SENT     [10:14:38.420]  REQUEST  frame (64 bytes)
  01 01 00 00 00 01 00 00 00 3A  |  ...........:
  82 A5 72 6F 75 74 65 A4 70 69  |  ..route.pi
  6E 67 A4 62 6F 64 79 80        |  ng.body.

← RECEIVED [10:14:38.421]  RESPONSE  frame (48 bytes)
  02 01 00 00 00 01 00 00 00 28  |  ...........(
  81 A4 70 6F 6E 67 C3           |  ..pong.
```

### 9.8 Preset Scenarios

Five preset scenarios are selectable via pill tabs. Switching a preset loads new code in the editor and clears the terminal.

#### Preset 1: Ping / Pong

```js
// Connect and send a ping
const client = new Client(PLAYGROUND_URL);
await client.connect();

const result = await client.request('ping', {});
console.log('Response:', result);

await client.disconnect();
```

**Expected output:**
```
[10:14:38.000]  > Connecting to afterlink playground server...
[10:14:38.120]  ◆ Connected  (session: sess_abc123 · server: AL/2 · compression: zlib)
[10:14:38.121]  > Sending REQUEST to route "ping"
[10:14:38.122]  ◆ RESPONSE received in 1.4ms
[10:14:38.122]    { "pong": true, "ts": 1751366400000 }
[10:14:38.123]  > Disconnecting...
[10:14:38.124]  ◆ Disconnected (graceful)
```

#### Preset 2: Pub/Sub Chat

```js
const client = new Client(PLAYGROUND_URL);
await client.connect();

// Subscribe to the shared playground chat topic
const unsub = await client.subscribe('playground.chat', (msg) => {
  console.log(`[${msg.from}] ${msg.text}`);
});

// Send a message (visible to all playground visitors!)
await client.request('sendPlaygroundMessage', {
  text: 'Hello from the AfterLink playground! 👋'
});

// Wait 5 seconds, then disconnect
await sleep(5000);
await unsub();
await client.disconnect();
```

**Note:** The `playground.chat` topic is shared across all playground visitors — messages from different visitors appear in real-time. A notice is shown: *"This is a shared channel. Other playground visitors may see your messages."*

#### Preset 3: Schema Validation

```js
const client = new Client(PLAYGROUND_URL);
await client.connect();

// This will FAIL validation (name too short, invalid email)
try {
  await client.request('createDemoUser', {
    name: 'A',              // minimum 2 characters
    email: 'not-an-email',  // must be valid email
  });
} catch (err) {
  console.log('Error code:', err.code);
  console.log('Fields:', err.meta.fields);
}

// This will SUCCEED
const result = await client.request('createDemoUser', {
  name: 'Ajju',
  email: 'ajju@example.com',
});
console.log('Created:', result);

await client.disconnect();
```

#### Preset 4: Streaming

```js
const client = new Client(PLAYGROUND_URL);
await client.connect();

// Stream 10 chunks of demo data
let chunkCount = 0;
for await (const chunk of client.stream('demoStream', { chunks: 10, delay: 200 })) {
  chunkCount++;
  console.log(`Chunk ${chunkCount}:`, chunk);
}

console.log('Stream complete!', chunkCount, 'chunks received');
await client.disconnect();
```

#### Preset 5: Priority Routing (Protocol v2)

```js
// Demonstrates v2 protocol: routing key + priority
const client = new Client(PLAYGROUND_URL, { protocol: 'v2' });
await client.connect();

// Send a normal priority request
const r1 = await client.request('echo', { msg: 'Normal request' }, {
  priority: 3,           // NORMAL
  routingKey: 'demo-a'
});

// Send a high priority request
const r2 = await client.request('echo', { msg: 'High priority request' }, {
  priority: 5,           // HIGH
  routingKey: 'demo-b'
});

console.log('r1:', r1, 'r2:', r2);
await client.disconnect();
```

### 9.9 Playground Server

A dedicated AfterLink server instance is deployed for the playground:

```js
// playground-server/server.js
const { Server } = require('@afterlink/server');
const { z } = require('zod');

const server = new Server({
  port: 4000,
  websocket: { enabled: true, port: 4001, cors: { origin: 'https://afterlinkdocs.vercel.app' } },
  rateLimit: { enabled: true, requestsPerSecond: 10, burstSize: 20 },
  compression: { enabled: true, algorithm: 'zlib' },
  // No auth required — public playground
});

server.on('ping', async (req, res) => {
  res.send({ pong: true, ts: Date.now() });
});

server.on('echo', async (req, res) => {
  res.send({ echo: req.body, ts: Date.now() });
});

server.on('createDemoUser', async (req, res) => {
  // Simulates user creation without actual DB
  res.send({
    user: { id: `demo_${Math.random().toString(36).slice(2)}`, ...req.body, createdAt: new Date().toISOString() }
  });
}, z.object({ name: z.string().min(2), email: z.string().email() }));

server.on('sendPlaygroundMessage', async (req, res) => {
  server.publish('playground.chat', { from: req.session.id.slice(0, 8), text: req.body.text, ts: Date.now() });
  res.send({ ok: true });
}, z.object({ text: z.string().min(1).max(200) }));

server.on('demoStream', async (req, res) => {
  const stream = res.stream();
  for (let i = 0; i < req.body.chunks; i++) {
    stream.write({ chunk: i + 1, data: `Chunk ${i + 1} of ${req.body.chunks}`, ts: Date.now() });
    await sleep(req.body.delay ?? 200);
  }
  stream.end();
});

await server.listen();
```

**Deployment:** Fly.io (persistent WebSocket support, global edge)

### 9.10 Playground Execution Engine

The playground does **not** execute arbitrary user JavaScript. Instead:

1. Each preset has a **fixed server-side implementation** (the routes above)
2. The editor content is **visual/educational** — it shows what you *would write* in your own app
3. When "Run" is pressed, the playground sends pre-defined calls matching the active preset to the playground server via `@afterlink/browser`
4. This design avoids any remote code execution security risk

A subtle note in the UI reads: *"This editor shows the equivalent Node.js code. The playground sends real AfterLink requests to our demo server."*

### 9.11 Playground Tech Stack

The playground page is a single HTML file at `/playground/index.html`:

| Concern | Implementation |
|---|---|
| HTML structure | Semantic HTML5 |
| Styling | Inline `<style>` using the site's CSS variables |
| Editor | Plain `<textarea>` with Prism.js highlighting overlay |
| Terminal | Plain `<div>` with `overflow-y: auto` and appended `<span>` lines |
| Frame inspector | `<pre>` with hex dump formatting |
| Client transport | `@afterlink/browser` (loaded from jsDelivr CDN) |
| Resizable split | 8 lines of vanilla JS using `mousedown` + `mousemove` |
| Syntax highlighting | Prism.js (already loaded on the docs site) |
| No frameworks | Pure HTML + CSS + vanilla JS — no React, no Vue |

### 9.12 Acceptance Criteria

- [ ] Playground loads at `afterlinkdocs.vercel.app/playground` with no install required
- [ ] All 5 preset scenarios run successfully against the live playground server
- [ ] "Ping / Pong" preset shows correct round-trip latency
- [ ] "Pub/Sub Chat" preset shows messages from other playground visitors in real-time
- [ ] "Schema Validation" preset shows a VALIDATION_ERROR, then succeeds on corrected input
- [ ] "Streaming" preset shows 10 chunks arriving with correct timing
- [ ] "Priority Routing" preset uses v2 protocol frames with routing key and priority
- [ ] Frame inspector shows correct hex dump of sent and received frames
- [ ] Editor has line numbers, Prism.js syntax highlighting, and copy button
- [ ] Terminal auto-scrolls to latest output
- [ ] Server status indicator shows green "Connected" or red "Disconnected"
- [ ] Rate limit (10 req/sec) prevents abuse of playground server
- [ ] Playground server deployed and reachable from Vercel (CORS configured)
- [ ] Page loads in < 2 seconds on a 4G mobile connection
- [ ] Page is fully usable on mobile (375px viewport) with tab-switch layout

---

## 10. Protocol Changes (Frame Spec v2)

### 10.1 Summary of All Protocol Changes

| Change | v1.x | v2.0 |
|---|---|---|
| Frame header size | 10 bytes fixed | 16 bytes fixed + variable routing key |
| Version field | None (implied AL/1) | Byte 2: `0x01`=v1, `0x02`=v2 |
| Priority field | None | Byte 3: 0–7 |
| Routing key length | None | Bytes 8–9: uint16 |
| Flags bit 2 | Reserved (0) | `PRIORITY_SET` (0x04) |
| Flags bit 3 | Reserved (0) | `HAS_ROUTING_KEY` (0x08) |
| Max routing key size | N/A | 255 UTF-8 bytes |
| HELLO version string | `"AL/1"` or `"AL/1.1"` or `"AL/1.2"` | `"AL/2"` |
| HELLO_ACK `accepted_protocol` | N/A | `"v1"` or `"v2"` |

### 10.2 Frame Type Table — Complete (v1 + v2)

| Code | Name | v1 | v2 | Direction | Description |
|---|---|---|---|---|---|
| `0x01` | REQUEST | ✅ | ✅ | C→S | Client request to a named route |
| `0x02` | RESPONSE | ✅ | ✅ | S→C | Server response to a request |
| `0x03` | STREAM_START | ✅ | ✅ | S→C | Begin a streaming sequence |
| `0x04` | STREAM_DATA | ✅ | ✅ | S→C | A chunk of streamed data |
| `0x05` | STREAM_END | ✅ | ✅ | S→C | End of stream |
| `0x06` | ERROR | ✅ | ✅ | Both | Error response |
| `0x07` | PING | ✅ | ✅ | Both | Keep-alive ping |
| `0x08` | PONG | ✅ | ✅ | Both | Keep-alive pong |
| `0x09` | BROADCAST | ✅ | ✅ | S→C | Push to all clients |
| `0x0A` | SUBSCRIBE | ✅ | ✅ | C→S | Subscribe to a topic |
| `0x0B` | UNSUBSCRIBE | ✅ | ✅ | C→S | Unsubscribe from a topic |
| `0x0C` | PUBLISH | ✅ | ✅ | Both | Publish message to a topic |
| `0x0D` | CLOSE | ✅ | ✅ | Both | Graceful connection close |
| `0x0E` | CLOSE_ACK | ✅ | ✅ | Both | Acknowledge close |
| `0x0F` | HELLO | ✅ | ✅ | C→S | Initial handshake |
| `0x10` | HELLO_ACK | ✅ | ✅ | S→C | Handshake acknowledgment |
| `0x11` | SERVER_CLOSING | — | ✅ | S→C | Server shutdown notification (v1.1.0) |
| `0x12` | ROUTE_REQUEST | — | ✅ | C→S | v2 only: REQUEST with routing key |
| `0x13` | PRIORITY_ACK | — | ✅ | S→C | v2 only: Confirms priority accepted |

### 10.3 Migration Path: v1 to v2

Clients can be upgraded independently of the server:

```
Step 1: Upgrade server to v2.0.0 (supports AL/1 + AL/2 simultaneously)
Step 2: Upgrade Node.js clients — pass { protocol: 'v2' } to enable AL/2
Step 3: Upgrade Python clients — set protocol='v2' in options
Step 4: Upgrade Dart clients — set protocol: AfterLinkProtocol.v2
Step 5: Enable v2-only features (routing key, priority) gradually
```

---

## 11. API Changes & Backward Compatibility

### 11.1 Breaking Changes in v2.0.0

| Change | Impact | Migration |
|---|---|---|
| Protocol v2 frame is not wire-compatible with v1.x frame decoders | Only affects code parsing raw frames directly (rare) | Use the provided `@afterlink/core` codec which handles both |
| `server.publish()` in cluster mode is now async (returns Promise) | `await server.publish()` instead of sync call | Add `await` |

### 11.2 Non-Breaking Changes

All Phase 1 (v1.1.x) and Phase 2 (v1.2.x) APIs remain unchanged. v2.0.0 is backward-compatible at the application layer:

- A server running v2.0.0 accepts v1.x clients unchanged
- Existing route handlers, middleware, TLS, compression, rate limiting, health endpoint, TypeScript types, CLI — all unchanged
- `@afterlink/cluster` is purely additive (new package)
- `@afterlink/python` and `@afterlink/dart` are new packages, no impact on existing
- `/metrics` and tracing are opt-in via config

### 11.3 Semantic Version Justification

**Major version bump** (v1.2.x → v2.0.0):
- Protocol v2 frame is wire-incompatible with v1.x frame decoders
- `server.publish()` async change in cluster mode
- Signals the ecosystem milestone: multi-language, observable, horizontally scalable

---

## 12. Package & File Structure Changes

```
AfterLink/
├── packages/
│   ├── core/
│   │   └── src/
│   │       └── protocol/
│   │           ├── frame-v1.js          ← RENAMED: was frame.js
│   │           ├── frame-v2.js          ← NEW: v2 frame codec
│   │           └── frame.js             ← UPDATED: auto-selects v1 or v2 codec
│   │
│   ├── server/
│   │   └── src/
│   │       ├── server.js                ← UPDATED: metrics init, tracing init, cluster adapter
│   │       ├── metrics/
│   │       │   ├── prometheus.js        ← NEW: prom-client registry + all metrics
│   │       │   └── grafana-dashboard.json ← NEW: pre-built Grafana dashboard
│   │       └── tracing/
│   │           ├── otel.js              ← NEW: OTel SDK setup + span creation
│   │           └── middleware.js        ← NEW: OTel middleware (auto-spans)
│   │
│   ├── cluster/                         ← NEW PACKAGE
│   │   ├── package.json
│   │   ├── index.d.ts
│   │   └── src/
│   │       ├── index.js                 ← createCluster() entry point
│   │       ├── manager.js               ← Primary process — fork, monitor, restart
│   │       ├── redis-adapter.js         ← ioredis pub/sub bridge
│   │       └── rolling-restart.js       ← SIGUSR2 handler
│   │
│   └── browser/
│       └── src/
│           └── client.js                ← UPDATED: v2 frame support
│
├── playground/                          ← NEW: Playground web app
│   ├── index.html                       ← Single-file playground UI
│   ├── server/
│   │   ├── server.js                    ← Playground AfterLink server
│   │   └── package.json
│   └── vercel.json                      ← Deploy config
│
├── python/                              ← NEW: Python SDK (PyPI: afterlink)
│   ├── pyproject.toml
│   ├── README.md
│   └── afterlink/
│       ├── __init__.py
│       ├── client.py
│       ├── server.py
│       ├── sync.py
│       ├── errors.py
│       ├── schema.py
│       └── protocol/
│           ├── frame.py
│           ├── codec.py
│           └── compression.py
│
├── dart/                                ← NEW: Dart SDK (pub.dev: afterlink)
│   ├── pubspec.yaml
│   ├── README.md
│   └── lib/
│       ├── afterlink.dart
│       └── src/
│           ├── client.dart
│           ├── errors.dart
│           ├── options.dart
│           └── protocol/
│               ├── frame.dart
│               └── codec.dart
│
├── examples/
│   ├── cluster-example/                 ← NEW: 4-worker cluster + Redis
│   ├── python-client-example/           ← NEW: Python ↔ Node.js communication
│   ├── flutter-chat-example/            ← NEW: Flutter app using @afterlink/dart
│   ├── prometheus-grafana-example/      ← NEW: Docker Compose stack
│   └── v2-protocol-example/            ← NEW: Routing key + priority demo
│
├── docs/
│   ├── cluster.md                       ← NEW
│   ├── python.md                        ← NEW
│   ├── dart.md                          ← NEW
│   ├── metrics.md                       ← NEW
│   ├── tracing.md                       ← NEW
│   ├── playground.md                    ← NEW
│   ├── protocol-v2.md                   ← NEW
│   └── migration-v1-to-v2.md           ← NEW
│
└── CHANGELOG.md                         ← UPDATED: v2.0.0 section
```

---

## 13. Cross-SDK Compatibility Matrix

This table defines what works between which SDK versions. ✅ = fully supported, ⚠️ = works with limitations, ❌ = not supported.

| Client \ Server | Node.js v1.0 | Node.js v1.2 | Node.js v2.0 | Python v2.0 |
|---|---|---|---|---|
| **Node.js client v1.0** | ✅ Full | ✅ Full | ✅ v1 only | ⚠️ v1 frames |
| **Node.js client v1.2** | ✅ Full | ✅ Full | ✅ v1+v2 | ⚠️ v1 frames |
| **Node.js client v2.0** | ⚠️ v1 fallback | ⚠️ v1 fallback | ✅ Full v2 | ⚠️ v1 frames |
| **@afterlink/browser v1.2** | ❌ TCP only | ✅ via WS | ✅ via WS | ❌ |
| **@afterlink/browser v2.0** | ❌ | ✅ v1 via WS | ✅ v2 via WS | ❌ |
| **Python client v2.0** | ⚠️ v1 frames | ⚠️ v1 frames | ✅ v1+v2 | ✅ Full |
| **Dart client v2.0** | ⚠️ v1 frames | ⚠️ v1 frames | ✅ v1+v2 | ✅ via server |

**Notes:**
- "v1 frames" means the connection works but routing key and priority (v2 features) are unavailable
- Python-to-Python communication goes through Node.js server (there is no Python server-to-server in v2.0.0)
- Dart web targets always use WebSocket, so require `websocket.enabled: true` on the server

---

## 14. Testing Requirements

### 14.1 Unit Tests

| Module | Test Cases | File |
|---|---|---|
| `frame-v2.js` | Encode/decode v2 frame with routing key + priority; encode with no routing key (0-length); max routing key (255 bytes); routing key > 255 bytes → FRAME_TOO_LARGE | `core/test/frame-v2.test.js` |
| `redis-adapter.js` | Publish on worker A → received on worker B; Redis disconnect fallback to local-only; key prefix isolation | `cluster/test/redis-adapter.test.js` |
| `prometheus.js` | All metrics present in output; histogram buckets correct; counter increments on request | `server/test/metrics.test.js` |
| `otel.js` | Root span created per request; child spans for middleware and handler; error span on AfterLinkError | `server/test/tracing.test.js` |
| Python `frame.py` | v1 + v2 encode/decode roundtrip; compression; MessagePack correctness | `python/tests/test_protocol.py` |
| Python `client.py` | connect, request, subscribe, publish, disconnect; auto-reconnect; AfterLinkError raised correctly | `python/tests/test_client.py` |
| Dart `frame.dart` | v1 + v2 encode/decode; TCP + WebSocket transport selection | `dart/test/protocol_test.dart` |
| Dart `client.dart` | connect, request, subscribe, disconnect; error handling; auto-reconnect | `dart/test/client_test.dart` |

### 14.2 Integration Tests

| Scenario | What It Tests |
|---|---|
| 4-worker cluster: publish on W1, subscriber on W2 receives | Redis adapter cross-worker pub/sub |
| Worker crash → restart → connections restored | Auto-restart and connection recovery |
| Rolling restart: 0 connections dropped during `SIGUSR2` | Zero-downtime deploy |
| Python client → Node.js server: request + subscribe + publish | Cross-language interop |
| Node.js client → Python server: request | Python server handling Node.js client |
| Dart client → Node.js server: request + subscribe | Dart client interop |
| v2 client → v2 server: routing key delivered correctly | Protocol v2 routing |
| v1 client → v2 server: works without routing key/priority | Backward compat |
| v2 client → v1 server: falls back to v1 frame format | Forward compat |
| Prometheus: all 12 metric families present in `/metrics` output | Metrics completeness |
| OTel: span exported to OTLP endpoint with all attributes | Trace export |
| Playground server: all 5 preset scenarios respond correctly | Playground server routes |

### 14.3 Performance Benchmarks

```bash
node benchmarks/v2.0-benchmarks.js
```

| Benchmark | Target |
|---|---|
| 8-worker cluster total req/min | ≥ 800,000 |
| v2 frame encode latency overhead vs v1 | < 0.05ms additional |
| Redis pub/sub round-trip latency | < 2ms (LAN) |
| Prometheus scrape response time | < 50ms |
| Python client round-trip latency | < 5ms (LAN, above Node.js baseline) |
| Dart client round-trip latency (TCP) | < 3ms (LAN, above Node.js baseline) |
| Playground server concurrent WebSocket connections | ≥ 500 |

### 14.4 Cross-Language Protocol Tests

A shared test vector file `test/protocol-vectors.json` defines binary frames (as hex strings) and their expected decoded values. All SDKs (Node.js, Python, Dart) must produce identical output for identical input:

```json
{
  "vectors": [
    {
      "name": "v2-request-with-routing-key",
      "hex": "010200030000000100066D792D6B657900000019...",
      "expected": {
        "type": "REQUEST",
        "version": 2,
        "priority": 3,
        "messageId": 1,
        "routingKey": "my-key",
        "payload": { "route": "ping", "body": {} }
      }
    }
  ]
}
```

Each SDK's test suite includes a test that decodes every vector and asserts equality.

### 14.5 Regression Tests

All Phase 1 and Phase 2 tests must pass unchanged. Full regression run:

```bash
pnpm test:all
pytest python/tests/
dart test dart/test/
```

---

## 15. Documentation Requirements

### 15.1 New Documentation Files

**`docs/migration-v1-to-v2.md`** — Migration Guide (most important):
- Summary of all changes between v1.2.x and v2.0.0
- Zero-change upgrade path (v1 clients work without modification)
- Step-by-step guide to enabling v2 protocol features (protocol: 'v2')
- How to enable clustering
- How to enable metrics
- FAQ: "Do I need to upgrade all clients at once?" (No)

**`docs/protocol-v2.md`** — Protocol v2 Spec:
- Full v2 frame header diagram
- Field-by-field description with byte offsets
- Routing key usage and max length
- Priority levels table
- Version negotiation flow (HELLO/HELLO_ACK)
- Wire format comparison: v1 vs v2

**`docs/cluster.md`** — Clustering Guide:
- `createCluster()` API
- Redis connection configuration
- Worker count recommendations (CPUs - 1 for primary)
- Rolling restart with PM2 / Kubernetes
- Aggregated health endpoint
- Debugging inter-worker pub/sub

**`docs/python.md`** — Python SDK Guide:
- `pip install afterlink`
- Async Client API (all methods)
- Python Server API (routes, middleware, schema with pydantic)
- `SyncClient` for synchronous code
- Error handling with `AfterLinkError`
- Cross-language example (Python client ↔ Node.js server)

**`docs/dart.md`** — Dart/Flutter SDK Guide:
- `flutter pub add afterlink`
- Client API with Flutter widget lifecycle example
- Platform detection (TCP vs WebSocket)
- Error handling with typed enum codes
- Complete Flutter chat app example

**`docs/metrics.md`** — Metrics & Observability Guide:
- Prometheus configuration
- Full metric registry (all metrics with descriptions)
- Grafana dashboard setup and import
- Custom labels
- Prometheus scrape config

**`docs/tracing.md`** — OpenTelemetry Tracing Guide:
- OTel configuration options
- Span hierarchy diagram
- Exporter options (OTLP, Jaeger, Zipkin, console)
- Sampling configuration
- Manual instrumentation with `getActiveSpan()`
- Jaeger local setup example (Docker)

**`docs/playground.md`** — Playground Guide:
- URL and how to access
- What each preset demonstrates
- Note on shared pub/sub channel
- Link to playground server source code

### 15.2 README.md Updates

- Add `@afterlink/cluster`, `@afterlink/python`, `@afterlink/dart` to the packages table
- Add Protocol v2 to the features section
- Add Prometheus metrics to the features section
- Add "Try the Playground" button (prominent, in hero section)
- Update comparison table: AfterLink now has clustering, multi-language, metrics
- Add badge: `Python` (PyPI), `Dart` (pub.dev), `Grafana` ready

### 15.3 Website Updates (`afterlinkdocs.vercel.app`)

- Add playground route `/playground`
- Add v2.0.0 release to changelog timeline
- Add Phase 3 features to the "How It Works" section
- Update benchmark numbers (cluster throughput)
- Add Language SDKs section showing Node.js / Python / Dart / Browser

---

## 16. Implementation Schedule (Week-by-Week)

### Week 9 — Protocol v2 Frame

| Day | Task | Package | Est. Hours |
|---|---|---|---|
| Mon | Design v2 frame binary layout; document field byte offsets | `@afterlink/core` | 2h |
| Mon | Implement `frame-v2.js` encoder — 16-byte header + routing key | `@afterlink/core` | 3h |
| Tue | Implement `frame-v2.js` decoder — parse all v2 fields | `@afterlink/core` | 3h |
| Tue | Update `frame.js` auto-selector (v1 vs v2 based on session protocol) | `@afterlink/core` | 2h |
| Wed | HELLO/HELLO_ACK v2 negotiation (`accepted_protocol`) in server | `@afterlink/server` | 2h |
| Wed | v2 client support in `@afterlink/client` (`protocol: 'v2'` option) | `@afterlink/client` | 2h |
| Thu | Priority queue implementation in server request pipeline | `@afterlink/server` | 3h |
| Thu | Routing key-based forwarding (simple key → upstream server map) | `@afterlink/server` | 2h |
| Fri | Unit tests — frame-v2 encoder/decoder roundtrip, routing key, priority | `@afterlink/core` | 3h |
| Fri | Integration test — v2 client ↔ v2 server; v1 client ↔ v2 server (compat) | Both | 2h |

**Week 9 Deliverable:** Protocol v2 frame working end-to-end. v1 backward compat confirmed. Priority queue and routing key functional.

---

### Week 10 — @afterlink/cluster

| Day | Task | Package | Est. Hours |
|---|---|---|---|
| Mon | Scaffold `@afterlink/cluster` package; `createCluster()` API | `@afterlink/cluster` | 2h |
| Mon | Primary process manager — fork N workers, round-robin port sharing | `@afterlink/cluster` | 3h |
| Tue | Worker crash detection + auto-restart with `restartDelay` | `@afterlink/cluster` | 2h |
| Tue | `redis-adapter.js` — ioredis pub + sub connections, channel naming | `@afterlink/cluster` | 3h |
| Wed | Cross-worker pub/sub: W1 publish → Redis → W2 local broadcast | `@afterlink/cluster` | 3h |
| Wed | Redis failure handling — graceful degradation to local-only pub/sub | `@afterlink/cluster` | 2h |
| Thu | Rolling restart via `SIGUSR2` — one worker at a time, no dropped connections | `@afterlink/cluster` | 3h |
| Thu | Aggregated health endpoint — collect stats from all workers via IPC | `@afterlink/cluster` | 2h |
| Fri | Integration test — 4-worker cluster: cross-worker pub/sub; crash + restart | `@afterlink/cluster` | 3h |
| Fri | `examples/cluster-example/` (4 workers, Redis, chat demo) | Examples | 2h |

**Week 10 Deliverable:** `createCluster()` spawns workers, cross-worker pub/sub via Redis works, rolling restart tested.

---

### Week 11 — Metrics & Observability

| Day | Task | Package | Est. Hours |
|---|---|---|---|
| Mon | `prom-client` integration — registry setup, `/metrics` HTTP endpoint | `@afterlink/server` | 2h |
| Mon | Connection metrics (active, total, refused) — counters + gauges | `@afterlink/server` | 2h |
| Tue | Request metrics (total, errors, latency histogram by route) | `@afterlink/server` | 3h |
| Tue | Pub/Sub metrics (topics, subscribers, messages/sec) | `@afterlink/server` | 2h |
| Wed | Cluster metrics (workers online, Redis latency) via IPC aggregation | `@afterlink/server` | 3h |
| Wed | Protocol v2 metrics (priority distribution, routing key counts) | `@afterlink/server` | 2h |
| Thu | OTel SDK setup — `@opentelemetry/sdk-node` initialisation | `@afterlink/server` | 2h |
| Thu | OTel middleware — root span + child spans for each middleware | `@afterlink/server` | 3h |
| Thu | OTel handler span — route handler child span with attributes | `@afterlink/server` | 2h |
| Fri | OTel exporters — OTLP, Jaeger, Zipkin, console | `@afterlink/server` | 2h |
| Fri | Grafana dashboard JSON (`packages/server/grafana/afterlink-dashboard.json`) | Assets | 2h |
| Fri | `examples/prometheus-grafana-example/` (Docker Compose: AfterLink + Prometheus + Grafana) | Examples | 2h |

**Week 11 Deliverable:** `/metrics` endpoint returning all metrics. OTel spans exported to console. Grafana dashboard importable.

---

### Week 12 — @afterlink/python

| Day | Task | Package | Est. Hours |
|---|---|---|---|
| Mon | Scaffold `afterlink` PyPI package (`pyproject.toml`, package structure) | `python/` | 2h |
| Mon | Python `frame.py` — v1 + v2 frame encode/decode using `struct` | `python/` | 3h |
| Tue | Python `codec.py` — MessagePack via `msgpack` library | `python/` | 2h |
| Tue | Python `transport/tcp.py` — asyncio TCP connection, read loop | `python/` | 3h |
| Wed | Python `client.py` — `connect()`, `request()`, `subscribe()`, `publish()`, `disconnect()` | `python/` | 4h |
| Wed | Python auto-reconnect with exponential backoff | `python/` | 2h |
| Thu | Python `server.py` — `@server.on()` decorator, middleware chain, `server.listen()` | `python/` | 4h |
| Thu | Pydantic schema validation integration | `python/` | 2h |
| Fri | Python `errors.py` — `AfterLinkError` class with all 19 codes | `python/` | 2h |
| Fri | `SyncClient` wrapper using `asyncio.run()` | `python/` | 1h |
| Fri | Unit tests — frame roundtrip, client connect/request, server handler | `python/` | 2h |

**Week 12 Deliverable:** Python client connects to Node.js server and calls routes. Python server accepts Node.js client connections.

---

### Week 13 — @afterlink/dart

| Day | Task | Package | Est. Hours |
|---|---|---|---|
| Mon | Scaffold `afterlink` pub.dev package (`pubspec.yaml`, lib structure) | `dart/` | 2h |
| Mon | Dart `frame.dart` — v1 + v2 frame encode/decode using `ByteData` | `dart/` | 3h |
| Tue | Dart `codec.dart` — MessagePack using `messagepack` package | `dart/` | 2h |
| Tue | Dart TCP transport (`dart:io` Socket) | `dart/` | 3h |
| Wed | Dart WebSocket transport (`web_socket_channel`) | `dart/` | 2h |
| Wed | Platform detection — TCP on native, WebSocket on web | `dart/` | 1h |
| Wed | Dart `client.dart` — `connect()`, `request()`, `subscribe()`, `publish()`, `disconnect()` | `dart/` | 3h |
| Thu | Event streams (`onConnected`, `onDisconnected`, `onReconnecting`, `onServerClosing`) | `dart/` | 2h |
| Thu | Dart `errors.dart` — `AfterLinkError` + `AfterLinkErrorCode` enum | `dart/` | 2h |
| Thu | Auto-reconnect with exponential backoff | `dart/` | 2h |
| Fri | Unit tests — frame roundtrip, client connect/request | `dart/` | 2h |
| Fri | `examples/flutter-chat-example/` (Flutter app with real-time chat) | Examples | 2h |

**Week 13 Deliverable:** Dart client connects to Node.js server. Flutter example app runs on Android and iOS. WebSocket transport works for Flutter web.

---

### Week 14 — Playground UI

| Day | Task | Package | Est. Hours |
|---|---|---|---|
| Mon | Deploy playground server to Fly.io (routes: ping, echo, createDemoUser, sendPlaygroundMessage, demoStream) | `playground/server/` | 3h |
| Mon | Rate limiting + CORS config for playground server | `playground/server/` | 1h |
| Tue | Playground `index.html` — layout (top bar, split panel, bottom presets bar) | `playground/` | 3h |
| Tue | Terminal output panel — append lines, auto-scroll, color-coded types | `playground/` | 2h |
| Wed | Code editor panel — line numbers, Prism.js highlight overlay, copy/reset | `playground/` | 3h |
| Wed | Preset scenario system — 5 presets, code swap, terminal clear on switch | `playground/` | 2h |
| Thu | `@afterlink/browser` integration — real WebSocket calls for each preset | `playground/` | 3h |
| Thu | Frame inspector panel — hex dump of sent/received frames | `playground/` | 2h |
| Thu | Resizable split panel (drag handle, mobile tab layout) | `playground/` | 2h |
| Fri | Server status indicator (green/red dot in top bar) | `playground/` | 1h |
| Fri | Mobile layout (375px viewport, tabbed editor/terminal) | `playground/` | 2h |
| Fri | Deploy playground page to Vercel at `/playground` route | `playground/` | 1h |

**Week 14 Deliverable:** Playground live at `afterlinkdocs.vercel.app/playground`. All 5 presets working against live playground server. Frame inspector showing real hex output.

---

### Week 15 — Cross-SDK Integration Testing + Documentation

| Day | Task | Est. Hours |
|---|---|---|
| Mon | Cross-language protocol vector tests (Node.js, Python, Dart decode same frames) | 3h |
| Mon | Python client ↔ Node.js server full integration test suite | 2h |
| Mon | Dart client ↔ Node.js server full integration test suite | 2h |
| Tue | Write `docs/migration-v1-to-v2.md` | 3h |
| Tue | Write `docs/protocol-v2.md` | 2h |
| Tue | Write `docs/cluster.md` | 2h |
| Wed | Write `docs/python.md` + `docs/dart.md` | 3h |
| Wed | Write `docs/metrics.md` + `docs/tracing.md` | 3h |
| Thu | Write `docs/playground.md` | 1h |
| Thu | Update `README.md` (new packages, badges, comparison table) | 2h |
| Thu | Update `CHANGELOG.md` v2.0.0 section (see Section 17) | 2h |
| Fri | Full regression test run — all Phase 1 + Phase 2 tests pass | 3h |
| Fri | Performance benchmarks — cluster throughput, v2 overhead, Python/Dart latency | 2h |

**Week 15 Deliverable:** All integration tests passing. All documentation written. Full regression suite green.

---

### Week 16 — Polish + Release

| Day | Task | Est. Hours |
|---|---|---|
| Mon | TypeScript `.d.ts` updates for `@afterlink/server` (metrics, tracing, cluster config types) | 3h |
| Mon | TypeScript `.d.ts` for `@afterlink/cluster` | 2h |
| Tue | Lighthouse audit on playground page (target > 90 all categories) | 2h |
| Tue | Browser compatibility test — playground on Chrome, Firefox, Safari, Edge | 2h |
| Tue | Dart tests on Android emulator (API 30) and iOS simulator | 2h |
| Wed | Security audit — playground server input validation, rate limit test | 2h |
| Wed | `promtool check metrics` validation on `/metrics` output | 1h |
| Wed | OTel trace export end-to-end test with real Jaeger (Docker) | 2h |
| Thu | Final `CHANGELOG.md` proofreading and formatting | 1h |
| Thu | `npm publish` — all 4 JS packages at `2.0.0` | 1h |
| Thu | `pip publish` — PyPI `afterlink==2.0.0` | 1h |
| Thu | `dart pub publish` — pub.dev `afterlink 2.0.0` | 1h |
| Fri | GitHub Release v2.0.0 with CHANGELOG body | 1h |
| Fri | Update `afterlinkdocs.vercel.app` (v2.0.0 changelog, new features, playground link) | 2h |
| Fri | Tweet/post announcement 🎉 | 1h |

**Week 16 Deliverable:** v2.0.0 published across npm, PyPI, pub.dev. GitHub Release created. Docs site updated. Playground live.

---

## 17. CHANGELOG Entry for v2.0.0

```markdown
## [2.0.0] — 2026-08-28

### ⚠️ Breaking Changes

- **Protocol v2 frame** — The binary frame header changes from 10 bytes to 16 bytes + variable routing key.
  v1.x frame decoders are incompatible with v2 frames. The v2.0.0 server supports both
  AL/1.x and AL/2 clients simultaneously. Application-level APIs are unchanged.
- **`server.publish()` in cluster mode** — Now returns a Promise (was synchronous). Add `await`.

### Added

#### @afterlink/cluster (NEW PACKAGE)
- `createCluster(config, workerFn)` — spawn N worker processes, one per CPU core by default
- Redis-backed shared pub/sub via `ioredis` — `server.publish()` delivers to subscribers on all workers
- Worker crash auto-restart with configurable `restartDelay`
- Rolling restart via `SIGUSR2` — zero connections dropped during restart
- `restartOnCrash: true` default with configurable `restartDelay` and `gracefulTimeout`
- Aggregated `/__health` endpoint — collects stats from all workers via IPC
- Redis connection health included in `/__health` response

#### @afterlink/python (NEW — PyPI: afterlink)
- Async Python client: `connect()`, `request()`, `subscribe()`, `publish()`, `stream()`, `disconnect()`
- Async Python server: `@server.on()` decorator, `@server.use` middleware, `server.listen()`
- Pydantic v2 schema validation for route handlers
- `SyncClient` wrapper for synchronous Python code
- `AfterLinkError` with all 19 typed error codes
- TLS support (`afterlinks://`), zlib compression, JWT auth
- Auto-reconnect with exponential backoff
- Python 3.10+ required

#### @afterlink/dart (NEW — pub.dev: afterlink)
- Dart/Flutter client: `connect()`, `request()`, `subscribe()`, `publish()`, `stream()`, `disconnect()`
- TCP transport for Android, iOS, macOS, Windows, Linux, Dart CLI
- WebSocket transport for Flutter web (auto-detected)
- `AfterLinkErrorCode` typed enum with all 19 error codes
- Event streams: `onConnected`, `onDisconnected`, `onReconnecting`, `onServerClosing`
- Null-safe Dart API (sound null safety)
- Flutter widget lifecycle example in `example/flutter_chat/`

#### Protocol v2 Frame
- 16-byte fixed header replacing 10-byte header
- `Version` field (byte 2): `0x01`=v1, `0x02`=v2
- `Priority` field (byte 3): 0–7 priority levels (0=LOWEST, 7=REAL_TIME)
- `RoutingKey` variable-length field (0–255 UTF-8 bytes)
- Flags bits `PRIORITY_SET` (0x04) and `HAS_ROUTING_KEY` (0x08)
- Server-side routing key dispatch (`routing.routes` config)
- Server-side priority queue (`priorityQueue: true` config)
- HELLO/HELLO_ACK protocol version negotiation (`accepted_protocol: "v1"|"v2"`)
- v1.x clients fully supported on v2.0.0 server

#### Metrics & Observability
- Prometheus `/metrics` endpoint via `prom-client` (opt-in via `metrics.enabled: true`)
- 12 metric families: connections, requests, pub/sub, cluster, memory, v2-specific
- `afterlink_request_duration_seconds` histogram with p50/p95/p99 accuracy
- Per-route request counters and latency histograms
- Pre-built Grafana dashboard JSON (`packages/server/grafana/afterlink-dashboard.json`)
- OpenTelemetry distributed tracing (opt-in via `tracing.enabled: true`)
- Root span per request + child spans for middleware, validation, handler
- OTLP, Jaeger, Zipkin, and console exporters
- `getActiveSpan()` for manual instrumentation in route handlers
- W3C TraceContext propagation across service boundaries

#### Playground UI
- Live interactive demo at `afterlinkdocs.vercel.app/playground`
- 5 preset scenarios: Ping/Pong, Pub/Sub Chat, Schema Validation, Streaming, Priority Routing
- Syntax-highlighted code editor with line numbers
- Real-time terminal output with color-coded line types
- Live frame inspector (hex dump of sent/received frames)
- Shared pub/sub channel (all visitors share `playground.chat` topic)
- Fully responsive — mobile layout at 375px

### Changed
- All 4 Node.js packages updated to v2.0.0
- TypeScript `.d.ts` updated for `@afterlink/server` (metrics, tracing, cluster config types)
- `@afterlink/cluster` TypeScript declarations added
- `/__health` endpoint aggregates stats from all cluster workers when clustering is active
- `CHANGELOG.md` format maintained — this entry follows Keep a Changelog
```

---

## 18. Definition of Done

v2.0.0 is considered **complete and releasable** when ALL of the following are true:

### Protocol v2
- [ ] v2 frame encoder/decoder correct for all field combinations
- [ ] v1 client → v2 server works with no code changes
- [ ] v2 client → v2 server uses routing key and priority correctly
- [ ] Priority queue processes priority 7 before priority 0 under load
- [ ] Cross-SDK protocol vector tests pass for Node.js, Python, and Dart

### @afterlink/cluster
- [ ] N workers spawned; all share port via `SO_REUSEPORT`
- [ ] Cross-worker pub/sub via Redis delivers messages correctly
- [ ] Worker crash triggers restart within `restartDelay` ms
- [ ] `SIGUSR2` rolling restart drops 0 connections (confirmed by test)
- [ ] Aggregated `/__health` sums stats from all workers
- [ ] Redis disconnect degrades gracefully (warning logged, local pub/sub continues)

### @afterlink/python
- [ ] `pip install afterlink` works from PyPI
- [ ] Python client ↔ Node.js server: request, subscribe, publish all work
- [ ] Python server ↔ Node.js client: all route types work
- [ ] Pydantic schema validation rejects invalid bodies with `VALIDATION_ERROR`
- [ ] `SyncClient` works in synchronous Python scripts

### @afterlink/dart
- [ ] `flutter pub add afterlink` works from pub.dev
- [ ] Dart client connects to Node.js server via TCP (Android, iOS, desktop)
- [ ] Dart client connects via WebSocket (Flutter web)
- [ ] Flutter chat example runs on Android emulator without errors
- [ ] All `AfterLinkErrorCode` enum values defined

### Metrics
- [ ] `/metrics` validates with `promtool check metrics`
- [ ] All 12 metric families present
- [ ] Grafana dashboard imports without errors
- [ ] OTel spans exported to OTLP endpoint with correct attributes
- [ ] `sampleRate: 0.1` samples approximately 10% of requests

### Playground
- [ ] Live at `afterlinkdocs.vercel.app/playground`
- [ ] All 5 preset scenarios complete successfully
- [ ] Shared pub/sub channel works across multiple browser tabs
- [ ] Frame inspector shows correct hex dumps
- [ ] Lighthouse performance > 90

### Documentation
- [ ] All 8 new doc files written and reviewed
- [ ] `README.md` updated with v2.0.0 features and new packages
- [ ] `CHANGELOG.md` v2.0.0 section complete
- [ ] `docs/migration-v1-to-v2.md` reviewed for accuracy

### Release
- [ ] v2.0.0 in all 4 JS `package.json` files
- [ ] `afterlink==2.0.0` on PyPI
- [ ] `afterlink 2.0.0` on pub.dev
- [ ] All JS packages published to npm: `@afterlink/core`, `server`, `client`, `browser`, `cli`, `cluster`, meta `afterlink`
- [ ] Git tag `v2.0.0` pushed
- [ ] GitHub Release v2.0.0 created with full CHANGELOG body
- [ ] `afterlinkdocs.vercel.app` updated

---

## 19. Risk & Mitigation

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Redis `ioredis` reconnect storms when Redis restarts | Medium | High | Implement jitter on reconnect delay; cap concurrent reconnect attempts; use `enableReadyCheck: true` in ioredis config |
| Port sharing (`SO_REUSEPORT`) not available on Windows | Medium | Medium | Detect OS at runtime; fall back to sticky sessions via primary process proxy on Windows |
| Python `msgpack` version incompatibility with Node.js `msgpack-lite` output | Medium | High | Include cross-language MessagePack compatibility test vectors; test edge cases (nil, int64, binary) |
| Dart `ByteData` endianness differs from Node.js `Buffer.readUInt32BE()` | Medium | High | Explicitly use `Endian.big` in all Dart `ByteData.get*` calls; verify with protocol vector tests in Week 9 |
| Playground server overwhelmed by traffic after launch | High | Medium | Rate limiting (10 req/sec per connection); max 500 concurrent connections; Fly.io auto-scaling enabled |
| OTel SDK adds more than 1ms overhead to requests | Low | Medium | Benchmark OTel with `sampleRate: 1.0` in Week 11; if overhead > 1ms, switch from sync to async span export |
| Python server performance too slow for production workloads | Medium | Medium | Clearly document that Python server is best for prototyping and ML inference; Node.js server is recommended for high-throughput production; add benchmark comparison to docs |
| v2 frame migration guide incomplete, causing production incidents | Medium | High | Have migration guide reviewed by a developer unfamiliar with AfterLink internals; add step-by-step rollback procedure |
| Dart Flutter web target requires WebSocket — server may not have `websocket.enabled: true` | High | Medium | Document prominently in `docs/dart.md`; `AfterLinkClient` on Flutter web throws `TRANSPORT_UNAVAILABLE` with a clear message if WebSocket is not enabled |
| pub.dev publish fails due to Dart package policy | Low | Medium | Review pub.dev publishing checklist in Week 13 Day 1; ensure `example/` directory is present and compiles |
| PyPI package name `afterlink` already taken | Low | High | Check `pip install afterlink` before starting Week 12 development; if taken, publish as `afterlink-protocol` and update all docs accordingly |
| Protocol v2 introduces subtle MessagePack + routing key offset bug in Python or Dart | Medium | High | Run the shared `protocol-vectors.json` test suite against all three SDKs in Week 15 before publishing |

---

*AfterLink v2.0.0 PRD — Version 1.0 — May 2026*
*Author: Ajju (Javali Ajayakumar) — GTTC Magadi, Karnataka*
*Predecessor: Phase 1 PRD (v1.1.0) · Phase 2 PRD (v1.2.0)*
*This is the final phase of the AfterLink 3-phase roadmap.*
*Post-v2.0.0 directions: AfterLink Cloud, WASM SDK, Go SDK, message broker binary.*
