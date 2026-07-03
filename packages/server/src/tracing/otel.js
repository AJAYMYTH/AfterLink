const { AsyncLocalStorage } = require('async_hooks');

/**
 * Custom Span implementation matching OpenTelemetry Span interface.
 */
class Span {
  constructor(name, attributes = {}, kind = 'INTERNAL', manager = null) {
    this.name = name;
    this.kind = kind;
    this.startTime = Date.now();
    this.endTime = 0;
    this.duration = 0;
    this.attributes = { ...attributes };
    this.status = 'OK';
    this.children = [];
    this.manager = manager;
  }

  setAttribute(key, value) {
    this.attributes[key] = value;
    return this;
  }

  setStatus(status) {
    if (status === 'OK' || status === 'ERROR') {
      this.status = status;
    }
    return this;
  }

  end() {
    this.endTime = Date.now();
    this.duration = (this.endTime - this.startTime) / 1000;
    if (this.manager) {
      this.manager.exportSpan(this);
    }
  }
}

/**
 * TracingManager handles context propagation, sampling, and exporting.
 */
class TracingManager {
  constructor(config = {}) {
    this.config = {
      enabled: false,
      serviceName: 'afterlink-server',
      serviceVersion: '2.0.0',
      exporter: { type: 'console', endpoint: '' },
      sampleRate: 1.0,
      propagateContext: true,
      ...config
    };
    this.storage = new AsyncLocalStorage();
    this.exportedSpans = []; // Useful for unit testing
  }

  startSpan(name, attributes = {}, kind = 'INTERNAL') {
    if (!this.config.enabled) {
      return new Span(name, attributes, kind, null);
    }

    const sampled = Math.random() < this.config.sampleRate;
    if (!sampled) {
      return new Span(name, attributes, kind, null);
    }

    const parentSpan = this.getActiveSpan();
    const span = new Span(name, attributes, kind, this);

    if (parentSpan) {
      parentSpan.children.push(span);
    }

    return span;
  }

  runWithSpan(span, fn) {
    return this.storage.run(span, fn);
  }

  getActiveSpan() {
    return this.storage.getStore() || null;
  }

  exportSpan(span) {
    this.exportedSpans.push(span);
    
    // Only log top-level root spans when they complete
    const isRoot = !this.storage.getStore() || this.storage.getStore() === span;
    if (this.config.exporter.type === 'console') {
      const msg = `[AfterLink Trace] Span End: ${span.name} (${span.duration}s) status=${span.status} attributes=${JSON.stringify(span.attributes)}`;
      console.log(msg);
    }
    // Placeholder OTLP HTTP post exporter
    if (this.config.exporter.type === 'otlp') {
      // send to this.config.exporter.endpoint
    }
  }
}

module.exports = {
  Span,
  TracingManager
};
