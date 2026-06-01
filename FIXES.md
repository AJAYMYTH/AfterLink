# AfterLink SDK — Known Issues & Applied Fixes

All issues documented in `PROBLEMS.md` have been resolved in the source code.
This document serves as the canonical reference for **what was changed and why**,
so future contributors understand the rationale without having to rediscover these bugs.

---

## Fixed Issues

---

### ✅ Fix 1 — `workspace:*` Protocol Incompatible with npm

**Status:** Resolved by project design — use `pnpm`.

The repo uses pnpm workspaces (`pnpm-workspace.yaml`, `pnpm-lock.yaml`).
All `@afterlink/*` packages reference each other via `workspace:*`, a pnpm-only protocol.

**Always install with:**
```bash
pnpm install
```

If consuming AfterLink packages in your own project, pin explicit versions:
```json
"pnpm": {
  "overrides": {
    "@afterlink/core": "1.2.0",
    "@afterlink/server": "1.2.0",
    "@afterlink/browser": "1.2.0"
  }
}
```

---

### ✅ Fix 2 — `jose` v6 ESM-only Crashed in CJS Context

**Files changed:** `packages/server/src/Connection.js`, `packages/server/src/browser/ws-bridge.js`

`jose` v6 is a pure ESM package. The original code used synchronous `require('jose')`
inside a CJS module, causing `ERR_REQUIRE_ESM` on Node 18+ or
`ReferenceError: TextEncoder is not defined` on older versions.

**Fix:** Both `_validateAuth` in `Connection.js` and `handleWsHandshake` in
`ws-bridge.js` now use dynamic `import('jose')`, which works correctly inside
CJS modules at runtime.

```js
// Before (broken):
const { jwtVerify } = require('jose'); // ❌ crashes — ESM-only

// After (fixed):
const { jwtVerify } = await import('jose'); // ✅ works in CJS
```

---

### ✅ Fix 3 — JWT Payload Discarded, `session.user` Always `null`

**Files changed:** `packages/server/src/Connection.js`, `packages/server/src/browser/ws-bridge.js`

After JWT verification, the decoded payload was never stored anywhere.
`session.user` was always `null`, making every authenticated route throw
`"Authentication required"`.

**Fix:** `_validateAuth` stores the decoded payload in `this._jwtPayload`.
`_handleHandshake` then writes `user: this._jwtPayload || null` onto the session.
`handleWsHandshake` similarly sets `session.user = payload`.

---

### ✅ Fix 4 — `_validateAuth` Not Awaited (Silent Race Condition)

**Files changed:** `packages/server/src/Connection.js`

`_handleHandshake` called `this._validateAuth(data.auth)` without `await`.
Because `_validateAuth` is async, the JWT verification completed *after*
the session was already constructed — so `session.user` was always `null`
regardless of the token, and invalid tokens were silently accepted.

**Fix:** `_handleHandshake` is now `async`, and it `await`s `_validateAuth`
before building the session object.

---

### ✅ Fix 5 — `ws-bridge` Ignored Auth and Dropped `session.user`

**Files changed:** `packages/server/src/browser/ws-bridge.js`

The WebSocket bridge's `handleWsHandshake` function:
- Completely ignored the `auth` field in the HELLO payload
- Created sessions with `user: null` unconditionally
- Did not pass session context through the middleware chain

**Fix:** `handleWsHandshake` is now `async`, accepts the server `authConfig`,
verifies the JWT from `helloData.auth` via `jwtVerify` (with dynamic ESM import),
and sets `session.user = payload`. The full session (including `user`) is passed
into `req` when routing frames.

---

### ✅ Fix 6 — Frames Dropped When HELLO and REQUEST Arrive in Same TCP Packet

**Files changed:** `packages/server/src/browser/ws-bridge.js`

When a browser sends HELLO and the first REQUEST in rapid succession, the OS
can coalesce them into a single TCP packet, causing a single `ws.on('message')`
event. The old code decoded only the HELLO frame and returned, silently
discarding all remaining bytes.

**Fix:** The `message` handler now maintains a persistent `buffer` across events.
After decoding the HELLO frame from the buffer, it advances past `helloFrame.totalSize`
and preserves the remaining bytes. After `handshakeComplete = true`, execution
falls through into the standard frame-draining `while` loop that processes all
complete frames in the buffer.

---

### ✅ Fix 7 — API Docs Described Wrong Config Key Names

**Status:** Verified correct in all README files. No code change required.

The issue was specific to an `api-reference.md` skill document (not present in
this repo). All existing READMEs already use the correct keys:

