const tls = require('tls');
const net = require('net');
const { errors: { TLSCertInvalidError } } = require('@ajaymyth/core');

/**
 * Creates a server transport (TCP or TLS) based on configuration.
 * @param {object} options - Server configuration
 * @param {object} [options.tls] - TLS configuration
 * @param {boolean} [options.tls.enabled=false] - Enable TLS encryption
 * @param {Buffer|string} [options.tls.key] - Private key PEM buffer or path
 * @param {Buffer|string} [options.tls.cert] - Certificate PEM buffer or path
 * @param {Buffer|string} [options.tls.ca] - CA certificate for mutual TLS
 * @param {boolean} [options.tls.rejectUnauthorized=true] - Reject unauthorized clients
 * @param {string} [options.tls.minVersion='TLSv1.2'] - Minimum TLS version
 * @param {number} [options.tls.sessionTimeout=300] - TLS session cache timeout (seconds)
 * @returns {tls.Server|net.Server}
 */
function createServerTransport(options) {
  if (options.tls?.enabled) {
    validateTlsConfig(options.tls);

    return tls.createServer({
      key: options.tls.key,
      cert: options.tls.cert,
      ca: options.tls.ca,
      requestCert: !!options.tls.ca,
      rejectUnauthorized: options.tls.rejectUnauthorized ?? true,
      minVersion: options.tls.minVersion ?? 'TLSv1.2',
      sessionTimeout: options.tls.sessionTimeout ?? 300,
    });
  }

  return net.createServer();
}

/**
 * Validates TLS configuration and throws descriptive errors.
 * @param {object} tlsConfig
 * @throws {TLSCertInvalidError} if configuration is invalid
 */
function validateTlsConfig(tlsConfig) {
  if (!tlsConfig.key) {
    throw new TLSCertInvalidError('TLS enabled but no private key provided');
  }

  if (!tlsConfig.cert) {
    throw new TLSCertInvalidError('TLS enabled but no certificate provided');
  }
}

/**
 * Checks if a socket is a TLS socket.
 * @param {net.Socket|tls.TLSSocket} socket
 * @returns {boolean}
 */
function isTLSSocket(socket) {
  return socket instanceof tls.TLSSocket;
}

/**
 * Gets TLS connection info from a socket.
 * @param {net.Socket|tls.TLSSocket} socket
 * @returns {object|null} TLS info or null if not TLS
 */
function getTLSInfo(socket) {
  if (!isTLSSocket(socket)) return null;

  const tlsSocket = socket;
  return {
    encrypted: true,
    protocol: tlsSocket.getProtocol(),
    cipher: tlsSocket.getCipher(),
    authorized: tlsSocket.authorized,
    authorizationError: tlsSocket.authorizationError,
  };
}

module.exports = {
  createServerTransport,
  validateTlsConfig,
  isTLSSocket,
  getTLSInfo,
};
