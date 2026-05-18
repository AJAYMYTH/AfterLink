import { describe, it, expect } from 'vitest';
import { TokenBucket } from '../src/middleware/rate-limit.js';

describe('TokenBucket', () => {
  it('allows requests up to capacity', () => {
    const bucket = new TokenBucket(10, 10); // 10 capacity, 10 tokens/sec
    for (let i = 0; i < 10; i++) {
      const result = bucket.consume();
      expect(result.allowed).toBe(true);
    }
  });

  it('rejects requests after capacity is exhausted', () => {
    const bucket = new TokenBucket(5, 5); // 5 capacity, 5 tokens/sec
    for (let i = 0; i < 5; i++) {
      bucket.consume();
    }
    const result = bucket.consume();
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('refills tokens over time', async () => {
    const bucket = new TokenBucket(5, 100); // 5 capacity, 100 tokens/sec
    for (let i = 0; i < 5; i++) {
      bucket.consume();
    }

    // Wait 50ms - should refill ~5 tokens
    await new Promise((resolve) => setTimeout(resolve, 50));

    const result = bucket.consume();
    expect(result.allowed).toBe(true);
  });

  it('tracks violations', () => {
    const bucket = new TokenBucket(1, 1);
    bucket.consume(); // Use the token
    bucket.consume(); // Violation 1
    bucket.consume(); // Violation 2

    expect(bucket.violations).toBe(2);
  });

  it('retryAfter calculation is accurate', () => {
    const bucket = new TokenBucket(1, 10); // 10 tokens/sec = 0.01 tokens/ms
    bucket.consume(); // Use the token
    // Immediately consume again - tokens haven't refilled yet
    const result = bucket.consume();

    expect(result.allowed).toBe(false);
    // retryAfter = ceil((1 - 0) / 0.01) = 100ms
    // But since some ms have passed, it will be slightly less
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(100);
  });
});
