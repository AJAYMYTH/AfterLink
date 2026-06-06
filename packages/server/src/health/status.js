function computeHealthStatus(stats, serverState, config = {}) {
  const {
    errorRateThreshold = 0.05,
    connectionUtilizationThreshold = 0.9,
  } = config;

  if (serverState === 'closing' || serverState === 'closed') {
    return {
      status: 'unhealthy',
      reason: 'Server is shutting down',
      httpStatus: 503,
    };
  }

  const reasons = [];

  if (stats.errorRate >= errorRateThreshold) {
    reasons.push(`Error rate above threshold (${(stats.errorRate * 100).toFixed(1)}%)`);
  }

  const maxConnections = config.maxConnections || 10000;
  const utilization = stats.connections / maxConnections;
  if (utilization >= connectionUtilizationThreshold) {
    reasons.push(`Connection utilization high (${(utilization * 100).toFixed(1)}%)`);
  }

  if (reasons.length > 0) {
    return {
      status: 'degraded',
      reason: reasons.join('; '),
      httpStatus: 200,
    };
  }

  return {
    status: 'healthy',
    reason: null,
    httpStatus: 200,
  };
}

function buildHealthResponse(stats, healthInfo, include = {}) {
  const {
    connections = true,
    memory = true,
    uptime = true,
    routes = true,
    rateLimit = true,
  } = include;

  const response = {
    status: healthInfo.status,
    version: '1.2.4',
    protocol: 'AL/1.1',
    timestamp: new Date().toISOString(),
  };

  if (healthInfo.reason) {
    response.reason = healthInfo.reason;
  }

  if (uptime) {
    response.uptime = stats.uptime;
  }

  if (connections) {
    const maxConnections = stats.maxConnections || 10000;
    response.connections = {
      active: stats.connections,
      max: maxConnections,
      utilizationPct: parseFloat((stats.connections / maxConnections).toFixed(4)),
    };
  }

  if (memory) {
    const mem = process.memoryUsage();
    response.memory = {
      heapUsedMB: parseFloat((mem.heapUsed / 1024 / 1024).toFixed(2)),
      heapTotalMB: parseFloat((mem.heapTotal / 1024 / 1024).toFixed(2)),
      rssMB: parseFloat((mem.rss / 1024 / 1024).toFixed(2)),
    };
  }

  response.requests = {
    total: stats.totalRequests || 0,
    perSecond: stats.requestsPerSec || 0,
    avgLatencyMs: parseFloat((stats.avgLatencyMs || 0).toFixed(2)),
    errorRatePct: parseFloat(((stats.errorRate || 0) * 100).toFixed(2)),
  };

  if (rateLimit && stats.rateLimit) {
    response.rateLimit = stats.rateLimit;
  }

  if (routes && stats.routes) {
    response.routes = stats.routes;
  }

  return response;
}

module.exports = { computeHealthStatus, buildHealthResponse };
