# AfterLink Communication Protocol

**For Reliable and Fast Communication**

AfterLink is a custom application-layer binary communication protocol designed to be a developer-friendly, high-performance alternative to raw HTTP for modern application development.

## Features

- **Fast** - 10-byte binary frame headers, persistent connections, multiplexing
- **Simple** - Clean SDK APIs, built-in schema validation, one-command scaffold
- **Feature-rich** - Streaming, pub/sub, authentication, compression, auto-reconnect
- **Universal** - Works over TCP (server-to-server) and WebSocket (browser)

## Quick Start

### Installation

```bash
pnpm install
```

### Hello World

**Server:**
```javascript
const { Server } = require('@afterlink/server');

const server = new Server({ port: 4000 });

server.on('ping', async (req, res) => {
  res.send({ message: 'pong', timestamp: Date.now() });
});

server.listen();
```

**Client:**
```javascript
const { Client } = require('@afterlink/client');

async function main() {
  const client = new Client('afterlink://localhost:4000');
  await client.connect();

  const result = await client.request('ping', {});
  console.log(result);

  await client.disconnect();
}

main();
```

### Run the Example

```bash
# Terminal 1 - Start server
node examples/hello-world/server.js

# Terminal 2 - Run client
node examples/hello-world/client.js
```

## Project Structure

```
afterlink/
├── packages/
│   ├── core/          # Frame codec and serialization
│   ├── server/        # Node.js server SDK
│   └── client/        # Node.js client SDK
├── examples/
│   └── hello-world/   # Ping/pong example
├── docs/              # Protocol documentation
└── README.md
```

## Protocol Specification

### Frame Format (10-byte header)

```
 0               1               2               3
 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7
├───────────────┼───────────────┼───────────────────────────────────┤
│  Frame Type   │     Flags     │         Message ID (4 bytes)      │
├───────────────┴───────────────┴───────────────────────────────────┤
│                    Payload Length (4 bytes)                        │
├───────────────────────────────────────────────────────────────────┤
│                    Payload (variable)                              │
└───────────────────────────────────────────────────────────────────┘
```

### Frame Types

| Code | Type | Description |
|------|------|-------------|
| 0x01 | REQUEST | Client request to a named route |
| 0x02 | RESPONSE | Server response to a request |
| 0x03 | STREAM_START | Begin a streaming sequence |
| 0x04 | STREAM_DATA | A chunk in a stream |
| 0x05 | STREAM_END | End of stream |
| 0x06 | ERROR | Error frame |
| 0x07 | PING | Keep-alive ping |
| 0x08 | PONG | Keep-alive pong |
| 0x09 | BROADCAST | Server-push to all clients |
| 0x0A | SUBSCRIBE | Subscribe to a topic |
| 0x0B | UNSUBSCRIBE | Unsubscribe from a topic |
| 0x0C | PUBLISH | Publish message to a topic |
| 0x0D | CLOSE | Graceful connection close |
| 0x0E | CLOSE_ACK | Acknowledge close |
| 0x0F | HELLO | Initial handshake |
| 0x10 | HELLO_ACK | Handshake acknowledgement |

## Running Tests

```bash
pnpm test
```

## Author

Ajju (Javali Ajayakumar)

## License

MIT
