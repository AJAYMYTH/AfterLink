const { Server } = require('@afterlink/server');

const server = new Server({
  port: 4001,
  compression: {
    enabled: true,
    algorithm: 'zlib',
    level: 6,
    threshold: 1024,
  },
});

server.on('echo', async (req, res) => {
  res.send({
    echoed: req.body.message,
    messageSize: req.body.message.length,
    sessionId: req.session.id,
    compression: req.session.compression,
  });
});

server.on('large-data', async (req, res) => {
  const largeResponse = 'X'.repeat(50000);
  res.send({
    receivedSize: req.body.payload.length,
    responseSize: largeResponse.length,
    compression: req.session.compression,
  });
});

server.listen().then(() => {
  console.log('[Compression Example] Server ready on port 4001');
});
