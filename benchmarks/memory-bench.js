import { Server as AfterLinkServer } from '@afterlink/server';
import { Client as AfterLinkClient } from '@afterlink/client';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioclient } from 'socket.io-client';

const CONNECTION_COUNTS = [10, 50];
const MSGS_PER_CONN = 10;

function getMemoryMB() {
  const mem = process.memoryUsage();
  return {
    rss: (mem.rss / 1024 / 1024).toFixed(2),
    heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(2),
    heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(2),
    external: (mem.external / 1024 / 1024).toFixed(2),
  };
}

async function benchAfterLinkConnections(count) {
  const server = new AfterLinkServer({ port: 4300 });
  server.on('ping', async (req, res) => {
    res.send({ pong: true });
  });
  await server.listen(4300);

  const clients = [];
  for (let i = 0; i < count; i++) {
    const client = new AfterLinkClient(`afterlink://127.0.0.1:4300`);
    await client.connect();
    clients.push(client);
  }

  for (const client of clients) {
    for (let i = 0; i < MSGS_PER_CONN; i++) {
      await client.request('ping', { seq: i });
    }
  }

  const mem = getMemoryMB();

  for (const client of clients) {
    await client.disconnect();
  }
  await server.close();

  return mem;
}

async function benchWebSocketConnections(count) {
  const wss = new WebSocketServer({ port: 4300 });
  await new Promise((resolve) => {
    wss.on('connection', (ws) => {
      ws.on('message', (data) => ws.send(data));
    });
    wss.on('listening', resolve);
  });

  const clients = [];
  for (let i = 0; i < count; i++) {
    const ws = new WebSocket(`ws://127.0.0.1:4300`);
    await new Promise((resolve) => ws.on('open', resolve));
    clients.push(ws);
  }

  function rr(ws, msg) {
    return new Promise((resolve) => {
      const h = (data) => { ws.removeListener('message', h); resolve(data.toString()); };
      ws.on('message', h);
      ws.send(JSON.stringify(msg));
    });
  }

  for (const ws of clients) {
    for (let i = 0; i < MSGS_PER_CONN; i++) {
      await rr(ws, { seq: i });
    }
  }

  const mem = getMemoryMB();

  for (const ws of clients) {
    ws.close();
  }
  wss.close();

  return mem;
}

async function benchSocketIOConnections(count) {
  const httpServer = createServer();
  const io = new SocketIOServer(httpServer, { cors: { origin: '*' }, transports: ['websocket'] });
  io.on('connection', (socket) => socket.on('ping', (data) => socket.emit('response', { pong: true })));
  await new Promise((resolve) => httpServer.listen(4300, resolve));

  const clients = [];
  for (let i = 0; i < count; i++) {
    const socket = ioclient(`http://127.0.0.1:4300`, { transports: ['websocket'], forceNew: true });
    await new Promise((resolve) => socket.on('connect', resolve));
    clients.push(socket);
  }

  function rr(socket, data) {
    return new Promise((resolve) => { socket.once('response', resolve); socket.emit('ping', data); });
  }

  for (const socket of clients) {
    for (let i = 0; i < MSGS_PER_CONN; i++) {
      await rr(socket, { seq: i });
    }
  }

  const mem = getMemoryMB();

  for (const socket of clients) {
    socket.disconnect();
  }
  await new Promise((resolve) => httpServer.close(resolve));

  return mem;
}

async function run() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          Memory Usage Benchmark — Connections           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`   Messages per connection: ${MSGS_PER_CONN} | Node.js: ${process.version}`);

  console.log('\n📊 MEMORY USAGE BY CONNECTION COUNT (MB)');
  console.log('─'.repeat(90));

  for (const count of CONNECTION_COUNTS) {
    console.log(`\n   ${count} Connections:`);
    console.log('   ┌─────────────────┬──────────┬────────────┬────────────┬────────────┐');
    console.log('   │ Library         │ RSS (MB) │ HeapUsed   │ HeapTotal  │ External   │');
    console.log('   ├─────────────────┼──────────┼────────────┼────────────┼────────────┤');

    console.log('   Running AfterLink...');
    const al = await benchAfterLinkConnections(count);
    console.log(`   │ AfterLink       │ ${al.rss.padStart(8)} │ ${al.heapUsed.padStart(10)} │ ${al.heapTotal.padStart(10)} │ ${al.external.padStart(10)} │`);

    console.log('   Running WebSocket...');
    const ws = await benchWebSocketConnections(count);
    console.log(`   │ WebSocket (ws)  │ ${ws.rss.padStart(8)} │ ${ws.heapUsed.padStart(10)} │ ${ws.heapTotal.padStart(10)} │ ${ws.external.padStart(10)} │`);

    console.log('   Running Socket.IO...');
    const si = await benchSocketIOConnections(count);
    console.log(`   │ Socket.IO       │ ${si.rss.padStart(8)} │ ${si.heapUsed.padStart(10)} │ ${si.heapTotal.padStart(10)} │ ${si.external.padStart(10)} │`);

    console.log('   └─────────────────┴──────────┴────────────┴────────────┴────────────┘');
  }

  console.log('\n✅ Memory benchmarks complete');
}

run().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
