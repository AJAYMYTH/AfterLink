const { AfterLinkError, ERROR_CATEGORIES, isErrorCategory } = require('./AfterLinkError');

const {
  ProtocolError,
  InvalidFrameError,
  UnsupportedVersionError,
  MalformedPayloadError,
  UnknownFrameTypeError,
} = require('./ProtocolError');

const {
  AuthError,
  AuthRequiredError,
  AuthFailedError,
  AuthExpiredError,
  AuthInsufficientPermissionsError,
} = require('./AuthError');

const {
  RouteError,
  RouteNotFoundError,
  RouteHandlerError,
  RouteTimeoutError,
} = require('./RouteError');

const { ValidationError } = require('./ValidationError');
const { RateLimitError } = require('./RateLimitError');

const {
  ConnectionError,
  ConnectionRefusedError,
  ConnectionTimeoutError,
  ConnectionResetError,
  TLSHandshakeFailedError,
  TLSCertInvalidError,
} = require('./ConnectionError');

const {
  ServerError,
  InternalServerErrorError,
  ServerShuttingDownError,
} = require('./ServerError');

const {
  CompressionError,
  DecompressionFailedError,
  CompressionAlgorithmUnsupportedError,
} = require('./CompressionError');

function fromError(err, fallback = {}) {
  if (err instanceof AfterLinkError) return err;

  if (err.code === 'RATE_LIMITED') {
    return RateLimitError.create({
      retryAfter: err.retryAfter,
      limit: err.limit,
      remaining: err.remaining,
      closeConnection: err.closeConnection,
      message: err.message,
      requestId: fallback.requestId,
    });
  }

  return new InternalServerErrorError(err.message || 'Unknown error', {
    cause: err,
    requestId: fallback.requestId,
  });
}

function fromFramePayload(payload, messageId) {
  try {
    const Serializer = require('../Serializer');
    const data = Serializer.decode(payload);

    if (data.code && data.message && data.category) {
      const errorClass = getErrorClassByCode(data.code);
      if (errorClass) {
        const err = new errorClass({
          code: data.code,
          message: data.message,
          details: data.details,
          requestId: data.requestId || messageId,
        });
        err.httpStatus = data.httpStatus || err.httpStatus;
        return err;
      }
    }

    if (data.code && data.message) {
      return new AfterLinkError({
        code: data.code,
        message: data.message,
        category: data.category || 'server',
        httpStatus: data.httpStatus || 500,
        details: data.details,
        requestId: data.requestId || messageId,
      });
    }

    return new AfterLinkError({
      code: data.code || 'UNKNOWN_ERROR',
      message: data.message || 'Unknown server error',
      category: 'server',
      httpStatus: 500,
      requestId: messageId,
    });
  } catch {
    return new AfterLinkError({
      code: 'UNKNOWN_ERROR',
      message: 'Unknown server error',
      category: 'server',
      httpStatus: 500,
      requestId: messageId,
    });
  }
}

function getErrorClassByCode(code) {
  const map = {
    INVALID_FRAME: InvalidFrameError,
    UNSUPPORTED_VERSION: UnsupportedVersionError,
    MALFORMED_PAYLOAD: MalformedPayloadError,
    UNKNOWN_FRAME_TYPE: UnknownFrameTypeError,
    AUTH_REQUIRED: AuthRequiredError,
    AUTH_FAILED: AuthFailedError,
    AUTH_EXPIRED: AuthExpiredError,
    AUTH_INSUFFICIENT_PERMISSIONS: AuthInsufficientPermissionsError,
    ROUTE_NOT_FOUND: RouteNotFoundError,
    ROUTE_HANDLER_ERROR: RouteHandlerError,
    ROUTE_TIMEOUT: RouteTimeoutError,
    VALIDATION_ERROR: ValidationError,
    RATE_LIMITED: RateLimitError,
    CONNECTION_REFUSED: ConnectionRefusedError,
    CONNECTION_TIMEOUT: ConnectionTimeoutError,
    CONNECTION_RESET: ConnectionResetError,
    TLS_HANDSHAKE_FAILED: TLSHandshakeFailedError,
    TLS_CERT_INVALID: TLSCertInvalidError,
    INTERNAL_SERVER_ERROR: InternalServerErrorError,
    SERVER_SHUTTING_DOWN: ServerShuttingDownError,
    DECOMPRESSION_FAILED: DecompressionFailedError,
    COMPRESSION_ALGORITHM_UNSUPPORTED: CompressionAlgorithmUnsupportedError,
  };
  return map[code] || null;
}

module.exports = {
  AfterLinkError,
  ERROR_CATEGORIES,
  isErrorCategory,
  ProtocolError,
  InvalidFrameError,
  UnsupportedVersionError,
  MalformedPayloadError,
  UnknownFrameTypeError,
  AuthError,
  AuthRequiredError,
  AuthFailedError,
  AuthExpiredError,
  AuthInsufficientPermissionsError,
  RouteError,
  RouteNotFoundError,
  RouteHandlerError,
  RouteTimeoutError,
  ValidationError,
  RateLimitError,
  ConnectionError,
  ConnectionRefusedError,
  ConnectionTimeoutError,
  ConnectionResetError,
  TLSHandshakeFailedError,
  TLSCertInvalidError,
  ServerError,
  InternalServerErrorError,
  ServerShuttingDownError,
  CompressionError,
  DecompressionFailedError,
  CompressionAlgorithmUnsupportedError,
  fromError,
  fromFramePayload,
  getErrorClassByCode,
};
