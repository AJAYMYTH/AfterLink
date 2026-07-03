import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MetricsRegistry from '../src/metrics/prometheus';
import http from 'http';

describe('MetricsRegistry (Prometheus)', () => {
  let registry;

  beforeEach(() => {
    registry = new MetricsRegistry({ env: 'test' });
  });

  afterEach(async () => {
    await registry.close();
  });

  it('registers all default metrics', () => {
    const text = registry.getMetricsText();
    expect(text).toContain('# HELP afterlink_connections_active');
    expect(text).toContain('# TYPE afterlink_connections_active gauge');
    expect(text).toContain('# HELP afterlink_requests_total');
    expect(text).toContain('# TYPE afterlink_requests_total counter');
  });

  it('increments counters correctly', () => {
    registry.recordRequest('users/get', 0.05, 'success');
    registry.recordRequest('users/get', 0.12, 'success');
    registry.recordRequest('users/create', 0.5, 'error', 'VALIDATION_ERROR');

    const text = registry.getMetricsText();
    expect(text).toContain('afterlink_requests_total{env="test",error_code="",route="users/get",status="success"} 2');
    expect(text).toContain('afterlink_requests_total{env="test",error_code="VALIDATION_ERROR",route="users/create",status="error"} 1');
    expect(text).toContain('afterlink_request_errors_total{env="test",error_code="VALIDATION_ERROR"} 1');
  });

  it('observes histograms with correct buckets', () => {
    registry.recordRequest('users/get', 0.003, 'success');
    const text = registry.getMetricsText();
    
    expect(text).toContain('afterlink_request_duration_seconds_bucket{env="test",route="users/get",le="0.005"} 1');
    expect(text).toContain('afterlink_request_duration_seconds_sum{env="test",route="users/get"} 0.003');
    expect(text).toContain('afterlink_request_duration_seconds_count{env="test",route="users/get"} 1');
  });

  it('starts HTTP server and serves metrics', async () => {
    await registry.startServer(9099, '/metrics', 'test-token');

    const fetchMetrics = () => new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 9099,
        path: '/metrics',
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-token'
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      req.on('error', reject);
      req.end();
    });

    const res = await fetchMetrics();
    expect(res.status).toBe(200);
    expect(res.data).toContain('# HELP afterlink_requests_total');
  });
});
