import { describe, it, expect } from 'vitest';
import { computeHealthStatus, buildHealthResponse } from '../../src/health/status.js';

describe('computeHealthStatus', () => {
  it('returns healthy for running server with low error rate', () => {
    const stats = {
      connections: 100,
      errorRate: 0.01,
    };
    const result = computeHealthStatus(stats, 'running', { maxConnections: 10000 });
    expect(result.status).toBe('healthy');
    expect(result.httpStatus).toBe(200);
    expect(result.reason).toBeNull();
  });

  it('returns unhealthy for closing server', () => {
    const stats = { connections: 0, errorRate: 0 };
    const result = computeHealthStatus(stats, 'closing', { maxConnections: 10000 });
    expect(result.status).toBe('unhealthy');
    expect(result.httpStatus).toBe(503);
    expect(result.reason).toBe('Server is shutting down');
  });

  it('returns unhealthy for closed server', () => {
    const stats = { connections: 0, errorRate: 0 };
    const result = computeHealthStatus(stats, 'closed', { maxConnections: 10000 });
    expect(result.status).toBe('unhealthy');
    expect(result.httpStatus).toBe(503);
  });

  it('returns degraded for high error rate', () => {
    const stats = {
      connections: 100,
      errorRate: 0.08,
    };
    const result = computeHealthStatus(stats, 'running', { maxConnections: 10000 });
    expect(result.status).toBe('degraded');
    expect(result.httpStatus).toBe(200);
    expect(result.reason).toContain('Error rate');
  });

  it('returns degraded for high connection utilization', () => {
    const stats = {
      connections: 9500,
      errorRate: 0.01,
    };
    const result = computeHealthStatus(stats, 'running', { maxConnections: 10000 });
    expect(result.status).toBe('degraded');
    expect(result.httpStatus).toBe(200);
    expect(result.reason).toContain('Connection utilization');
  });

  it('returns degraded for both high error rate and high utilization', () => {
    const stats = {
      connections: 9500,
      errorRate: 0.08,
    };
    const result = computeHealthStatus(stats, 'running', { maxConnections: 10000 });
    expect(result.status).toBe('degraded');
    expect(result.reason).toContain('Error rate');
    expect(result.reason).toContain('Connection utilization');
  });

  it('uses custom thresholds', () => {
    const stats = {
      connections: 500,
      errorRate: 0.02,
    };
    const result = computeHealthStatus(stats, 'running', {
      maxConnections: 1000,
      errorRateThreshold: 0.01,
      connectionUtilizationThreshold: 0.4,
    });
    expect(result.status).toBe('degraded');
  });
});

describe('buildHealthResponse', () => {
  const stats = {
    uptime: 3600,
    connections: 50,
    maxConnections: 10000,
    totalRequests: 100000,
    requestsPerSec: 27.78,
    avgLatencyMs: 1.5,
    errorRate: 0.001,
    routes: [
      { name: 'ping', totalCalls: 50000, avgLatencyMs: 0.5, errorRate: 0 },
    ],
    rateLimit: { enabled: true, requestsPerSecond: 100 },
  };

  it('builds full health response', () => {
    const healthInfo = { status: 'healthy', reason: null, httpStatus: 200 };
    const body = buildHealthResponse(stats, healthInfo, {
      connections: true,
      memory: true,
      uptime: true,
      routes: true,
      rateLimit: true,
    });

    expect(body.status).toBe('healthy');
    expect(body.version).toBe('1.2.4');
    expect(body.protocol).toBe('AL/1.1');
    expect(body.uptime).toBe(3600);
    expect(body.connections.active).toBe(50);
    expect(body.connections.max).toBe(10000);
    expect(body.requests.total).toBe(100000);
    expect(body.routes).toHaveLength(1);
    expect(body.memory).toBeDefined();
    expect(body.rateLimit).toBeDefined();
  });

  it('excludes fields when include flags are false', () => {
    const healthInfo = { status: 'healthy', reason: null, httpStatus: 200 };
    const body = buildHealthResponse(stats, healthInfo, {
      connections: false,
      memory: false,
      uptime: false,
      routes: false,
      rateLimit: false,
    });

    expect(body.connections).toBeUndefined();
    expect(body.memory).toBeUndefined();
    expect(body.uptime).toBeUndefined();
    expect(body.routes).toBeUndefined();
    expect(body.rateLimit).toBeUndefined();
    expect(body.requests).toBeDefined();
  });

  it('includes reason for degraded status', () => {
    const healthInfo = { status: 'degraded', reason: 'High error rate', httpStatus: 200 };
    const body = buildHealthResponse(stats, healthInfo, {});
    expect(body.reason).toBe('High error rate');
  });

  it('includes reason for unhealthy status', () => {
    const healthInfo = { status: 'unhealthy', reason: 'Server is shutting down', httpStatus: 503 };
    const body = buildHealthResponse(stats, healthInfo, {});
    expect(body.status).toBe('unhealthy');
    expect(body.reason).toBe('Server is shutting down');
  });
});
