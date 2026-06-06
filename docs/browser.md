# AfterLink Browser Client

The `@ajaymyth/browser` package provides a zero-dependency WebSocket client for browser environments, enabling AfterLink protocol communication over WebSocket transport.

## Installation

```bash
npm install @ajaymyth/browser
```

Or include the bundled UMD build directly in HTML:

```html
<script src="https://unpkg.com/@ajaymyth/browser/dist/afterlink-browser.min.js"></script>
```

## Quick Start

```javascript
import { Client } from '@ajaymyth/browser';

const client = new Client('ws://localhost:4001/ws');

await client.connect();

// Request/Response
const result = await client.request('getUser', { id: 42 });
console.log(result);

// Pub/Sub
client.subscribe('chat', (data) => {
  console.log('New message:', data);
});

client.publish('chat', { user: 'Alice', text: 'Hello!' });

await client.disconnect();
```

## Server Setup

The server must enable the WebSocket bridge:

```javascript
import { Server } from '@ajaymyth/server';

const server = new Server({
  port: 4000,
  browser: {
    enabled: true,
    port: 4001,       // WebSocket bridge port
    path: '/ws',      // WebSocket endpoint path
    cors: {
      origins: ['https://myapp.com'],  // Allowed origins (or '*' for all)
    },
  },
});

server.on('getUser', async (req, res) => {
  const user = await db.users.find(req.body.id);
  res.send(user);
});

await server.listen();
```

## API Reference

### `new Client(url, options)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | string | WebSocket URL (e.g., `ws://host:port/ws`) |
| `options.autoReconnect` | boolean | Auto-reconnect on disconnect | `true` |
| `options.maxReconnectAttempts` | number | Max reconnection attempts | `10` |
| `options.reconnectDelay` | number | Base delay between reconnects (ms) | `1000` |
| `options.timeout` | number | Request timeout (ms) | `30000` |
| `options.pingInterval` | number | Ping interval (ms) | `30000` |
| `options.auth` | string | JWT token for HELLO handshake | - |

### `client.connect()`

Establishes the WebSocket connection and completes the AfterLink HELLO handshake.

```javascript
await client.connect();
console.log(client.isConnected()); // true
console.log(client.getSessionId()); // "ws_..."
```

### `client.request(route, body)`

Sends a REQUEST frame and returns the response body.

```javascript
const user = await client.request('getUser', { id: 42 });
```

### `client.subscribe(topic, handler)`

Subscribes to a pub/sub topic.

```javascript
client.subscribe('notifications', (data) => {
  showToast(data.message);
});
```

### `client.publish(topic, data)`

Publishes data to a topic (received by all subscribers).

```javascript
client.publish('notifications', { message: 'New order received!' });
```

### `client.unsubscribe(topic)`

Unsubscribes from a topic.

```javascript
client.unsubscribe('notifications');
```

### `client.disconnect()`

Gracefully closes the connection.

```javascript
await client.disconnect();
```

### Events

```javascript
client.on('disconnected', ({ graceful, reason, code }) => {
  console.log('Disconnected:', reason);
});

client.on('reconnecting', ({ attempt, delay }) => {
  console.log(`Reconnecting attempt ${attempt} in ${delay}ms`);
});

client.on('reconnected', () => {
  console.log('Reconnected!');
});

client.on('message', ({ topic, data }) => {
  console.log(`Topic ${topic}:`, data);
});

client.on('server-closing', (data) => {
  console.log('Server is shutting down');
});
```

## Browser Demo

A complete browser demo is included in `examples/browser-example/`:

```bash
cd examples/browser-example
npm install
node server.js
# Open http://localhost:3000
```

Features:
- Inline AfterLink client (zero dependencies)
- Health dashboard
- Real-time chat via pub/sub
- Request/response demo
