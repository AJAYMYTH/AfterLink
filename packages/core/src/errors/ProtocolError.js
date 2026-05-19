const { AfterLinkError } = require('./AfterLinkError');

class ProtocolError extends AfterLinkError {
  constructor({ code, message, httpStatus = 400, details, requestId, cause }) {
    super({ code, message, category: 'protocol', httpStatus, details, requestId, cause });
    this.name = 'ProtocolError';
  }
}

class InvalidFrameError extends ProtocolError {
  constructor(message, options = {}) {
    super({ code: 'INVALID_FRAME', message, ...options });
    this.name = 'InvalidFrameError';
  }
}

class UnsupportedVersionError extends ProtocolError {
  constructor(message, options = {}) {
    super({ code: 'UNSUPPORTED_VERSION', message, httpStatus: 426, ...options });
    this.name = 'UnsupportedVersionError';
  }
}

class MalformedPayloadError extends ProtocolError {
  constructor(message, options = {}) {
    super({ code: 'MALFORMED_PAYLOAD', message, ...options });
    this.name = 'MalformedPayloadError';
  }
}

class UnknownFrameTypeError extends ProtocolError {
  constructor(message, options = {}) {
    super({ code: 'UNKNOWN_FRAME_TYPE', message, ...options });
    this.name = 'UnknownFrameTypeError';
  }
}

module.exports = {
  ProtocolError,
  InvalidFrameError,
  UnsupportedVersionError,
  MalformedPayloadError,
  UnknownFrameTypeError,
};
