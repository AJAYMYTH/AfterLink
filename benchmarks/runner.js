import { Server as AfterLinkServer } from '@afterlink/server';
import { Client as AfterLinkClient } from '@afterlink/client';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioclient } from 'socket.io-client';

const WARMUP = 100;
const ITERATIONS = 10000;
const PAYLOAD_SIZES = [64, 256, 1024, 4096, 16384];

function stats(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return { avg, p50, p95, p99, min, max };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ===================== AFTERLINK =====================

async function benchAfterLink(port) {
  const server = new AfterLinkServer({ port });
  server.on('ping', async (req, res) => {
    res.send({ pong: true });
  });
  await server.listen(port);

  const client = new AfterLinkClient(`afterlink://127.0.0.1:${port}`);
  await client.connect();

  for (let i = 0; i < WARMUP; i++) {
    await client.request('ping', { seq: i });
  }

  const latencies = [];
  const start = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    await client.request('ping', { seq: i });
    latencies.push(performance.now() - t0);
  }

  const elapsed = performance.now() - start;
  await client.disconnect();
  await server.close();

  return { name: 'AfterLink', latencies: stats(latencies), throughput: ITERATIONS / (elapsed / 1000) };
}

// ===================== WEBSOCKET =====================

async function benchWebSocket(port) {
  const wss = new WebSocketServer({ port });

  await new Promise((resolve) => {
    wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        ws.send(data);
      });
    });
    wss.on('listening', resolve);
  });

  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((resolve) => ws.on('open', resolve));

  function rr(msg) {
    return new Promise((resolve) => {
      const handler = (data) => {
        ws.removeListener('message', handler);
        resolve(data.toString());
      };
      ws.on('message', handler);
      ws.send(JSON.stringify(msg));
    });
  }

  for (let i = 0; i < WARMUP; i++) {
    await rr({ type: 'ping', seq: i });
  }

  const latencies = [];
  const start = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    await rr({ type: 'ping', seq: i });
    latencies.push(performance.now() - t0);
  }

  const elapsed = performance.now() - start;
  ws.close();
  wss.close();

  return { name: 'WebSocket (ws)', latencies: stats(latencies), throughput: ITERATIONS / (elapsed / 1000) };
}

// ===================== SOCKET.IO =====================

async function benchSocketIO(port) {
  const httpServer = createServer();
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket'],
  });

  io.on('connection', (socket) => {
    socket.on('ping', (data) => {
      socket.emit('response', { pong: true });
    });
  });

  await new Promise((resolve) => httpServer.listen(port, resolve));

  const socket = ioclient(`http://127.0.0.1:${port}`, {
    transports: ['websocket'],
    forceNew: true,
  });

  await new Promise((resolve) => socket.on('connect', resolve));

  function rr(data) {
    return new Promise((resolve) => {
      socket.once('response', resolve);
      socket.emit('ping', data);
    });
  }

  for (let i = 0; i < WARMUP; i++) {
    await rr({ seq: i });
  }

  const latencies = [];
  const start = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    await rr({ seq: i });
    latencies.push(performance.now() - t0);
  }

  const elapsed = performance.now() - start;
  socket.disconnect();
  await new Promise((resolve) => httpServer.close(resolve));

  return { name: 'Socket.IO', latencies: stats(latencies), throughput: ITERATIONS / (elapsed / 1000) };
}

// ===================== PAYLOAD THROUGHPUT =====================

async function benchPayloadThroughput(port, type) {
  const results = [];

  if (type === 'afterlink') {
    const server = new AfterLinkServer({ port });
    server.on('echo', async (req, res) => {
      res.send(req.body);
    });
    await server.listen(port);

    for (const size of PAYLOAD_SIZES) {
      const client = new AfterLinkClient(`afterlink://127.0.0.1:${port}`);
      await client.connect();
      const payload = { data: 'x'.repeat(size) };

      for (let i = 0; i < 50; i++) await client.request('echo', payload);

      const count = 5000;
      const start = performance.now();
      for (let i = 0; i < count; i++) await client.request('echo', payload);
      const elapsed = performance.now() - start;

      results.push({ size, throughput: count / (elapsed / 1000) });
      await client.disconnect();
    }

    await server.close();
  } else if (type === 'websocket') {
    const wss = new WebSocketServer({ port });
    await new Promise((resolve) => {
      wss.on('connection', (ws) => ws.on('message', (data) => ws.send(data)));
      wss.on('listening', resolve);
    });

    for (const size of PAYLOAD_SIZES) {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      await new Promise((resolve) => ws.on('open', resolve));

      function rr(msg) {
        return new Promise((resolve) => {
          const h = (data) => { ws.removeListener('message', h); resolve(data.toString()); };
          ws.on('message', h);
          ws.send(JSON.stringify(msg));
        });
      }

      const payload = { data: 'x'.repeat(size) };
      for (let i = 0; i < 50; i++) await rr(payload);

      const count = 5000;
      const start = performance.now();
      for (let i = 0; i < count; i++) await rr(payload);
      const elapsed = performance.now() - start;

      results.push({ size, throughput: count / (elapsed / 1000) });
      ws.close();
    }

    wss.close();
  } else if (type === 'socketio') {
    const httpServer = createServer();
    const io = new SocketIOServer(httpServer, { cors: { origin: '*' }, transports: ['websocket'] });
    io.on('connection', (socket) => socket.on('echo', (data) => socket.emit('response', data)));
    await new Promise((resolve) => httpServer.listen(port, resolve));

    for (const size of PAYLOAD_SIZES) {
      const socket = ioclient(`http://127.0.0.1:${port}`, { transports: ['websocket'], forceNew: true });
      await new Promise((resolve) => socket.on('connect', resolve));

      function rr(data) {
        return new Promise((resolve) => { socket.once('response', resolve); socket.emit('echo', data); });
      }

      const payload = { data: 'x'.repeat(size) };
      for (let i = 0; i < 50; i++) await rr(payload);

      const count = 5000;
      const start = performance.now();
      for (let i = 0; i < count; i++) await rr(payload);
      const elapsed = performance.now() - start;

      results.push({ size, throughput: count / (elapsed / 1000) });
      socket.disconnect();
    }

    await new Promise((resolve) => httpServer.close(resolve));
  }

  return results;
}

