enum AfterLinkErrorCode {
  protocolError,
  authRequired,
  authFailed,
  authExpired,
  routeNotFound,
  validationError,
  rateLimited,
  connectionTimeout,
  connectionClosed,
  internalServerError,
  malformedPayload,
  unknownFrameType,
  decompressionFailed,
  tlsCertInvalid,
  frameTooLarge,
  compressionError,
  invalidFrame,
  serverClosing,
  protocolVersionMismatch,
}

class AfterLinkError implements Exception {
  final AfterLinkErrorCode code;
  final String message;
  final Map<String, dynamic>? meta;
  final int? retryAfter;

  AfterLinkError({
    required this.code,
    required this.message,
    this.meta,
    this.retryAfter,
  });

  @override
  String toString() => 'AfterLinkError: [${code.name}] $message';

  factory AfterLinkError.fromMap(Map<String, dynamic> map) {
    final dynamic rawCode = map['code'] ?? 10;
    final String message = map['message'] ?? 'Unknown error';
    final int? retryAfter = map['retry_after'] ?? map['retryAfter'];
    final Map<String, dynamic>? meta = map['meta'];

    // The Node.js SDK (canonical wire format) sends string codes such as
    // "ROUTE_NOT_FOUND"; older/Python servers may send numeric codes.
    AfterLinkErrorCode code;
    if (rawCode is int) {
      code = AfterLinkErrorCode.values.elementAt(
        (rawCode - 1).clamp(0, AfterLinkErrorCode.values.length - 1),
      );
    } else {
      code = _codeNames[rawCode.toString().toUpperCase()] ??
          AfterLinkErrorCode.internalServerError;
    }

    return AfterLinkError(
      code: code,
      message: message,
      meta: meta,
      retryAfter: retryAfter,
    );
  }

  static const Map<String, AfterLinkErrorCode> _codeNames = {
    'PROTOCOL_ERROR': AfterLinkErrorCode.protocolError,
    'AUTH_REQUIRED': AfterLinkErrorCode.authRequired,
    'AUTH_FAILED': AfterLinkErrorCode.authFailed,
    'AUTH_EXPIRED': AfterLinkErrorCode.authExpired,
    'ROUTE_NOT_FOUND': AfterLinkErrorCode.routeNotFound,
    'VALIDATION_ERROR': AfterLinkErrorCode.validationError,
    'RATE_LIMITED': AfterLinkErrorCode.rateLimited,
    'CONNECTION_TIMEOUT': AfterLinkErrorCode.connectionTimeout,
    'CONNECTION_CLOSED': AfterLinkErrorCode.connectionClosed,
    'INTERNAL_SERVER_ERROR': AfterLinkErrorCode.internalServerError,
    'MALFORMED_PAYLOAD': AfterLinkErrorCode.malformedPayload,
    'UNKNOWN_FRAME_TYPE': AfterLinkErrorCode.unknownFrameType,
    'DECOMPRESSION_FAILED': AfterLinkErrorCode.decompressionFailed,
    'TLS_CERT_INVALID': AfterLinkErrorCode.tlsCertInvalid,
    'FRAME_TOO_LARGE': AfterLinkErrorCode.frameTooLarge,
    'COMPRESSION_ERROR': AfterLinkErrorCode.compressionError,
    'INVALID_FRAME': AfterLinkErrorCode.invalidFrame,
    'SERVER_CLOSING': AfterLinkErrorCode.serverClosing,
    'PROTOCOL_VERSION_MISMATCH': AfterLinkErrorCode.protocolVersionMismatch,
  };
}
