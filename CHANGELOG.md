# Changelog

All notable changes to AfterLink are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/)

---

## [Unreleased]

_No unreleased changes yet._

---

## [2.0.3] — 2026-10-17

### Changed
- **Node.js client — protocol v2 negotiation**: `@afterlink/client` now requests `AL/2` in the HELLO handshake; once the server confirms with `accepted_protocol: 'v2'` all subsequent frames use the 16-byte v2 header (routing key / priority capable). HELLO itself stays v1-framed so older servers can parse it, and v1-only servers fall back per session. Adds the `protocolVersion` client option (`2` default, `1` to pin v1) and `getProtocolVersion()`.
- **Browser client + WebSocket bridge — protocol v2 negotiation**: `@afterlink/browser` negotiates AL/2 the same way; the server's WS bridge decodes both frame versions, returns `accepted_protocol` (`v1`/`v2`) and `server_version: AL/2` in `HELLO_ACK`, and encodes all subsequent frames with the session's negotiated format.
- **`TcpClient` (`@afterlink/core`)**: requests `AL/2` by default with automatic v1 fallback, exposing the negotiated version via the `protocolVersion` getter.

### Fixed
- **Python SDK — Protocol v2 frame header**: `encode_v2`/`decode_v2` packed an 18-byte header (4-byte reserved field) instead of the 16-byte layout defined by `test/protocol-vectors.json`, so v2 frames were not byte-identical to the Node.js and Dart encoders and `struct.unpack` failed on decode.
- **Python/Dart clients — HELLO_ACK handshake**: `HELLO_ACK` frames now resolve the pending handshake future. Previously only `RESPONSE`/`ERROR` frames were matched, so every connect timed out against a real server.
- **Dart client — MessagePack maps**: `MessagePackCodec.deserialize` now normalizes decoded maps to `Map<String, dynamic>`, fixing the `type '_Map<dynamic, dynamic>' is not a subtype of type 'Map<String, dynamic>'` crash in `request()`.
- **Cross-SDK error codes**: Python and Dart clients now map the canonical string error codes sent by Node.js servers (e.g. `ROUTE_NOT_FOUND`); the Python server now emits string codes over the wire so Node.js clients resolve typed errors.
- **Python/Dart clients — pub/sub**: `subscribe()`/`unsubscribe()`/`publish()` now use the protocol's `SUBSCRIBE`/`UNSUBSCRIBE`/`PUBLISH` frame types instead of `pubsub/*` routes that were never registered on Node.js servers.
- **Node.js server — protocol negotiation**: `HELLO_ACK` now includes `accepted_protocol` (`v1`/`v2`) and server responses are encoded with the negotiated frame version, so v2-capable clients (Python/Dart) can use routing keys and priorities.

### Added
- **Negotiation test coverage** — raw-socket tests for `@afterlink/client` (v2 ACK, legacy v1 fallback, v1-framed ACK containing `accepted_protocol: v2` as sent by the Python server, pinned v1, reconnect re-negotiation), WS-bridge v2 integration tests for `@afterlink/browser`, and `TcpClient` negotiation tests.
- **Python server — pub/sub broker**: `SUBSCRIBE`/`UNSUBSCRIBE`/`PUBLISH` frames are now handled with per-topic subscriber tracking (no echo to the publisher, matching the Node.js broker).
- **Python regression test** for pub/sub round-trip and AL/2 negotiation.
- **Dart `tool/e2e_check.dart`** — live cross-SDK smoke check (request, routing key, typed errors, pub/sub) against a running Node.js server.

---

## [2.0.2] — 2026-07-07

### Changed
- Bumped all packages (JS, Python, Dart) to 2.0.2.
- README updated with detailed package documentation and SDK guides for Python, Dart, and the other packages.

---

## [2.0.1] — 2026-07-06

### Added
- **Redis Cluster support** in `@afterlink/cluster` — cluster-wide pub/sub and slot routing when configured with a `nodes` array or `cluster` flag.

### Fixed
- **npm publishing** — renamed the root workspace package to avoid a name collision and made the scope-renaming script replace scope names recursively inside code and documentation.
- **Dart SDK** — migrated from the streaming-only `messagepack` dependency to `msgpack_dart`, resolving compilation issues and ensuring standard-compliant MessagePack serialization.
- **CI** — aligned the Node.js version matrix with pnpm v11 and fixed a server unit test.

---

## [2.0.0] — 2026-07-03

### Added
- **Protocol v2 Header**: Upgraded header to 16-byte fixed layout supporting version negotiation (v1 vs v2), priority queues (0-7), and custom string routing keys (0-255 bytes). Added `ROUTE_REQUEST` and `PRIORITY_ACK` frame types.
- **Node Clustering**: Created the new `@ajaymyth/cluster` package enabling multi-process clustering with Redis-backed shared pub/sub routing, worker crash detection/restarts, and SIGUSR2 rolling restarts.
- **Metrics & Observability**: Integrated custom self-contained Prometheus endpoint, Grafana dashboard JSON template, and custom OpenTelemetry-compliant TracingManager with AsyncLocalStorage context propagation.
- **Python SDK**: Authored the new Python SDK (`afterlink`) providing async client, async server, sync wrapper, type hints, and Pydantic validation support.
- **Dart Client SDK**: Authored the new Dart Client SDK (`afterlink`) supporting native TCP and web WebSocket transports using conditional compilation loaders.

---


## [1.2.4] — 2026-06-06

### Added
- Added new `afterlink upgrade` CLI command to easily keep all packages up to date.
- Configured umbrella `afterlink` package to use `latest` version resolution for all dependencies.

