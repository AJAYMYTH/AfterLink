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
    final int codeInt = map['code'] ?? 10; 
    final String message = map['message'] ?? 'Unknown error';
    final int? retryAfter = map['retry_after'] ?? map['retryAfter'];
    final Map<String, dynamic>? meta = map['meta'];

    final code = AfterLinkErrorCode.values.elementAt(
      (codeInt - 1).clamp(0, AfterLinkErrorCode.values.length - 1),
    );

    return AfterLinkError(
      code: code,
      message: message,
      meta: meta,
      retryAfter: retryAfter,
    );
  }
}
