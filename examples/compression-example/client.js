const { Client } = require('@afterlink/client');

async function main() {
  const client = new Client('tcp://localhost:4001', {
    compression: {
      enabled: true,
      algorithm: 'zlib',
      level: 6,
      threshold: 1024,
    },
  });

  await client.connect();
  console.log('[Compression Example] Connected to server');

  // Test 1: Small payload (below threshold, should not compress)
  const smallRes = await client.request('echo', { message: 'Hello, World!' });
  console.log('\nTest 1: Small payload');
  console.log('  Response:', smallRes);

  // Test 2: Large payload (above threshold, should compress)
  const largePayload = 'A'.repeat(10000);
  const largeRes = await client.request('echo', { message: largePayload });
  console.log('\nTest 2: Large payload (10KB)');
  console.log('  Original size:', largeRes.originalSize);
  console.log('  Compression used:', largeRes.compression);

  // Test 3: Large response from server
  const largeDataRes = await client.request('large-data', { payload: 'test'.repeat(100) });
  console.log('\nTest 3: Large response from server');
  console.log('  Received size:', largeDataRes.receivedSize);
  console.log('  Response size:', largeDataRes.responseSize);
  console.log('  Compression used:', largeDataRes.compression);

  await client.disconnect();
  console.log('\n[Compression Example] Disconnected');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
