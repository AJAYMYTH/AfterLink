/**
 * Headless smoke test for the AfterLink interactive web demo.
 *
 * Loads public/sdk.js in a VM sandbox that mimics a browser (no Node Buffer),
 * connects to the running demo server over the WebSocket bridge, and checks:
 *
 *   1. the bundle installs its own Buffer polyfill
 *   2. frame codec produces 10-byte v1 / 16-byte v2 headers from bundled sources
 *   3. HELLO/HELLO_ACK negotiates AL/2
 *   4. demo.echo round-trip
 *   5. chat.send request → chat.lobby pub/sub broadcast
 *   6. typed errors (VALIDATION_ERROR, ROUTE_NOT_FOUND)
 *   7. demo.stats returns live server metrics
 *
 * Usage:
 *   1. node examples/web-demo/server.js     (terminal 1 — keep running)
 *   2. node examples/web-demo/smoke-test.js (terminal 2)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WS_URL = process.env.DEMO_WS_URL || 'ws://127.0.0.1:4401/ws';

function fail(msg) {
  console.error('\nSMOKE FAIL:', msg);
  process.exit(1);
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

(async () => {
  // ── Load the bundle in a browser-like sandbox ─────────────────────────────
  const code = fs.readFileSync(path.join(__dirname, 'public', 'sdk.js'), 'utf8');

  const sandbox = {
    console,
    WebSocket, // Node 22+ ships a spec-compliant WebSocket — perfect stand-in
    TextEncoder,
    TextDecoder,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    performance,
    atob,
    btoa,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'sdk.js' });

  const { Client, Core } = sandbox.AfterLinkDemo || {};
  if (!Client || !Core) fail('bundle did not expose AfterLinkDemo.{Client,Core}');
  if (typeof sandbox.Buffer === 'undefined') fail('the bundle did not install the Buffer polyfill');
  if (typeof sandbox.Buffer.isBuffer !== 'function') fail('Buffer polyfill is missing isBuffer');
  console.log('PASS  bundle loaded in a browser-like sandbox; Buffer polyfill installed');

  // ── Frame codec must be byte-accurate ─────────────────────────────────────
  const payload = Core.Serializer.encode({ route: 'demo.echo', body: { hello: 'smoke' } });
  const v1Frame = Core.Frame.encode(Core.FrameTypes.REQUEST, 0, 1, payload);
  const v2Frame = Core.Frame.encode(Core.FrameTypes.REQUEST, 0, 1, payload, { version: 2 });

  if (v1Frame.length !== 10 + payload.length) fail(`v1 frame length ${v1Frame.length}, expected ${10 + payload.length}`);
  if (v1Frame[2] === 0x02) fail('v1 frame version byte must not be 0x02');
  if (v2Frame.length !== 16 + payload.length) fail(`v2 frame length ${v2Frame.length}, expected ${16 + payload.length}`);
  if (v2Frame[2] !== 0x02) fail(`v2 frame version byte is 0x${v2Frame[2].toString(16)}, expected 0x02`);
  if (v2Frame[3] !== 3) fail(`v2 default priority is ${v2Frame[3]}, expected 3`);
  console.log('PASS  frame codec: v1 = 10-byte header, v2 = 16-byte header (version byte 0x02)');

  // ── Live session over the WS bridge ───────────────────────────────────────
  const client = new Client(WS_URL, { autoReconnect: false, pingInterval: 60000 });
  client.on('connected', () => {});
  await withTimeout(client.connect(), 6000, 'connect');

  if (client.getProtocolVersion() !== 2) fail(`expected AL/2 negotiation, got v${client.getProtocolVersion()}`);
  console.log(`PASS  negotiated protocol v2 (session ${client.getSessionId()})`);

  // ── Request/response ──────────────────────────────────────────────────────
  const echo = await withTimeout(client.request('demo.echo', { smoke: true }), 5000, 'demo.echo');
  if (!echo || !echo.echoed || echo.echoed.smoke !== true) fail(`echo mismatch: ${JSON.stringify(echo)}`);
  console.log('PASS  demo.echo round-trip');

  // ── Pub/sub: chat.send → chat.lobby broadcast ─────────────────────────────
  let resolveMessage;
  const receivedPromise = new Promise((resolve) => { resolveMessage = resolve; });
  await withTimeout(client.subscribe('chat.lobby', (msg) => resolveMessage(msg)), 5000, 'subscribe');

  const ack = await withTimeout(
    client.request('chat.send', { user: 'smoke', text: 'hello from the smoke test' }),
    5000,
    'chat.send'
  );
  if (!ack || ack.delivered !== true) fail(`chat.send not delivered: ${JSON.stringify(ack)}`);

  const message = await withTimeout(receivedPromise, 5000, 'chat.lobby broadcast');
  if (message.text !== 'hello from the smoke test' || message.user !== 'smoke') {
    fail(`pub/sub payload mismatch: ${JSON.stringify(message)}`);
  }
  console.log('PASS  chat.send → chat.lobby pub/sub broadcast');

  // ── Typed errors ──────────────────────────────────────────────────────────
  try {
    await client.request('chat.send', { user: 'smoke', text: '' });
    fail('expected VALIDATION_ERROR for empty text');
  } catch (err) {
    if (err.code !== 'VALIDATION_ERROR') fail(`expected VALIDATION_ERROR, got ${err.code}: ${err.message}`);
  }
  console.log('PASS  schema validation → VALIDATION_ERROR frame');

  try {
    await client.request('does.not.exist', {});
    fail('expected ROUTE_NOT_FOUND');
  } catch (err) {
    if (err.code !== 'ROUTE_NOT_FOUND') fail(`expected ROUTE_NOT_FOUND, got ${err.code}: ${err.message}`);
  }
  console.log('PASS  unknown route → ROUTE_NOT_FOUND frame');

  // ── Live server stats ─────────────────────────────────────────────────────
  const stats = await withTimeout(client.request('demo.stats', {}), 5000, 'demo.stats');
  if (typeof stats.connections !== 'number' || typeof stats.avgLatencyMs !== 'number') {
    fail(`unexpected stats shape: ${JSON.stringify(stats)}`);
  }
  // The `demo` counters are the demo server's own middleware tally — they count
  // every routed request on both transports (the library's counters only cover
  // raw-TCP connections, which browser sessions never use).
  if (!stats.demo || typeof stats.demo.requests !== 'number' || stats.demo.requests < 1) {
    fail(`demo request counter missing or zero: ${JSON.stringify(stats.demo)}`);
  }
  if (typeof stats.demo.avgHandlerMs !== 'number' || typeof stats.demo.requestsPerSec !== 'number') {
    fail(`demo metrics malformed: ${JSON.stringify(stats.demo)}`);
  }
  console.log(
    `PASS  demo.stats → ${stats.connections} tcp connection(s), ${stats.demo.requests} request(s) handled, ` +
    `avg handler time ${stats.demo.avgHandlerMs}ms`
  );

  await client.disconnect();

  console.log('\nSMOKE PASS — browser bundle + AL/2 negotiation + request/response + pub/sub + typed errors all work.');
  process.exit(0);
})().catch((err) => fail(err.message));
