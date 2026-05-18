import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as ioclient } from 'socket.io-client';

const PORT = 4102;
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

function requestResponse(socket, event, data) {
  return new Promise((resolve) => {
    socket.once('response', (res) => resolve(res));
    socket.emit(event, data);
  });
}

async function latencyBench() {
  console.log('\n🟠 Socket.IO — Latency Benchmark');
  console.log(`   Warmup: ${WARMUP} | Iterations: ${ITERATIONS}`);

  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket'],
  });

  io.on('connection', (socket) => {
    socket.on('ping', (data) => {
      socket.emit('response', { pong: true, ts: Date.now() });
    });
  });

  await new Promise((resolve) => httpServer.listen(PORT, resolve));

  const socket = ioclient(`http://127.0.0.1:${PORT}`, {
    transports: ['websocket'],
    forceNew: true,
  });

  await new Promise((resolve) => socket.on('connect', resolve));

  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    await requestResponse(socket, 'ping', { seq: i });
  }

  const latencies = [];
  const start = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    await requestResponse(socket, 'ping', { seq: i });
    const t1 = performance.now();
    latencies.push(t1 - t0);
  }

  const elapsed = performance.now() - start;
  const s = stats(latencies);

  console.log(`   Avg: ${s.avg.toFixed(3)}ms | P50: ${s.p50.toFixed(3)}ms | P95: ${s.p95.toFixed(3)}ms | P99: ${s.p99.toFixed(3)}ms`);
  console.log(`   Min: ${s.min.toFixed(3)}ms | Max: ${s.max.toFixed(3)}ms`);
  console.log(`   Throughput: ${(ITERATIONS / (elapsed / 1000)).toFixed(0)} msg/sec`);

  socket.disconnect();
  await new Promise((resolve) => httpServer.close(resolve));

  return { name: 'Socket.IO', latencies: s, throughput: ITERATIONS / (elapsed / 1000) };
}

async function throughputByPayload() {
  console.log('\n🟠 Socket.IO — Throughput by Payload Size');

  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket'],
  });

  io.on('connection', (socket) => {
    socket.on('echo', (data) => {
      socket.emit('response', data);
    });
  });

  await new Promise((resolve) => httpServer.listen(PORT, resolve));

  const results = [];

  for (const size of PAYLOAD_SIZES) {
    const socket = ioclient(`http://127.0.0.1:${PORT}`, {
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise((resolve) => socket.on('connect', resolve));

    const payload = { data: 'x'.repeat(size) };

    // Warmup
    for (let i = 0; i < 50; i++) {
      await requestResponse(socket, 'echo', payload);
    }

    const count = 5000;
    const start = performance.now();

    for (let i = 0; i < count; i++) {
      await requestResponse(socket, 'echo', payload);
    }

    const elapsed = performance.now() - start;
    const throughput = count / (elapsed / 1000);

    console.log(`   ${size.toString().padStart(6)} bytes: ${throughput.toFixed(0)} msg/sec`);
    results.push({ size, throughput });

    socket.disconnect();
  }

  await new Promise((resolve) => httpServer.close(resolve));
  return results;
}

async function run() {
  try {
    const latency = await latencyBench();
    const throughput = await throughputByPayload();
    return { latency, throughput };
  } catch (err) {
    console.error('Benchmark failed:', err.message);
    process.exit(1);
  }
}

run().then(() => {
  console.log('\n✅ Socket.IO benchmarks complete');
  process.exit(0);
});
