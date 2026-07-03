enum AfterLinkProtocol { v1, v2 }

class AuthOptions {
  final String token;
  AuthOptions({required this.token});
}

class CompressionOptions {
  final bool enabled;
  final String algorithm;
  CompressionOptions({this.enabled = false, this.algorithm = 'zlib'});
}

class TlsOptions {
  final bool enabled;
  final bool verifyCert;
  TlsOptions({this.enabled = false, this.verifyCert = true});
}

class AfterLinkClientOptions {
  final bool autoReconnect;
  final int maxReconnectAttempts;
  final Duration reconnectDelay;
  final Duration timeout;
  final AuthOptions? auth;
  final CompressionOptions? compression;
  final TlsOptions? tls;
  final AfterLinkProtocol protocol;

  AfterLinkClientOptions({
    this.autoReconnect = true,
    this.maxReconnectAttempts = 5,
    this.reconnectDelay = const Duration(seconds: 1),
    this.timeout = const Duration(seconds: 10),
    this.auth,
    this.compression,
    this.tls,
    this.protocol = AfterLinkProtocol.v2,
  });
}
