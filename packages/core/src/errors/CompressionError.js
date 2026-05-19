const { AfterLinkError } = require('./AfterLinkError');

class CompressionError extends AfterLinkError {
  constructor({ code, message, details, requestId, cause }) {
    super({ code, message, category: 'compression', httpStatus: 400, details, requestId, cause });
    this.name = 'CompressionError';
  }
}

class DecompressionFailedError extends CompressionError {
  constructor(message = 'Failed to decompress payload', options = {}) {
    super({ code: 'DECOMPRESSION_FAILED', message, ...options });
    this.name = 'DecompressionFailedError';
  }
}

class CompressionAlgorithmUnsupportedError extends CompressionError {
  constructor(algorithm, options = {}) {
    super({
      code: 'COMPRESSION_ALGORITHM_UNSUPPORTED',
      message: `Compression algorithm '${algorithm}' is not supported`,
      details: { algorithm },
      ...options,
    });
    this.name = 'CompressionAlgorithmUnsupportedError';
  }
}

module.exports = {
  CompressionError,
  DecompressionFailedError,
  CompressionAlgorithmUnsupportedError,
};
