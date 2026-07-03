# @ajaymyth/cluster

AfterLink multi-process clustering orchestrator with Redis pub/sub synchronization.

## Installation

```bash
pnpm add @ajaymyth/cluster
```

## Usage

```javascript
const { createCluster } = require('@ajaymyth/cluster');
const Server = require('@ajaymyth/server');

createCluster({
  workers: 4,
  redis: {
    host: 'localhost',
    port: 6379
  }
}, () => {
  const server = new Server();
  server.listen(4000);
});
```
