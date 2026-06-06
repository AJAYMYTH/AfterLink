const { errors: { RateLimitError } } = require('@ajaymyth/core');

class TokenBucket {
  constructor(capacity, refillRate) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefill = Date.now();
    this.violations = 0;
  }

  consume() {
    this._refill();
    if (this.tokens < 1) {
      this.violations++;
      return {
        allowed: false,
        retryAfter: Math.ceil((1 - this.tokens) / this.refillRate),
      };
    }
    this.tokens--;
    return { allowed: true, retryAfter: 0 };
  }

  _refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

function createRateLimitMiddleware(options = {}) {
  const {
    enabled = false,
    requestsPerSecond = 100,
    burstSize = 200,
    closeAfterViolations = null,
    errorMessage = 'Rate limit exceeded. Please slow down.',
    onLimited = null,
  } = options;

  if (!enabled) {
    return null;
  }

  const refillRatePerMs = requestsPerSecond / 1000;

  return function rateLimitMiddleware(req, next) {
    const bucket = req.connection._rateBucket;
    if (!bucket) {
      return next();
    }

    const result = bucket.consume();

    if (!result.allowed) {
      const closeConnection = closeAfterViolations && bucket.violations >= closeAfterViolations;

      if (onLimited) {
        try {
          onLimited(req.connection);
        } catch {
          // Ignore callback errors
        }
      }

      throw RateLimitError.create({
        retryAfter: result.retryAfter,
        limit: requestsPerSecond,
        remaining: 0,
        closeConnection,
        message: errorMessage,
      });
    }

    return next();
  };
}

module.exports = { TokenBucket, createRateLimitMiddleware };
