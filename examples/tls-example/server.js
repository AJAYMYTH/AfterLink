const { Server, generateDevCerts } = require('@afterlink/server');

async function main() {
  console.log('🔐 Generating development certificates...');
  const { key, cert } = await generateDevCerts({
    commonName: 'afterlink-tls-dev',
    days: 365,
  });
  console.log('✅ Dev certificates generated');

  const server = new Server({
    port: 4443,
    tls: {
      enabled: true,
      key,
      cert,
      rejectUnauthorized: false, // Allow self-signed certs in dev
    },
  });

  server.on('ping', async (req, res) => {
    console.log(`[TLS] Received ping from ${req.connection?.remoteAddress || 'unknown'}`);
    res.send({ message: 'pong', encrypted: true, timestamp: Date.now() });
  });

  server.on('echo', async (req, res) => {
    res.send({ echo: req.body, encrypted: true });
  });

  await server.listen();
  console.log('🔒 TLS Server running on afterlinks://localhost:4443');
  console.log('Press Ctrl+C to stop');
}

main().catch(console.error);
