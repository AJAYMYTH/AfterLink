# AfterLink Demos

Real-world examples showcasing the AfterLink Communication Protocol.

## Quick Start

```bash
# Install dependencies
pnpm install

# Run the interactive demo showcase (all 7 demos)
cd examples/demo-runner
node index.js
```

## Demo Projects

### 1. Demo Runner - Interactive Showcase

The best way to learn AfterLink. Runs 7 automated demos showing core features.

```bash
cd examples/demo-runner
node index.js
```

**Demos included:**
1. **Basic Request/Response** - Simple RPC calls
2. **Schema Validation** - Automatic payload validation with Zod
3. **Middleware Chain** - Logging, timing, auth middleware
4. **Publish/Subscribe** - Real-time broadcast to subscribers
5. **Multiple Topics** - Selective topic subscriptions
6. **Error Handling** - Structured error codes and messages
7. **Connection Management** - Track active connections

### 2. Chat Application

Real-time chat with pub/sub and request/response.

```bash
# Terminal 1 - Start server
cd examples/demo-chat
node server.js

# Terminal 2 - Client 1
node client.js --name Alice

# Terminal 3 - Client 2
node client.js --name Bob
```

**Concepts demonstrated:**
- `server.publish('chat', msg)` - broadcast to all subscribers
- `client.subscribe('chat', handler)` - receive real-time messages
- `client.request('getHistory', {})` - fetch chat history
- Interactive CLI with readline

### 3. Stock Dashboard

Real-time stock price monitoring with alerts.

```bash
# Terminal 1 - Start server (generates simulated prices)
cd examples/demo-dashboard
node server.js

# Terminal 2 - Client (displays live dashboard)
node client.js
```

**Concepts demonstrated:**
- Periodic data publishing (`setInterval` + `server.publish`)
- Multiple topics (`stocks.AAPL`, `stocks.GOOGL`, `alerts`)
- Conditional broadcasting (alert thresholds)
- Terminal UI with live updates

### 4. Microservice RPC

CRUD operations with schema validation and middleware.

```bash
# Terminal 1 - Start server
cd examples/demo-microservice
node server.js

# Terminal 2 - Run client (automated CRUD demo)
node client.js
```

**Concepts demonstrated:**
- Zod schema validation on routes
- Middleware chain (request logging with timing)
- Automatic validation error rejection
- Full CRUD operations over AfterLink

## How to Write Your Own AfterLink Server

```javascript
const { Server } = require('@ajaymyth/server');
const { z } = require('zod'); // optional

const server = new Server({ port: 4000 });

// Simple route
server.on('hello', async (req, res) => {
  res.send({ message: `Hello, ${req.body.name}!` });
});

// Route with schema validation
server.on('createUser',
  async (req, res) => {
    const user = { id: 1, ...req.body };
    res.send({ user });
  },
  z.object({
    name: z.string().min(2),
    email: z.string().email(),
  })
);

// Middleware
server.use(async (req, next) => {
  console.log(`[${req.route}] started`);
  await next();
});

await server.listen();
```

## How to Write Your Own AfterLink Client

```javascript
const { Client } = require('@ajaymyth/client');

const client = new Client('afterlink://localhost:4000');

// Connect
await client.connect();

// Request/Response
const result = await client.request('hello', { name: 'World' });
console.log(result.message);

// Subscribe to topic
await client.subscribe('news', (data) => {
  console.log('New update:', data);
});

// Publish to topic
client.publish('chat', { text: 'Hello everyone!' });

// Disconnect
await client.disconnect();
```

## Backend-Agnostic Design

AfterLink is a **communication protocol**, not a database. It works with **any** backend provider.

### How to connect AfterLink to your backend:

```javascript
const { Server } = require('@ajaymyth/server');

// Choose YOUR backend - AfterLink doesn't care which one:
// const supabase = require('@supabase/supabase-js').createClient(url, key);
// const insforge = require('@insforge/sdk').createClient(config);
// const firebase = require('firebase-admin');
// const { MongoClient } = require('mongodb');

const server = new Server({ port: 4000 });

// AfterLink handles communication, your backend handles data
server.on('getData', async (req, res) => {
  // Call your backend of choice:
  // const { data } = await supabase.from('items').select();
  // const items = await insforge.db.list('items');
  // const items = await mongoDb.collection('items').find().toArray();
  res.send({ items: [] });
});

// AfterLink Pub/Sub broadcasts your backend changes to clients
server.on('createItem', async (req, res) => {
  // const { data } = await supabase.from('items').insert(req.body);
  server.publish('items.created', data); // Broadcast to subscribers
  res.send({ item: data });
});

await server.listen();
```

| Your Backend | SDK to Install | AfterLink Role |
|---|---|---|
| Supabase | `@supabase/supabase-js` | Real-time layer + auth gateway |
| InsForge | `@insforge/sdk` | Fast binary transport + pub/sub |
| Firebase | `firebase-admin` | Multi-client sync layer |
| AWS | `@aws-sdk/*` | Persistent connection manager |
| MongoDB | `mongodb` | Real-time change broadcasting |
| PostgreSQL | `pg` | Connection pooling + routing |
| Custom REST | `node-fetch` | Protocol upgrade layer |

## Project Structure

```
examples/
├── demo-runner/         # Interactive showcase (7 demos)
├── demo-chat/           # Real-time chat app
├── demo-dashboard/      # Stock price dashboard
├── demo-microservice/   # CRUD with validation
└── hello-world/         # Simple ping/pong
```
