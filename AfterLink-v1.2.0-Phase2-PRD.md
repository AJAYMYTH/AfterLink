# Product Requirements Document
## AfterLink v1.2.0 — Phase 2: Developer Experience

---

| Field | Detail |
|---|---|
| **Project** | AfterLink — Binary Communication Protocol |
| **Phase** | Phase 2 of 3 |
| **Version Target** | v1.2.0 |
| **Baseline Version** | v1.1.3 (Phase 1 complete) |
| **Author** | Ajju (Javali Ajayakumar) |
| **Repo** | https://github.com/AJAYMYTH/AfterLink |
| **npm** | https://www.npmjs.com/package/afterlink |
| **Status** | Planning |
| **Target Timeline** | Weeks 5–8 (July 2026) |
| **PRD Version** | 1.0 |
| **Created** | May 2026 |
| **Depends On** | AfterLink v1.1.3 PRD (Phase 1 — Protocol & Stability) |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Background & Motivation](#2-background--motivation)
3. [Scope](#3-scope)
4. [Feature 1 — `afterlink` CLI Tool](#4-feature-1--afterlink-cli-tool)
5. [Feature 2 — `@afterlink/browser` WebSocket Package](#5-feature-2--afterlinkbrowser-websocket-package)
6. [Feature 3 — Full TypeScript Type Definitions](#6-feature-3--full-typescript-type-definitions)
7. [Feature 4 — Built-in `/__health` Endpoint](#7-feature-4--built-in-__health-endpoint)
8. [Feature 5 — Structured Error Taxonomy](#8-feature-5--structured-error-taxonomy)
9. [Protocol Changes (Frame Spec)](#9-protocol-changes-frame-spec)
10. [API Changes & Backward Compatibility](#10-api-changes--backward-compatibility)
11. [File & Package Structure Changes](#11-file--package-structure-changes)
12. [Testing Requirements](#12-testing-requirements)
13. [Documentation Requirements](#13-documentation-requirements)
14. [Implementation Schedule (Week-by-Week)](#14-implementation-schedule-week-by-week)
15. [Definition of Done](#15-definition-of-done)
16. [Risk & Mitigation](#16-risk--mitigation)
17. [CHANGELOG Entry (v1.2.0)](#17-changelog-entry-v120)

---

## 1. Executive Summary

AfterLink v1.1.3 delivers a production-safe binary TCP protocol: encrypted, compressed, rate-limited, and gracefully shutdownable.

**v1.2.0 makes AfterLink a joy to develop with.**

Phase 1 answered *"is this safe enough for production?"*
Phase 2 answers *"is this easy enough that I actually want to use it?"*

The five developer-experience upgrades in this phase target the friction points that slow down real-world adoption:

1. *"I have to write a client script just to test one route?"* → **`afterlink` CLI**
2. *"My frontend can't use TCP — I'm stuck with HTTP?"* → **`@afterlink/browser` WebSocket package**
3. *"There's no autocomplete in my IDE and TypeScript gives me `any` everywhere?"* → **Full `.d.ts` TypeScript types**
4. *"How do I know if my server is healthy in my load balancer?"* → **Built-in `/__health` endpoint**
5. *"Every error is just a plain `Error` object — I can't programmatically handle them?"* → **Structured error taxonomy**

None of these changes break any v1.1.x API. Every change is purely additive. A project running v1.1.3 can upgrade to v1.2.0 and get all five features with zero code changes required.

---

## 2. Background & Motivation

### State After Phase 1 (v1.1.3)

Phase 1 delivered:
- ✅ TLS/SSL encryption (`afterlinks://` scheme)
- ✅ zlib/Brotli payload compression (Flags byte, negotiated in HELLO)
- ✅ Per-connection token-bucket rate limiting
- ✅ Graceful server shutdown with `SERVER_CLOSING` frame
- ✅ Formal `CHANGELOG.md` and versioned release process

### Remaining Developer-Experience Gaps

| Gap | Who It Affects | Impact |
|---|---|---|
| No CLI tool | Every developer | Must write Node.js scripts to test routes; slow iteration loop |
| No browser support | Frontend developers | AfterLink is invisible to web apps; must use HTTP or WebSocket manually |
| No TypeScript types | TypeScript developers | IDE gives `any`, no autocomplete, no type safety at boundaries |
| No health endpoint | DevOps, platform engineers | Cannot integrate with load balancers, Kubernetes probes, or Uptime monitoring |
| Unstructured errors | All developers | Cannot programmatically distinguish `AUTH_FAILED` from `ROUTE_NOT_FOUND` — must parse error strings |

### Why Developer Experience Is the Correct Phase 2 Focus

Protocol correctness (Phase 1) is table-stakes. Developer experience is what determines whether AfterLink gets adopted over alternatives. A developer evaluating AfterLink vs gRPC vs HTTP will run `afterlink ping` before reading the docs. They will open a browser tab before writing a Node.js script. Their IDE's autocomplete is part of the evaluation.

These five features collectively reduce the time from "npm install" to "working feature" by an estimated 60%.

---

## 3. Scope

### In Scope

- `afterlink` CLI npm package (`@afterlink/cli`) with `ping`, `call`, `monitor`, `inspect` commands
- `@afterlink/browser` npm package — WebSocket transport enabling browser clients to connect to AfterLink servers
- TypeScript `.d.ts` type definition files for `@afterlink/core`, `@afterlink/server`, `@afterlink/client`, and `@afterlink/browser`
- Built-in `/__health` HTTP endpoint on a configurable secondary port (or same port via protocol detection)
- AfterLinkError class hierarchy — typed, code-bearing error objects replacing plain `Error` throws
- Updated `afterlink` meta-package to include `@afterlink/cli` as an optional install
- Full test coverage for all five features
- Complete documentation for all five features
- CHANGELOG.md updated with v1.2.0 section

### Out of Scope (Phase 3)

- Python SDK (`pip install afterlink`)
- Dart/Flutter SDK
- Redis-backed cluster pub/sub (`@afterlink/cluster`)
- Protocol v2 frame design
- Prometheus metrics endpoint
- Browser playground UI
- React/Vue hooks package (`@afterlink/react`, `@afterlink/vue`)

### New npm Packages This Phase

| Package | Description |
|---|---|
| `@afterlink/cli` | CLI tool: `ping`, `call`, `monitor`, `inspect` commands |
| `@afterlink/browser` | Browser-compatible client over WebSocket transport |

### External Dependencies Introduced

| Package | Version | Used In | Justification |
|---|---|---|---|
| `commander` | `^12.0.0` | `@afterlink/cli` | Industry-standard CLI argument parsing; tiny (47KB) |
| `chalk` | `^5.3.0` | `@afterlink/cli` | Terminal colors; zero sub-dependencies in v5 |
| `ora` | `^8.0.0` | `@afterlink/cli` | Spinner for async CLI operations |
| `ws` | `^8.17.0` | `@afterlink/browser` (server-side bridge only) | WebSocket server for browser bridge |

> **Note:** `@afterlink/browser` itself has **zero dependencies** — it uses the browser's native `WebSocket` API. The `ws` package is only used in `@afterlink/server` to expose the WebSocket bridge endpoint.

---

## 4. Feature 1 — `afterlink` CLI Tool

### 4.1 Overview

A command-line tool (`afterlink`) that lets developers test, debug, and monitor AfterLink servers from the terminal — without writing any code. Installable globally or used via `npx`.

```bash
npm install -g @afterlink/cli
# or
npx afterlink <command>
```

### 4.2 User Stories

> As a developer building an AfterLink server, I want to run `afterlink ping myserver:4000` in the terminal and immediately see if it's alive, without writing a client script.

> As a developer debugging a route, I want to run `afterlink call myserver:4000 createUser '{"name":"Ajju","email":"a@b.com"}'` and see the response, so I can validate my server logic from the terminal.

> As a DevOps engineer, I want to run `afterlink monitor myserver:4000` and watch live request throughput, connection count, and error rate in a real-time terminal dashboard.

> As a developer learning the protocol, I want to run `afterlink inspect` and see a live frame-by-frame hex dump of what my client is sending and receiving.

### 4.3 Commands

#### 4.3.1 `afterlink ping`

Tests basic connectivity and measures round-trip latency.

```bash
afterlink ping <host:port> [options]

Options:
  -n, --count <n>        Number of pings to send       default: 4
  -i, --interval <ms>    Interval between pings (ms)   default: 1000
  -t, --timeout <ms>     Timeout per ping (ms)         default: 5000
  --tls                  Use afterlinks:// (TLS)
  --no-color             Disable colored output
  -j, --json             Output as JSON (for scripting)

Examples:
  afterlink ping localhost:4000
  afterlink ping api.example.com:4000 --tls -n 10
  afterlink ping localhost:4000 --json
```

**Terminal Output (color):**

```
AfterLink PING localhost:4000 (AF/1.1)

  PONG  seq=1  time=0.84ms   ✓
  PONG  seq=2  time=0.91ms   ✓
  PONG  seq=3  time=0.78ms   ✓
  PONG  seq=4  time=0.88ms   ✓

--- localhost:4000 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss
rtt min/avg/max = 0.78 / 0.85 / 0.91 ms
```

**JSON Output (`--json`):**

```json
{
  "host": "localhost",
  "port": 4000,
  "protocol": "AF/1.1",
  "sent": 4,
  "received": 4,
  "packetLoss": 0,
  "latency": { "min": 0.78, "avg": 0.85, "max": 0.91, "unit": "ms" },
  "results": [
    { "seq": 1, "status": "ok", "latencyMs": 0.84 },
    { "seq": 2, "status": "ok", "latencyMs": 0.91 },
    { "seq": 3, "status": "ok", "latencyMs": 0.78 },
    { "seq": 4, "status": "ok", "latencyMs": 0.88 }
  ]
}
```

**Exit Codes:**
- `0` — All pings succeeded
- `1` — Partial packet loss
- `2` — Total failure (server unreachable)

---

#### 4.3.2 `afterlink call`

Sends a single REQUEST to a named route and prints the RESPONSE.

```bash
afterlink call <host:port> <route> [payload] [options]

Arguments:
  host:port     Server address (e.g. localhost:4000)
  route         Route name (e.g. createUser, getStats)
  payload       JSON payload as a string or @file.json   default: {}

Options:
  --tls                    Use TLS (afterlinks://)
  -H, --header <k=v>       Add session header (repeatable)
  --auth <token>           JWT auth token for HELLO handshake
  -t, --timeout <ms>       Request timeout                  default: 10000
  --pretty                 Pretty-print JSON response       default: true
  --no-pretty              Compact JSON output
  -j, --json               Machine-readable JSON wrapper
  --raw                    Print raw response bytes (hex)
  --trace                  Show full frame exchange

Examples:
  afterlink call localhost:4000 ping
  afterlink call localhost:4000 createUser '{"name":"Ajju","email":"a@b.com"}'
  afterlink call localhost:4000 importData @data.json --tls
  afterlink call localhost:4000 getStats --auth eyJhbGci... --pretty
```

**Terminal Output (success):**

```
→  afterlink call localhost:4000 createUser

   Route    createUser
   Host     localhost:4000
   Payload  { "name": "Ajju", "email": "a@b.com" }

✓  Response  (1.2ms)

{
  "user": {
    "id": "usr_01j2kx",
    "name": "Ajju",
    "email": "a@b.com",
    "createdAt": "2026-07-01T10:30:00Z"
  }
}
```

**Terminal Output (error response):**

```
✗  Error Response  (0.4ms)

   Code     VALIDATION_ERROR
   Message  String must contain at least 2 character(s) at "name"
   Field    name
```

**With `--trace` flag (shows raw frame exchange):**

```
→  HELLO         seq=0   { version: "AL/1.1", capabilities: ["zlib"] }
←  HELLO_ACK     seq=0   { session_id: "s_9f2a", compression: "zlib" }
→  REQUEST       seq=1   route="createUser"  payload=23B  flags=0x00
←  RESPONSE      seq=1   status=ok  payload=87B  flags=0x00  time=1.2ms
```

---

#### 4.3.3 `afterlink monitor`

A live real-time terminal dashboard showing server statistics and request stream.

```bash
afterlink monitor <host:port> [options]

Options:
  --tls                  Use TLS
  --auth <token>         Auth token
  --refresh <ms>         Dashboard refresh rate       default: 500
  --no-requests          Hide live request stream
  --filter <route>       Only show specific route in stream
  -j, --json             Stream stats as NDJSON (for piping to log tools)

Examples:
  afterlink monitor localhost:4000
  afterlink monitor api.example.com:4000 --tls --filter createUser
  afterlink monitor localhost:4000 --json | jq '.requestsPerSec'
```

**Terminal Dashboard Layout:**

```
╔══════════════════════════════════════════════════════════════════════╗
║  AfterLink Monitor  ·  localhost:4000  ·  AF/1.1  ·  ↻ 500ms       ║
╠══════════════════╦══════════════════╦══════════════════╦═════════════╣
║  Connections     ║  Requests/sec    ║  Avg Latency     ║  Errors     ║
║       12         ║      847         ║     0.92ms       ║    0.1%     ║
╠══════════════════╩══════════════════╩══════════════════╩═════════════╣
║  Uptime: 2h 14m 33s   ·   Total Requests: 6,847,293                 ║
╠══════════════════════════════════════════════════════════════════════╣
║  Live Request Stream                                                  ║
║                                                                       ║
║  10:31:04.882  createUser      OK   1.1ms  192.168.1.5              ║
║  10:31:04.883  getProducts     OK   0.8ms  192.168.1.7              ║
║  10:31:04.884  updateOrder     OK   2.3ms  192.168.1.5              ║
║  10:31:04.885  createUser      ERR  0.4ms  192.168.1.9  VALIDATION  ║
║  10:31:04.887  exportData      OK  14.2ms  192.168.1.8              ║
║  ...                                                                  ║
╠══════════════════════════════════════════════════════════════════════╣
║  Top Routes (last 60s)                                                ║
║  getProducts     3,421  ██████████████████████  avg 0.8ms            ║
║  createUser      1,847  ████████████           avg 1.2ms             ║
║  updateOrder       923  ██████                 avg 2.1ms             ║
║  exportData         41  ▌                      avg 13.8ms            ║
╚══════════════════════════════════════════════════════════════════════╝
  [q] quit  [p] pause  [f] filter  [c] clear  [h] help
```

**Implementation Note:** The monitor connects to the server's `/__health` endpoint (Feature 4) using a polling connection and the server's built-in stats stream. The server must expose a `stats` route (added as part of Feature 4) that the CLI subscribes to.

---

#### 4.3.4 `afterlink inspect`

A raw frame inspector — shows hex dump and decoded frame breakdown for every frame sent and received. Useful for debugging protocol issues and learning the frame format.

```bash
afterlink inspect <host:port> <route> [payload] [options]

Options:
  --tls           Use TLS
  --auth <token>  Auth token
  --annotate      Annotate each byte with field name    default: true

Examples:
  afterlink inspect localhost:4000 ping
  afterlink inspect localhost:4000 createUser '{"name":"Ajju"}'
```

**Terminal Output:**

```
AfterLink Frame Inspector  ·  localhost:4000

────── SENT: HELLO frame ──────────────────────────────────────────────
Hex:  01 00 00 00 00 00 00 00 00 1A  [header: 10 bytes]
      82 A7 76 65 72 73 69 6F 6E A6  [payload: 26 bytes]
      41 4C 2F 31 2E 31 A8 63 61 70  ...

Decoded:
  [00] Frame Type  : 0x01  REQUEST
  [01] Flags       : 0x00  (no compression, no encryption)
  [02-05] Msg ID   : 0x00000000  (1)
  [06-09] Payload  : 0x0000001A  (26 bytes)
  Payload (decoded):
    { version: "AL/1.1", capabilities: ["zlib"] }

────── RECEIVED: HELLO_ACK frame ──────────────────────────────────────
Hex:  10 00 00 00 00 01 00 00 00 2C  [header: 10 bytes]
      ...

Decoded:
  [00] Frame Type  : 0x10  HELLO_ACK
  [01] Flags       : 0x00
  [02-05] Msg ID   : 0x00000001
  [06-09] Payload  : 0x0000002C  (44 bytes)
  Payload (decoded):
    { session_id: "s_9f2a3b", server_version: "AL/1.1", compression: "zlib" }
```

---

#### 4.3.5 `afterlink --version` and `afterlink --help`

```bash
afterlink --version
# → @afterlink/cli v1.2.0

afterlink --help
# → Full command reference

afterlink <command> --help
# → Command-specific help
```

### 4.4 CLI Configuration File

Users can store default connection settings in `~/.afterlinkrc` (JSON):

```json
{
  "default": {
    "host": "localhost",
    "port": 4000,
    "tls": false
  },
  "production": {
    "host": "api.example.com",
    "port": 4000,
    "tls": true,
    "auth": "eyJhbGci..."
  }
}
```

Usage:

```bash
afterlink ping --profile production
afterlink call --profile production createUser '{"name":"Ajju"}'
```

### 4.5 Technical Implementation

**Package:** `packages/cli/`

**`packages/cli/package.json`:**

```json
{
  "name": "@afterlink/cli",
  "version": "1.2.0",
  "bin": {
    "afterlink": "./bin/afterlink.js"
  },
  "dependencies": {
    "@afterlink/client": "^1.2.0",
    "commander": "^12.0.0",
    "chalk": "^5.3.0",
    "ora": "^8.0.0"
  },
  "engines": { "node": ">=20.0.0" }
}
```

**`packages/cli/bin/afterlink.js`:**

```js
#!/usr/bin/env node
const { program } = require('commander');
const { pingCommand }    = require('../src/commands/ping');
const { callCommand }    = require('../src/commands/call');
const { monitorCommand } = require('../src/commands/monitor');
const { inspectCommand } = require('../src/commands/inspect');

program
  .name('afterlink')
  .description('AfterLink CLI — test, debug, and monitor AfterLink servers')
  .version(require('../package.json').version);

program.addCommand(pingCommand);
program.addCommand(callCommand);
program.addCommand(monitorCommand);
program.addCommand(inspectCommand);

program.parse();
```

### 4.6 Acceptance Criteria

- [ ] `npm install -g @afterlink/cli` installs the `afterlink` binary globally
- [ ] `npx afterlink ping localhost:4000` works without global install
- [ ] `afterlink ping` — sends PING frame, receives PONG, displays latency stats
- [ ] `afterlink ping` — exits code `0` on success, `2` on unreachable
- [ ] `afterlink ping --json` — outputs valid JSON, no color codes
- [ ] `afterlink call` — sends REQUEST frame, prints formatted RESPONSE
- [ ] `afterlink call` — handles both success and typed error responses
- [ ] `afterlink call --trace` — shows every frame sent and received
- [ ] `afterlink call @file.json` — reads payload from file path
- [ ] `afterlink monitor` — displays live dashboard with real-time refresh
- [ ] `afterlink monitor --json` — streams NDJSON stats (one JSON object per line)
- [ ] `afterlink inspect` — shows hex dump and decoded breakdown per frame
- [ ] `~/.afterlinkrc` profile loading works for `--profile <name>`
- [ ] All commands support `--tls` flag for `afterlinks://` connections
- [ ] All commands support `--auth <token>` for JWT-authenticated servers
- [ ] `afterlink --version` outputs correct version string
- [ ] Binary is cross-platform: macOS, Linux, Windows (WSL and native)

---

## 5. Feature 2 — `@afterlink/browser` WebSocket Package

### 5.1 Overview

A browser-compatible AfterLink client that communicates over WebSocket instead of raw TCP. Allows web applications (React, Vue, Svelte, plain HTML/JS) to connect to AfterLink servers using the same API as `@afterlink/client`.

The package is **zero-dependency** in the browser — it uses the native `WebSocket` API. On the server side, `@afterlink/server` gains a WebSocket bridge endpoint that translates WebSocket frames to AfterLink binary frames.

### 5.2 User Stories

> As a frontend developer, I want to use `@afterlink/browser` in my React app to call AfterLink server routes and subscribe to pub/sub topics — using the same API I use in Node.js — without writing REST endpoints.

> As an AfterLink server developer, I want browsers to be able to connect to my existing server without adding any special configuration, so I don't need two separate server implementations.

### 5.3 Architecture

```
Browser                          AfterLink Server
┌─────────────────────────┐      ┌───────────────────────────────────┐
│  @afterlink/browser     │      │  @afterlink/server                │
│                         │      │                                   │
│  AfterLinkBrowserClient │      │  ┌──────────────┐  ┌──────────┐  │
│  ┌─────────────────────┐│      │  │  TCP Handler │  │  WS      │  │
│  │  WebSocket API      ││      │  │  (existing)  │  │  Bridge  │  │
│  │  (native browser)   ││      │  └──────┬───────┘  └────┬─────┘  │
│  └─────────┬───────────┘│      │         │               │        │
│            │ WS frames  │      │         └───────┬───────┘        │
│  ┌─────────▼───────────┐│      │                 │                │
│  │  Frame Encoder/     ││      │  ┌──────────────▼────────────┐   │
│  │  Decoder (same as   ││◀────▶│  │  Shared Router / Handler  │   │
│  │  @afterlink/core)   ││      │  │  (routes, middleware, p/s) │   │
│  └─────────────────────┘│      │  └───────────────────────────┘   │
└─────────────────────────┘      └───────────────────────────────────┘

Transport:  ws:// or wss://
Frame format:  Binary (ArrayBuffer) — same 10-byte header + MessagePack payload
```

### 5.4 Browser Client API

The API is intentionally **identical** to `@afterlink/client` so switching transports requires only changing the import and URL scheme.

```js
// Node.js (existing)
import { Client } from '@afterlink/client';
const client = new Client('afterlinks://api.example.com:4000');

// Browser (new)
import { Client } from '@afterlink/browser';
const client = new Client('wss://api.example.com:4001');  // WS bridge port

// Everything else is the same ↓
await client.connect();
const result = await client.request('createUser', { name: 'Ajju' });
await client.subscribe('chat.newMessage', (msg) => console.log(msg));
client.publish('chat.newMessage', { text: 'Hello!' });
await client.disconnect();
```

**Full API surface (identical to `@afterlink/client`):**

```ts
class Client {
  constructor(url: string, options?: BrowserClientOptions);

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  request(route: string, payload?: unknown, options?: RequestOptions): Promise<unknown>;
  subscribe(topic: string, handler: (data: unknown) => void): Promise<void>;
  unsubscribe(topic: string): Promise<void>;
  publish(topic: string, data: unknown): void;

  on(event: 'connected',        handler: () => void): this;
  on(event: 'disconnected',     handler: (info: DisconnectInfo) => void): this;
  on(event: 'reconnecting',     handler: (info: ReconnectInfo) => void): this;
  on(event: 'reconnected',      handler: () => void): this;
  on(event: 'server-closing',   handler: (info: ClosingInfo) => void): this;
  on(event: 'error',            handler: (err: AfterLinkError) => void): this;
}
```

**`BrowserClientOptions`:**

```ts
interface BrowserClientOptions {
  autoReconnect?:          boolean;   // default: true
  maxReconnectAttempts?:   number;    // default: 10
  reconnectDelay?:         number;    // default: 1000 (ms)
  timeout?:                number;    // default: 30000 (ms)
  pingInterval?:           number;    // default: 30000 (ms)
  protocols?:              string[];  // WebSocket sub-protocols, default: ['afterlink']
}
```

### 5.5 Server-Side WebSocket Bridge

The server exposes a WebSocket endpoint on a configurable port. The bridge translates between WebSocket frames (binary) and the server's internal AfterLink frame handler — the exact same handler that serves TCP clients.

**Server configuration:**

```js
const server = new Server({
  port: 4000,          // TCP port (existing)
  browser: {
    enabled:  true,
    port:     4001,    // WebSocket bridge port
    path:     '/ws',   // WebSocket endpoint path  default: '/ws'
    cors: {
      origins: ['https://myapp.com', 'http://localhost:3000'],
    },
    // TLS is handled by the parent server's tls config
    // If server has tls.enabled: true, bridge also uses wss://
  }
});
```

**What the bridge does:**

```
Browser WebSocket frame arrives (binary ArrayBuffer)
  ↓
Convert ArrayBuffer → Node.js Buffer
  ↓
Pass to existing AfterLink frame decoder (same as TCP path)
  ↓
Router dispatches to route handler
  ↓
Handler returns result
  ↓
Encode as AfterLink RESPONSE frame
  ↓
Send back as binary WebSocket frame to browser
```

The bridge is a thin translation layer — **zero business logic is duplicated**. Both TCP and WebSocket clients go through the same router, middleware, and handlers.

### 5.6 CDN / Script Tag Usage

For non-bundler environments (plain HTML/JS sites):

```html
<script src="https://cdn.jsdelivr.net/npm/@afterlink/browser@1.2.0/dist/afterlink.browser.min.js"></script>
<script>
  const { Client } = AfterLink;
  const client = new Client('wss://api.example.com:4001');
  // ...
</script>
```

**Build targets:**

| File | Format | Size (est.) | Use Case |
|---|---|---|---|
| `dist/index.esm.js` | ESM | ~12KB | Bundlers (Vite, Webpack, Rollup) |
| `dist/index.cjs.js` | CJS | ~13KB | Legacy Node.js / Jest |
| `dist/afterlink.browser.min.js` | IIFE (`AfterLink`) | ~10KB gzip | CDN / script tag |

**Build tool:** `esbuild` (fast, zero config for this use case).

### 5.7 CORS and Security

WebSocket connections from browsers carry `Origin` headers. The bridge validates the origin against the `cors.origins` allowlist:

```js
server = new Server({
  browser: {
    enabled: true,
    port: 4001,
    cors: {
      origins: ['https://myapp.com'],  // Strict allowlist
      // OR:
      origins: '*',                    // Allow all — for development only
    }
  }
});
```

If origin validation fails, the WebSocket handshake returns `403 Forbidden`.

### 5.8 Acceptance Criteria

- [ ] `@afterlink/browser` published to npm, zero runtime dependencies
- [ ] Browser client API is identical to `@afterlink/client` (same method names, same event names)
- [ ] `client.connect()` establishes WebSocket connection to the WS bridge
- [ ] `client.request()` sends REQUEST frame as binary WebSocket message, receives RESPONSE
- [ ] `client.subscribe()` and pub/sub messages work over WebSocket
- [ ] Auto-reconnect works after WebSocket connection drops
- [ ] `server.closing` notification received by browser client as `server-closing` event
- [ ] `browser.enabled: true` on server starts WS bridge on configured port
- [ ] CORS origin validation rejects disallowed origins with 403
- [ ] `wss://` bridge works when server has `tls.enabled: true`
- [ ] CDN bundle (`afterlink.browser.min.js`) works in plain HTML `<script>` tag
- [ ] Bundle size < 15KB minified, < 6KB gzip
- [ ] Tested in Chrome 120+, Firefox 120+, Safari 17+, Edge 120+
- [ ] No TCP-specific code in the browser bundle (no `node:net`, `node:tls`)

---

## 6. Feature 3 — Full TypeScript Type Definitions

### 6.1 Overview

Add complete `.d.ts` TypeScript declaration files for all AfterLink packages. Every public API surface — constructors, methods, options, events, error codes, frame types — is fully typed. No `any`. No `unknown` where the shape is known.

AfterLink itself remains written in JavaScript. The `.d.ts` files are hand-authored declaration files, not generated by `tsc`. This approach is preferred for a library of this size because it gives precise control over the public API surface and avoids exposing internal types.

### 6.2 User Stories

> As a TypeScript developer using AfterLink, I want full IDE autocomplete for all config options, method parameters, and return types so I can explore the API without reading the documentation.

> As a TypeScript developer, I want type errors at compile time when I pass the wrong payload type to a route handler, so bugs are caught before they reach runtime.

> As a developer using VSCode with JavaScript (not TypeScript), I want JSDoc type hints to appear in the IDE, so I still get autocomplete and hover documentation.

### 6.3 Type Files Per Package

#### `@afterlink/core` — `types/index.d.ts`

```ts
// ─── Frame Types ───────────────────────────────────────────────────────────

export const FrameType: {
  readonly REQUEST:        0x01;
  readonly RESPONSE:       0x02;
  readonly STREAM_START:   0x03;
  readonly STREAM_DATA:    0x04;
  readonly STREAM_END:     0x05;
  readonly ERROR:          0x06;
  readonly PING:           0x07;
  readonly PONG:           0x08;
  readonly BROADCAST:      0x09;
  readonly SUBSCRIBE:      0x0A;
  readonly UNSUBSCRIBE:    0x0B;
  readonly PUBLISH:        0x0C;
  readonly CLOSE:          0x0D;
  readonly CLOSE_ACK:      0x0E;
  readonly HELLO:          0x0F;
  readonly HELLO_ACK:      0x10;
  readonly SERVER_CLOSING: 0x11;  // v1.1.0+
};

// ─── Frame ─────────────────────────────────────────────────────────────────

export interface RawFrame {
  type:      number;
  flags:     number;
  messageId: number;
  payload:   Buffer;
}

export interface DecodedFrame<T = unknown> {
  type:      number;
  flags:     number;
  messageId: number;
  payload:   T;
  compressed: boolean;
}

// ─── Compression ───────────────────────────────────────────────────────────

export type CompressionAlgorithm = 'zlib' | 'brotli' | 'none';

export interface CompressionOptions {
  enabled?:   boolean;
  algorithm?: CompressionAlgorithm;
  threshold?: number;  // bytes; default: 1024
  level?:     1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
}

// ─── Serialization ─────────────────────────────────────────────────────────

export function encode(frame: DecodedFrame): Buffer;
export function decode(buffer: Buffer): DecodedFrame;
```

---

#### `@afterlink/server` — `types/index.d.ts`

```ts
import { ZodSchema } from 'zod';
import { CompressionOptions, CompressionAlgorithm } from '@afterlink/core';
import { AfterLinkError } from './errors';

// ─── Server Config ─────────────────────────────────────────────────────────

export interface TLSOptions {
  enabled:              boolean;
  key:                  Buffer | string;
  cert:                 Buffer | string;
  ca?:                  Buffer | string;
  rejectUnauthorized?:  boolean;   // default: true
  minVersion?:          'TLSv1.2' | 'TLSv1.3';
}

export interface RateLimitOptions {
  enabled:                boolean;
  requestsPerSecond:      number;
  burstSize?:             number;
  closeAfterViolations?:  number;
  errorMessage?:          string;
  onLimited?:             (connection: ConnectionInfo) => void;
  perIP?: {
    enabled:            boolean;
    requestsPerSecond:  number;
    burstSize?:         number;
  };
}

export interface ShutdownOptions {
  drainTimeout?:    number;   // ms; default: 5000
  reason?:          string;
  notifyClients?:   boolean;  // default: true
}

export interface BrowserBridgeOptions {
  enabled:   boolean;
  port:      number;
  path?:     string;  // default: '/ws'
  cors?: {
    origins: string[] | '*';
  };
}

export interface HealthOptions {
  enabled?:    boolean;   // default: true
  port?:       number;    // default: same as main port, HTTP sidecar
  path?:       string;    // default: '/__health'
  token?:      string;    // Optional bearer token to protect the endpoint
  include?: {
    connections?:  boolean;
    memory?:       boolean;
    uptime?:       boolean;
    routes?:       boolean;
    rateLimit?:    boolean;
  };
}

export interface ServerOptions {
  port:           number;
  host?:          string;
  maxConnections?: number;
  tls?:           TLSOptions;
  compression?:   CompressionOptions;
  rateLimit?:     RateLimitOptions;
  shutdown?:      ShutdownOptions;
  browser?:       BrowserBridgeOptions;
  health?:        HealthOptions;
  auth?: {
    type:    'jwt';
    secret:  string;
  };
}

// ─── Request / Response ────────────────────────────────────────────────────

export interface AfterLinkRequest<TBody = unknown> {
  route:      string;
  body:       TBody;
  messageId:  number;
  session:    SessionInfo;
  connection: ConnectionInfo;
  headers:    Record<string, string>;
}

export interface AfterLinkResponse {
  send(data: unknown):  void;
  error(code: string, message: string, details?: unknown): void;
  stream(): AfterLinkStream;
}

export interface AfterLinkStream {
  write(chunk: unknown): void;
  end(): void;
}

// ─── Session / Connection ──────────────────────────────────────────────────

export interface SessionInfo {
  id:           string;
  userId?:      string;
  connectedAt:  Date;
  compression:  CompressionAlgorithm;
  capabilities: string[];
}

export interface ConnectionInfo {
  remoteAddress: string;
  remotePort:    number;
  transport:     'tcp' | 'tls' | 'websocket';
  sessionId:     string;
}

// ─── Route Options ─────────────────────────────────────────────────────────

export interface RouteOptions {
  compression?:  CompressionAlgorithm | false;
  rateLimit?:    Partial<RateLimitOptions> | false;
}

// ─── Middleware ─────────────────────────────────────────────────────────────

export type MiddlewareFunction<TBody = unknown> = (
  req:  AfterLinkRequest<TBody>,
  next: () => Promise<void>
) => Promise<void>;

// ─── Route Handler ─────────────────────────────────────────────────────────

export type RouteHandler<TBody = unknown> = (
  req:  AfterLinkRequest<TBody>,
  res:  AfterLinkResponse
) => void | Promise<void>;

// ─── Server Class ──────────────────────────────────────────────────────────

export class Server {
  constructor(options: ServerOptions);

  on<TBody = unknown>(
    route:    string,
    handler:  RouteHandler<TBody>,
    schema?:  ZodSchema<TBody> | null,
    options?: RouteOptions
  ): this;

  use(middleware: MiddlewareFunction): this;

  publish(topic: string, data: unknown): void;

  listen(): Promise<void>;
  close(options?: { force?: boolean }): Promise<void>;

  handleProcessSignals(): void;

  getConnectionCount(): number;
  getRouteCount():      number;
  getStats():           ServerStats;

  on(event: 'listening',  handler: () => void): this;
  on(event: 'connection', handler: (info: ConnectionInfo) => void): this;
  on(event: 'closing',    handler: (info: ClosingInfo) => void): this;
  on(event: 'drained',    handler: () => void): this;
  on(event: 'closed',     handler: () => void): this;
  on(event: 'error',      handler: (err: AfterLinkError) => void): this;
}

// ─── Stats ─────────────────────────────────────────────────────────────────

export interface ServerStats {
  uptime:           number;   // seconds
  connections:      number;
  totalRequests:    number;
  requestsPerSec:   number;
  avgLatencyMs:     number;
  errorRate:        number;   // 0–1
  memory: {
    heapUsed:  number;
    heapTotal: number;
    rss:       number;
  };
  routes: RouteStats[];
}

export interface RouteStats {
  name:          string;
  totalCalls:    number;
  avgLatencyMs:  number;
  errorRate:     number;
}

export interface ClosingInfo {
  activeConnections: number;
  activeRequests:    number;
  reason:            string;
}

// ─── TLS Utilities ─────────────────────────────────────────────────────────

export function generateDevCerts(options?: {
  commonName?: string;
}): Promise<{ key: Buffer; cert: Buffer }>;
```

---

#### `@afterlink/client` — `types/index.d.ts`

```ts
import { CompressionOptions, AfterLinkError } from '@afterlink/core';

export interface ClientOptions {
  autoReconnect?:         boolean;    // default: true
  maxReconnectAttempts?:  number;     // default: 10
  reconnectDelay?:        number;     // default: 1000
  timeout?:               number;     // default: 30000
  pingInterval?:          number;     // default: 30000
  autoThrottle?:          boolean;    // default: false (v1.1.0+)
  tls?: {
    ca?:                  Buffer | string;
    rejectUnauthorized?:  boolean;
  };
  compression?: CompressionOptions;
}

export interface RequestOptions {
  timeout?:  number;
  headers?:  Record<string, string>;
}

export interface ReconnectInfo {
  attempt:  number;
  delay:    number;
}

export interface DisconnectInfo {
  graceful: boolean;
  reason?:  string;
  code?:    number;
}

export interface ClosingInfo {
  drainTimeout:  number;
  reason:        string;
}

export class Client {
  constructor(url: string, options?: ClientOptions);

  connect():    Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  request(route: string, payload?: unknown, options?: RequestOptions): Promise<unknown>;

  subscribe(topic: string, handler: (data: unknown) => void):   Promise<void>;
  unsubscribe(topic: string):                                    Promise<void>;
  publish(topic: string, data: unknown):                         void;

  on(event: 'connected',       handler: () => void): this;
  on(event: 'disconnected',    handler: (info: DisconnectInfo) => void): this;
  on(event: 'reconnecting',    handler: (info: ReconnectInfo) => void): this;
  on(event: 'reconnected',     handler: () => void): this;
  on(event: 'server-closing',  handler: (info: ClosingInfo) => void): this;
  on(event: 'error',           handler: (err: AfterLinkError) => void): this;
}
```

### 6.4 Generic Route Typing on Server (Advanced Usage)

TypeScript users can type their route handlers end-to-end using generics:

```ts
import { Server, AfterLinkRequest, AfterLinkResponse } from '@afterlink/server';
import { z } from 'zod';

const CreateUserSchema = z.object({
  name:  z.string().min(2),
  email: z.string().email(),
});

type CreateUserBody = z.infer<typeof CreateUserSchema>;

const server = new Server({ port: 4000 });

server.on<CreateUserBody>(
  'createUser',
  async (req: AfterLinkRequest<CreateUserBody>, res: AfterLinkResponse) => {
    // req.body is fully typed as { name: string; email: string }
    const user = await db.create(req.body);
    res.send({ user });
  },
  CreateUserSchema
);
```

### 6.5 JSDoc Integration (JavaScript Users)

Even without TypeScript, JS users get IDE hints via JSDoc `@type` annotations that reference the `.d.ts` types:

```js
// jsdoc-types.js — example in README showing how JS users get hints
const { Server } = require('@afterlink/server');

/** @type {import('@afterlink/server').ServerOptions} */
const options = {
  port: 4000,
  // IDE autocomplete works here ↑
};

const server = new Server(options);
```

### 6.6 `tsconfig.json` in Each Package

Each package gets a `tsconfig.json` for IDE integration (not for compilation):

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": false,
    "declaration": false,
    "strict": true,
    "moduleResolution": "bundler",
    "types": []
  },
  "include": ["src/**/*.js", "types/**/*.d.ts"]
}
```

### 6.7 Acceptance Criteria

- [ ] `types/index.d.ts` exists in `@afterlink/core`, `@afterlink/server`, `@afterlink/client`, `@afterlink/browser`, `@afterlink/cli`
- [ ] `package.json` `"types"` field points to `types/index.d.ts` in each package
- [ ] All public constructors, methods, events, and config options are typed — zero `any` in the public surface
- [ ] `Server.on<TBody>()` generic propagates body type to `req.body` in handler
- [ ] `AfterLinkError` subclasses are exported and typed
- [ ] All frame type constants exported as `const` (literal types, not `number`)
- [ ] VSCode shows autocomplete for all config options on `new Server({ })` and `new Client()`
- [ ] `tsc --noEmit` on a TypeScript project using AfterLink produces zero errors
- [ ] `.d.ts` files are validated against actual JS implementation — no phantom properties
- [ ] `@afterlink/browser` types are compatible with browser DOM types (`lib: ["DOM"]` in tsconfig)

---

## 7. Feature 4 — Built-in `/__health` Endpoint

### 7.1 Overview

Every AfterLink server automatically exposes an HTTP health check endpoint at `/__health`. This allows:
- Load balancers (AWS ALB, Nginx, HAProxy) to detect unhealthy instances
- Kubernetes liveness and readiness probes
- Uptime monitors (UptimeRobot, Betterstack, etc.)
- The `afterlink monitor` CLI to fetch server stats
- Custom dashboards to poll server telemetry

The endpoint is HTTP (not AfterLink protocol) so it works with standard health check tools without needing an AfterLink client.

### 7.2 User Stories

> As a DevOps engineer, I want my load balancer to automatically stop routing traffic to an AfterLink instance that is overloaded or unhealthy, without writing any custom health check code.

> As a developer running AfterLink in Kubernetes, I want to configure liveness and readiness probes using the built-in `/__health` endpoint so my pods restart automatically on failure.

### 7.3 Endpoint Specification

**Default behavior:** The health endpoint runs on the same port as the AfterLink server. When an incoming connection sends a valid HTTP GET request to `/__health` (detected by the `GET /__health HTTP/1` prefix in the first bytes), the server responds with HTTP and closes the connection. All other connections follow the normal AfterLink TCP handshake.

**Alternate behavior (separate port):** If `health.port` is configured, a dedicated HTTP server is started on that port, keeping the AfterLink port clean for protocol-only traffic.

```js
const server = new Server({
  port: 4000,
  health: {
    enabled: true,              // default: true
    port:    4001,              // separate HTTP port (optional)
    path:    '/__health',       // default: '/__health'
    token:   'secret-token',    // optional Bearer token protection
    include: {
      connections: true,
      memory:      true,
      uptime:      true,
      routes:      true,
      rateLimit:   true,
    }
  }
});
```

### 7.4 Response Format

**`GET /__health` — Healthy:**

```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-cache

{
  "status": "healthy",
  "version": "1.2.0",
  "protocol": "AL/1.1",
  "timestamp": "2026-07-01T10:30:00.000Z",
  "uptime": 8053,
  "connections": {
    "active": 12,
    "max": 10000,
    "utilizationPct": 0.12
  },
  "requests": {
    "total": 6847293,
    "perSecond": 847,
    "avgLatencyMs": 0.92,
    "errorRatePct": 0.1
  },
  "memory": {
    "heapUsedMB": 48.2,
    "heapTotalMB": 64.0,
    "rssMB": 72.1
  },
  "rateLimit": {
    "enabled": true,
    "limitedLast60s": 3
  },
  "routes": [
    { "name": "createUser",  "calls": 1847, "avgLatencyMs": 1.2, "errorRatePct": 0.5 },
    { "name": "getProducts", "calls": 3421, "avgLatencyMs": 0.8, "errorRatePct": 0.0 }
  ]
}
```

**`GET /__health` — Degraded (high error rate, near connection limit):**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "degraded",
  "reason": "Error rate above threshold (5.2%)",
  ...
}
```

**`GET /__health` — Unhealthy (server is shutting down):**

```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{
  "status": "unhealthy",
  "reason": "Server is shutting down",
  ...
}
```

### 7.5 Health Status Logic

```
status = "healthy"   if  errorRate < 5%
                     AND connections < 90% of maxConnections
                     AND server.state === 'running'

status = "degraded"  if  errorRate >= 5%   OR connections >= 90% of max
                     AND server.state === 'running'

status = "unhealthy" if  server.state === 'closing' OR 'closed'
```

HTTP status codes:
- `200` for `healthy` and `degraded` (load balancers route to degraded instances)
- `503` for `unhealthy` (load balancers stop routing immediately)

### 7.6 Kubernetes Probe Configuration

Include this in the AfterLink docs for Kubernetes users:

```yaml
# Kubernetes deployment snippet
livenessProbe:
  httpGet:
    path: /__health
    port: 4000
  initialDelaySeconds: 10
  periodSeconds: 15
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /__health
    port: 4000
  initialDelaySeconds: 5
  periodSeconds: 10
  successThreshold: 1
  failureThreshold: 2
```

### 7.7 Additional Endpoints

| Endpoint | Description |
|---|---|
| `GET /__health` | Full status + stats (documented above) |
| `GET /__health/live` | Liveness only — returns `200 {"alive":true}` if server is running |
| `GET /__health/ready` | Readiness — returns `503` during shutdown/drain |
| `GET /__health/stats` | Raw stats JSON (same as full health minus status logic) |

### 7.8 Protection (Optional Bearer Token)

```http
GET /__health HTTP/1.1
Authorization: Bearer secret-token
```

If `health.token` is set and the request lacks the correct `Authorization` header, the server returns `401 Unauthorized`. This is recommended for production to prevent competitors from seeing your server throughput.

### 7.9 Technical Implementation

**Protocol detection in TCP connection handler:**

```js
socket.once('data', (firstChunk) => {
  const isHTTP = firstChunk.slice(0, 4).toString() === 'GET ';

  if (isHTTP && firstChunk.includes('/__health')) {
    return handleHealthRequest(socket, firstChunk, config.health);
  }
  // Normal AfterLink handshake
  return handleAfterLinkConnection(socket, firstChunk);
});
```

**HTTP response writer (no `http` module needed for this simple case):**

```js
function handleHealthRequest(socket, chunk, healthConfig) {
  const stats   = server.getStats();
  const status  = computeHealthStatus(stats);
  const body    = JSON.stringify(buildHealthResponse(stats, status, healthConfig));
  const code    = status === 'unhealthy' ? 503 : 200;

  socket.write(
    `HTTP/1.1 ${code} ${code === 200 ? 'OK' : 'Service Unavailable'}\r\n` +
    `Content-Type: application/json\r\n` +
    `Content-Length: ${Buffer.byteLength(body)}\r\n` +
    `Cache-Control: no-cache\r\n` +
    `\r\n` +
    body
  );
  socket.end();
}
```

### 7.10 Acceptance Criteria

- [ ] `GET /__health` returns `200` with JSON body on a healthy server
- [ ] `status` field is `"healthy"`, `"degraded"`, or `"unhealthy"` based on thresholds
- [ ] `503` returned during graceful shutdown (`server.state === 'closing'`)
- [ ] Response includes `uptime`, `connections`, `requests`, `memory`, `routes`
- [ ] `health.port` config starts a dedicated HTTP server on that port
- [ ] `GET /__health/live` returns `200 {"alive":true}` (liveness probe)
- [ ] `GET /__health/ready` returns `503` during shutdown (readiness probe)
- [ ] `health.token` enforces Bearer token authentication — `401` without it
- [ ] Health endpoint is enabled by default without any config
- [ ] `health.enabled: false` fully disables the endpoint (no HTTP responses)
- [ ] `afterlink monitor` CLI connects to `/__health/stats` for its dashboard data
- [ ] Normal AfterLink TCP clients on the same port are NOT affected by health check logic

---

## 8. Feature 5 — Structured Error Taxonomy

### 8.1 Overview

Replace all plain `new Error('message')` throws in AfterLink with a formal class hierarchy of typed, code-bearing error objects. Every error has a `code` string, an `httpStatus` equivalent, a `category`, and optional structured `details`.

This makes programmatic error handling possible — developers can `switch (err.code)` instead of parsing error strings.

### 8.2 User Stories

> As a developer handling AfterLink errors in my client, I want to programmatically distinguish `AUTH_FAILED` from `VALIDATION_ERROR` from `ROUTE_NOT_FOUND` using a stable `code` string, so I can show appropriate UI messages without parsing error text.

> As a developer using TypeScript, I want `AfterLinkError` and its subclasses to be properly typed so I get autocomplete on `err.code`, `err.details`, and `err.category`.

### 8.3 Error Class Hierarchy

```
AfterLinkError (base)
├── ProtocolError          — Frame-level protocol violations
│   ├── INVALID_FRAME
│   ├── UNSUPPORTED_VERSION
│   ├── MALFORMED_PAYLOAD
│   └── UNKNOWN_FRAME_TYPE
├── AuthError              — Authentication and authorization failures
│   ├── AUTH_REQUIRED
│   ├── AUTH_FAILED
│   ├── AUTH_EXPIRED
│   └── AUTH_INSUFFICIENT_PERMISSIONS
├── RouteError             — Route resolution and invocation errors
│   ├── ROUTE_NOT_FOUND
│   ├── ROUTE_HANDLER_ERROR
│   └── ROUTE_TIMEOUT
├── ValidationError        — Zod schema validation failures
│   └── VALIDATION_ERROR   (with field-level details)
├── RateLimitError         — Rate limiting rejections (v1.1.0+)
│   └── RATE_LIMITED
├── ConnectionError        — Transport-level connection errors
│   ├── CONNECTION_REFUSED
│   ├── CONNECTION_TIMEOUT
│   ├── CONNECTION_RESET
│   ├── TLS_HANDSHAKE_FAILED   (v1.1.0+)
│   └── TLS_CERT_INVALID       (v1.1.0+)
├── ServerError            — Internal server errors
│   ├── INTERNAL_SERVER_ERROR
│   └── SERVER_SHUTTING_DOWN
└── CompressionError       — Compression failures (v1.1.0+)
    ├── DECOMPRESSION_FAILED
    └── COMPRESSION_ALGORITHM_UNSUPPORTED
```

### 8.4 Base Class

```ts
// packages/core/src/errors/AfterLinkError.ts

export class AfterLinkError extends Error {
  readonly code:       string;
  readonly category:   ErrorCategory;
  readonly httpStatus: number;
  readonly details?:   Record<string, unknown>;
  readonly timestamp:  Date;
  readonly requestId?: string;  // messageId of the failing request

  constructor(options: {
    code:       string;
    message:    string;
    category:   ErrorCategory;
    httpStatus: number;
    details?:   Record<string, unknown>;
    requestId?: string;
    cause?:     Error;
  });

  toJSON(): SerializedError;
  toFrame(): Buffer;  // encodes as AfterLink ERROR frame payload
}

export type ErrorCategory =
  | 'protocol'
  | 'auth'
  | 'route'
  | 'validation'
  | 'rate_limit'
  | 'connection'
  | 'server'
  | 'compression';

export interface SerializedError {
  code:       string;
  message:    string;
  category:   ErrorCategory;
  httpStatus: number;
  details?:   Record<string, unknown>;
  requestId?: string;
}
```

### 8.5 Complete Error Code Reference

| Code | Category | HTTP | Description |
|---|---|---|---|
| `INVALID_FRAME` | protocol | 400 | Frame header is malformed or incomplete |
| `UNSUPPORTED_VERSION` | protocol | 426 | Client protocol version not supported |
| `MALFORMED_PAYLOAD` | protocol | 400 | Payload cannot be deserialized |
| `UNKNOWN_FRAME_TYPE` | protocol | 400 | Frame type byte is not in the known range |
| `AUTH_REQUIRED` | auth | 401 | Route requires authentication but HELLO had no token |
| `AUTH_FAILED` | auth | 401 | JWT token is invalid or signature check failed |
| `AUTH_EXPIRED` | auth | 401 | JWT token has expired |
| `AUTH_INSUFFICIENT_PERMISSIONS` | auth | 403 | Token valid but lacks required scope/role |
| `ROUTE_NOT_FOUND` | route | 404 | No handler registered for the requested route name |
| `ROUTE_HANDLER_ERROR` | route | 500 | Route handler threw an uncaught exception |
| `ROUTE_TIMEOUT` | route | 408 | Handler did not respond within configured timeout |
| `VALIDATION_ERROR` | validation | 422 | Zod schema validation failed (includes field details) |
| `RATE_LIMITED` | rate_limit | 429 | Request exceeds per-connection rate limit |
| `CONNECTION_REFUSED` | connection | 503 | Server is not accepting connections |
| `CONNECTION_TIMEOUT` | connection | 408 | TCP connection timed out |
| `CONNECTION_RESET` | connection | 503 | TCP connection was unexpectedly reset |
| `TLS_HANDSHAKE_FAILED` | connection | 525 | TLS handshake could not complete |
| `TLS_CERT_INVALID` | connection | 526 | TLS certificate is untrusted or expired |
| `INTERNAL_SERVER_ERROR` | server | 500 | Unhandled server error |
| `SERVER_SHUTTING_DOWN` | server | 503 | Server rejected request due to active shutdown |
| `DECOMPRESSION_FAILED` | compression | 400 | Compressed frame payload could not be decompressed |
| `COMPRESSION_ALGORITHM_UNSUPPORTED` | compression | 400 | Requested compression algorithm not available |

### 8.6 ValidationError Details

`VALIDATION_ERROR` includes structured Zod error details:

```js
// Error frame payload received by client:
{
  code:    'VALIDATION_ERROR',
  message: 'Validation failed',
  details: {
    issues: [
      {
        field:   'email',
        message: 'Invalid email',
        code:    'invalid_string',
        path:    ['email']
      },
      {
        field:   'name',
        message: 'String must contain at least 2 character(s)',
        code:    'too_small',
        path:    ['name']
      }
    ]
  }
}
```

### 8.7 Client-Side Usage

```js
import { Client }                        from '@afterlink/client';
import { ValidationError, AuthError,
         RouteError, RateLimitError }    from '@afterlink/core/errors';

const client = new Client('afterlink://localhost:4000');
await client.connect();

try {
  const result = await client.request('createUser', { name: 'A' });
} catch (err) {
  if (err instanceof ValidationError) {
    // TypeScript knows err.details.issues is an array
    for (const issue of err.details.issues) {
      console.error(`Field ${issue.field}: ${issue.message}`);
    }
  } else if (err instanceof AuthError && err.code === 'AUTH_EXPIRED') {
    await refreshToken();
    // retry...
  } else if (err instanceof RateLimitError) {
    await sleep(err.details.retryAfter);
    // retry...
  } else if (err instanceof RouteError && err.code === 'ROUTE_NOT_FOUND') {
    console.error('Route does not exist on this server');
  }
}
```

### 8.8 Server-Side Usage (Custom Errors in Handlers)

```js
import { AfterLinkError } from '@afterlink/core/errors';

server.on('getOrder', async (req, res) => {
  const order = await db.findOrder(req.body.orderId);

  if (!order) {
    throw new AfterLinkError({
      code:       'ORDER_NOT_FOUND',
      message:    `Order ${req.body.orderId} does not exist`,
      category:   'route',
      httpStatus: 404,
      details:    { orderId: req.body.orderId }
    });
  }

  res.send({ order });
});
```

The client receives this as a typed `AfterLinkError` with `code: 'ORDER_NOT_FOUND'`.

### 8.9 Acceptance Criteria

- [ ] `AfterLinkError` base class exported from `@afterlink/core/errors`
- [ ] All 8 error subclasses exist and extend `AfterLinkError`
- [ ] All 22 error codes defined in the taxonomy table above are implemented
- [ ] Every existing `throw new Error(...)` in the codebase replaced with the appropriate typed error
- [ ] `VALIDATION_ERROR` includes `details.issues` array matching Zod's error structure
- [ ] `RATE_LIMITED` includes `details.retryAfter` in ms (from v1.1.0 feature)
- [ ] Client receives typed `AfterLinkError` (not plain `Error`) for all server errors
- [ ] `err instanceof ValidationError` works correctly in client catch blocks
- [ ] `AfterLinkError.toJSON()` produces a serializable plain object (no circular refs)
- [ ] Custom application errors (non-standard codes) work when thrown in route handlers
- [ ] TypeScript: `err.code` autocompletes to known error codes within each subclass
- [ ] CHANGELOG updated with complete error code table

---

## 9. Protocol Changes (Frame Spec)

### 9.1 Frame Header

**Unchanged.** The 10-byte frame header format is identical to v1.1.x. No breaking change.

### 9.2 New Frame Types

None. All five features in Phase 2 are implemented at the SDK and tooling layer without new frame types.

### 9.3 ERROR Frame Payload — Structured (Additive Change)

The `ERROR` frame (type `0x06`) payload is extended from a plain string to a structured object. **Backward compatible:** v1.1.x clients that receive the new payload see it as an opaque MessagePack map — they won't crash, but won't parse the `code` field either.

```js
// v1.1.x ERROR frame payload (plain string)
"VALIDATION_ERROR: email is invalid"

// v1.2.0 ERROR frame payload (structured object)
{
  code:       "VALIDATION_ERROR",
  message:    "email is invalid",
  category:   "validation",
  httpStatus: 422,
  details:    { issues: [...] },
  requestId:  42
}
```

### 9.4 WebSocket Framing

`@afterlink/browser` sends binary WebSocket frames where the payload is the exact same 10-byte AfterLink frame header + MessagePack payload. No wrapper, no additional framing. The bridge on the server strips the WebSocket layer and hands the raw bytes to the existing AfterLink frame decoder.

---

## 10. API Changes & Backward Compatibility

### 10.1 Breaking Changes

**None.** All changes in Phase 2 are fully additive:

| Change | Backward Compatible? | Notes |
|---|---|---|
| `@afterlink/cli` new package | ✅ Additive | New package, no impact on existing |
| `@afterlink/browser` new package | ✅ Additive | New package, `browser.enabled` defaults to `false` |
| TypeScript `.d.ts` files | ✅ Additive | JS users unaffected |
| `/__health` endpoint | ✅ Additive | Enabled by default, but plain HTTP — doesn't affect AfterLink clients |
| `AfterLinkError` class hierarchy | ⚠️ Soft break | Old code catching `err.message` still works; `instanceof Error` still true; only `instanceof AfterLinkError` is new |
| Structured ERROR frame payload | ⚠️ Soft break | v1.1.x clients receive the object as raw MessagePack — won't crash, won't parse `code` field |

### 10.2 Semantic Version Justification

**Minor version bump** (v1.1.3 → v1.2.0) is correct because:
- No existing public API is removed or changed in a breaking way
- The ERROR frame payload change is additive (structured superset of the old string)
- The `AfterLinkError` change is a superset of `Error` — existing `catch (err)` code still works
- All five features are opt-in (new packages, new config options, new imports)

### 10.3 Migration Guide for v1.1.x → v1.2.0

**Zero required changes.** To opt in to new features:

```bash
# Install CLI
npm install -g @afterlink/cli

# Install browser package (frontend projects)
npm install @afterlink/browser

# Enable health endpoint (already on by default)
# Enable WebSocket bridge in server config
```

```js
// Optional: switch to typed errors
import { ValidationError } from '@afterlink/core/errors';
// instead of: catch (err) { if (err.message.includes('VALIDATION')) }
```

---

## 11. File & Package Structure Changes

```
AfterLink/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   └── errors/
│   │   │       ├── AfterLinkError.js       ← NEW: Base error class
│   │   │       ├── ProtocolError.js        ← NEW
│   │   │       ├── AuthError.js            ← NEW
│   │   │       ├── RouteError.js           ← NEW
│   │   │       ├── ValidationError.js      ← NEW
│   │   │       ├── RateLimitError.js       ← NEW (wraps v1.1.0 behavior)
│   │   │       ├── ConnectionError.js      ← NEW
│   │   │       ├── ServerError.js          ← NEW
│   │   │       ├── CompressionError.js     ← NEW
│   │   │       └── index.js                ← NEW: exports all error classes
│   │   └── types/
│   │       └── index.d.ts                  ← NEW: TypeScript declarations
│   │
│   ├── server/
│   │   ├── src/
│   │   │   ├── server.js                   ← MODIFIED: health endpoint, WS bridge, typed errors
│   │   │   ├── browser/
│   │   │   │   └── ws-bridge.js            ← NEW: WebSocket bridge server
│   │   │   └── health/
│   │   │       ├── handler.js              ← NEW: HTTP health response writer
│   │   │       └── status.js               ← NEW: health/degraded/unhealthy logic
│   │   └── types/
│   │       └── index.d.ts                  ← NEW: TypeScript declarations
│   │
│   ├── client/
│   │   ├── src/
│   │   │   └── client.js                   ← MODIFIED: typed error parsing
│   │   └── types/
│   │       └── index.d.ts                  ← NEW: TypeScript declarations
│   │
│   ├── browser/                            ← NEW PACKAGE
│   │   ├── src/
│   │   │   ├── client.js                   ← Browser client (WebSocket transport)
│   │   │   └── transport/
│   │   │       └── websocket.js            ← Native WebSocket wrapper
│   │   ├── types/
│   │   │   └── index.d.ts                  ← TypeScript declarations
│   │   ├── dist/                           ← esbuild output (gitignored)
│   │   │   ├── index.esm.js
│   │   │   ├── index.cjs.js
│   │   │   └── afterlink.browser.min.js
│   │   └── package.json
│   │
│   └── cli/                                ← NEW PACKAGE
│       ├── bin/
│       │   └── afterlink.js               ← CLI entry point (#!/usr/bin/env node)
│       ├── src/
│       │   ├── commands/
│       │   │   ├── ping.js
│       │   │   ├── call.js
│       │   │   ├── monitor.js
│       │   │   └── inspect.js
│       │   ├── output/
│       │   │   ├── formatter.js            ← Colored terminal output
│       │   │   └── json.js                 ← --json mode output
│       │   └── config/
│       │       └── rc.js                   ← ~/.afterlinkrc loader
│       ├── types/
│       │   └── index.d.ts
│       └── package.json
│
├── afterlink/                              ← Meta-package
│   └── package.json                        ← MODIFIED: add @afterlink/cli as optionalDependency
│
├── CHANGELOG.md                            ← MODIFIED: add v1.2.0 section
└── examples/
    ├── browser-example/                    ← NEW: browser client demo
    │   ├── server.js
    │   ├── index.html
    │   └── README.md
    └── typescript-example/                 ← NEW: typed TypeScript project
        ├── server.ts
        ├── client.ts
        ├── tsconfig.json
        └── README.md
```

---

## 12. Testing Requirements

### 12.1 Unit Tests

| Module | Test Cases | File |
|---|---|---|
| `AfterLinkError` | constructor, toJSON, toFrame, instanceof checks | `core/test/errors/AfterLinkError.test.js` |
| Each error subclass | correct code, category, httpStatus defaults | `core/test/errors/*.test.js` |
| `ValidationError` | details.issues structure matches Zod output | `core/test/errors/ValidationError.test.js` |
| `ws-bridge.js` | WebSocket frame → AfterLink frame conversion | `server/test/browser/ws-bridge.test.js` |
| `health/handler.js` | 200/503 logic, JSON structure, token auth | `server/test/health/handler.test.js` |
| `health/status.js` | healthy/degraded/unhealthy threshold logic | `server/test/health/status.test.js` |
| Browser client | connect, request, subscribe, reconnect | `browser/test/client.test.js` |
| CLI `ping` | output format, exit codes, JSON mode | `cli/test/commands/ping.test.js` |
| CLI `call` | success/error output, trace mode, @file | `cli/test/commands/call.test.js` |
| `~/.afterlinkrc` loader | valid config, missing file, invalid JSON | `cli/test/config/rc.test.js` |

### 12.2 Integration Tests

| Scenario | What It Tests |
|---|---|
| Browser WS client ↔ server TCP route | Full request/response across WebSocket bridge |
| Browser pub/sub | Browser subscribes to topic, Node.js client publishes, browser receives |
| `afterlink ping localhost:4000` (real server) | CLI end-to-end — real PING/PONG |
| `afterlink call localhost:4000 createUser '...'` | CLI end-to-end — real REQUEST/RESPONSE |
| `GET /__health` during normal operation | Returns `200 healthy` with correct stats |
| `GET /__health` during graceful shutdown | Returns `503 unhealthy` |
| `GET /__health` with wrong Bearer token | Returns `401 Unauthorized` |
| `catch (err instanceof ValidationError)` | Client receives typed error, not plain Error |
| TypeScript compilation | `tsc --noEmit` on `examples/typescript-example/` — zero errors |

### 12.3 Browser Compatibility Tests

Tested using Playwright (headless browser automation):

| Browser | Test |
|---|---|
| Chrome 120+ | connect, request, subscribe, reconnect |
| Firefox 120+ | connect, request, subscribe, reconnect |
| Safari 17+ | connect, request (Safari WebSocket edge cases) |
| Edge 120+ | connect, request |

```bash
pnpm test:browser   # runs Playwright suite
```

### 12.4 TypeScript Validation

```bash
pnpm typecheck
# runs: tsc --noEmit on examples/typescript-example/
# Expected: 0 errors
```

### 12.5 Regression Tests

All v1.0.0 and v1.1.x tests pass unchanged:

```bash
pnpm test:all
```

---

## 13. Documentation Requirements

### 13.1 README.md Updates

- Add `@afterlink/browser` to the packages table
- Add `@afterlink/cli` to the packages table
- Add CLI quick demo section (`afterlink ping localhost:4000`)
- Update comparison table: AfterLink now has `✅ TypeScript`, `✅ CLI`, `✅ Browser`
- Add new badges: TypeScript, browser support

### 13.2 New Documentation Pages

**`docs/cli.md`** — CLI Reference:
- Installation (`npm install -g @afterlink/cli`)
- All four commands with full option tables
- `~/.afterlinkrc` config file format
- Usage in CI/CD pipelines
- Exit codes reference

**`docs/browser.md`** — Browser Client Guide:
- Installation and import (ESM, CJS, CDN script tag)
- Server configuration (`browser.enabled`, port, CORS)
- Full API example (connect, request, subscribe)
- React integration example
- CORS configuration guide
- `ws://` vs `wss://` selection

**`docs/typescript.md`** — TypeScript Guide:
- Where `.d.ts` files live
- Generic route typing (`server.on<TBody>()`)
- JSDoc hints for JavaScript users
- `tsconfig.json` setup for projects using AfterLink

**`docs/health.md`** — Health Endpoint Guide:
- Default behavior (same port, HTTP detection)
- Separate port configuration
- Response fields explained
- Kubernetes probe configuration snippet
- Load balancer integration (AWS ALB, Nginx, HAProxy)
- Bearer token protection

**`docs/errors.md`** — Error Handling Guide:
- `AfterLinkError` class hierarchy diagram
- Complete error code table (all 22 codes)
- Client-side `catch` patterns (switch, instanceof)
- Custom application errors in route handlers
- TypeScript usage with error types

### 13.3 Example Projects (New)

**`examples/browser-example/`:**

```
browser-example/
├── server.js       # AfterLink server with browser.enabled: true
├── index.html      # Plain HTML — no bundler — uses CDN script tag
└── README.md       # How to run in 2 commands
```

**`examples/typescript-example/`:**

```
typescript-example/
├── server.ts       # Fully typed server with generic route handlers
├── client.ts       # Fully typed client with typed error handling
├── tsconfig.json
├── package.json
└── README.md
```

### 13.4 CHANGELOG.md

Documented in Section 17. Required before v1.2.0 npm publish.

---

## 14. Implementation Schedule (Week-by-Week)

### Week 5 — Structured Error Taxonomy + TypeScript Core

**Rationale for order:** Errors first because every other feature this phase produces typed errors. Types first in core because browser and CLI depend on them.

| Day | Task | Package | Est. Hours |
|---|---|---|---|
| Mon | `AfterLinkError` base class + `toJSON()` + `toFrame()` | `@afterlink/core` | 3h |
| Mon | `ProtocolError`, `AuthError`, `RouteError` subclasses | `@afterlink/core` | 2h |
| Tue | `ValidationError` (Zod details mapping), `RateLimitError` | `@afterlink/core` | 2h |
| Tue | `ConnectionError`, `ServerError`, `CompressionError` | `@afterlink/core` | 2h |
| Tue | Replace all `throw new Error(...)` in existing codebase | All packages | 2h |
| Wed | `types/index.d.ts` for `@afterlink/core` | `@afterlink/core` | 3h |
| Wed | `types/index.d.ts` for `@afterlink/server` | `@afterlink/server` | 3h |
| Thu | `types/index.d.ts` for `@afterlink/client` | `@afterlink/client` | 2h |
| Thu | Unit tests — all error classes | `@afterlink/core` | 2h |
| Fri | `examples/typescript-example/` (server.ts + client.ts) | Examples | 2h |
| Fri | `tsc --noEmit` validation — fix any type issues found | All | 1h |

**Week 5 Deliverable:** All error classes in place, replacing plain Error objects. TypeScript `.d.ts` for core, server, client complete and validated.

---

### Week 6 — `/__health` Endpoint + `@afterlink/browser`

**Mon–Tue: Health Endpoint**

| Day | Task | Package | Est. Hours |
|---|---|---|---|
| Mon | Protocol detection in TCP handler (HTTP `GET` prefix) | `@afterlink/server` | 2h |
| Mon | `health/handler.js` — HTTP response writer | `@afterlink/server` | 2h |
| Tue | `health/status.js` — healthy/degraded/unhealthy logic | `@afterlink/server` | 2h |
| Tue | `GET /__health/live` and `/__health/ready` sub-paths | `@afterlink/server` | 1h |
| Tue | Bearer token auth (`Authorization: Bearer`) | `@afterlink/server` | 1h |

**Wed–Fri: `@afterlink/browser`**

| Day | Task | Package | Est. Hours |
|---|---|---|---|
| Wed | `packages/browser/` scaffold (package.json, tsconfig) | `@afterlink/browser` | 1h |
| Wed | `ws-bridge.js` — WebSocket server in `@afterlink/server` | `@afterlink/server` | 3h |
| Wed | CORS origin validation in bridge | `@afterlink/server` | 1h |
| Thu | Browser client `src/client.js` — WebSocket transport | `@afterlink/browser` | 3h |
| Thu | Auto-reconnect on WebSocket disconnect | `@afterlink/browser` | 2h |
| Fri | `types/index.d.ts` for `@afterlink/browser` | `@afterlink/browser` | 1h |
| Fri | `esbuild` build scripts (ESM, CJS, IIFE bundles) | `@afterlink/browser` | 1h |
| Fri | `examples/browser-example/` (server.js + index.html) | Examples | 2h |

**Week 6 Deliverable:** `/__health` returning correct status. Browser client connecting and exchanging messages through WS bridge.

---

### Week 7 — `afterlink` CLI Tool

| Day | Task | Package | Est. Hours |
|---|---|---|---|
| Mon | `packages/cli/` scaffold (package.json, commander setup) | `@afterlink/cli` | 1h |
| Mon | `commands/ping.js` — PING/PONG with stats output | `@afterlink/cli` | 3h |
| Tue | `commands/ping.js` — `--json` mode, exit codes | `@afterlink/cli` | 2h |
| Tue | `commands/call.js` — REQUEST/RESPONSE, formatted output | `@afterlink/cli` | 3h |
| Wed | `commands/call.js` — `--trace` mode (hex frame dump) | `@afterlink/cli` | 2h |
| Wed | `commands/call.js` — `@file.json` payload input | `@afterlink/cli` | 1h |
| Wed | `commands/inspect.js` — annotated hex dump per frame | `@afterlink/cli` | 3h |
| Thu | `commands/monitor.js` — live dashboard (terminal UI) | `@afterlink/cli` | 4h |
| Thu | `config/rc.js` — `~/.afterlinkrc` profile loader | `@afterlink/cli` | 2h |
| Fri | `types/index.d.ts` for `@afterlink/cli` | `@afterlink/cli` | 1h |
| Fri | Cross-platform test (macOS, Linux, Windows via WSL) | `@afterlink/cli` | 2h |

**Week 7 Deliverable:** All four CLI commands working. Profile config loading. Cross-platform validation complete.

---

### Week 8 — Integration Testing + Polish + Release

| Day | Task | Est. Hours |
|---|---|---|
| Mon | Integration tests — browser WS client ↔ server | 3h |
| Mon | Integration tests — CLI end-to-end (real server) | 2h |
| Tue | Playwright browser compatibility suite (Chrome, Firefox, Safari) | 3h |
| Tue | Regression tests — all v1.1.x tests pass | 2h |
| Wed | `docs/cli.md`, `docs/browser.md` | 3h |
| Wed | `docs/typescript.md`, `docs/health.md`, `docs/errors.md` | 3h |
| Thu | `CHANGELOG.md` — v1.2.0 section (Section 17 of this PRD) | 1h |
| Thu | `README.md` updates (new packages table, badges, CLI demo) | 2h |
| Thu | Final JSDoc on all new public APIs | 2h |
| Fri | `npm publish` — `@afterlink/core@1.2.0`, `@afterlink/server@1.2.0`, `@afterlink/client@1.2.0`, `@afterlink/browser@1.2.0`, `@afterlink/cli@1.2.0`, `afterlink@1.2.0` | 1h |
| Fri | GitHub Release v1.2.0 with CHANGELOG body | 1h |
| Fri | Update `afterlinkdocs.vercel.app` with v1.2.0 content | 2h |

**Week 8 Deliverable:** v1.2.0 published to npm across all packages. Docs complete. GitHub Release created.

---

## 15. Definition of Done

v1.2.0 is **complete and releasable** when ALL of the following are true:

### Code
- [ ] All 5 features implemented per spec in this PRD
- [ ] `@afterlink/cli` and `@afterlink/browser` published as new packages
- [ ] All unit tests pass (`pnpm test:all`)
- [ ] All integration tests pass
- [ ] All v1.1.x regression tests pass unchanged
- [ ] Playwright browser compatibility suite passes (Chrome, Firefox, Safari)
- [ ] `tsc --noEmit` on `examples/typescript-example/` — zero errors
- [ ] Bundle size check: `@afterlink/browser` minified < 15KB

### Features
- [ ] `afterlink ping`, `call`, `monitor`, `inspect` all working
- [ ] `~/.afterlinkrc` profile loading working
- [ ] Browser client connects, requests, subscribes over WebSocket
- [ ] WS bridge on server with CORS validation working
- [ ] `wss://` bridge working when server has TLS enabled
- [ ] `.d.ts` files in all 5 packages, zero `any` in public surface
- [ ] `GET /__health` returns correct status and stats
- [ ] `503` returned during shutdown
- [ ] Bearer token auth on health endpoint working
- [ ] All 22 error codes implemented and tested
- [ ] All existing `throw new Error(...)` replaced with typed errors
- [ ] `instanceof AfterLinkError` works on client-caught errors

### Documentation
- [ ] `CHANGELOG.md` updated with complete v1.2.0 section
- [ ] `docs/cli.md` written with full command reference
- [ ] `docs/browser.md` written with integration examples
- [ ] `docs/typescript.md` written
- [ ] `docs/health.md` written with Kubernetes snippets
- [ ] `docs/errors.md` written with complete error code table
- [ ] `README.md` updated with new packages and badges
- [ ] `examples/browser-example/` working and documented
- [ ] `examples/typescript-example/` working and documented

### Release
- [ ] Version bumped to `1.2.0` in all package.json files
- [ ] All 6 packages published to npm at `@1.2.0`
- [ ] Git tag `v1.2.0` created and pushed
- [ ] GitHub Release created with CHANGELOG body

---

## 16. Risk & Mitigation

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Safari WebSocket binary frame handling differs from Chrome | Medium | Medium | Test early in Week 6 with Playwright; Safari sometimes sends `Blob` instead of `ArrayBuffer` — handle both in `ws-bridge.js` |
| `esbuild` tree-shaking removes needed polyfills for older browsers | Low | Low | Target `chrome120, firefox120, safari17` in esbuild `--target` — no polyfills needed for native WebSocket |
| TypeScript `.d.ts` diverges from actual JS implementation | Medium | Medium | Weekly `tsc --noEmit` validation on `typescript-example/` catches this; run as CI check |
| `commander` version conflict with other global CLI tools | Low | Low | Use `peerDependencies` for Node.js version; document Node 20+ requirement |
| `monitor` command terminal UI breaks on Windows CMD | Medium | Medium | Test on Windows; use `chalk` v5 (no Windows ANSI issues); fall back to plain text if terminal doesn't support escape codes |
| Health endpoint HTTP detection conflicts with AfterLink clients sending data starting with `GET ` | Very Low | High | AfterLink HELLO frame type byte is `0x0F` — never ASCII `G` (`0x47`). The check is safe. Document this in comments. |
| Browser CORS misconfiguration allows unintended origins | Medium | High | `cors.origins: '*'` must log a prominent warning in production (`NODE_ENV === 'production'`); default is `[]` (no origins allowed, requires explicit config) |
| `ValidationError.details` structure changes in future Zod versions | Low | Medium | Pin Zod in `peerDependencies` range (`"zod": ">=3.0.0 <4.0.0"`); write a Zod → AfterLink issue mapper that is version-isolated |
| npm publish fails on one package in the chain | Low | Medium | Publish order: `core` → `server` → `client` → `browser` → `cli` → `afterlink` (meta). Use `pnpm -r publish` with `--filter` flags if partial failure |

---

## 17. CHANGELOG Entry (v1.2.0)

```markdown
## [1.2.0] — 2026-07-25

### Added

#### `@afterlink/cli` — New Package
- `afterlink ping <host:port>` — test server connectivity, measure round-trip latency
- `afterlink call <host:port> <route> [payload]` — send a request and print the response
- `afterlink call --trace` — show raw hex frame dump for every frame exchanged
- `afterlink monitor <host:port>` — live terminal dashboard (connections, req/sec, latency, top routes)
- `afterlink monitor --json` — stream stats as NDJSON for piping to log tools
- `afterlink inspect <host:port> <route>` — annotated hex dump and decoded frame breakdown
- `~/.afterlinkrc` config file support for storing default connection profiles
- `--profile <name>` flag to select a named profile from `~/.afterlinkrc`
- `--tls` flag on all commands for `afterlinks://` connections
- `--auth <token>` flag on all commands for JWT-authenticated servers
- `--json` flag on `ping` and `call` for machine-readable output

#### `@afterlink/browser` — New Package
- Browser-compatible AfterLink client using native WebSocket API
- Identical API to `@afterlink/client` (same methods, same events, same options)
- Zero runtime dependencies — uses native browser `WebSocket`
- ESM, CJS, and IIFE bundles (CDN script tag support)
- Auto-reconnect with configurable delay and max attempts
- Pub/sub subscribe/publish over WebSocket transport

#### `@afterlink/server` — WebSocket Bridge
- `browser.enabled` config option starts a WebSocket bridge endpoint
- `browser.port` — configurable separate port for WebSocket connections
- `browser.cors.origins` — origin allowlist for browser CORS validation
- `wss://` bridge when server TLS is enabled

#### `@afterlink/server` — Health Endpoint
- Built-in `GET /__health` HTTP endpoint (enabled by default)
- Returns `200 healthy`, `200 degraded`, or `503 unhealthy` based on server state
- Response includes: `uptime`, `connections`, `requests`, `memory`, `rateLimit`, `routes`
- `GET /__health/live` — liveness probe (always `200` if server is running)
- `GET /__health/ready` — readiness probe (`503` during graceful shutdown)
- `GET /__health/stats` — raw stats JSON
- `health.token` — optional Bearer token to protect the endpoint
- `health.port` — optional dedicated HTTP port for health endpoint
- Protocol detection — health requests on AfterLink port handled via HTTP prefix detection

#### All Packages — Error Taxonomy
- `AfterLinkError` base class exported from `@afterlink/core/errors`
- 8 error subclasses: `ProtocolError`, `AuthError`, `RouteError`, `ValidationError`,
  `RateLimitError`, `ConnectionError`, `ServerError`, `CompressionError`
- 22 typed error codes (see `docs/errors.md` for complete reference)
- `ValidationError.details.issues` — structured Zod error details per field
- `RateLimitError.details.retryAfter` — ms until next request is allowed
- `AfterLinkError.toJSON()` — serializable plain object representation
- `AfterLinkError.httpStatus` — HTTP equivalent status code per error

#### All Packages — TypeScript Types
- `types/index.d.ts` in `@afterlink/core`, `@afterlink/server`, `@afterlink/client`,
  `@afterlink/browser`, `@afterlink/cli`
- Full IDE autocomplete for all config options, method parameters, and return types
- `Server.on<TBody>()` generic propagates body type to `req.body` in handler
- All frame type constants typed as literal numbers
- JSDoc type hints for JavaScript users (no TypeScript required)

### Changed
- `ERROR` frame payload changed from plain string to structured object
  `{ code, message, category, httpStatus, details, requestId }`
  — backward compatible: v1.1.x clients receive as opaque MessagePack map
- All internal `throw new Error(...)` replaced with typed `AfterLinkError` subclasses
- `afterlink` meta-package now includes `@afterlink/cli` as `optionalDependency`

### Fixed
- Health detection correctly identifies HTTP `GET` vs AfterLink HELLO frame
  (no collision possible: HELLO frame type byte `0x0F` ≠ ASCII `G` `0x47`)
```

---

*AfterLink v1.2.0 PRD — Version 1.0 — May 2026*
*Author: Ajju (Javali Ajayakumar) — GTTC Magadi, Karnataka*
*Baseline: AfterLink v1.1.3 (Phase 1 — Protocol & Stability)*
*Next: Phase 3 PRD — v2.0.0 Scale & Ecosystem (Cluster, Python SDK, Dart SDK, Metrics)*
