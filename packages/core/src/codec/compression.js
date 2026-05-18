const zlib = require('zlib');

const FLAGS_COMPRESSED = 0x01;

const ALGORITHMS = {
  zlib: {
    compress: (buf, level) => zlib.deflateSync(buf, { level }),
    decompress: (buf) => zlib.inflateSync(buf),
  },
  brotli: {
    compress: (buf, level) =>
      zlib.brotliCompressSync(buf, {
        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: level },
      }),
    decompress: (buf) => zlib.brotliDecompressSync(buf),
  },
  none: {
    compress: (buf) => buf,
    decompress: (buf) => buf,
  },
};

/**
 * Compresses a payload if it exceeds the threshold and compression results in smaller size.
 * @param {Buffer} payload - Raw payload buffer
 * @param {string} algorithm - 'zlib' | 'brotli' | 'none'
 * @param {number} level - Compression level (1-9)
 * @param {number} threshold - Only compress if payload > this size
 * @returns {{ data: Buffer, compressed: boolean }}
 */
function compress(payload, algorithm = 'zlib', level = 6, threshold = 1024) {
  if (!ALGORITHMS[algorithm]) {
    throw new Error(`Unknown compression algorithm: ${algorithm}`);
  }

  if (algorithm === 'none' || payload.length < threshold) {
    return { data: payload, compressed: false };
  }

  try {
    const result = ALGORITHMS[algorithm].compress(payload, level);
    // Only use compressed version if it's actually smaller
    if (result.length >= payload.length) {
      return { data: payload, compressed: false };
    }
    return { data: result, compressed: true };
  } catch {
    // If compression fails, send uncompressed
    return { data: payload, compressed: false };
  }
}

/**
 * Decompresses a payload based on the compressed flag.
 * @param {Buffer} payload - Payload buffer
 * @param {boolean} compressed - Whether the payload is compressed
 * @param {string} algorithm - 'zlib' | 'brotli' | 'none'
 * @returns {Buffer}
 */
function decompress(payload, compressed, algorithm = 'zlib') {
  if (!compressed || algorithm === 'none') {
    return payload;
  }

  if (!ALGORITHMS[algorithm]) {
    throw new Error(`Unknown compression algorithm: ${algorithm}`);
  }

  return ALGORITHMS[algorithm].decompress(payload);
}

/**
 * Checks if the compressed flag is set in the flags byte.
 * @param {number} flags - Flags byte
 * @returns {boolean}
 */
function isCompressed(flags) {
  return (flags & FLAGS_COMPRESSED) !== 0;
}

/**
 * Sets the compressed flag in the flags byte.
 * @param {number} flags - Flags byte
 * @param {boolean} compressed - Whether to set the compressed flag
 * @returns {number}
 */
function setCompressedFlag(flags, compressed) {
  return compressed ? flags | FLAGS_COMPRESSED : flags & ~FLAGS_COMPRESSED;
}

module.exports = {
  compress,
  decompress,
  isCompressed,
  setCompressedFlag,
  FLAGS_COMPRESSED,
  ALGORITHMS,
};
