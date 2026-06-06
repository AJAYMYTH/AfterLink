# AfterLink CLI Reference

The AfterLink CLI (`afterlink`) is a terminal tool for testing, debugging, and monitoring AfterLink servers.

## Installation

```bash
npm install -g @afterlink/cli
# or use via npx
npx afterlink --help
```

## Commands

### `ping` — Test server connectivity

Measures round-trip latency by sending PING frames and timing PONG responses.

```bash
afterlink ping <host:port> [options]
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-n, --count <n>` | Number of pings to send | 4 |
| `-i, --interval <ms>` | Interval between pings | 1000 |
| `-t, --timeout <ms>` | Timeout per ping | 5000 |
| `--tls` | Use TLS (afterlinks://) | false |
| `--no-color` | Disable colored output | auto |
| `-j, --json` | Output as JSON | false |
| `--profile <name>` | Connection profile from ~/.afterlinkrc | - |

**Examples:**

```bash
# Basic ping
afterlink ping localhost:4000

# 10 pings, 200ms interval
afterlink ping localhost:4000 -n 10 -i 200

# JSON output for scripting
afterlink ping localhost:4000 --json

# TLS connection
afterlink ping localhost:443 --tls
```

**Exit codes:**
- `0` — All pings successful
- `1` — Partial packet loss
- `2` — Total failure (no connection)

**JSON output format:**

```json
{
  "host": "localhost",
  "port": 4000,
  "protocol": "AF/1.1",
  "sent": 4,
  "received": 4,
  "packetLoss": 0,
  "latency": { "min": 2, "avg": 5, "max": 12, "unit": "ms" },
  "results": [
    { "seq": 1, "status": "ok", "latencyMs": 3 },
    { "seq": 2, "status": "ok", "latencyMs": 5 }
  ]
}
```

---

### `call` — Send a request to a route

Connects to the server, sends a REQUEST frame to a named route, and prints the response.

```bash
afterlink call <host:port> <route> [payload] [options]
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `--tls` | Use TLS | false |
| `-H, --header <k=v>` | Add session header (repeatable) | - |
| `--auth <token>` | JWT auth token for HELLO handshake | - |
| `-t, --timeout <ms>` | Request timeout | 10000 |
| `--pretty` | Pretty-print JSON response | true |
| `--no-pretty` | Compact JSON output | - |
| `-j, --json` | Machine-readable JSON wrapper | false |
| `--raw` | Print raw response bytes (hex) | false |
| `--trace` | Show full frame exchange | false |
| `--profile <name>` | Connection profile | - |

**Payload input:**
- Inline JSON: `afterlink call localhost:4000 createUser '{"name":"Alice"}'`
- From file: `afterlink call localhost:4000 createUser @data.json`

**Examples:**

```bash
# Simple call
afterlink call localhost:4000 getStats

# With payload
afterlink call localhost:4000 createUser '{"name":"Alice","email":"a@b.com"}'

# From file
afterlink call localhost:4000 bulkImport @users.json

# JSON output
afterlink call localhost:4000 getStats --json

# Trace mode (shows HELLO → HELLO_ACK → REQUEST → RESPONSE)
afterlink call localhost:4000 getStats --trace
```

**Exit codes:**
- `0` — Successful response
- `1` — Error response or connection failure

---

### `inspect` — Raw frame inspector

Shows an annotated hex dump and decoded breakdown for every frame exchanged during a request.

```bash
afterlink inspect <host:port> <route> [payload] [options]
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `--tls` | Use TLS | false |
| `--auth <token>` | JWT auth token | - |
| `-t, --timeout <ms>` | Request timeout | 10000 |
| `--profile <name>` | Connection profile | - |

**Example output:**

```
  →  afterlink inspect localhost:4000:getStats

  →  HELLO            seq=1  payload=42B  flags=0x00
  ←  HELLO_ACK        seq=1  payload=68B  flags=0x00
  →  REQUEST          seq=2  payload=28B  flags=0x00
  ←  RESPONSE         seq=2  payload=156B  flags=0x00
```

---

### `monitor` — Live terminal dashboard

Real-time dashboard polling the `/__health` endpoint with connection stats, request rates, latency, error rates, and top routes.

```bash
afterlink monitor <host:port> [options]
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `--tls` | Use TLS | false |
| `-r, --refresh <ms>` | Refresh interval | 2000 |
| `--token <key>` | Health endpoint bearer token | - |
| `--json` | NDJSON streaming output | false |
| `--filter <route>` | Filter request stream by route | - |
| `--profile <name>` | Connection profile | - |

**Dashboard displays:**
- Server status (healthy/degraded/unhealthy)
- Active connections
- Requests per second
- Average latency
- Error rate
- Uptime
- Top 5 routes with bar charts
- Live request stream (route + latency)

Press `q` to quit.

### `upgrade` — Upgrade AfterLink packages

Upgrades all installed AfterLink packages in the current project (dependencies and devDependencies) to their latest versions. Detects the package manager (npm, pnpm, yarn) automatically from the lockfile.

```bash
afterlink upgrade [options]
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-g, --global` | Upgrade AfterLink packages globally | false |

**Examples:**

```bash
# Upgrade all AfterLink packages in the current project
afterlink upgrade

# Upgrade globally
afterlink upgrade --global
```

---

## Connection Profiles

Store connection presets in `~/.afterlinkrc`:

```yaml
profiles:
  dev:
    host: localhost
    port: 4000
    tls: false
  staging:
    host: api.staging.example.com
    port: 443
    tls: true
    auth: eyJhbGciOi...
  production:
    host: api.example.com
    port: 443
    tls: true
    headers:
      X-Environment: production
```

Use with `--profile`:

```bash
afterlink ping staging --profile staging
afterlink call production createUser --profile production
```

Profile values can be overridden by command-line flags.
