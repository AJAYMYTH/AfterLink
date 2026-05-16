const { pack, unpack } = require('msgpackr');

module.exports = {
  encode(data) {
    try {
      return Buffer.from(pack(data));
    } catch (err) {
      throw new Error(`MessagePack encode failed: ${err.message}`);
    }
  },

  decode(buffer) {
    try {
      return unpack(buffer);
    } catch (err) {
      throw new Error(`MessagePack decode failed: ${err.message}`);
    }
  },
};
