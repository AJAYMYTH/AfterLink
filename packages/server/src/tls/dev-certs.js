const selfsigned = require('selfsigned');

/**
 * Generates self-signed development certificates.
 * Uses the `selfsigned` package for reliable X.509 generation.
 * NEVER use these in production.
 *
 * @param {object} [options]
 * @param {string} [options.commonName='afterlink-dev'] - Certificate common name
 * @param {number} [options.days=365] - Certificate validity in days
 * @returns {Promise<{key: Buffer, cert: Buffer}>}
 */
async function generateDevCerts(options = {}) {
  const {
    commonName = 'afterlink-dev',
    days = 365,
  } = options;

  const attrs = [{ name: 'commonName', value: commonName }];

  const pems = await selfsigned.generate(attrs, {
    days,
    algorithm: 'sha256',
    keySize: 2048,
  });

  return {
    key: Buffer.from(pems.private),
    cert: Buffer.from(pems.cert),
  };
}

module.exports = { generateDevCerts };
