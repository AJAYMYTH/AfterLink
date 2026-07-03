const http = require('http');

/**
 * Self-contained MetricsRegistry implementing the Prometheus text format exposition.
 * Eliminates the need for the external prom-client package.
 */
class MetricsRegistry {
  constructor(customLabels = {}) {
    this.customLabels = customLabels;
    this.metrics = new Map();
    this.server = null;
    this.initDefaultMetrics();
  }

  initDefaultMetrics() {
    this.registerGauge('afterlink_connections_active', 'Active TCP or WebSocket connections', ['transport']);
    this.registerCounter('afterlink_connections_total', 'Total established TCP or WebSocket connections', ['transport']);
    this.registerCounter('afterlink_connections_refused_total', 'Total refused TCP or WebSocket connections due to limits', ['reason']);
    
    this.registerCounter('afterlink_requests_total', 'Total requests processed', ['route', 'status', 'error_code']);
    this.registerHistogram('afterlink_request_duration_seconds', 'Request execution latency in seconds', ['route'], [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 5]);
    this.registerCounter('afterlink_request_errors_total', 'Total request errors', ['error_code']);
    
    this.registerGauge('afterlink_pubsub_topics_active', 'Active pub/sub topics', []);
    this.registerGauge('afterlink_pubsub_subscribers_total', 'Active pub/sub subscribers', []);
    this.registerCounter('afterlink_pubsub_messages_total', 'Total pub/sub messages published', ['topic']);
    
    this.registerCounter('afterlink_frame_priority_total', 'Total frames grouped by priority level', ['priority', 'label']);
    this.registerCounter('afterlink_routing_key_requests_total', 'Total requests containing routing key', ['routing_key']);
    
    this.registerGauge('afterlink_cluster_workers', 'Active cluster worker processes', ['status']);
    this.registerHistogram('afterlink_cluster_redis_latency_seconds', 'Redis latency in seconds', [], [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]);
  }

  registerCounter(name, help, labelNames) {
    this.metrics.set(name, {
      type: 'counter',
      help,
      labelNames,
      values: new Map()
    });
  }

  registerGauge(name, help, labelNames) {
    this.metrics.set(name, {
      type: 'gauge',
      help,
      labelNames,
      values: new Map()
    });
  }

  registerHistogram(name, help, labelNames, buckets) {
    this.metrics.set(name, {
      type: 'histogram',
      help,
      labelNames,
      buckets: [...buckets, Infinity],
      values: new Map()
    });
  }

  getLabelKey(labels) {
    const merged = { ...this.customLabels, ...labels };
    if (Object.keys(merged).length === 0) return '';
    return Object.entries(merged)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }

  incrementCounter(name, labels = {}, value = 1) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'counter') return;
    const key = this.getLabelKey(labels);
    const current = metric.values.get(key) || 0;
    metric.values.set(key, current + value);
  }

  setGauge(name, labels = {}, value) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'gauge') return;
    const key = this.getLabelKey(labels);
    metric.values.set(key, value);
  }

  incrementGauge(name, labels = {}, value = 1) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'gauge') return;
    const key = this.getLabelKey(labels);
    const current = metric.values.get(key) || 0;
    metric.values.set(key, current + value);
  }

  observeHistogram(name, labels = {}, value) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'histogram') return;
    const key = this.getLabelKey(labels);
    
    if (!metric.values.has(key)) {
      const bucketCounts = new Map();
      for (const b of metric.buckets) {
        bucketCounts.set(b, 0);
      }
      metric.values.set(key, { sum: 0, count: 0, bucketCounts });
    }

    const data = metric.values.get(key);
    data.sum += value;
    data.count += 1;

    for (const b of metric.buckets) {
      if (value <= b) {
        data.bucketCounts.set(b, data.bucketCounts.get(b) + 1);
      }
    }
  }

  recordRequest(route, durationSec, status, errorCode = '') {
    const labels = { route, status, error_code: errorCode };
    this.incrementCounter('afterlink_requests_total', labels);
    this.observeHistogram('afterlink_request_duration_seconds', { route }, durationSec);
    if (status === 'error') {
      this.incrementCounter('afterlink_request_errors_total', { error_code: errorCode });
    }
  }

  recordConnection(transport, delta) {
    this.incrementGauge('afterlink_connections_active', { transport }, delta);
    if (delta > 0) {
      this.incrementCounter('afterlink_connections_total', { transport });
    }
  }

  recordRefusedConnection(reason) {
    this.incrementCounter('afterlink_connections_refused_total', { reason });
  }

  recordPubSubMessage(topic) {
    this.incrementCounter('afterlink_pubsub_messages_total', { topic });
  }

  recordPriority(priority, label) {
    this.incrementCounter('afterlink_frame_priority_total', { priority: String(priority), label });
  }

  recordRoutingKey(routingKey) {
    this.incrementCounter('afterlink_routing_key_requests_total', { routing_key: routingKey });
  }

  getMetricsText() {
    let lines = [];
    for (const [name, metric] of this.metrics.entries()) {
      lines.push(`# HELP ${name} ${metric.help}`);
      lines.push(`# TYPE ${name} ${metric.type}`);

      if (metric.type === 'counter' || metric.type === 'gauge') {
        if (metric.values.size === 0) {
          // Expose metric with default 0 if no values registered yet
          lines.push(`${name} 0`);
        } else {
          for (const [labelKey, val] of metric.values.entries()) {
            const labelPart = labelKey ? `{${labelKey}}` : '';
            lines.push(`${name}${labelPart} ${val}`);
          }
        }
      } else if (metric.type === 'histogram') {
        if (metric.values.size === 0) {
          lines.push(`${name}_sum 0`);
          lines.push(`${name}_count 0`);
        } else {
          for (const [labelKey, data] of metric.values.entries()) {
            for (const b of metric.buckets) {
              const leStr = b === Infinity ? '+Inf' : String(b);
              const labelPart = labelKey 
                ? `{${labelKey},le="${leStr}"}`
                : `{le="${leStr}"}`;
              lines.push(`${name}_bucket${labelPart} ${data.bucketCounts.get(b)}`);
            }
            const labelPartSumCount = labelKey ? `{${labelKey}}` : '';
            lines.push(`${name}_sum${labelPartSumCount} ${data.sum}`);
            lines.push(`${name}_count${labelPartSumCount} ${data.count}`);
          }
        }
      }
      lines.push('');
    }
    return lines.join('\n');
  }

  startServer(port = 9090, path = '/metrics', authToken = null) {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        if (req.url !== path) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }

        if (authToken) {
          const authHeader = req.headers['authorization'] || '';
          if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== authToken) {
            res.writeHead(401, { 'Content-Type': 'text/plain' });
            res.end('Unauthorized');
            return;
          }
        }

        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
        res.end(this.getMetricsText());
      });

      this.server.listen(port, () => {
        console.log(`[AfterLink Prometheus] Server listening on port ${port} at ${path}`);
        resolve();
      });
    });
  }

  close() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = MetricsRegistry;
