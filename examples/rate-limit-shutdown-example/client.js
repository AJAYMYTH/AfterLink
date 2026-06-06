const { Client } = require('@ajaymyth/client');

async function testRateLimit() {
  const client = new Client('tcp://localhost:4002');

  await client.connect();
  console.log('[Client] Connected');

  client.on('server-closing', (data) => {
    console.log(`[Client] Server closing: ${data.reason} in ${data.drainTimeout}ms`);
  });

  // Test 1: Normal requests
  console.log('\nTest 1: Normal requests');
  for (let i = 0; i < 5; i++) {
    const res = await client.request('echo', { message: `Hello ${i}` });
    console.log(`  Request ${i + 1}: ${res.echoed}`);
  }

  // Test 2: Burst requests (should hit rate limit)
  console.log('\nTest 2: Burst requests (hitting rate limit)');
  const promises = [];
  for (let i = 0; i < 25; i++) {
    promises.push(
      client.request('echo', { message: `Burst ${i}` }).catch((err) => {
        if (err.code === 'RATE_LIMITED') {
          return { rateLimited: true, retryAfter: err.retryAfter };
        }
        return { error: err.message };
      })
    );
  }

  const results = await Promise.all(promises);
  let limited = 0;
  let success = 0;
  for (const r of results) {
    if (r.rateLimited) limited++;
    else success++;
  }
  console.log(`  Success: ${success}, Rate Limited: ${limited}`);

  await client.disconnect();
  console.log('\n[Client] Disconnected');
}

async function testGracefulShutdown() {
  const client = new Client('tcp://localhost:4002');

  await client.connect();
  console.log('\n[Shutdown Test] Connected');

  client.on('server-closing', (data) => {
    console.log(`[Shutdown Test] Server closing: ${data.reason}`);
  });

  // Start a slow request
  const slowPromise = client.request('slow', {}).then((res) => {
    console.log(`[Shutdown Test] Slow request completed: ${res.done}`);
  });

  // Wait a bit then trigger shutdown
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.log('[Shutdown Test] Triggering server close...');

  // In real scenario, server.close() would be called server-side
  // Here we just disconnect to demonstrate client behavior
  await slowPromise;
  await client.disconnect();
  console.log('[Shutdown Test] Client disconnected');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--close')) {
    await testGracefulShutdown();
  } else {
    await testRateLimit();
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
