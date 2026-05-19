const { AfterLinkError } = require('./AfterLinkError');

class ValidationError extends AfterLinkError {
  constructor({ message, details, requestId, cause }) {
    super({
      code: 'VALIDATION_ERROR',
      message: message || 'Validation failed',
      category: 'validation',
      httpStatus: 422,
      details,
      requestId,
      cause,
    });
    this.name = 'ValidationError';
  }

  static fromZodError(zodError, options = {}) {
    const issues = (zodError.errors || []).map((issue) => ({
      field: issue.path?.join('.') || issue.path?.[0] || 'unknown',
      message: issue.message,
      code: issue.code,
      path: issue.path || [],
    }));

    return new ValidationError({
      message: issues[0]?.message || 'Validation failed',
      details: { issues },
      ...options,
    });
  }
}

module.exports = { ValidationError };
