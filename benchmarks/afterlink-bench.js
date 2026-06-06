import { Server } from '@ajaymyth/server';
import { Client } from '@ajaymyth/client';

const PORT = 4100;
const WARMUP = 100;
const ITERATIONS = 10000;
const PAYLOAD_SIZES = [64, 256, 1024, 4096, 16384];

function generatePayload(size) {
  return Buffer.alloc(size, 'x');
}

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

async function latencyBench() {
  console.log('\n🔵 AfterLink — Latency Benchmark');
  console.log(`   Warmup: ${WARMUP} | Iterations: ${ITERATIONS}`);

  const server = new Server({ port: PORT });
  server.on('ping', async (data) => ({ pong: true, ts: Date.now() }));
  await server.listen(PORT);

  const client = new Client(`tcp://127.0.0.1:${PORT}`);
  await client.connect();

  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    await client.request('ping', { seq: i });
  }

  const latencies = [];
  const start = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    await client.request('ping', { seq: i });
    const t1 = performance.now();
    latencies.push(t1 - t0);
  }

  const elapsed = performance.now() - start;
  const s = stats(latencies);

  console.log(`   Avg: ${s.avg.toFixed(3)}ms | P50: ${s.p50.toFixed(3)}ms | P95: ${s.p95.toFixed(3)}ms | P99: ${s.p99.toFixed(3)}ms`);
  console.log(`   Min: ${s.min.toFixed(3)}ms | Max: ${s.max.toFixed(3)}ms`);
  console.log(`   Throughput: ${(ITERATIONS / (elapsed / 1000)).toFixed(0)} msg/sec`);

  await client.disconnect();
  await server.close();

  return { name: 'AfterLink', latencies: s, throughput: ITERATIONS / (elapsed / 1000) };
}

async function throughputByPayload() {
  console.log('\n🔵 AfterLink — Throughput by Payload Size');

  const server = new Server({ port: PORT });
  server.on('echo', async (data) => ({ echo: true, size: Buffer.byteLength(JSON.stringify(data)) }));
  await server.listen(PORT);

  const results = [];

  for (const size of PAYLOAD_SIZES) {
    const client = new Client(`tcp://127.0.0.1:${PORT}`);
    await client.connect();

    const payload = { data: 'x'.repeat(size) };

    // Warmup
    for (let i = 0; i < 50; i++) {
      await client.request('echo', payload);
    }

    const count = 5000;
    const start = performance.now();

    for (let i = 0; i < count; i++) {
      await client.request('echo', payload);
    }

    const elapsed = performance.now() - start;
    const throughput = count / (elapsed / 1000);

    console.log(`   ${size.toString().padStart(6)} bytes: ${throughput.toFixed(0)} msg/sec`);
    results.push({ size, throughput });

    await client.disconnect();
  }

  await server.close();
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

run().then((results) => {
  console.log('\n✅ AfterLink benchmarks complete');
  process.exit(0);
});
