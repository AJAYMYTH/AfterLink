# Changelog

All notable changes to AfterLink are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/)

---

## [Unreleased]

_Changes staged for the next release_

---

## [1.2.0] — 2026-05-19

### Added
- **Error taxonomy**: `AfterLinkError` base class + 22 typed subclasses (`ProtocolError`, `AuthError`, `RouteError`, `ValidationError`, `RateLimitError`, `ConnectionError`, `ServerError`, `CompressionError`)
- `fromError()` — convert any `Error` to typed `AfterLinkError`
- `fromFramePayload()` — deserialize error from ERROR frame payload
- `getErrorClassByCode()` — look up error class by code string
- TypeScript definitions (`.d.ts`) for `@afterlink/core`, `@afterlink/server`, `@afterlink/client`
- **Health endpoint** (`/__health`, `/__health/live`, `/__health/ready`, `/__health/stats`)
- Protocol detection on TCP socket (`GET` vs HELLO frame) for same-port health
- Optional separate HTTP port for health endpoint
- Configurable health thresholds (max connections, error rate, latency)
- Bearer token authentication for health endpoints
- **Browser SDK** (`@afterlink/browser`) — zero-dependency WebSocket client
- Auto-reconnect with exponential backoff and jitter
- Ping/keepalive support
- Pub/Sub over WebSocket transport
- **WebSocket bridge** (`ws-bridge.js`) — translates WS binary frames to AfterLink frames
- CORS origin validation for WebSocket connections
- **CLI tool** (`@afterlink/cli`) — terminal testing and monitoring utility
- `afterlink ping` — PING/PONG latency measurement with stats
- `afterlink call` — request/response with route invocation
- `afterlink inspect` — raw frame inspector with annotated hex dump
- `afterlink monitor` — live terminal dashboard (connections, req/sec, latency, error rate, top routes)
- `~/.afterlinkrc` connection profile loader
- Colored terminal output with JSON/raw/trace modes
- `examples/browser-example/` — working browser demo with inline client, health dashboard, chat pub/sub
- 39 unit tests for error classes
- 11 unit tests for health status computation
- 8 CLI integration tests (real server)
- 9 browser integration tests (WebSocket bridge ↔ client)

### Changed
- `Connection.js` now handles PING/PONG frames at the connection level (no longer dispatched to router)
- `Server.js` rewritten with stats tracking (`getStats()`), health endpoint integration, WS bridge startup, and state machine (`initialized` → `running` → `closing` → `closed`)
- `Router.js` updated with latency tracking via `finally` block and `_onRequestComplete` callback hook
- Replaced all `throw new Error()` with typed errors across `@afterlink/core`, `@afterlink/server`, `@afterlink/client`
- `ws` dependency added to `@afterlink/server` for WebSocket bridge
- `commander` dependency added to `@afterlink/cli`

### Fixed
- Reverted `Frame.js` and `Serializer.js` to native `Error`/`RangeError` to eliminate circular `require()` dependencies with the new `errors/` module
- Used `workspace:*` protocol for `@afterlink/core` dependency in client/server packages to fix vitest module resolution
- Browser client `ws.send()` now sends Buffer directly (not `frame.buffer`) to avoid ArrayBuffer size mismatch with `ws` library

---

## [1.1.2] — 2026-05-19

### Added
- Full README.md included in all npm packages (`@afterlink/core`, `@afterlink/server`, `@afterlink/client`, `afterlink`)
- Package pages on npm now show complete documentation, features, and quick start guides

---

## [1.1.1] — 2026-05-19

### Fixed
- Normalize `workspace:*` dependencies to `^1.1.1` for npm registry compatibility
- Ensure all packages install correctly via `npm install afterlink`

---

## [1.1.0] — 2026-05-19

### Added
- TLS/SSL encryption via `afterlinks://` URL scheme (`@afterlink/server`, `@afterlink/client`)
- `generateDevCerts()` utility for self-signed dev certificates using `selfsigned` package
- zlib/Brotli payload compression with per-frame Flags bit (`@afterlink/core`)
- Compression negotiation in HELLO/HELLO_ACK handshake
- Per-route compression override option
- Per-connection token-bucket rate limiting (`@afterlink/server`)
- `RATE_LIMITED` error code with `retryAfter` in milliseconds
- Rate limit policy communicated to client in HELLO_ACK
- `closeAfterViolations` option to auto-close abusive connections
- `server.close()` graceful shutdown — drains active requests before closing
- `SERVER_CLOSING` frame type (`0x11`) — server notifies clients of shutdown
- `server.on('closing')`, `server.on('drained')`, `server.on('closed')` events
- `client.on('server-closing')` event
- `server.handleProcessSignals()` — auto-registers SIGTERM/SIGINT handlers
- Flags byte specification in frame header (bit 0: compressed)
- Capability advertisement in HELLO payload
- `examples/tls-example/` — working TLS server + client demo
- `examples/compression-example/` — working compression demo
- `examples/rate-limit-shutdown-example/` — rate limiting + graceful shutdown demo

### Changed
- HELLO frame payload extended with `capabilities` and `compression` fields
- HELLO_ACK payload extended with `rateLimit` and `compression` fields
- `server.close()` is now async (returns Promise) — drains active requests
- `server.on()` now supports both route registration and event listening
- Server version bumped to `AL/1.1` in HELLO_ACK

### Fixed
- Client `autoReconnect` now correctly distinguishes graceful vs unplanned disconnects
- Rate limiter middleware properly integrated into request handling pipeline
- Request tracking for accurate graceful shutdown drain detection

---

## [1.0.1] — 2026-05-18

### Added
- TLS/SSL encryption support via `afterlinks://` URL scheme
- `generateDevCerts()` utility for development environments
- TLS transport wrappers for server and client
- TLS error types (`TLS_CERT_UNTRUSTED`, `TLS_CERT_ERROR`, `TLS_CONFIG_ERROR`)
- `Server.isTLS()` and `Client.isTLS()` methods
- `examples/tls-example/` demo

### Changed
- HELLO handshake updated with `capabilities` field
- Bump all packages to v1.0.1

---

## [1.0.0] — 2026-05-01

### Added
- Binary TCP communication protocol with 10-byte frame header
- Frame types: REQUEST, RESPONSE, STREAM_START/DATA/END, ERROR, PING/PONG,
  BROADCAST, SUBSCRIBE, UNSUBSCRIBE, PUBLISH, CLOSE, CLOSE_ACK, HELLO, HELLO_ACK
- MessagePack payload serialization
- HELLO/HELLO_ACK connection handshake
- Request/response with 32-bit message ID (multiplexing)
- Built-in Pub/Sub (PUBLISH/SUBSCRIBE/UNSUBSCRIBE)
- Express-style middleware chain
- Automatic Zod schema validation per route
- JWT authentication option in HELLO handshake
- Auto-reconnect client with configurable delay and max attempts
- Ping/pong keep-alive
- Streaming frames (STREAM_START / STREAM_DATA / STREAM_END)
- monorepo structure: `@afterlink/core`, `@afterlink/server`, `@afterlink/client`
- `afterlink` meta-package (installs all three)
- Published to npm: https://www.npmjs.com/package/afterlink
- Demo suite: hello-world, chat, dashboard, microservice, demo-runner
- DEPLOYMENT.md guide (PM2, Docker, Railway, Render, Fly.io, AWS, Kubernetes)
- SECURITY.md policy
