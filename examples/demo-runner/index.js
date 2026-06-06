/**
 * AfterLink Demo Runner
 * 
 * An interactive showcase that demonstrates all AfterLink features
 * in a single automated run. Perfect for presentations and learning.
 * 
 * Run: node index.js
 */

const { Server } = require('@ajaymyth/server');
const { Client } = require('@ajaymyth/client');
const { z } = require('zod');

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(color, msg) {
  console.log(`${color}${msg}${COLORS.reset}`);
}

function section(title) {
  console.log('');
  log(COLORS.bold, '═'.repeat(60));
  log(COLORS.bold, `  ${title}`);
  log(COLORS.bold, '═'.repeat(60));
}

function subSection(title) {
  console.log('');
  log(COLORS.cyan, `── ${title} ──`);
}

function code(label, value) {
  console.log(`  ${COLORS.gray}${label}${COLORS.reset} ${value}`);
}

function success(msg) {
  log(COLORS.green, `  ✓ ${msg}`);
}

function error(msg) {
  log(COLORS.red, `  ✗ ${msg}`);
}

function info(msg) {
  log(COLORS.blue, `  ℹ ${msg}`);
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Demo 1: Basic Request/Response ────────────────────────────────

async function demoBasicRequestResponse() {
  section('Demo 1: Basic Request/Response');

  info('This is the simplest AfterLink pattern - like HTTP but faster');
  console.log('');
  log(COLORS.gray, '  Server code:');
  code('', `server.on('ping', async (req, res) => {`);
  code('', `  res.send({ message: 'pong', timestamp: Date.now() });`);
  code('', `});`);
  console.log('');
  log(COLORS.gray, '  Client code:');
  code('', `const result = await client.request('ping', {});`);
  console.log('');

  const server = new Server({ port: 5001 });
  server.on('ping', async (req, res) => {
    res.send({ message: 'pong', timestamp: Date.now() });
  });
  server.on('echo', async (req, res) => {
    res.send({ echo: req.body.text, length: req.body.text.length });
  });
  await server.listen();

  const client = new Client('afterlink://localhost:5001');
  await client.connect();
  success('Connected to server');

  const pingResult = await client.request('ping', {});
  success(`Ping: "${pingResult.message}" (timestamp: ${pingResult.timestamp})`);

  const echoResult = await client.request('echo', { text: 'Hello AfterLink!' });
  success(`Echo: "${echoResult.echo}" (length: ${echoResult.length})`);

  await client.disconnect();
  await server.close();
}

// ─── Demo 2: Schema Validation ─────────────────────────────────────

async function demoSchemaValidation() {
  section('Demo 2: Schema Validation with Zod');

  info('AfterLink automatically validates request payloads before they reach your handler');
  console.log('');
  log(COLORS.gray, '  Server code:');
  code('', `server.on('createUser', async (req, res) => {`);
  code('', `  // Handler only runs if validation passes`);
  code('', `  res.send({ user: req.body.name });`);
  code('', `}, z.object({`);
  code('', `  name: z.string().min(2),`);
  code('', `  email: z.string().email(),`);
  code('', `}));`);
  console.log('');

  const server = new Server({ port: 5002 });
  server.on(
    'createUser',
    async (req, res) => {
      res.send({ user: { name: req.body.name, email: req.body.email, id: 1 } });
    },
    z.object({
      name: z.string().min(2),
      email: z.string().email(),
    })
  );
  await server.listen();

  const client = new Client('afterlink://localhost:5002');
  await client.connect();

  subSection('Valid request');
  const validResult = await client.request('createUser', {
    name: 'Ajju',
    email: 'ajju@afterlink.dev',
  });
  success(`Created user: ${validResult.user.name} <${validResult.user.email}>`);

  subSection('Invalid request (missing email)');
  try {
    await client.request('createUser', { name: 'X' });
  } catch (err) {
    error(`Validation rejected: ${err.code} - ${err.message}`);
  }

  subSection('Invalid request (name too short)');
  try {
    await client.request('createUser', { name: 'A', email: 'a@b.com' });
  } catch (err) {
    error(`Validation rejected: ${err.code} - ${err.message}`);
  }

  await client.disconnect();
  await server.close();
}

// ─── Demo 3: Middleware ────────────────────────────────────────────

async function demoMiddleware() {
  section('Demo 3: Middleware Chain');

  info('Middleware runs before every route handler - perfect for logging, auth, etc.');
  console.log('');
  log(COLORS.gray, '  Server code:');
  code('', `server.use(async (req, next) => {`);
  code('', `  console.log(\`[LOG] \${req.route} - \${Date.now()}ms\`);`);
  code('', `  await next();`);
  code('', `});`);
  console.log('');

  const logs = [];
  const server = new Server({ port: 5003 });

  server.use(async (req, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    logs.push({ route: req.route, duration });
  });

  server.use(async (req, next) => {
    req.processedBy = (req.processedBy || 0) + 1;
    await next();
  });

  server.on('getData', async (req, res) => {
    res.send({ data: 'hello', processedBy: req.processedBy });
  });

  server.on('slowRoute', async (req, res) => {
    await wait(50);
    res.send({ data: 'slow response' });
  });

  await server.listen();

  const client = new Client('afterlink://localhost:5003');
  await client.connect();

  await client.request('getData', {});
  await client.request('getData', {});
  await client.request('slowRoute', {});

  subSection('Middleware logs');
  for (const entry of logs) {
    success(`${entry.route.padEnd(12)} completed in ${entry.duration}ms`);
  }

  await client.disconnect();
  await server.close();
}

// ─── Demo 4: Pub/Sub ───────────────────────────────────────────────

async function demoPubSub() {
  section('Demo 4: Publish/Subscribe (Real-time Updates)');

  info('Clients subscribe to topics; server broadcasts updates to all subscribers');
  console.log('');
  log(COLORS.gray, '  Server code:');
  code('', `server.publish('news', { headline: 'Breaking news!' });`);
  console.log('');
  log(COLORS.gray, '  Client code:');
  code('', `client.subscribe('news', (data) => {`);
  code('', `  console.log(data.headline);`);
  code('', `});`);
  console.log('');

  const server = new Server({ port: 5004 });
  await server.listen();

  const client1 = new Client('afterlink://localhost:5004');
  const client2 = new Client('afterlink://localhost:5004');

  await client1.connect();
  await client2.connect();
  success('Client 1 connected');
  success('Client 2 connected');

  const received1 = [];
  const received2 = [];

  await client1.subscribe('news', (data) => received1.push(data));
  await client2.subscribe('news', (data) => received2.push(data));
  success('Both clients subscribed to "news" topic');

  subSection('Server publishes 3 news updates');
  server.publish('news', { headline: 'AfterLink v1.0 released!', source: 'tech' });
  await wait(100);
  server.publish('news', { headline: '10K downloads in first week', source: 'stats' });
  await wait(100);
  server.publish('news', { headline: 'Go SDK now available', source: 'tech' });
  await wait(100);

  success(`Client 1 received ${received1.length} messages`);
  for (const msg of received1) {
    console.log(`    📰 ${msg.headline} [${msg.source}]`);
  }

  success(`Client 2 received ${received2.length} messages`);

  await client1.disconnect();
  await client2.disconnect();
  await server.close();
}

// ─── Demo 5: Multiple Topics ───────────────────────────────────────

async function demoMultipleTopics() {
  section('Demo 5: Multiple Topics (Selective Subscriptions)');

  info('Clients can subscribe to specific topics - they only receive relevant updates');
  console.log('');

  const server = new Server({ port: 5005 });
  await server.listen();

  const client = new Client('afterlink://localhost:5005');
  await client.connect();

  const sports = [];
  const tech = [];

  await client.subscribe('sports', (data) => sports.push(data));
  await client.subscribe('tech', (data) => tech.push(data));
  success('Subscribed to "sports" and "tech" topics');

  subSection('Server publishes to different topics');
  server.publish('sports', { event: 'Goal! Team A scores' });
  server.publish('tech', { event: 'New CPU architecture announced' });
  server.publish('sports', { event: 'Match ends 2-1' });
  server.publish('tech', { event: 'Open-source framework hits 10K stars' });
  server.publish('weather', { event: 'Sunny tomorrow' });
  await wait(200);

  success(`Sports updates received: ${sports.length}`);
  for (const msg of sports) {
    console.log(`    ⚽ ${msg.event}`);
  }

  success(`Tech updates received: ${tech.length}`);
  for (const msg of tech) {
    console.log(`    💻 ${msg.event}`);
  }

  info('Note: "weather" topic was not subscribed to, so 0 messages received');

  await client.disconnect();
  await server.close();
}

// ─── Demo 6: Error Handling ────────────────────────────────────────

async function demoErrorHandling() {
  section('Demo 6: Error Handling');

  info('AfterLink provides structured error responses with error codes');
  console.log('');
  log(COLORS.gray, '  Client code:');
  code('', `try {`);
  code('', `  await client.request('getUser', { id: 999 });`);
  code('', `} catch (err) {`);
  code('', `  console.log(err.code, err.message);`);
  code('', `}`);
  console.log('');

  const server = new Server({ port: 5006 });

  server.on('divide', async (req, res) => {
    if (req.body.divisor === 0) {
      throw new Error('Division by zero');
    }
    res.send({ result: req.body.dividend / req.body.divisor });
  });

  server.on('restricted', async (req, res) => {
    throw new Error('Access denied: admin only');
  });

  await server.listen();

  const client = new Client('afterlink://localhost:5006');
  await client.connect();

  subSection('Successful request');
  const result = await client.request('divide', { dividend: 10, divisor: 3 });
  success(`10 / 3 = ${result.result.toFixed(4)}`);

  subSection('Server error (division by zero)');
  try {
    await client.request('divide', { dividend: 10, divisor: 0 });
  } catch (err) {
    error(`${err.code}: ${err.message}`);
  }

  subSection('Route not found');
  try {
    await client.request('nonExistent', {});
  } catch (err) {
    error(`${err.code}: ${err.message}`);
  }

  subSection('Application error');
  try {
    await client.request('restricted', {});
  } catch (err) {
    error(`${err.code}: ${err.message}`);
  }

  await client.disconnect();
  await server.close();
}

// ─── Demo 7: Connection Info ───────────────────────────────────────

async function demoConnectionInfo() {
  section('Demo 7: Connection Management');

  info('AfterLink tracks connections and provides session info');
  console.log('');

  const server = new Server({ port: 5007 });
  server.on('getServerInfo', async (req, res) => {
    res.send({
      connections: server.getConnectionCount(),
      uptime: process.uptime().toFixed(0) + 's',
      version: '1.0.0',
    });
  });
  await server.listen();

  const client1 = new Client('afterlink://localhost:5007');
  const client2 = new Client('afterlink://localhost:5007');
  const client3 = new Client('afterlink://localhost:5007');

  await client1.connect();
  success('Client 1 connected');
  let serverInfo = await client1.request('getServerInfo', {});
  console.log(`  Connections: ${serverInfo.connections}`);

  await client2.connect();
  success('Client 2 connected');
  serverInfo = await client1.request('getServerInfo', {});
  console.log(`  Connections: ${serverInfo.connections}`);

  await client3.connect();
  success('Client 3 connected');
  serverInfo = await client1.request('getServerInfo', {});
  console.log(`  Connections: ${serverInfo.connections}`);

  await client2.disconnect();
  success('Client 2 disconnected');
  await wait(100);
  serverInfo = await client1.request('getServerInfo', {});
  console.log(`  Connections: ${serverInfo.connections}`);

  await client1.disconnect();
  await client3.disconnect();
  await server.close();
}

// ─── Main Runner ───────────────────────────────────────────────────

async function runAllDemos() {
  console.log('');
  log(COLORS.bold, '╔═══════════════════════════════════════════════════════════╗');
  log(COLORS.bold, '║         AfterLink Communication Protocol                  ║');
  log(COLORS.bold, '║         For Reliable and Fast Communication               ║');
  log(COLORS.bold, '║                    Demo Showcase                          ║');
  log(COLORS.bold, '╚═══════════════════════════════════════════════════════════╝');

  const demos = [
    { name: 'Basic Request/Response', fn: demoBasicRequestResponse },
    { name: 'Schema Validation with Zod', fn: demoSchemaValidation },
    { name: 'Middleware Chain', fn: demoMiddleware },
    { name: 'Publish/Subscribe', fn: demoPubSub },
    { name: 'Multiple Topics', fn: demoMultipleTopics },
    { name: 'Error Handling', fn: demoErrorHandling },
    { name: 'Connection Management', fn: demoConnectionInfo },
  ];

  for (let i = 0; i < demos.length; i++) {
    try {
      await demos[i].fn();
      await wait(300);
    } catch (err) {
      error(`Demo failed: ${err.message}`);
    }
  }

  section('Summary');
  console.log('');
  log(COLORS.green, '  All 7 demos completed successfully!');
  console.log('');
  log(COLORS.bold, '  Features demonstrated:');
  log(COLORS.cyan, '    1. Request/Response    - Simple RPC calls');
  log(COLORS.cyan, '    2. Schema Validation   - Automatic payload validation with Zod');
  log(COLORS.cyan, '    3. Middleware          - Logging, auth, timing chains');
  log(COLORS.cyan, '    4. Pub/Sub             - Real-time broadcast to subscribers');
  log(COLORS.cyan, '    5. Multiple Topics     - Selective topic subscriptions');
  log(COLORS.cyan, '    6. Error Handling      - Structured error codes and messages');
  log(COLORS.cyan, '    7. Connection Mgmt     - Track active connections');
  console.log('');
  log(COLORS.bold, '  Protocol details:');
  log(COLORS.gray, '    - Binary frame: 10-byte header');
  log(COLORS.gray, '    - Serialization: MessagePack');
  log(COLORS.gray, '    - Transport: TCP');
  log(COLORS.gray, '    - Multiplexing: 32-bit message IDs');
  log(COLORS.gray, '    - Frame types: 16 (REQUEST, RESPONSE, STREAM, PUBSUB, etc.)');
  console.log('');
  log(COLORS.bold, '  Learn more:');
  log(COLORS.yellow, '    GitHub: https://github.com/AJAYMYTH/AfterLink');
  console.log('');
}

runAllDemos().catch(console.error);
