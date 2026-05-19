const { AfterLinkError } = require('./AfterLinkError');

class AuthError extends AfterLinkError {
  constructor({ code, message, httpStatus = 401, details, requestId, cause }) {
    super({ code, message, category: 'auth', httpStatus, details, requestId, cause });
    this.name = 'AuthError';
  }
}

class AuthRequiredError extends AuthError {
  constructor(message = 'Authentication required', options = {}) {
    super({ code: 'AUTH_REQUIRED', message, ...options });
    this.name = 'AuthRequiredError';
  }
}

class AuthFailedError extends AuthError {
  constructor(message = 'Authentication failed', options = {}) {
    super({ code: 'AUTH_FAILED', message, ...options });
    this.name = 'AuthFailedError';
  }
}

class AuthExpiredError extends AuthError {
  constructor(message = 'Authentication token has expired', options = {}) {
    super({ code: 'AUTH_EXPIRED', message, ...options });
    this.name = 'AuthExpiredError';
  }
}

class AuthInsufficientPermissionsError extends AuthError {
  constructor(message = 'Insufficient permissions', options = {}) {
    super({ code: 'AUTH_INSUFFICIENT_PERMISSIONS', message, httpStatus: 403, ...options });
    this.name = 'AuthInsufficientPermissionsError';
  }
}

module.exports = {
  AuthError,
  AuthRequiredError,
  AuthFailedError,
  AuthExpiredError,
  AuthInsufficientPermissionsError,
};
