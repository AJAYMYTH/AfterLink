# AfterLink Health Endpoint

The `/__health` endpoint provides HTTP-based health monitoring for AfterLink servers, supporting load balancers, orchestration systems, and monitoring dashboards.

## Configuration

```javascript
import { Server } from '@afterlink/server';

const server = new Server({
  port: 4000,
  health: {
    enabled: true,
    // Optional: separate HTTP port (default: same port, protocol detection)
    port: 4002,
    // Optional: bearer token for authentication
    token: 'my-secret-token',
    // Optional: thresholds for degraded/unhealthy status
    thresholds: {
      maxConnections: 1000,    // Above this → degraded
      maxErrorRate: 10,        // Error rate % above this → degraded
      maxLatency: 5000,        // Avg latency (ms) above this → degraded
    },
  },
});

await server.listen();
```

## Endpoints

### `GET /__health` — Full health report

Returns comprehensive server health information.

**Response:**

```json
{
  "status": "healthy",
  "version": "1.2.0",
  "protocol": "AF/1.1",
  "uptime": 3600,
  "connections": {
    "active": 42,
    "max": 1000
  },
  "requests": {
    "perSecond": 150,
    "avgLatencyMs": 12,
    "errorRatePct": 0.5
  },
  "routes": [
    { "name": "getUser", "totalCalls": 5000, "avgLatencyMs": 8 },
    { "name": "createUser", "totalCalls": 200, "avgLatencyMs": 25 }
  ]
}
```

### `GET /__health/live` — Liveness probe

Returns `200 OK` if the server process is running. Used by Kubernetes liveness probes.

**Response:**

```json
{ "status": "alive" }
```

### `GET /__health/ready` — Readiness probe

Returns `200 OK` if the server is ready to accept connections. Returns `503` if the server is still initializing or shutting down.

**Response (ready):**

```json
{ "status": "ready" }
```

**Response (not ready):**

```json
{ "status": "not_ready" }
```

HTTP status: `503 Service Unavailable`

### `GET /__health/stats` — Raw statistics

Returns raw server statistics without health status computation.

**Response:**

```json
{
  "uptime": 3600,
  "connections": { "active": 42 },
  "requests": {
    "total": 10000,
    "perSecond": 150,
    "avgLatencyMs": 12,
    "errorRatePct": 0.5
  },
  "routes": [
    { "name": "getUser", "totalCalls": 5000, "avgLatencyMs": 8 }
  ]
}
```

## Status Logic

| Status | Condition |
|--------|-----------|
| `healthy` | Server is running, connections < threshold, error rate < threshold, latency < threshold |
| `degraded` | One or more thresholds exceeded but server is still functional |
| `unhealthy` | Server is not running or critical failure |

## Authentication

If a `token` is configured, all health endpoints require a `Bearer` token:

```bash
curl -H "Authorization: Bearer my-secret-token" http://localhost:4000/__health
```

Without authentication, returns `401 Unauthorized`.

## Same-Port vs Separate Port

### Same-Port Mode (default)

The health endpoint shares the main TCP port. Protocol detection on the TCP stream distinguishes HTTP `GET` requests from AfterLink HELLO frames.

```javascript
const server = new Server({
  port: 4000,
  health: { enabled: true },
});
// Health available at http://localhost:4000/__health
```

### Separate Port Mode

A dedicated HTTP server runs on a separate port.

```javascript
const server = new Server({
  port: 4000,
  health: { enabled: true, port: 4002 },
});
// Health available at http://localhost:4002/__health
// AfterLink protocol on port 4000
```

## Monitoring with CLI

Use the `afterlink monitor` command for a live terminal dashboard:

```bash
afterlink monitor localhost:4000
# With auth token
afterlink monitor localhost:4000 --token my-secret-token
# JSON streaming
afterlink monitor localhost:4000 --json
```