// ===================== RUNNER =====================

async function run() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          AfterLink Protocol — Benchmark Suite           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`   Iterations: ${ITERATIONS} | Warmup: ${WARMUP}`);
  console.log(`   Node.js: ${process.version}`);
  console.log(`   Platform: ${process.platform} (${process.arch})`);

  // Latency comparison
  console.log('\n📊 LATENCY COMPARISON (Request/Response)');
  console.log('─'.repeat(80));

  const results = [];

  console.log('   Running AfterLink...');
  results.push(await benchAfterLink(4200));
  await delay(500);

  console.log('   Running WebSocket (ws)...');
  results.push(await benchWebSocket(4201));
  await delay(500);

  console.log('   Running Socket.IO...');
  results.push(await benchSocketIO(4202));
  await delay(500);

  // Print latency table
  console.log('\n   ┌─────────────────┬─────────┬─────────┬─────────┬─────────┬──────────┐');
  console.log('   │ Library         │ Avg ms  │ P50 ms  │ P95 ms  │ P99 ms  │ msg/sec  │');
  console.log('   ├─────────────────┼─────────┼─────────┼─────────┼─────────┼──────────┤');

  for (const r of results) {
    const name = r.name.padEnd(15);
    const avg = r.latencies.avg.toFixed(3).padStart(7);
    const p50 = r.latencies.p50.toFixed(3).padStart(7);
    const p95 = r.latencies.p95.toFixed(3).padStart(7);
    const p99 = r.latencies.p99.toFixed(3).padStart(7);
    const tp = r.throughput.toFixed(0).padStart(8);
    console.log(`   │ ${name} │ ${avg} │ ${p50} │ ${p95} │ ${p99} │ ${tp} │`);
  }

  console.log('   └─────────────────┴─────────┴─────────┴─────────┴─────────┴──────────┘');

  // Throughput by payload
  console.log('\n📦 THROUGHPUT BY PAYLOAD SIZE (msg/sec)');
  console.log('─'.repeat(80));

  const payloadResults = {};

  console.log('   Running AfterLink payload tests...');
  payloadResults.AfterLink = await benchPayloadThroughput(4203, 'afterlink');
  await delay(500);

  console.log('   Running WebSocket payload tests...');
  payloadResults['WebSocket (ws)'] = await benchPayloadThroughput(4204, 'websocket');
  await delay(500);

  console.log('   Running Socket.IO payload tests...');
  payloadResults['Socket.IO'] = await benchPayloadThroughput(4205, 'socketio');
  await delay(500);

  console.log('\n   ┌──────────┬──────────────┬──────────────┬──────────────┐');
  console.log('   │ Bytes    │ AfterLink    │ WebSocket    │ Socket.IO    │');
  console.log('   ├──────────┼──────────────┼──────────────┼──────────────┤');

  for (const size of PAYLOAD_SIZES) {
    const al = payloadResults.AfterLink.find((r) => r.size === size)?.throughput || 0;
    const ws = payloadResults['WebSocket (ws)'].find((r) => r.size === size)?.throughput || 0;
    const si = payloadResults['Socket.IO'].find((r) => r.size === size)?.throughput || 0;

    console.log(`   │ ${size.toString().padStart(6)}   │ ${al.toFixed(0).padStart(12)} │ ${ws.toFixed(0).padStart(12)} │ ${si.toFixed(0).padStart(12)} │`);
  }

  console.log('   └──────────┴──────────────┴──────────────┴──────────────┘');

  // Summary
  const alResult = results.find((r) => r.name === 'AfterLink');
  const wsResult = results.find((r) => r.name === 'WebSocket (ws)');
  const siResult = results.find((r) => r.name === 'Socket.IO');

  console.log('\n📈 SUMMARY');
  console.log('─'.repeat(80));
  console.log(`   AfterLink vs WebSocket: ${((alResult.throughput / wsResult.throughput - 1) * 100).toFixed(1)}% ${alResult.throughput > wsResult.throughput ? 'faster' : 'slower'}`);
  console.log(`   AfterLink vs Socket.IO: ${((alResult.throughput / siResult.throughput - 1) * 100).toFixed(1)}% ${alResult.throughput > siResult.throughput ? 'faster' : 'slower'}`);
  console.log(`   WebSocket vs Socket.IO: ${((wsResult.throughput / siResult.throughput - 1) * 100).toFixed(1)}% ${wsResult.throughput > siResult.throughput ? 'faster' : 'slower'}`);

  console.log('\n✅ Benchmarks complete');
}

run().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
