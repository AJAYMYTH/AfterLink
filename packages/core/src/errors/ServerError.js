const { AfterLinkError } = require('./AfterLinkError');

class ServerError extends AfterLinkError {
  constructor({ code, message, httpStatus = 500, details, requestId, cause }) {
    super({ code, message, category: 'server', httpStatus, details, requestId, cause });
    this.name = 'ServerError';
  }
}

class InternalServerErrorError extends ServerError {
  constructor(message = 'Internal server error', options = {}) {
    super({ code: 'INTERNAL_SERVER_ERROR', message, ...options });
    this.name = 'InternalServerErrorError';
  }
}

class ServerShuttingDownError extends ServerError {
  constructor(message = 'Server is shutting down', options = {}) {
    super({ code: 'SERVER_SHUTTING_DOWN', message, httpStatus: 503, ...options });
    this.name = 'ServerShuttingDownError';
  }
}

module.exports = {
  ServerError,
  InternalServerErrorError,
  ServerShuttingDownError,
};
