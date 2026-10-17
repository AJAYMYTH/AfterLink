# AfterLink Interactive Web Demo

A guided website **plus** a live browser playground — every interaction on the page
runs over real AfterLink sessions (AL/2 negotiated, binary frames, routes, pub/sub,
typed errors). No simulation, no mocks.

## Run it

```bash
# from the repo root
pnpm install        # once
pnpm demo:web       # or: node examples/web-demo/server.js
```

Open **http://localhost:8080** — Alice and Bob connect automatically and the
playground comes alive.

| Port | Env var          | What                                          |
| ---- | ---------------- | --------------------------------------------- |
| 8080 | `DEMO_PORT`      | website + browser SDK bundle                  |
| 4400 | `DEMO_TCP_PORT`  | AfterLink TCP endpoint (`afterlink://`)       |
| 4401 | `DEMO_WS_PORT`   | WebSocket bridge (`/ws`) used by the page     |

`node examples/web-demo/server.js --build-only` rebuilds `public/sdk.js` and exits
(useful after SDK source changes).

## What's on the page

| Section        | What it shows                                                                    |
| -------------- | -------------------------------------------------------------------------------- |
| **Why**        | The problem with HTTP polling / bare WebSockets / gRPC / Socket.IO               |
| **What**       | Feature tour + comparison table (schema validation, pub/sub, typed errors, …)    |
| **How it works** | Interactive AL/2 handshake stepper + byte-accurate frame explorer              |
| **Live demo**  | Alice & Bob messaging app, wire log, typed errors, reconnect, metrics            |
| **Impact**     | Repo benchmark numbers + a 200-request benchmark you can run yourself            |
| **Challenges** | Real war stories from the changelog (cross-SDK byte parity, negotiation, …)      |
| **Real world** | Use cases, code snippets for all four SDKs, deployment checklist                 |

Highlights in the **Live Playground**:

- `chat.send` is a request; the server fans the message out on the `chat.lobby`
  topic over pub/sub — every bubble made a full request → broadcast round trip.
- **🧪 Break schema** sends an invalid body and shows the typed `VALIDATION_ERROR`
  frame the server returns *before* the handler runs.
- **🔌 Drop socket** force-closes a client's socket and you can watch it auto-reconnect
  with backoff and re-negotiate a brand-new AL/2 session (new session id in the log).
- **📣 Server push** schedules a server-initiated broadcast to `demo.news`.
- Open the page in a second tab and you have four participants in the room.

The **frame explorer** encodes real frames with the bundled codec in your browser:
pick v1/v2, switch presets (REQUEST / RESPONSE / PUBLISH / HELLO), click any byte to
inspect its field, and compare header cost (`v1 10 B` vs `v2 16 B`) for the same payload.

## How it's built

```
examples/web-demo/
├── server.js           # static server + AfterLink server + WS bridge + routes
├── client/sdk-entry.js # esbuild entry: @ajaymyth/browser + core + Buffer polyfill
├── public/             # index.html · style.css · app.js   (no framework)
│   └── sdk.js          # generated at server start — gitignored
├── smoke-test.js       # headless verification (no browser needed)
└── package.json
```

- The bundle is built **from workspace sources** at server startup (`public/sdk.js`,
  IIFE global `AfterLinkDemo` = `{ Client, Core }`), so the site always demos the
  code that's actually in this repo.
- Routes served: `demo.echo`, `demo.add` (zod), `demo.slow`, `demo.boom`,
  `demo.trigger` → `demo.news`, `chat.send` → `chat.lobby`, `demo.stats`.
- `demo.stats` also reports a demo-level request counter (a router middleware) —
  the library's built-in counters are per-TCP-connection, and browser sessions ride
  the WebSocket bridge, so the page labels that metric **tcp clients** and uses the
  middleware count for "requests handled".

## Verify it

```bash
# terminal 1
pnpm demo:web
# terminal 2
node examples/web-demo/smoke-test.js
```

The smoke test loads `public/sdk.js` in a browser-like VM sandbox (no Node `Buffer`,
proving the polyfill), then checks: 10-byte v1 / 16-byte v2 codec, AL/2 negotiation,
`demo.echo`, pub/sub, `VALIDATION_ERROR`, `ROUTE_NOT_FOUND`, and live metrics.
Exit code 0 = pass.

**Browser self-test:** open `http://localhost:8080/?smoke=1` — the page performs a
scripted round trip (echo + chat delivery) and writes `SMOKE_PASS …` / `SMOKE_FAIL …`
into a hidden `#smoke` element, which makes it easy to assert from any headless
browser or automation pipeline.

## Troubleshooting

- **Page shows "Can't reach the demo server"** — the server isn't running or ports
  are taken. Start it (`pnpm demo:web`) or override ports via `DEMO_PORT` /
  `DEMO_TCP_PORT` / `DEMO_WS_PORT` and reload.
- **Edited SDK sources but the page behaves the same** — restart the server
  (or run `--build-only`) to rebuild `public/sdk.js`.
