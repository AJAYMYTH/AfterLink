/**
 * AfterLink Demo: Real-time Chat Application
 * 
 * This demonstrates:
 * - Pub/Sub for broadcasting messages to all connected clients
 * - Request/Response for getting chat history
 * - Real-time message delivery
 * 
 * Run: node server.js
 */

const { Server } = require('@ajaymyth/server');

const messages = [];
const server = new Server({ port: 4000 });

// Route: Send a message to the chat
server.on('sendMessage', async (req, res) => {
  const msg = {
    id: messages.length + 1,
    text: req.body.text,
    from: req.body.from || 'anonymous',
    timestamp: new Date().toISOString(),
  };
  messages.push(msg);

  // Broadcast to all subscribers of the 'chat' topic
  server.publish('chat', msg);

  res.send({ ok: true, msg });
});

// Route: Get chat history
server.on('getHistory', async (req, res) => {
  const limit = req.body.limit || 50;
  res.send({ messages: messages.slice(-limit) });
});

// Route: Get online user count
server.on('getStats', async (req, res) => {
  res.send({
    totalMessages: messages.length,
    connections: server.getConnectionCount(),
  });
});

server.listen().then(() => {
  console.log('Chat server running on port 4000');
  console.log('Concepts demonstrated:');
  console.log('  - Pub/Sub (server.publish for broadcast)');
  console.log('  - Request/Response (getHistory, getStats)');
  console.log('  - Shared state (messages array)');
});
