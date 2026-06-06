# AfterLink SDK Problems & Workarounds

> **All issues below have been resolved in the source code.**
> See [FIXES.md](./FIXES.md) for the full rationale, diffs, and usage examples.

---

## ✅ 1. `workspace:*` Protocol in Package Dependencies

**Problem:** `@ajaymyth/*` packages use `workspace:*` protocol internally. Running `npm install` throws `ERR! EUNSUPPORTEDPROTOCOL`.

**Fix:** Use `pnpm` instead of `npm`. Add `pnpm.overrides` in `package.json` to resolve workspace references:
```json
"pnpm": {
  "overrides": {
    "@ajaymyth/core": "1.2.0",
    "@ajaymyth/server": "1.2.0",
    "@ajaymyth/browser": "1.2.0"
  }
}
```

---

## ✅ 2. `jose` v6 is ESM-only — Crashes in CJS Context

**Problem:** The SDK's internal auth uses `jose` for JWT verification. `jose` v6 is ESM-only. When imported via CJS `require()`, it throws `ReferenceError: TextEncoder is not defined`.

**Fixed in:** `packages/server/src/Connection.js` · `packages/server/src/browser/ws-bridge.js`

Both now use `await import('jose')` (dynamic ESM import) instead of `require('jose')`.

---

## ✅ 3. Built-in `_handleHandshake` Doesn't Store JWT User in Session

**Problem:** The SDK's `Connection._handleHandshake` calls `_validateAuth()` but **discards the decoded JWT payload**. The `session.user` is always `null`, making every authenticated route throw `"Authentication required"`.

**Fixed in:** `packages/server/src/Connection.js` · `packages/server/src/browser/ws-bridge.js`

`session.user` is now populated with the decoded JWT payload after verification.

---

## ✅ 4. Built-in `_validateAuth` Doesn't Use `await`

**Problem:** The SDK v1.2.0's `Connection._handleHandshake` calls `_validateAuth` without `await`, so the JWT verification completes asynchronously after the session is created. The session always has `user: null` regardless of whether the token was valid.

**Fixed in:** `packages/server/src/Connection.js`

`_handleHandshake` is now `async` and properly `await`s `_validateAuth`.

---

## ✅ 5. `ws-bridge` Doesn't Handle HELLO Auth or Pass `session.user` to Router

**Problem:** The SDK's built-in `createWsBridge`:
- Ignores the `auth` field in the HELLO frame entirely (creates session with `user: null`)
- Doesn't pass `req.session` to the router's middleware chain
- Routes receive no user context, so all authenticated routes fail

**Fixed in:** `packages/server/src/browser/ws-bridge.js`

`handleWsHandshake` now parses the HELLO `auth` field, verifies the JWT, and sets `session.user`. The full session is forwarded through the middleware chain.

---

## ✅ 6. `ws-bridge` Drops Frames When HELLO and REQUEST Arrive in Same TCP Packet

**Problem:** When the browser sends HELLO and the first REQUEST as two `ws.send()` calls in quick succession, they can arrive as a single WebSocket message (one `ws.on('message')` event). The bridge decodes only the HELLO frame and returns, discarding the REQUEST frame still in the buffer.

**Fixed in:** `packages/server/src/browser/ws-bridge.js`

The message handler now maintains a persistent buffer. After decoding the HELLO, remaining bytes are preserved and processed by the standard frame-draining loop.

---

## ✅ 7. API Reference Documents Outdated API Names

**Problem:** The afterlink-skill's `api-reference.md` describes `rateLimit.maxRequests`, `browser.corsOrigins`, `auth.enabled`, etc. The actual v1.2.0 SDK uses:
- `rateLimit: { requestsPerSecond, burstSize }` (not `maxRequests`)
- `browser: { cors: { origins } }` (not `corsOrigins`)
- `auth: { type: 'jwt', secret }` (not `auth: { enabled: true }`)

**Fix:** All READMEs in this repo already use the correct keys. Always cross-reference against the defaults in `packages/server/src/Server.js`.

---

## ✅ 8. `@ajaymyth/core` Exports No Client Class

**Problem:** The core package exports only `{ Frame, FrameTypes, Serializer, compression, errors }`. There is no `Client` class for TCP connections. Testing the TCP server requires writing a raw socket client using `net` module + Frame encoding.

**Fixed in:** `packages/core/src/TcpClient.js` *(new)* · `packages/core/src/index.js`

A `TcpClient` class is now exported from `@ajaymyth/core`:
```js
const { TcpClient } = require('@ajaymyth/core');
const client = new TcpClient({ host: 'localhost', port: 4000 });
await client.connect({ auth: myJwtToken });
const response = await client.request('messages/send', { text: 'hello' });
client.disconnect();
```

---

## ✅ 9. WebSocket CORS Blocks Node.js Test Clients

**Problem:** The ws-bridge's `verifyClient` requires an `Origin` header matching the allowed origins list. Node.js test scripts using `ws` library don't set this header by default, causing 403 rejection.

**Fixed in:** `packages/server/src/browser/ws-bridge.js`

Connections with no `Origin` header are permitted when `cors.origins` is empty (default dev config). Production servers should always set an explicit origins list.

**Alternative:** Set origin explicitly in your test client:
```js
new WebSocket(url, { origin: 'http://localhost:5173' });
```

---

## ✅ 10. Supabase `room_members!inner(role)` Join Fails in PostgREST

**Problem:** Using Supabase's `select('*, room_members!inner(role)')` with an inner join on room_members causes "Message not found" errors because PostgREST doesn't interpret the column restriction in joins the same way as raw SQL.

**Fix:** No SDK change needed. Use two separate queries in your app code:
```js
const msg = await supabase.from('messages').select('id,room_id,sender_id').eq('id',messageId).single();
const member = await supabase.from('room_members').select('role').eq('room_id',msg.room_id).eq('user_id',userId).single();
```

---

## ✅ 11. Supabase Mock Falls Back Silently

**Problem:** When `SUPABASE_URL` or `SUPABASE_SERVICE_KEY` contain placeholder values, the server's `supabase.js` module creates a mock client (all queries return empty/null results). No error is thrown, making it appear the server works while silently dropping all data operations.

**Fix:** No SDK change needed. Copy `.env.example` → `.env` and set real Supabase credentials before testing. Add a startup guard:
```js
if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-')) {
  throw new Error('SUPABASE_URL is not configured!');
}
```
