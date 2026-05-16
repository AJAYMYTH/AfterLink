const { pack, unpack } = require('msgpackr');

module.exports = {
  encode: (data) => Buffer.from(pack(data)),
  decode: (buffer) => unpack(buffer),
};
