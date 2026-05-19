const { AfterLinkError } = require('./AfterLinkError');

class ConnectionError extends AfterLinkError {
  constructor({ code, message, httpStatus = 503, details, requestId, cause }) {
    super({ code, message, category: 'connection', httpStatus, details, requestId, cause });
    this.name = 'ConnectionError';
  }
}

class ConnectionRefusedError extends ConnectionError {
  constructor(message = 'Connection refused', options = {}) {
    super({ code: 'CONNECTION_REFUSED', message, ...options });
    this.name = 'ConnectionRefusedError';
  }
}

class ConnectionTimeoutError extends ConnectionError {
  constructor(host, port, options = {}) {
    super({
      code: 'CONNECTION_TIMEOUT',
      message: `Connection to ${host}:${port} timed out`,
      httpStatus: 408,
      details: { host, port },
      ...options,
    });
    this.name = 'ConnectionTimeoutError';
  }
}

class ConnectionResetError extends ConnectionError {
  constructor(message = 'Connection was unexpectedly reset', options = {}) {
    super({ code: 'CONNECTION_RESET', message, ...options });
    this.name = 'ConnectionResetError';
  }
}

class TLSHandshakeFailedError extends ConnectionError {
  constructor(message = 'TLS handshake failed', options = {}) {
    super({ code: 'TLS_HANDSHAKE_FAILED', message, httpStatus: 525, ...options });
    this.name = 'TLSHandshakeFailedError';
  }
}

class TLSCertInvalidError extends ConnectionError {
  constructor(message = 'TLS certificate is untrusted or expired', options = {}) {
    super({ code: 'TLS_CERT_INVALID', message, httpStatus: 526, ...options });
    this.name = 'TLSCertInvalidError';
  }
}

module.exports = {
  ConnectionError,
  ConnectionRefusedError,
  ConnectionTimeoutError,
  ConnectionResetError,
  TLSHandshakeFailedError,
  TLSCertInvalidError,
};
