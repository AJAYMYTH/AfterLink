const { AfterLinkError } = require('./AfterLinkError');

class RateLimitError extends AfterLinkError {
  constructor({ message, details, requestId, cause }) {
    super({
      code: 'RATE_LIMITED',
      message: message || 'Rate limit exceeded',
      category: 'rate_limit',
      httpStatus: 429,
      details,
      requestId,
      cause,
    });
    this.name = 'RateLimitError';
  }

  static create({ retryAfter, limit, remaining, closeConnection = false, message, requestId }) {
    return new RateLimitError({
      message: message || `Rate limit exceeded. Retry after ${retryAfter}ms`,
      details: { retryAfter, limit, remaining, closeConnection },
      requestId,
    });
  }
}

module.exports = { RateLimitError };
