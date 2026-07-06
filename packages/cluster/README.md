# @ajaymyth/cluster

AfterLink multi-process clustering orchestrator with Redis and Redis Cluster pub/sub synchronization.

## Installation

```bash
pnpm add @ajaymyth/cluster
```

## Usage

### Single-node Redis Connection

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

### Redis Cluster Connection

You can connect your orchestrator to a Redis Cluster by providing an array of seed nodes:

```javascript
const { createCluster } = require('@ajaymyth/cluster');
const Server = require('@ajaymyth/server');

createCluster({
  workers: 4,
  redis: {
    nodes: [
      { host: '10.0.0.1', port: 7000 },
      { host: '10.0.0.2', port: 7001 },
      { host: '10.0.0.3', port: 7002 }
    ],
    redisOptions: {
      password: 'your-cluster-password'
    }
  }
}, () => {
  const server = new Server();
  server.listen(4000);
});
```
