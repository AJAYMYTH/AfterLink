const Server = require('./Server');
const { generateDevCerts } = require('./tls/dev-certs');

module.exports = { Server, generateDevCerts };
