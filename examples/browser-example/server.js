const { Server } = require('@ajaymyth/server');

const server = new Server({
  port: 4000,
  health: {
    enabled: true,
  },
  browser: {
    enabled: true,
    port: 4001,
    path: '/ws',
    cors: {
      origins: ['*'],
    },
  },
});

server.on('ping', async (req, res) => {
  res.send({ pong: true, timestamp: Date.now() });
});

server.on('echo', async (req, res) => {
  res.send({ echoed: req.body });
});

server.on('chat.message', async (req, res) => {
  server.publish('chat.broadcast', {
    user: req.body.user || 'anonymous',
    text: req.body.text,
    timestamp: Date.now(),
  });
  res.send({ sent: true });
});

server.on('stats', async (req, res) => {
  res.send(server.getStats());
});

server.listen().then(() => {
  console.log('AfterLink server ready!');
  console.log('  TCP:      afterlink://localhost:4000');
  console.log('  WebSocket: ws://localhost:4001/ws');
  console.log('  Health:   http://localhost:4000/__health');
  console.log('  Open examples/browser-example/index.html in your browser');
});

server.handleProcessSignals();
