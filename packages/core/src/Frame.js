const HEADER_SIZE = 10;
const MAX_PAYLOAD_SIZE = 16 * 1024 * 1024; // 16MB default max

class Frame {
  static encode(type, flags, messageId, payload) {
    if (!Buffer.isBuffer(payload)) {
      throw new TypeError('Payload must be a Buffer');
    }
    if (payload.length > MAX_PAYLOAD_SIZE) {
      throw new RangeError(`Payload size ${payload.length} exceeds maximum ${MAX_PAYLOAD_SIZE}`);
    }

    const header = Buffer.allocUnsafe(HEADER_SIZE);
    header.writeUInt8(type, 0);
    header.writeUInt8(flags & 0xFF, 1);
    header.writeUInt32BE(messageId >>> 0, 2);
    header.writeUInt32BE(payload.length, 6);
    return Buffer.concat([header, payload]);
  }

  static decode(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < HEADER_SIZE) return null;

    const type = buffer.readUInt8(0);
    const flags = buffer.readUInt8(1);
    const messageId = buffer.readUInt32BE(2);
    const length = buffer.readUInt32BE(6);

    if (length > MAX_PAYLOAD_SIZE) {
      throw new RangeError(`Frame payload length ${length} exceeds maximum ${MAX_PAYLOAD_SIZE}`);
    }

    if (buffer.length < HEADER_SIZE + length) return null;

    const payload = buffer.slice(HEADER_SIZE, HEADER_SIZE + length);
    return { type, flags, messageId, payload, totalSize: HEADER_SIZE + length };
  }

  static headerSize() {
    return HEADER_SIZE;
  }

  static maxPayloadSize() {
    return MAX_PAYLOAD_SIZE;
  }
}

module.exports = Frame;