| ❌ Incorrect (in old skill docs) | ✅ Correct (in Server.js & READMEs) |
|---------------------------------|-------------------------------------|
| `rateLimit.maxRequests`         | `rateLimit.requestsPerSecond` + `rateLimit.burstSize` |
| `browser.corsOrigins`           | `browser.cors.origins`              |
| `auth.enabled: true`            | `auth: { type: 'jwt', secret: '...' }` |

**Rule for contributors:** Always derive config examples directly from the
defaults in `packages/server/src/Server.js` constructor, not from external docs.

---

### ✅ Fix 8 — `@afterlink/core` Exported No Client Class

**Files changed:** `packages/core/src/TcpClient.js` *(new)*, `packages/core/src/index.js`

The core package exported only low-level primitives (`Frame`, `FrameTypes`,
`Serializer`, `compression`, `errors`). There was no ready-made TCP client,
forcing every developer to write ~100 lines of raw socket boilerplate.

**Fix:** A new `TcpClient` class is now exported from `@afterlink/core`.
It wraps `net.Socket` with the full AfterLink framing protocol, exposes
clean Promise-based `connect()` and `request()` APIs, and automatically handles
HELLO_ACK, PING/PONG, SERVER_CLOSING, and connection teardown.

```js
const { TcpClient } = require('@afterlink/core');

const client = new TcpClient({ host: 'localhost', port: 4000 });
await client.connect({ auth: myJwtToken });

const response = await client.request('messages/send', { text: 'hello' });
client.disconnect();
```

---

### ✅ Fix 9 — WebSocket CORS Blocked Node.js Test Clients

**Files changed:** `packages/server/src/browser/ws-bridge.js`

Node.js WebSocket clients using the `ws` library don't set an `Origin` header
by default. The bridge's `verifyClient` callback rejected all no-origin
connections with HTTP 403, making it impossible to write server-side test scripts
without patching the origin manually.

**Fix:** The updated `verifyClient` permits connections with no `Origin` header
when the `cors.origins` list is empty (the default development config). When
the server is configured with an explicit origins list, the strict check remains
in effect. Production deployments should always set `cors.origins` explicitly.

**Alternative for Node.js test clients — set origin explicitly:**
```js
const ws = new WebSocket('ws://localhost:4001/ws', {
  origin: 'http://localhost:5173',
});
```

---

### ✅ Fix 10 — Supabase `room_members!inner(role)` Join Fails in PostgREST

**Status:** No SDK code change needed — this is a Supabase/PostgREST limitation.

PostgREST's `!inner()` join syntax does not interpret column restriction inside
the join the same way as raw SQL `INNER JOIN`, causing empty results or
"Message not found" errors.

**Pattern to follow in your app code:**
```js
// ❌ Fails silently in PostgREST:
const msg = await supabase
  .from('messages')
  .select('*, room_members!inner(role)')
  .eq('id', messageId)
  .single();

// ✅ Use two separate queries instead:
const { data: msg } = await supabase
  .from('messages')
  .select('id, room_id, sender_id')
  .eq('id', messageId)
  .single();

const { data: member } = await supabase
  .from('room_members')
  .select('role')
  .eq('room_id', msg.room_id)
  .eq('user_id', userId)
  .single();
```

---

### ✅ Fix 11 — Supabase Mock Silently Swallowed All Data Operations

**Status:** No SDK code change needed — this is a deployment/env config issue.

When `SUPABASE_URL` or `SUPABASE_SERVICE_KEY` contain placeholder values,
the `supabase.js` module creates a mock client that returns empty/null for
all queries without throwing errors. The server appears to work while silently
dropping every data operation.

**Required before any real testing:**
1. Copy `.env.example` → `.env`
2. Set real Supabase credentials
3. Add a startup guard to catch misconfiguration early:

```js
// supabase.js — add this at the top:
if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-')) {
  throw new Error(
    '[AfterLink] SUPABASE_URL is not configured. ' +
    'Copy .env.example to .env and set real credentials.'
  );
}
if (!process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY.includes('your-')) {
  throw new Error(
    '[AfterLink] SUPABASE_SERVICE_KEY is not configured. ' +
    'Copy .env.example to .env and set real credentials.'
  );
}
```

---

## Summary of Source Changes

| File | Problems Fixed |
|------|---------------|
| `packages/server/src/Connection.js` | #2 (jose ESM), #3 (session.user), #4 (await) |
| `packages/server/src/browser/ws-bridge.js` | #5 (auth), #6 (frame coalescing), #9 (CORS) |
| `packages/core/src/TcpClient.js` | #8 (client class) — **new file** |
| `packages/core/src/index.js` | #8 (exports TcpClient) |
| Problems #1, #7, #10, #11 | Config/env/docs — no source change needed |
