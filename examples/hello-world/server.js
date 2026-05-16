const { Server } = require('@afterlink/server');

const server = new Server({ port: 4000 });

server.on('ping', async (req, res) => {
  res.send({ message: 'pong', timestamp: Date.now() });
});

server.on('hello', async (req, res) => {
  res.send({ greeting: `Hello, ${req.body.name || 'World'}!` });
});

server.listen().then(() => {
  console.log('AfterLink Hello World server running on port 4000');
});
