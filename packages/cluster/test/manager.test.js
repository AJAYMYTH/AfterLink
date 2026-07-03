import { describe, it, expect, vi, beforeEach } from 'vitest';
import ClusterManager from '../src/manager';

describe('ClusterManager', () => {
  let manager;

  beforeEach(() => {
    manager = new ClusterManager({ workers: 2 });
  });

  it('aggregates stats correctly from multiple workers', () => {
    manager.workerStats.set(1001, {
      connections: 5,
      totalRequests: 100,
      requestsPerSec: 10,
      avgLatencyMs: 12.5,
      errorRate: 0.02,
      routes: [
        { name: 'users/get', totalCalls: 80, avgLatencyMs: 10, errorRate: 0.01 },
        { name: 'users/create', totalCalls: 20, avgLatencyMs: 22.5, errorRate: 0.06 }
      ]
    });

    manager.workerStats.set(1002, {
      connections: 3,
      totalRequests: 50,
      requestsPerSec: 5,
      avgLatencyMs: 15.0,
      errorRate: 0.04,
      routes: [
        { name: 'users/get', totalCalls: 40, avgLatencyMs: 12, errorRate: 0.02 },
        { name: 'users/create', totalCalls: 10, avgLatencyMs: 27.0, errorRate: 0.12 }
      ]
    });

    const aggregated = manager.getAggregatedStats();

    expect(aggregated.workers).toBe(2);
    expect(aggregated.connections).toBe(8);
    expect(aggregated.totalRequests).toBe(150);
    expect(aggregated.requestsPerSec).toBe(15);
    expect(aggregated.avgLatencyMs).toBe(13.75); // (12.5 + 15.0) / 2
    expect(aggregated.errorRate).toBe(0.03); // (0.02 + 0.04) / 2

    const getRoute = aggregated.routes.find(r => r.name === 'users/get');
    expect(getRoute).toBeDefined();
    expect(getRoute.totalCalls).toBe(120);
    expect(getRoute.avgLatencyMs).toBe(10.67);
    expect(getRoute.errorRate).toBe(0.0133);
  });
});
