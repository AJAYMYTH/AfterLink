const tls = require('tls');
const net = require('net');

/**
 * Creates a client transport (TCP or TLS) based on URL scheme and options.
 * @param {URL} url - Parsed URL
 * @param {object} [options] - Client options
 * @param {object} [options.tls] - TLS configuration
 * @param {Buffer|string} [options.tls.ca] - CA certificate for self-signed certs
 * @param {boolean} [options.tls.rejectUnauthorized=true] - Reject unauthorized servers
 * @param {string} [options.tls.minVersion='TLSv1.2'] - Minimum TLS version
 * @returns {tls.TLSSocket|net.Socket}
 */
function createClientTransport(url, options = {}) {
  const isTLS = url.protocol === 'afterlinks:';
  const port = parseInt(url.port, 10) || (isTLS ? 443 : 4000);

  if (isTLS) {
    return tls.connect({
      host: url.hostname,
      port,
      ca: options.tls?.ca,
      rejectUnauthorized: options.tls?.rejectUnauthorized ?? true,
      minVersion: options.tls?.minVersion ?? 'TLSv1.2',
      timeout: options.connectTimeout,
    });
  }

  return net.connect({
    host: url.hostname,
    port,
    timeout: options.connectTimeout,
  });
}

/**
 * Checks if a URL scheme indicates TLS.
 * @param {string} url
 * @returns {boolean}
 */
function isTLSUrl(url) {
  try {
    return new URL(url).protocol === 'afterlinks:';
  } catch {
    return false;
  }
}

/**
 * Gets TLS connection info from a socket.
 * @param {net.Socket|tls.TLSSocket} socket
 * @returns {object|null}
 */
function getTLSInfo(socket) {
  if (!(socket instanceof tls.TLSSocket)) return null;

  return {
    encrypted: true,
    protocol: socket.getProtocol(),
    cipher: socket.getCipher(),
    authorized: socket.authorized,
  };
}

module.exports = {
  createClientTransport,
  isTLSUrl,
  getTLSInfo,
};
