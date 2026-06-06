const { Server } = require('@ajaymyth/server');

const server = new Server({
  port: 4002,
  rateLimit: {
    enabled: true,
    requestsPerSecond: 10,
    burstSize: 20,
    closeAfterViolations: 5,
    errorMessage: 'Too many requests! Slow down.',
    onLimited: (conn) => {
      console.warn(`[Rate Limit] Client ${conn.getRemoteAddress()} rate limited`);
    },
  },
  shutdown: {
    drainTimeout: 3000,
    reason: 'maintenance',
    notifyClients: true,
  },
});

server.on('echo', async (req, res) => {
  res.send({ echoed: req.body.message });
});

server.on('slow', async (req, res) => {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  res.send({ done: true });
});

server.on('close', async () => {
  console.log('[Example] Initiating graceful shutdown...');
  await server.close();
});

server.on('closing', ({ activeConnections, activeRequests }) => {
  console.log(`[Shutdown] Server closing - ${activeConnections} connections, ${activeRequests} active requests`);
});

server.on('drained', ({ timedOut }) => {
  console.log(`[Shutdown] Drained - timed out: ${timedOut}`);
});

server.on('closed', () => {
  console.log('[Shutdown] Server fully closed');
});

server.handleProcessSignals();

server.listen().then(() => {
  console.log('[Rate Limit + Shutdown Example] Server ready on port 4002');
  console.log('  Rate limit: 10 req/s, burst 20');
  console.log('  Try: node client.js');
  console.log('  Try: node client.js --close (to trigger graceful shutdown)');
});
