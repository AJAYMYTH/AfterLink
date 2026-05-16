# AfterLink Deployment Guide

Complete guide to deploying AfterLink servers on any platform — from local development to production at scale.

---

## Table of Contents

1. [Quick Deploy](#quick-deploy)
2. [Local Development](#local-development)
3. [Node.js Process Managers](#nodejs-process-managers)
4. [Docker Deployment](#docker-deployment)
5. [Cloud Platforms](#cloud-platforms)
6. [VPS / Dedicated Server](#vps--dedicated-server)
7. [Kubernetes](#kubernetes)
8. [Serverless (Not Recommended)](#serverless-not-recommended)
9. [Production Checklist](#production-checklist)
10. [Monitoring & Observability](#monitoring--observability)
11. [Scaling](#scaling)
12. [Security Hardening](#security-hardening)

---

## Quick Deploy

### One-Command Deploy

| Platform | Command | Time |
|---|---|---|
| **Railway** | `railway init` → push to GitHub | 2 min |
| **Render** | Connect GitHub repo → deploy | 3 min |
| **Fly.io** | `fly launch` → `fly deploy` | 3 min |
| **DigitalOcean** | Deploy from marketplace | 5 min |
| **AWS EC2** | SSH → clone → `pnpm install` → run | 5 min |

---

## Local Development

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)

### Setup

```bash
git clone https://github.com/AJAYMYTH/AfterLink.git
cd AfterLink
pnpm install
```

### Run Server

```bash
# Create your server file
cat > server.js << 'EOF'
const { Server } = require('@afterlink/server');

const server = new Server({ port: 4000 });

server.on('ping', async (req, res) => {
  res.send({ message: 'pong', timestamp: Date.now() });
});

server.listen();
EOF

# Start the server
node server.js
```

### Run Client

```bash
cat > client.js << 'EOF'
const { Client } = require('@afterlink/client');

async function main() {
  const client = new Client('afterlink://localhost:4000');
  await client.connect();
  const result = await client.request('ping', {});
  console.log(result);
  await client.disconnect();
}

main();
EOF

node client.js
```

### Run Demos

```bash
# Interactive showcase (7 demos)
cd examples/demo-runner
node index.js

# Real-time chat
cd examples/demo-chat
node server.js    # Terminal 1
node client.js    # Terminal 2

# Stock dashboard
cd examples/demo-dashboard
node server.js    # Terminal 1
node client.js    # Terminal 2
```

---

## Node.js Process Managers

### PM2 (Recommended for single-server)

```bash
# Install PM2
npm install -g pm2

# Start server
pm2 start server.js --name afterlink-server

# Start with environment variables
pm2 start server.js --name afterlink \
  -- --port 4000 \
  --env production

# Monitor
pm2 monit
pm2 logs afterlink-server

# Auto-restart on file changes (development)
pm2 start server.js --watch

# Save process list and setup startup
pm2 save
pm2 startup
```

### ecosystem.config.js

```javascript
module.exports = {
  apps: [{
    name: 'afterlink-server',
    script: 'server.js',
    instances: 'max',        // Use all CPU cores
    exec_mode: 'cluster',    // Cluster mode for load balancing
    env: {
      NODE_ENV: 'production',
      AFTERLINK_PORT: 4000,
      AFTERLINK_HOST: '0.0.0.0',
      AFTERLINK_MAX_CONNECTIONS: 10000,
    },
    env_production: {
      NODE_ENV: 'production',
    },
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    merge_logs: true,
    restart_delay: 3000,
  }]
};
```

```bash
pm2 start ecosystem.config.js
```

### nodemon (Development only)

```bash
npm install -g nodemon
nodemon server.js
```

---

## Docker Deployment

### Dockerfile

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ packages/
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Production stage
FROM node:20-alpine
WORKDIR /app

# Copy only production files
COPY --from=builder /app/packages/core packages/core
COPY --from=builder /app/packages/server packages/server
COPY --from=builder /app/packages/client packages/client
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/pnpm-lock.yaml ./
COPY package.json pnpm-workspace.yaml ./

# Install production dependencies only
RUN npm install -g pnpm && pnpm install --prod --frozen-lockfile

# Copy your server file
COPY server.js .

# Create non-root user
RUN addgroup -g 1001 -S afterlink && \
    adduser -S afterlink -u 1001 -G afterlink
USER afterlink

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('net').connect(4000, 'localhost', () => process.exit(0))" || exit 1

# Start
CMD ["node", "server.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  afterlink:
    build: .
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - AFTERLINK_PORT=4000
      - AFTERLINK_HOST=0.0.0.0
      - AFTERLINK_MAX_CONNECTIONS=10000
      - AFTERLINK_JWT_SECRET=${JWT_SECRET}
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
        reservations:
          memory: 128M
          cpus: '0.25'
    healthcheck:
      test: ["CMD", "node", "-e", "require('net').connect(4000, 'localhost', () => process.exit(0))"]
      interval: 30s
      timeout: 5s
      retries: 3
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  # Optional: Add your backend services
  # postgres:
  #   image: postgres:16-alpine
  #   environment:
  #     POSTGRES_PASSWORD: ${DB_PASSWORD}
  #   volumes:
  #     - postgres_data:/var/lib/postgresql/data

  # redis:
  #   image: redis:7-alpine
  #   command: redis-server --requirepass ${REDIS_PASSWORD}

# volumes:
#   postgres_data:
```

### Build and Run

```bash
# Build
docker build -t afterlink-server .

# Run
docker run -d \
  --name afterlink \
  -p 4000:4000 \
  -e NODE_ENV=production \
  -e AFTERLINK_JWT_SECRET=your-secret \
  afterlink-server

# With docker-compose
docker compose up -d

# View logs
docker compose logs -f afterlink

# Stop
docker compose down
```

---

## Cloud Platforms

### Railway

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your AfterLink repository
4. Add environment variables in Railway dashboard
5. Railway auto-detects Node.js and deploys

**railway.json:**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install -g pnpm && pnpm install"
  },
  "deploy": {
    "startCommand": "node server.js",
    "healthcheckPath": "/",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Render

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repository
3. Configure:
   - **Build Command:** `npm install -g pnpm && pnpm install`
   - **Start Command:** `node server.js`
   - **Port:** 4000
4. Add environment variables
5. Deploy

**render.yaml:**
```yaml
services:
  - type: web
    name: afterlink-server
    env: node
    buildCommand: npm install -g pnpm && pnpm install
    startCommand: node server.js
    port: 4000
    envVars:
      - key: NODE_ENV
        value: production
      - key: AFTERLINK_PORT
        value: 4000
      - key: AFTERLINK_JWT_SECRET
        sync: false
```

### Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Initialize app
fly launch --name afterlink-server

# Deploy
fly deploy

# Set secrets
fly secrets set AFTERLINK_JWT_SECRET=your-secret

# Scale
fly scale count 2
fly scale memory 512

# View logs
fly logs
```

**fly.toml:**
```toml
app = "afterlink-server"
primary_region = "sjc"

[build]

[env]
  AFTERLINK_PORT = "4000"
  AFTERLINK_HOST = "0.0.0.0"
  NODE_ENV = "production"

[[services]]
  protocol = "tcp"
  internal_port = 4000

  [[services.ports]]
    port = 4000
    handlers = ["tls"]

  [services.concurrency]
    type = "connections"
    hard_limit = 10000
    soft_limit = 8000

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1
```

### DigitalOcean App Platform

1. Push to GitHub
2. Go to DigitalOcean → Create App → Connect repository
3. Select Node.js runtime
4. Configure:
   - **Build Command:** `npm install -g pnpm && pnpm install`
   - **Run Command:** `node server.js`
   - **HTTP Port:** 4000
5. Add environment variables
6. Deploy

### AWS EC2

```bash
# SSH into your EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# Install pnpm
sudo npm install -g pnpm

# Clone and setup
git clone https://github.com/AJAYMYTH/AfterLink.git
cd AfterLink
pnpm install

# Install PM2
sudo npm install -g pm2

# Start with PM2
pm2 start server.js --name afterlink
pm2 save
sudo pm2 startup

# Configure firewall
sudo ufw allow 4000/tcp
```

### Vercel (Edge Functions)

AfterLink requires persistent TCP connections, so it's **not ideal for Vercel's serverless model**. However, you can use Vercel for:

- **Frontend clients** that connect to your AfterLink server
- **HTTP Gateway** that proxies to your AfterLink server

```javascript
// vercel/api/gateway.js
// HTTP-to-AfterLink gateway
export default async function handler(req, res) {
  const { Client } = require('@afterlink/client');

  const client = new Client(process.env.AFTERLINK_SERVER_URL);
  await client.connect();

  const result = await client.request(req.body.route, req.body.body);
  await client.disconnect();

  res.status(200).json(result);
}
```

---

## VPS / Dedicated Server

### Ubuntu/Debian Setup Script

```bash
#!/bin/bash
# afterlink-setup.sh - Run as root

set -e

# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Install PM2
npm install -g pm2

# Install Nginx
apt install -y nginx

# Create app directory
mkdir -p /var/www/afterlink
cd /var/www/afterlink

# Clone repository
git clone https://github.com/AJAYMYTH/AfterLink.git .
pnpm install --prod

# Create systemd service
cat > /etc/systemd/system/afterlink.service << 'EOF'
[Unit]
Description=AfterLink Communication Protocol Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/afterlink
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=AFTERLINK_PORT=4000
Environment=AFTERLINK_HOST=127.0.0.1

# Security
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/www/afterlink/logs

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
systemctl daemon-reload
systemctl enable afterlink
systemctl start afterlink

# Check status
systemctl status afterlink
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;

    # AfterLink TCP proxy (raw TCP, not HTTP)
    # Note: Nginx cannot proxy raw TCP without stream module
    # Use HAProxy or direct port exposure for TCP

    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
```

### HAProxy (For TCP Proxy)

```haproxy
global
    log /dev/log local0
    maxconn 50000

defaults
    log     global
    mode    tcp
    option  tcplog
    timeout connect 5s
    timeout client  30s
    timeout server  30s

frontend afterlink_tcp
    bind *:4000 ssl crt /etc/haproxy/certs/yourdomain.pem
    default_backend afterlink_servers

backend afterlink_servers
    balance leastconn
    option tcp-check
    server afterlink1 127.0.0.1:4001 check maxconn 10000
    server afterlink2 127.0.0.1:4002 check maxconn 10000 backup
```

---

## Kubernetes

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: afterlink-server
  labels:
    app: afterlink
spec:
  replicas: 3
  selector:
    matchLabels:
      app: afterlink
  template:
    metadata:
      labels:
        app: afterlink
    spec:
      containers:
        - name: afterlink
          image: your-registry/afterlink-server:latest
          ports:
            - containerPort: 4000
              name: afterlink-tcp
          env:
            - name: NODE_ENV
              value: "production"
            - name: AFTERLINK_PORT
              value: "4000"
            - name: AFTERLINK_HOST
              value: "0.0.0.0"
            - name: AFTERLINK_MAX_CONNECTIONS
              value: "10000"
            - name: AFTERLINK_JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: afterlink-secrets
                  key: jwt-secret
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            tcpSocket:
              port: 4000
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            tcpSocket:
              port: 4000
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: afterlink-service
spec:
  type: LoadBalancer
  ports:
    - port: 4000
      targetPort: 4000
      protocol: TCP
      name: afterlink-tcp
  selector:
    app: afterlink
---
apiVersion: v1
kind: Secret
metadata:
  name: afterlink-secrets
type: Opaque
data:
  jwt-secret: <base64-encoded-secret>
```

### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: afterlink-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: afterlink-server
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

---

## Serverless (Not Recommended)

AfterLink requires **persistent TCP connections**, which conflicts with serverless architecture (cold starts, stateless functions, connection limits).

### When NOT to use serverless:
- AfterLink server itself (needs persistent connections)
- Pub/Sub broker (needs long-lived connections)
- Real-time streaming

### When serverless IS appropriate:
- HTTP Gateway that proxies to AfterLink
- Client-side code (frontend)
- Background jobs that trigger AfterLink events

---

## Production Checklist

### Before Deploying

- [ ] Set `NODE_ENV=production`
- [ ] Configure `AFTERLINK_JWT_SECRET` (min 32 characters)
- [ ] Set `AFTERLINK_MAX_CONNECTIONS` based on server capacity
- [ ] Enable TLS/SSL for all connections
- [ ] Configure firewall rules (only expose necessary ports)
- [ ] Set up log rotation (prevent disk fill)
- [ ] Configure health checks
- [ ] Set up monitoring and alerting
- [ ] Test auto-reconnect behavior
- [ ] Load test with expected traffic
- [ ] Set up backup strategy for your backend data
- [ ] Configure rate limiting
- [ ] Set up CI/CD pipeline

### Environment Variables

```env
# Required
NODE_ENV=production
AFTERLINK_PORT=4000
AFTERLINK_HOST=0.0.0.0
AFTERLINK_JWT_SECRET=<min-32-char-secret>

# Optional
AFTERLINK_MAX_CONNECTIONS=10000
AFTERLINK_WS_PORT=4001
AFTERLINK_MAX_PAYLOAD_MB=16
AFTERLINK_RATE_LIMIT_CAPACITY=100
AFTERLINK_RATE_LIMIT_REFILL=10

# TLS (optional, use reverse proxy instead)
AFTERLINK_TLS_CERT=/etc/ssl/certs/server.pem
AFTERLINK_TLS_KEY=/etc/ssl/private/server.key

# Logging
AFTERLINK_LOG_LEVEL=info
AFTERLINK_LOG_FILE=/var/log/afterlink/server.log
```

---

## Monitoring & Observability

### Health Check Endpoint

Add to your server:

```javascript
const http = require('http');

// Separate HTTP health check on different port
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      connections: server.getConnectionCount(),
      routes: server.getRouteCount(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: Date.now(),
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(4001);
```

### Prometheus Metrics

```javascript
const client = require('prom-client');

const registry = new client.Registry();

const connectionsGauge = new client.Gauge({
  name: 'afterlink_connections_active',
  help: 'Number of active AfterLink connections',
});

const requestCounter = new client.Counter({
  name: 'afterlink_requests_total',
  help: 'Total number of AfterLink requests',
  labelNames: ['route'],
});

const latencyHistogram = new client.Histogram({
  name: 'afterlink_request_duration_ms',
  help: 'Request duration in milliseconds',
  labelNames: ['route'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
});

registry.registerMetric(connectionsGauge);
registry.registerMetric(requestCounter);
registry.registerMetric(latencyHistogram);

// Middleware to track metrics
server.use(async (req, next) => {
  const start = Date.now();
  requestCounter.inc({ route: req.route });
  await next();
  latencyHistogram.observe({ route: req.route }, Date.now() - start);
  connectionsGauge.set(server.getConnectionCount());
});

// Expose /metrics endpoint
const metricsServer = http.createServer(async (req, res) => {
  if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': registry.contentType });
    res.end(await registry.metrics());
  }
});

metricsServer.listen(4002);
```

### Logging

```javascript
// Structured JSON logging
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.AFTERLINK_LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

// Use in middleware
server.use(async (req, next) => {
  logger.info('request_start', { route: req.route, sessionId: req.session?.id });
  const start = Date.now();
  try {
    await next();
    logger.info('request_complete', { route: req.route, duration: Date.now() - start });
  } catch (err) {
    logger.error('request_error', { route: req.route, error: err.message });
    throw err;
  }
});
```

---

## Scaling

### Vertical Scaling

Increase server resources:
- More CPU cores → more concurrent requests
- More RAM → more connections (50KB per connection)
- Faster network → lower latency

### Horizontal Scaling

```
                    ┌─────────────┐
                    │  HAProxy /  │
                    │  Load       │
                    │  Balancer   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌───▼────┐ ┌─────▼─────┐
        │ AfterLink │ │AfterLink│ │ AfterLink │
        │ Server 1  │ │Server 2 │ │ Server 3  │
        └───────────┘ └────────┘ └───────────┘
```

For horizontal scaling with Pub/Sub, use Redis as a shared broker:

```javascript
// Use Redis Pub/Sub for cross-server broadcasting
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

// When publishing locally, also publish to Redis
server.publish = function(topic, data) {
  redis.publish(`afterlink:${topic}`, JSON.stringify(data));
  // Also publish to local subscribers
  originalPublish.call(this, topic, data);
};

// Subscribe to Redis for other servers' messages
redis.psubscribe('afterlink:*');
redis.on('pmessage', (pattern, channel, message) => {
  const topic = channel.replace('afterlink:', '');
  const data = JSON.parse(message);
  // Broadcast to local subscribers
  localBroker.publishToAll(topic, data);
});
```

### Connection Limits

| Server Size | Max Connections | RAM Needed |
|---|---|---|
| 1 vCPU, 1GB | 5,000 | ~250MB |
| 2 vCPU, 2GB | 15,000 | ~750MB |
| 4 vCPU, 4GB | 40,000 | ~2GB |
| 8 vCPU, 8GB | 100,000 | ~5GB |

---

## Security Hardening

### 1. Enable JWT Authentication

```javascript
const server = new Server({
  port: 4000,
  auth: {
    type: 'jwt',
    secret: process.env.AFTERLINK_JWT_SECRET,
    issuer: 'your-app',
  },
});
```

### 2. Rate Limiting

```javascript
const rateLimit = new Map();

server.use(async (req, next) => {
  const sessionId = req.session?.id;
  if (!sessionId) return next();

  const now = Date.now();
  const window = 60000; // 1 minute
  const limit = 100; // requests per minute

  if (!rateLimit.has(sessionId)) {
    rateLimit.set(sessionId, []);
  }

  const requests = rateLimit.get(sessionId);
  const recent = requests.filter((t) => now - t < window);

  if (recent.length >= limit) {
    throw new Error('RATE_LIMITED');
  }

  recent.push(now);
  rateLimit.set(sessionId, recent);
  await next();
});
```

### 3. TLS Configuration

```javascript
const fs = require('fs');

const server = new Server({
  port: 4000,
  tls: {
    cert: fs.readFileSync('/etc/ssl/certs/server.pem'),
    key: fs.readFileSync('/etc/ssl/private/server.key'),
    ca: fs.readFileSync('/etc/ssl/certs/ca.pem'),
  },
});
```

### 4. Firewall Rules

```bash
# Only allow necessary ports
ufw default deny incoming
ufw default allow outgoing
ufw allow 4000/tcp    # AfterLink
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP (for Let's Encrypt)
ufw allow 443/tcp     # HTTPS
ufw enable
```

### 5. Non-Root User

```bash
# Never run AfterLink as root
useradd -r -s /bin/false afterlink
chown -R afterlink:afterlink /var/www/afterlink
```

---

## Platform-Specific Notes

### AfterLink as a Service

You can offer AfterLink as a managed service (like Supabase does for PostgreSQL):

1. **Multi-tenant server** — Route connections to different backend instances based on project ID
2. **Connection pooling** — Manage connection limits per user/plan
3. **Dashboard** — Provide a web UI for users to manage their AfterLink endpoints
4. **Billing** — Charge based on connections, messages, or bandwidth

```javascript
// Multi-tenant routing
server.on('connect', async (req, res) => {
  const projectId = req.auth.projectId;
  const backend = getBackendForProject(projectId);

  // Proxy the connection to the user's backend
  const proxy = net.connect(backend.port, backend.host);
  proxy.pipe(req.socket);
  req.socket.pipe(proxy);
});
```

---

## Troubleshooting

### Connection Refused

```bash
# Check if server is running
pm2 status

# Check port is open
netstat -tlnp | grep 4000

# Check firewall
ufw status
```

### High Memory Usage

```bash
# Check memory per connection
# Each connection uses ~50KB idle
# 10,000 connections = ~500MB

# Monitor with PM2
pm2 monit

# Check for memory leaks
node --inspect server.js
# Open chrome://inspect in Chrome
```

### Connection Drops

```bash
# Check system limits
ulimit -n          # File descriptors (should be > 65536)
cat /proc/sys/net/ipv4/tcp_keepalive_time

# Increase limits
echo "fs.file-max = 1000000" >> /etc/sysctl.conf
echo "net.core.somaxconn = 65535" >> /etc/sysctl.conf
sysctl -p
```

---

## Support

- **GitHub Issues:** [github.com/AJAYMYTH/AfterLink/issues](https://github.com/AJAYMYTH/AfterLink/issues)
- **Documentation:** See README.md and protocol spec files
- **License:** MIT
