const { Client } = require('@ajaymyth/client');

async function main() {
  console.log('🔒 Connecting to TLS server...');

  const client = new Client('afterlinks://localhost:4443', {
    tls: {
      rejectUnauthorized: false, // Accept self-signed dev certs
    },
  });

  await client.connect();
  console.log('✅ Connected (TLS encrypted)');
  console.log(`   Session: ${client.getSessionId()}`);

  // Test ping
  const pingResult = await client.request('ping', {});
  console.log(`\n📡 Ping response:`, pingResult);

  // Test echo
  const echoResult = await client.request('echo', { data: 'Hello over TLS!' });
  console.log(`📡 Echo response:`, echoResult);

  await client.disconnect();
  console.log('\n✅ Disconnected');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
