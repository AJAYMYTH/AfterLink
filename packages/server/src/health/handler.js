const { computeHealthStatus, buildHealthResponse } = require('./status');

function handleHealthRequest(socket, firstChunk, server, config, serverState) {
  const path = extractPath(firstChunk);
  const headers = parseHeaders(firstChunk);

  if (config.token) {
    const authHeader = headers['authorization'] || '';
    if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== config.token) {
      writeHttpResponse(socket, 401, 'Unauthorized', { error: 'Invalid or missing authentication token' });
      return;
    }
  }

  const include = config.include || {
    connections: true,
    memory: true,
    uptime: true,
    routes: true,
    rateLimit: true,
  };

  const stats = server.getStats ? server.getStats() : {
    uptime: 0,
    connections: 0,
    totalRequests: 0,
    requestsPerSec: 0,
    avgLatencyMs: 0,
    errorRate: 0,
    routes: [],
  };

  const healthConfig = {
    errorRateThreshold: 0.05,
    connectionUtilizationThreshold: 0.9,
    maxConnections: server.config?.maxConnections || 10000,
  };

  switch (path) {
    case '/__health/live': {
      const alive = serverState === 'running' || serverState === 'listening';
      writeHttpResponse(socket, alive ? 200 : 503, alive ? 'OK' : 'Service Unavailable', { alive });
      break;
    }
    case '/__health/ready': {
      const ready = serverState === 'running' || serverState === 'listening';
      if (!ready) {
        writeHttpResponse(socket, 503, 'Service Unavailable', {
          status: 'unhealthy',
          reason: 'Server is shutting down',
          ready: false,
        });
      } else {
        writeHttpResponse(socket, 200, 'OK', { ready: true });
      }
      break;
    }
    case '/__health/stats': {
      const rawStats = { ...stats };
      writeHttpResponse(socket, 200, 'OK', rawStats);
      break;
    }
    case '/__health':
    default: {
      const healthInfo = computeHealthStatus(stats, serverState, healthConfig);
      const body = buildHealthResponse(stats, healthInfo, include);
      writeHttpResponse(socket, healthInfo.httpStatus, healthInfo.httpStatus === 200 ? 'OK' : 'Service Unavailable', body);
      break;
    }
  }
}

function extractPath(chunk) {
  const str = chunk.toString('ascii', 0, Math.min(chunk.length, 512));
  const match = str.match(/^GET\s+(\S+)/);
  return match ? match[1].split('?')[0] : '/';
}

function parseHeaders(chunk) {
  const str = chunk.toString('ascii', 0, Math.min(chunk.length, 2048));
  const headers = {};
  const lines = str.split('\r\n');
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '') break;
    const colonIdx = lines[i].indexOf(':');
    if (colonIdx > 0) {
      const key = lines[i].slice(0, colonIdx).toLowerCase().trim();
      const value = lines[i].slice(colonIdx + 1).trim();
      headers[key] = value;
    }
  }
  return headers;
}

function writeHttpResponse(socket, statusCode, statusText, body) {
  const bodyStr = JSON.stringify(body);
  const bodyBuf = Buffer.from(bodyStr, 'utf8');

  const head =
    `HTTP/1.1 ${statusCode} ${statusText}\r\n` +
    `Content-Type: application/json\r\n` +
    `Content-Length: ${bodyBuf.length}\r\n` +
    `Cache-Control: no-cache\r\n` +
    `Connection: close\r\n` +
    `\r\n`;

  socket.write(Buffer.concat([Buffer.from(head, 'ascii'), bodyBuf]));
  socket.end();
}

module.exports = { handleHealthRequest };
