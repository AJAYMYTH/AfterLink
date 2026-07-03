import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TracingManager } from '../src/tracing/otel';

describe('TracingManager (OpenTelemetry)', () => {
  let tracingManager;

  beforeEach(() => {
    tracingManager = new TracingManager({
      enabled: true,
      serviceName: 'test-service',
      exporter: { type: 'console' }
    });
  });

  it('creates spans with correct attributes and status', () => {
    const span = tracingManager.startSpan('test-span', { foo: 'bar' }, 'SERVER');
    
    expect(span.name).toBe('test-span');
    expect(span.kind).toBe('SERVER');
    expect(span.attributes.foo).toBe('bar');
    expect(span.status).toBe('OK');
    
    span.setAttribute('baz', 'qux');
    span.setStatus('ERROR');
    span.end();
    
    expect(span.attributes.baz).toBe('qux');
    expect(span.status).toBe('ERROR');
    expect(span.endTime).toBeGreaterThan(0);
    expect(span.duration).toBeGreaterThanOrEqual(0);
    expect(tracingManager.exportedSpans).toContain(span);
  });

  it('maintains active span context and children hierarchy', () => {
    const parent = tracingManager.startSpan('parent-span');
    
    tracingManager.runWithSpan(parent, () => {
      expect(tracingManager.getActiveSpan()).toBe(parent);
      
      const child = tracingManager.startSpan('child-span');
      expect(parent.children).toContain(child);
      
      tracingManager.runWithSpan(child, () => {
        expect(tracingManager.getActiveSpan()).toBe(child);
      });
      
      child.end();
    });
    
    parent.end();
    
    expect(parent.children.length).toBe(1);
    expect(parent.children[0].name).toBe('child-span');
  });

  it('respects sampleRate', () => {
    const unsampledManager = new TracingManager({
      enabled: true,
      sampleRate: 0.0
    });
    
    const span = unsampledManager.startSpan('unsampled-span');
    span.end();
    
    expect(unsampledManager.exportedSpans.length).toBe(0);
  });
});