### Fixed
- **Security / Vulnerability Fix:** Removed `@ajaymyth/ai-assistant` from the default dependencies/optionalDependencies of the `afterlink` umbrella package. This prevents heavy, vulnerable machine learning packages (such as LangChain community and Hugging Face/Xenova Transformers with their vulnerable `protobufjs` sub-dependency) from being downloaded by default, bringing the vulnerability count for standard `afterlink` installations down to **0**.
- Switched npm publication script to use `pnpm publish` to correctly resolve `workspace:*` dependencies.

## [1.2.1] — 2026-06-01

### Fixed

- **Connection._validateAuth** — replaced synchronous require('jose') with await import('jose').
  jose v6 is ESM-only; the old require() crashed with ERR_REQUIRE_ESM on Node 18+ or
  ReferenceError: TextEncoder is not defined on older runtimes. Affects both TCP
  (Connection.js) and WebSocket (ws-bridge.js).

- **Connection._handleHandshake** — made async and added await before _validateAuth.
  Previously the JWT verification promise resolved after the session was constructed,
  causing session.user to always be null and invalid tokens to pass unchecked.

- **session.user** — decoded JWT payload is now stored on this._jwtPayload and
  written to session.user during the HELLO handshake. All route handlers and
  middleware now receive the correct user context via req.session.user.

- **ws-bridge - JWT auth** — handleWsHandshake is now async and verifies the auth
  field from the HELLO payload with jwtVerify. WebSocket sessions now populate
  session.user on the same basis as TCP sessions.

- **ws-bridge - frame coalescing** — fixed silent frame loss when HELLO and REQUEST
  arrive in the same TCP packet. Buffer bytes after HELLO are now preserved and
  processed immediately.

- **ws-bridge - CORS** — connections without an Origin header are now allowed when
  cors.origins is empty (default). Node.js test clients no longer receive a 403
  in local development.

### Added

- **@ajaymyth/core - TcpClient** — new class for TCP connections wrapping net.Socket
  with full AfterLink framing. Provides Promise-based connect(helloData) and
  request(route, body); auto-handles HELLO_ACK, PING/PONG, and SERVER_CLOSING.

- **TypeScript** — TcpClient, TcpClientOptions, and HelloData interfaces added
  to packages/core/types/index.d.ts.

---

## [1.2.0] — 2026-05-19

### Added
- **Error taxonomy**: `AfterLinkError` base class + 22 typed subclasses (`ProtocolError`, `AuthError`, `RouteError`, `ValidationError`, `RateLimitError`, `ConnectionError`, `ServerError`, `CompressionError`)
- `fromError()` — convert any `Error` to typed `AfterLinkError`
- `fromFramePayload()` — deserialize error from ERROR frame payload
- `getErrorClassByCode()` — look up error class by code string
- TypeScript definitions (`.d.ts`) for `@ajaymyth/core`, `@ajaymyth/server`, `@ajaymyth/client`
- **Health endpoint** (`/__health`, `/__health/live`, `/__health/ready`, `/__health/stats`)
- Protocol detection on TCP socket (`GET` vs HELLO frame) for same-port health
- Optional separate HTTP port for health endpoint
- Configurable health thresholds (max connections, error rate, latency)
- Bearer token authentication for health endpoints
- **Browser SDK** (`@ajaymyth/browser`) — zero-dependency WebSocket client
- Auto-reconnect with exponential backoff and jitter
- Ping/keepalive support
- Pub/Sub over WebSocket transport
- **WebSocket bridge** (`ws-bridge.js`) — translates WS binary frames to AfterLink frames
- CORS origin validation for WebSocket connections
- **CLI tool** (`@ajaymyth/cli`) — terminal testing and monitoring utility
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
- Replaced all `throw new Error()` with typed errors across `@ajaymyth/core`, `@ajaymyth/server`, `@ajaymyth/client`
- `ws` dependency added to `@ajaymyth/server` for WebSocket bridge
- `commander` dependency added to `@ajaymyth/cli`

### Fixed
- Reverted `Frame.js` and `Serializer.js` to native `Error`/`RangeError` to eliminate circular `require()` dependencies with the new `errors/` module
- Used `workspace:*` protocol for `@ajaymyth/core` dependency in client/server packages to fix vitest module resolution
- Browser client `ws.send()` now sends Buffer directly (not `frame.buffer`) to avoid ArrayBuffer size mismatch with `ws` library

---

## [1.1.2] — 2026-05-19

### Added
- Full README.md included in all npm packages (`@ajaymyth/core`, `@ajaymyth/server`, `@ajaymyth/client`, `afterlink`)
- Package pages on npm now show complete documentation, features, and quick start guides

---

## [1.1.1] — 2026-05-19

### Fixed
- Normalize `workspace:*` dependencies to `^1.1.1` for npm registry compatibility
- Ensure all packages install correctly via `npm install afterlink`

---

## [1.1.0] — 2026-05-19

### Added
- TLS/SSL encryption via `afterlinks://` URL scheme (`@ajaymyth/server`, `@ajaymyth/client`)
- `generateDevCerts()` utility for self-signed dev certificates using `selfsigned` package
- zlib/Brotli payload compression with per-frame Flags bit (`@ajaymyth/core`)
- Compression negotiation in HELLO/HELLO_ACK handshake
- Per-route compression override option
- Per-connection token-bucket rate limiting (`@ajaymyth/server`)
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
- monorepo structure: `@ajaymyth/core`, `@ajaymyth/server`, `@ajaymyth/client`
- `afterlink` meta-package (installs all three)
- Published to npm: https://www.npmjs.com/package/afterlink
- Demo suite: hello-world, chat, dashboard, microservice, demo-runner
- DEPLOYMENT.md guide (PM2, Docker, Railway, Render, Fly.io, AWS, Kubernetes)
- SECURITY.md policy
