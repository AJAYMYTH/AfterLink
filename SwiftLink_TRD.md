# SwiftLink Protocol — Technical Requirements Document (TRD)

**Version:** 1.0.0
**Author:** Ajju (Javali Ajayakumar)
**Date:** May 2026
**Status:** Draft

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Protocol Specification](#2-protocol-specification)
3. [Connection Lifecycle](#3-connection-lifecycle)
4. [Frame Specification](#4-frame-specification)
5. [Encoding & Serialization](#5-encoding--serialization)
6. [Multiplexing Design](#6-multiplexing-design)
7. [Streaming Design](#7-streaming-design)
8. [Pub/Sub Design](#8-pubsub-design)
9. [Authentication & Security](#9-authentication--security)
10. [SDK Architecture](#10-sdk-architecture)
11. [CLI Tool Architecture](#11-cli-tool-architecture)
12. [HTTP Gateway Bridge](#12-http-gateway-bridge)
13. [Error Handling](#13-error-handling)
14. [Performance Requirements](#14-performance-requirements)
15. [Technology Stack](#15-technology-stack)

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SwiftLink Ecosystem                              │
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │  Browser App │    │  Mobile App  │    │     IoT / Device         │  │
│  │  (JS SDK)    │    │  (Dart SDK)  │    │     (C / Python SDK)     │  │
│  └──────┬───────┘    └──────┬───────┘    └────────────┬─────────────┘  │
│         │ WebSocket         │ TCP                      │ TCP            │
│         └──────────────┬────┘──────────────────────────┘               │
│                        │                                                │
│              ┌─────────▼──────────┐                                    │
│              │   SwiftLink Server  │                                    │
│              │   (Node.js / Go)    │                                    │
│              │                    │                                    │
│              │  ┌──────────────┐  │                                    │
│              │  │ Frame Router │  │                                    │
│              │  └──────┬───────┘  │                                    │
│              │         │          │                                    │
│              │  ┌──────┴───────┐  │                                    │
│              │  │  Middleware  │  │                                    │
│              │  │    Chain     │  │                                    │
│              │  └──────┬───────┘  │                                    │
│              │         │          │                                    │
│              │  ┌──────┴───────┐  │                                    │
│              │  │Route Handlers│  │                                    │
│              │  └──────────────┘  │                                    │
│              └─────────┬──────────┘                                    │
│                        │                                                │
│          ┌─────────────┼──────────────┐                                │
│          │             │              │                                 │
│  ┌───────▼──────┐  ┌───▼──────┐  ┌───▼────────────┐                   │
│  │  HTTP Gateway│  │  Pub/Sub │  │  DevTools API  │                   │
│  │  Bridge      │  │  Broker  │  │  (WebSocket)   │                   │
│  └──────────────┘  └──────────┘  └────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Summary

| Component | Responsibility |
|---|---|
| SwiftLink Server | Accepts connections, routes frames, manages state |
| Frame Router | Decodes binary frames and dispatches to handlers |
| Middleware Chain | Auth, logging, validation, rate limiting |
| Route Handlers | Developer-defined business logic |
| HTTP Gateway | Translates HTTP requests to SwiftLink frames |
| Pub/Sub Broker | In-process topic management and fan-out |
| DevTools API | WebSocket API consumed by browser DevTools dashboard |

---

## 2. Protocol Specification

### 2.1 Protocol Identifier

```
Protocol Name:    SwiftLink
Version:          1 (SL/1)
URI Scheme:       swiftlink://
Secure URI:       swiftlinks://
Default Port:     4000 (TCP)
WS Port:          4001 (WebSocket)
```

### 2.2 Transport Support

| Transport | Use Case | Notes |
|---|---|---|
| Raw TCP | Server-to-server, IoT | Fastest; no HTTP overhead |
| WebSocket | Browser clients | Full SwiftLink frames over WS data messages |
| TLS over TCP | Secure server-to-server | Certificate-based |
| WSS (TLS+WS) | Secure browser | Standard wss:// |

### 2.3 Handshake Sequence

```
Client                              Server
  │                                    │
  │──── TCP / WS Connect ─────────────▶│
  │                                    │
  │──── HELLO Frame ──────────────────▶│
  │    { version: "SL/1",             │
  │      auth: <token or null>,        │
  │      capabilities: [...] }         │
  │                                    │
  │◀─── HELLO_ACK Frame ──────────────│
  │    { session_id: "...",            │
  │      server_version: "SL/1",       │
  │      capabilities: [...] }         │
  │                                    │
  │       (Connection Established)     │
  │                                    │
  │◀──▶  REQUEST / RESPONSE frames     │
  │                                    │
  │──── CLOSE Frame ──────────────────▶│
  │◀─── CLOSE_ACK ────────────────────│
```

If authentication fails, the server responds with an AUTH_ERROR frame and closes the connection.

---

## 3. Connection Lifecycle

### 3.1 States

```
NEW ──connect()──▶ CONNECTING ──HELLO_ACK──▶ CONNECTED
                        │                        │
                     error                    close()
                        │                        │
                        ▼                        ▼
                   RECONNECTING ◀──────── DISCONNECTED
                        │
                  max retries exceeded
                        │
                        ▼
                      CLOSED
```

### 3.2 Keep-Alive

- Client sends PING frame every 30 seconds (configurable)
- Server must respond with PONG within 10 seconds
- If no PONG is received, the client marks the connection as dead and triggers reconnect
- Server pings clients that have been idle for 60 seconds

### 3.3 Auto-Reconnect Algorithm

```
attempt = 0
delay = 1 second (initial)
max_delay = 60 seconds
multiplier = 2
jitter = random(0, 0.3 * delay)

while attempt < max_attempts:
  wait(delay + jitter)
  try connect()
  on success: reset attempt = 0, delay = 1s
  on failure: delay = min(delay * multiplier, max_delay)
              attempt++
```

---

## 4. Frame Specification

### 4.1 Frame Header (10 bytes fixed)

```
 0               1               2               3
 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7
├───────────────┼───────────────┼───────────────────────────────────┤
│  Frame Type   │     Flags     │         Message ID (4 bytes)      │
│   (1 byte)    │   (1 byte)    │                                   │
├───────────────┴───────────────┴───────────────────────────────────┤
│                    Payload Length (4 bytes)                        │
├───────────────────────────────────────────────────────────────────┤
│                    Payload (variable)                              │
└───────────────────────────────────────────────────────────────────┘
```

Total header size: **10 bytes**
Maximum payload size: **4,294,967,295 bytes** (~4 GB, limited in practice by config)
Default max payload: **16 MB**

### 4.2 Frame Types Table

| Hex | Name | Direction | Description |
|---|---|---|---|
| 0x01 | REQUEST | C→S | Client request to a named route |
| 0x02 | RESPONSE | S→C | Server response to a request |
| 0x03 | STREAM_START | S→C | Begin streaming sequence |
| 0x04 | STREAM_DATA | S→C | A chunk of streamed data |
| 0x05 | STREAM_END | S→C | End of stream |
| 0x06 | ERROR | Both | Error response |
| 0x07 | PING | Both | Keep-alive ping |
| 0x08 | PONG | Both | Keep-alive pong |
| 0x09 | BROADCAST | S→C | Push to all/filtered clients |
| 0x0A | SUBSCRIBE | C→S | Subscribe to a topic |
| 0x0B | UNSUBSCRIBE | C→S | Unsubscribe from a topic |
| 0x0C | PUBLISH | C→S or S→C | Publish message to a topic |
| 0x0D | CLOSE | Both | Begin graceful close |
| 0x0E | CLOSE_ACK | Both | Acknowledge close |
| 0x0F | HELLO | C→S | Initial handshake |
| 0x10 | HELLO_ACK | S→C | Handshake acknowledgement |

### 4.3 Flags Byte

```
Bit 7 (MSB): COMPRESSED    — Payload is zstd compressed
Bit 6:       ENCRYPTED     — Payload is encrypted (TLS is at transport; this is app-layer)
Bit 5:       FINAL         — Last frame in a sequence (streaming)
Bit 4:       PRIORITY      — High-priority frame (processed before normal frames)
Bit 3:       ACK_REQUIRED  — Sender expects explicit acknowledgement
Bits 2–0:    Reserved (must be 0)
```

### 4.4 REQUEST Frame Payload Structure

```json
{
  "route": "getUser",
  "body": { "id": 42 },
  "meta": {
    "timestamp": 1748000000000,
    "trace_id": "abc-123"
  }
}
```

### 4.5 RESPONSE Frame Payload Structure

```json
{
  "status": "ok",
  "body": { "user": { "id": 42, "name": "Ajju" } },
  "meta": {
    "duration_ms": 3,
    "trace_id": "abc-123"
  }
}
```

### 4.6 ERROR Frame Payload Structure

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Field 'id' is required",
  "details": { "field": "id" },
  "trace_id": "abc-123"
}
```

### 4.7 Standard Error Codes

| Code | Meaning |
|---|---|
| AUTH_REQUIRED | No authentication provided |
| AUTH_INVALID | Token invalid or expired |
| ROUTE_NOT_FOUND | No handler registered for route name |
| VALIDATION_ERROR | Payload failed schema validation |
| RATE_LIMITED | Too many requests from this connection |
| INTERNAL_ERROR | Unhandled server error |
| PAYLOAD_TOO_LARGE | Payload exceeds server limit |
| PROTOCOL_ERROR | Malformed frame received |
| TIMEOUT | Request timed out on server |

---

## 5. Encoding & Serialization

### 5.1 Default Serialization: MessagePack

MessagePack is used as the default payload serialization format because:
- ~30% smaller than JSON on average
- Binary-safe (supports Buffer/Bytes natively)
- Supported in all major languages
- Still human-readable when decoded

### 5.2 JSON Mode

Clients can negotiate JSON mode during the HELLO handshake. This is slower but easier to debug. The DevTools dashboard forces JSON mode for readability.

### 5.3 Compression

zstd level 3 is the default compression. Applied only when:
- The COMPRESSED flag is set in the frame header
- Payload size > 512 bytes (compression of small payloads is wasteful)

```
Raw Payload ──zstd compress──▶ Compressed Bytes ──▶ Frame Payload
```

---

## 6. Multiplexing Design

### 6.1 Message ID Assignment

- Client maintains an atomic counter starting at 1
- Each new REQUEST gets the next ID
- IDs are 32-bit unsigned integers (wraps at 4,294,967,295)
- Server uses the client-assigned ID in its RESPONSE

### 6.2 Pending Request Map

```javascript
// Client internals
class PendingRequests {
  map = new Map(); // messageId → { resolve, reject, timeout }

  add(id, resolve, reject) {
    const timeout = setTimeout(() => {
      this.map.delete(id);
      reject(new Error('Request timeout'));
    }, this.timeoutMs);
    this.map.set(id, { resolve, reject, timeout });
  }

  resolve(id, payload) {
    const pending = this.map.get(id);
    clearTimeout(pending.timeout);
    this.map.delete(id);
    pending.resolve(payload);
  }
}
```

### 6.3 Max Concurrent Requests

Default limit: **1,000 in-flight requests** per connection.
Exceeding this returns a RATE_LIMITED error immediately.

---

## 7. Streaming Design

### 7.1 Stream Sequence

```
Client                          Server
  │                               │
  │──── REQUEST (streamMode:true)─▶│
  │                               │
  │◀─── STREAM_START ─────────────│
  │◀─── STREAM_DATA (chunk 1) ────│
  │◀─── STREAM_DATA (chunk 2) ────│
  │◀─── STREAM_DATA (chunk N) ────│
  │◀─── STREAM_END ───────────────│
```

### 7.2 Stream Backpressure

- Client tracks a receive window (default 64 chunks)
- When window is full, client sends a STREAM_PAUSE frame
- Server pauses sending STREAM_DATA frames
- Client sends STREAM_RESUME when ready

### 7.3 Stream Cancellation

Client can cancel a stream by sending a CLOSE frame with the stream's Message ID. Server stops sending immediately.

---

## 8. Pub/Sub Design

### 8.1 Topic Naming Convention

```
Topics are dot-separated hierarchical strings:
  prices.BTC
  orders.user.42
  system.alerts
  
Wildcards:
  prices.*          — matches prices.BTC, prices.ETH
  orders.user.*     — matches orders.user.42, orders.user.99
  **                — matches everything (superuser only)
```

### 8.2 Subscription Flow

```
Client                          Server
  │                               │
  │──── SUBSCRIBE ────────────────▶│
  │     { topic: "prices.BTC" }   │
  │                               │
  │◀─── SUBSCRIBE_ACK ────────────│
  │     { topic: "prices.BTC",    │
  │       sub_id: "s1" }          │
  │                               │
  │     ... later ...             │
  │◀─── PUBLISH ──────────────────│
  │     { topic: "prices.BTC",    │
  │       data: { price: 65000 } }│
```

### 8.3 In-Process Broker

The default pub/sub broker is in-process (single server). For multi-server setups, the broker can be backed by Redis or NATS (plugin system in v2).

```javascript
class PubSubBroker {
  topics = new Map(); // topic → Set<Connection>

  subscribe(topic, connection) { ... }
  unsubscribe(topic, connection) { ... }
  publish(topic, data) { // fan-out to all matching subscribers }
  cleanupConnection(connection) { // remove all subscriptions }
}
```

---

## 9. Authentication & Security

### 9.1 Handshake Authentication

JWT token is passed in the HELLO frame `auth` field. The server validates:
- Signature (HMAC-SHA256 or RS256)
- Expiry (`exp` claim)
- Issuer (`iss` claim, if configured)

On failure: AUTH_INVALID error and connection close.

### 9.2 TLS Configuration

```javascript
const server = new SwiftLink.Server({
  port: 4000,
  tls: {
    cert: fs.readFileSync('cert.pem'),
    key:  fs.readFileSync('key.pem'),
    ca:   fs.readFileSync('ca.pem'),   // optional, for mutual TLS
  }
});
```

### 9.3 Rate Limiting Algorithm

Token bucket per connection:

```
bucket_capacity = 100 requests
refill_rate = 10 requests/second

on each request:
  if bucket.tokens >= 1:
    bucket.tokens -= 1
    allow()
  else:
    reject(RATE_LIMITED)
```

### 9.4 Message Signing (Optional)

When enabled, each frame includes an HMAC-SHA256 signature of the payload appended to the frame. The receiver verifies before processing.

```
signature = HMAC-SHA256(secret_key, payload_bytes)
```

---

## 10. SDK Architecture

### 10.1 Node.js SDK Structure

```
swiftlink-node/
├── src/
│   ├── server/
│   │   ├── Server.js          — Main server class
│   │   ├── Connection.js      — Per-client connection handler
│   │   ├── Router.js          — Route registry and dispatch
│   │   ├── Middleware.js      — Middleware chain executor
│   │   └── PubSubBroker.js    — In-process pub/sub
│   ├── client/
│   │   ├── Client.js          — Main client class
│   │   ├── PendingRequests.js — In-flight request tracking
│   │   └── Reconnect.js       — Auto-reconnect logic
│   ├── protocol/
│   │   ├── Frame.js           — Frame encode/decode
│   │   ├── FrameTypes.js      — Constants
│   │   └── Serializer.js      — MessagePack / JSON
│   ├── security/
│   │   ├── Auth.js            — JWT validation
│   │   └── RateLimiter.js     — Token bucket
│   └── index.js               — Public API exports
├── test/
├── package.json
└── README.md
```

### 10.2 Python SDK Structure

```
swiftlink-python/
├── swiftlink/
│   ├── __init__.py
│   ├── server.py              — AsyncIO server
│   ├── client.py              — AsyncIO client
│   ├── protocol/
│   │   ├── frame.py           — Struct-based frame codec
│   │   └── serializer.py      — msgpack / json
│   ├── security/
│   │   ├── auth.py
│   │   └── rate_limiter.py
│   └── pubsub.py
├── tests/
├── pyproject.toml
└── README.md
```

### 10.3 SDK Public API Contract

All SDKs must implement this interface contract (translated to each language's idioms):

```typescript
// Server
interface SwiftLinkServer {
  on(route: string, handler: Handler, schema?: Schema): void;
  use(middleware: Middleware): void;
  subscribe(topic: string, handler: Handler): void;
  publish(topic: string, data: any, filter?: ClientFilter): void;
  listen(port: number): Promise<void>;
  close(): Promise<void>;
}

// Client
interface SwiftLinkClient {
  connect(): Promise<void>;
  request(route: string, body: any, options?: RequestOptions): Promise<any>;
  stream(route: string, body: any): AsyncIterableIterator<any>;
  subscribe(topic: string, handler: (data: any) => void): Subscription;
  disconnect(): Promise<void>;
}
```

---

## 11. CLI Tool Architecture

### 11.1 Commands

```
sl init <project-name>         — Scaffold a new SwiftLink project
sl serve [config]              — Start a SwiftLink server from config file
sl test --route <name>         — Send a test request and print response
sl monitor --host <url>        — Live connection and message monitor
sl gen-client --lang <lang>    — Generate client SDK boilerplate
sl inspect --frame <hex>       — Decode a raw frame hex string
sl docs --output <dir>         — Generate HTML API documentation
```

### 11.2 `sl init` Output Structure

```
my-project/
├── slconfig.json              — Server configuration
├── routes/
│   └── hello.js               — Example route handler
├── middleware/
│   └── auth.js                — Example middleware
├── .env                       — Environment variables
├── server.js                  — Entry point
└── package.json
```

### 11.3 `slconfig.json` Schema

```json
{
  "port": 4000,
  "ws_port": 4001,
  "max_payload_mb": 16,
  "auth": {
    "type": "jwt",
    "secret_env": "JWT_SECRET"
  },
  "rate_limit": {
    "capacity": 100,
    "refill_per_second": 10
  },
  "compression": true,
  "routes_dir": "./routes",
  "middleware_dir": "./middleware",
  "tls": null
}
```

---

## 12. HTTP Gateway Bridge

### 12.1 Architecture

```
HTTP Client                    Gateway                    SwiftLink Server
    │                             │                              │
    │── POST /sl/getUser ────────▶│                              │
    │   Body: {"id": 42}          │── REQUEST frame ────────────▶│
    │                             │   route: "getUser"           │
    │                             │   body: {"id": 42}           │
    │                             │◀── RESPONSE frame ───────────│
    │◀── HTTP 200 ────────────────│                              │
    │    Body: {"user": {...}}     │                              │
```

### 12.2 URL Mapping

```
HTTP Method: POST
URL:         /sl/{route_name}
Body:        JSON or form-encoded (converted to SwiftLink body)
Headers:
  Authorization: Bearer <token>   → passed as auth in SwiftLink request
  X-SwiftLink-Host: <server_url>  → target SwiftLink server (optional)
```

### 12.3 Gateway Configuration

The gateway runs as a separate lightweight server (default port: 4080) and maintains a persistent SwiftLink connection pool to each upstream server.

---

## 13. Error Handling

### 13.1 Error Propagation Model

```
Server handler throws exception
        │
        ▼
Error middleware intercepts
        │
        ├── Known error (ValidationError, AuthError) → Structured ERROR frame
        └── Unknown error → INTERNAL_ERROR + sanitized message (no stack traces)
```

### 13.2 Client Error Handling

```javascript
try {
  const result = await client.request('getUser', { id: 42 });
} catch (err) {
  if (err.code === 'ROUTE_NOT_FOUND') { ... }
  if (err.code === 'VALIDATION_ERROR') { ... }
  if (err.code === 'AUTH_INVALID') { ... }
}
```

### 13.3 Graceful Degradation

- If the server cannot process a request within the timeout, it sends TIMEOUT error frame
- Default timeout: 30 seconds (configurable per route)
- Timed-out requests are cleaned up from server memory immediately

---

## 14. Performance Requirements

### 14.1 Benchmarks (Target)

| Metric | Target | Measurement Method |
|---|---|---|
| Requests/second (single core) | 100,000+ | autocannon benchmark tool |
| Round-trip latency (LAN) | < 1ms p50, < 5ms p99 | histogram with 10K requests |
| Memory per idle connection | < 50KB | profiled with heapdump |
| Frame decode time | < 10µs | micro-benchmark |
| Compression overhead (zstd) | < 20µs per KB | micro-benchmark |
| Pub/Sub fan-out (1000 subs) | < 5ms | load test |

### 14.2 Connection Pooling

Clients should maintain a pool of connections for high-throughput use cases:

```javascript
const pool = new SwiftLink.ConnectionPool({
  host: 'swiftlink://api.example.com',
  min: 2,
  max: 10,
  acquireTimeout: 5000
});

const result = await pool.request('getData', { ... });
```

---

## 15. Technology Stack

### 15.1 Reference Server (Node.js)

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| TCP server | net module (built-in) |
| WebSocket | ws library |
| Serialization | msgpackr |
| Compression | @mongodb-js/zstd |
| JWT | jose |
| Schema validation | zod |
| Testing | vitest |
| Benchmarking | autocannon |

### 15.2 Reference Client (Node.js + Browser)

| Feature | Technology |
|---|---|
| Transport (Node.js) | net / tls module |
| Transport (Browser) | WebSocket API |
| Serialization | msgpackr |
| Build (Browser) | esbuild / Vite |

### 15.3 Python SDK

| Layer | Technology |
|---|---|
| Runtime | Python 3.11+ |
| Async | asyncio |
| TCP | asyncio streams |
| WebSocket | websockets library |
| Serialization | msgpack |
| Compression | zstandard |
| JWT | python-jose |
| Testing | pytest + pytest-asyncio |

### 15.4 DevTools Dashboard

| Layer | Technology |
|---|---|
| Framework | React + Vite |
| Styling | Tailwind CSS |
| Charts | Recharts |
| WebSocket client | native browser WS |
| State management | Zustand |

---

*Document End — SwiftLink TRD v1.0*
