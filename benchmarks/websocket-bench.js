import { WebSocketServer, WebSocket } from 'ws';

const PORT = 4101;
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

function requestResponse(ws, message) {
  return new Promise((resolve) => {
    const handler = (data) => {
      ws.removeListener('message', handler);
      resolve(JSON.parse(data.toString()));
    };
    ws.on('message', handler);
    ws.send(JSON.stringify(message));
  });
}

async function latencyBench() {
  console.log('\n🟡 WebSocket (ws) — Latency Benchmark');
  console.log(`   Warmup: ${WARMUP} | Iterations: ${ITERATIONS}`);

  const wss = new WebSocketServer({ port: PORT });

  await new Promise((resolve) => {
    wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        }
      });
    });
    wss.on('listening', resolve);
  });

  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
  await new Promise((resolve) => ws.on('open', resolve));

  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    await requestResponse(ws, { type: 'ping', seq: i });
  }

  const latencies = [];
  const start = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    await requestResponse(ws, { type: 'ping', seq: i });
    const t1 = performance.now();
    latencies.push(t1 - t0);
  }

  const elapsed = performance.now() - start;
  const s = stats(latencies);

  console.log(`   Avg: ${s.avg.toFixed(3)}ms | P50: ${s.p50.toFixed(3)}ms | P95: ${s.p95.toFixed(3)}ms | P99: ${s.p99.toFixed(3)}ms`);
  console.log(`   Min: ${s.min.toFixed(3)}ms | Max: ${s.max.toFixed(3)}ms`);
  console.log(`   Throughput: ${(ITERATIONS / (elapsed / 1000)).toFixed(0)} msg/sec`);

  ws.close();
  wss.close();

  return { name: 'WebSocket (ws)', latencies: s, throughput: ITERATIONS / (elapsed / 1000) };
}

async function throughputByPayload() {
  console.log('\n🟡 WebSocket (ws) — Throughput by Payload Size');

  const wss = new WebSocketServer({ port: PORT });

  await new Promise((resolve) => {
    wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        ws.send(data);
      });
    });
    wss.on('listening', resolve);
  });

  const results = [];

  for (const size of PAYLOAD_SIZES) {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    await new Promise((resolve) => ws.on('open', resolve));

    const payload = JSON.stringify({ data: 'x'.repeat(size) });

    // Warmup
    for (let i = 0; i < 50; i++) {
      await requestResponse(ws, payload);
    }

    const count = 5000;
    const start = performance.now();

    for (let i = 0; i < count; i++) {
      await requestResponse(ws, payload);
    }

    const elapsed = performance.now() - start;
    const throughput = count / (elapsed / 1000);

    console.log(`   ${size.toString().padStart(6)} bytes: ${throughput.toFixed(0)} msg/sec`);
    results.push({ size, throughput });

    ws.close();
  }

  wss.close();
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
  console.log('\n✅ WebSocket benchmarks complete');
  process.exit(0);
});
