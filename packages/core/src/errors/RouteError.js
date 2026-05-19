const { AfterLinkError } = require('./AfterLinkError');

class RouteError extends AfterLinkError {
  constructor({ code, message, httpStatus = 404, details, requestId, cause }) {
    super({ code, message, category: 'route', httpStatus, details, requestId, cause });
    this.name = 'RouteError';
  }
}

class RouteNotFoundError extends RouteError {
  constructor(route, options = {}) {
    super({
      code: 'ROUTE_NOT_FOUND',
      message: `Route '${route}' not found`,
      details: { route },
      ...options,
    });
    this.name = 'RouteNotFoundError';
  }
}

class RouteHandlerError extends RouteError {
  constructor(message, options = {}) {
    super({ code: 'ROUTE_HANDLER_ERROR', message, httpStatus: 500, ...options });
    this.name = 'RouteHandlerError';
  }
}

class RouteTimeoutError extends RouteError {
  constructor(route, timeoutMs, options = {}) {
    super({
      code: 'ROUTE_TIMEOUT',
      message: `Route '${route}' timed out after ${timeoutMs}ms`,
      httpStatus: 408,
      details: { route, timeoutMs },
      ...options,
    });
    this.name = 'RouteTimeoutError';
  }
}

module.exports = {
  RouteError,
  RouteNotFoundError,
  RouteHandlerError,
  RouteTimeoutError,
};
