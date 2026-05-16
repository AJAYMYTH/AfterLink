const HEADER_SIZE = 10;

class Frame {
  static encode(type, flags, messageId, payload) {
    const header = Buffer.allocUnsafe(HEADER_SIZE);
    header.writeUInt8(type, 0);
    header.writeUInt8(flags, 1);
    header.writeUInt32BE(messageId >>> 0, 2);
    header.writeUInt32BE(payload.length, 6);
    return Buffer.concat([header, payload]);
  }

  static decode(buffer) {
    if (buffer.length < HEADER_SIZE) return null;

    const type = buffer.readUInt8(0);
    const flags = buffer.readUInt8(1);
    const messageId = buffer.readUInt32BE(2);
    const length = buffer.readUInt32BE(6);

    if (buffer.length < HEADER_SIZE + length) return null;

    const payload = buffer.slice(HEADER_SIZE, HEADER_SIZE + length);
    return { type, flags, messageId, payload, totalSize: HEADER_SIZE + length };
  }

  static headerSize() {
    return HEADER_SIZE;
  }
}

module.exports = Frame;
