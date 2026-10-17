/**
 * AfterLink Interactive Web Demo — server
 *
 * Serves the demo website, runs a live AfterLink server with the WebSocket
 * bridge enabled, and builds the browser SDK bundle (public/sdk.js) from the
 * real workspace sources on startup. It also copies the Astryx design-system
 * stylesheets (public/astryx/*.css) out of node_modules so the page styles
 * itself with the real design tokens.
 *
 * Run from the repo root:
 *   pnpm demo:web                    (or)
 *   node examples/web-demo/server.js
 *
 * Ports (override with env vars):
 *   8080  DEMO_PORT      → website + browser SDK bundle
 *   4400  DEMO_TCP_PORT  → AfterLink TCP endpoint
 *   4401  DEMO_WS_PORT   → WebSocket bridge (/ws) used by the page
 *
 * Everything the page does in the Live Playground is a real AfterLink
 * session: HELLO/HELLO_ACK with AL/2 negotiation, REQUEST/RESPONSE routes,
 * schema validation, typed errors, and pub/sub broadcasts.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('@ajaymyth/server');
const { z } = require('zod');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const SDK_BUNDLE = path.join(PUBLIC_DIR, 'sdk.js');
const DEMO_VERSION = require('./package.json').version;

function toPort(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : fallback;
}

const STATIC_PORT = toPort(process.env.DEMO_PORT, 8080);
const TCP_PORT = toPort(process.env.DEMO_TCP_PORT, 4400);
const WS_PORT = toPort(process.env.DEMO_WS_PORT, 4401);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Build the browser SDK bundle from workspace sources
// ─────────────────────────────────────────────────────────────────────────────
async function buildSdkBundle() {
  const esbuild = require('esbuild');
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'client', 'sdk-entry.js')],
    bundle: true,
    format: 'iife',
    globalName: 'AfterLinkDemo',
    platform: 'browser',
    target: ['chrome120', 'firefox120', 'safari17'],
    outfile: SDK_BUNDLE,
    minify: false,
    sourcemap: false,
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'warning',
  });
  const kb = (fs.statSync(SDK_BUNDLE).size / 1024).toFixed(1);
  console.log(`[demo] browser SDK bundle built  →  public/sdk.js (${kb} kB)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Copy the Astryx stylesheets the page consumes into public/astryx/
//    (the page styles itself with the real design-system tokens — the files
//    come from node_modules at startup, like sdk.js, and stay gitignored)
// ─────────────────────────────────────────────────────────────────────────────
const ASTRYX_CSS_DIR = path.join(PUBLIC_DIR, 'astryx');
const ASTRYX_SHEETS = {
  'fonts.css': '@astryxdesign/theme-neutral/fonts.css',
  'theme.css': '@astryxdesign/theme-neutral/theme.css',
  'reset.css': '@astryxdesign/core/reset.css',
  'astryx.css': '@astryxdesign/core/astryx.css',
};

function copyDesignSystemCss() {
  fs.mkdirSync(ASTRYX_CSS_DIR, { recursive: true });
  for (const [name, spec] of Object.entries(ASTRYX_SHEETS)) {
    const from = require.resolve(spec, { paths: [ROOT] });
    fs.copyFileSync(from, path.join(ASTRYX_CSS_DIR, name));
  }
  console.log('[demo] Astryx design-system CSS copied  →  public/astryx/');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. AfterLink server + demo routes
// ─────────────────────────────────────────────────────────────────────────────
const server = new Server({
  port: TCP_PORT,
  health: { enabled: true },
  browser: {
    enabled: true,
    port: WS_PORT,
    path: '/ws',
    cors: { origins: '*' },
  },
});

// — Simple request/response ──────────────────────────────────────────────────
server.on('demo.echo', async (req, res) => {
  res.send({ echoed: req.body, serverTime: Date.now() });
});

// — Schema validation (zod) — invalid bodies get a typed VALIDATION_ERROR ────
server.on(
  'demo.add',
  async (req, res) => {
    res.send({ a: req.body.a, b: req.body.b, result: req.body.a + req.body.b });
  },
  z.object({ a: z.number(), b: z.number() })
);

// — Async handler — shows the connection stays usable while work is pending ──
server.on('demo.slow', async (req, res) => {
  const ms = Math.min(Math.max(parseInt(req.body && req.body.ms, 10) || 600, 50), 3000);
  await new Promise((resolve) => setTimeout(resolve, ms));
  res.send({ sleptMs: ms, serverTime: Date.now() });
});

// — Deliberate crash — becomes an INTERNAL_SERVER_ERROR frame ────────────────
server.on('demo.boom', async () => {
  throw new Error('Intentional crash from demo.boom — uncaught handler errors become typed error frames');
});

// — Server-initiated push — responds first, broadcasts to pub/sub 1.2s later ─
server.on('demo.trigger', async (req, res) => {
  const headline =
    (req.body && req.body.headline) || 'The server just pushed this over AfterLink pub/sub';
  const publishInMs = 1200;

  setTimeout(() => {
    server.publish('demo.news', {
      id: `news_${Date.now()}`,
      headline,
      source: 'server',
      at: Date.now(),
    });
  }, publishInMs);

  res.send({ scheduled: true, publishInMs, topic: 'demo.news' });
});

// — Chat — request/response ACK + pub/sub fan-out to every subscriber ────────
let chatMessageSeq = 0;

server.on(
  'chat.send',
  async (req, res) => {
    const { user, text, room = 'lobby' } = req.body;
    const message = {
      id: `msg_${Date.now()}_${++chatMessageSeq}`,
      room,
      user,
      text,
      sentAt: Date.now(),
    };
    server.publish(`chat.${room}`, message);
    res.send({ delivered: true, messageId: message.id, deliveredAt: Date.now() });
  },
  z.object({
    user: z.string().min(1).max(32),
    text: z.string().min(1).max(500),
    room: z.string().min(1).max(64).optional(),
  })
);

// — Demo telemetry that covers BOTH transports ───────────────────────────────
// The library's built-in counters are attached per TCP connection, so frames
// arriving through the WebSocket bridge are invisible to them. This middleware
// runs on the shared router instead — every routed REQUEST frame (TCP or WS)
// passes through it, which is exactly what the playground metrics need.
const demoMetrics = { requests: 0, latencySumMs: 0, startedAt: Date.now() };

server.use(async (_req, next) => {
  const t0 = Date.now();
  demoMetrics.requests++;
  try {
    await next();
  } finally {
    demoMetrics.latencySumMs += Date.now() - t0;
  }
});

// — Live server stats (dogfooded over the protocol itself) ───────────────────
server.on('demo.stats', async (_req, res) => {
  const uptimeMs = Math.max(1, Date.now() - demoMetrics.startedAt);
  res.send({
    ...server.getStats(),
    demo: {
      requests: demoMetrics.requests,
      requestsPerSec: parseFloat((demoMetrics.requests / (uptimeMs / 1000)).toFixed(2)),
      avgHandlerMs: demoMetrics.requests
        ? parseFloat((demoMetrics.latencySumMs / demoMetrics.requests).toFixed(3))
        : 0,
    },
    node: process.version,
    version: DEMO_VERSION,
    protocols: ['AL/2 (16-byte v2 frames)', 'AL/1.x (10-byte v1 frames)'],
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Static website
// ─────────────────────────────────────────────────────────────────────────────
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
};

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';

  // Runtime config for the page (which ports the demo is actually using)
  if (pathname === '/config.js') {
    const host = (req.headers.host || 'localhost').split(':')[0];
    const config = {
      wsUrl: `ws://${host}:${WS_PORT}/ws`,
      tcpUrl: `afterlink://${host}:${TCP_PORT}`,
      staticPort: STATIC_PORT,
      version: DEMO_VERSION,
    };
    res.writeHead(200, { 'Content-Type': CONTENT_TYPES['.js'], 'Cache-Control': 'no-store' });
    res.end(`window.AFTERLINK_DEMO_CONFIG = ${JSON.stringify(config, null, 2)};\n`);
    return;
  }

  const filePath = path.resolve(PUBLIC_DIR, '.' + pathname);
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(filePath).pipe(res);
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const staticServer = http.createServer((req, res) => {
      try {
        serveStatic(req, res);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal demo error');
      }
    });
    staticServer.on('error', reject);
    staticServer.listen(STATIC_PORT, () => resolve(staticServer));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  if (process.argv.includes('--build-only')) {
    await buildSdkBundle();
    copyDesignSystemCss();
    return;
  }

  await buildSdkBundle();
  copyDesignSystemCss();
  await server.listen();
  await startStaticServer();

  console.log('');
  console.log('  ┌───────────────────────────────────────────────────────────┐');
  console.log('  │  AfterLink interactive web demo                           │');
  console.log('  └───────────────────────────────────────────────────────────┘');
  console.log('');
  console.log(`    Website        http://localhost:${STATIC_PORT}`);
  console.log(`    WebSocket      ws://localhost:${WS_PORT}/ws   (browser bridge)`);
  console.log(`    TCP endpoint   afterlink://localhost:${TCP_PORT}`);
  console.log(`    Health         http://localhost:${TCP_PORT}/__health`);
  console.log('');
  console.log('    Open the website and press “Connect” — everything in the');
  console.log('    Live Playground runs over real AfterLink sessions.');
  console.log('');
}

main().catch((err) => {
  console.error('[demo] failed to start:', err);
  process.exit(1);
});

server.handleProcessSignals();
