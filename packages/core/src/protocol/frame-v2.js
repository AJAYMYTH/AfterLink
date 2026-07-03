const HEADER_SIZE = 16;
const MAX_PAYLOAD_SIZE = 16 * 1024 * 1024; // 16MB default max
const MAX_ROUTING_KEY_SIZE = 255;

class FrameV2 {
  static encode(type, flags, messageId, payload, options = {}) {
    if (!Buffer.isBuffer(payload)) {
      throw new TypeError('Payload must be a Buffer');
    }
    if (payload.length > MAX_PAYLOAD_SIZE) {
      throw new RangeError(`Payload size ${payload.length} exceeds maximum ${MAX_PAYLOAD_SIZE}`);
    }

    let priority = 3;
    if (options.priority !== undefined && options.priority !== null) {
      priority = Number(options.priority);
      if (isNaN(priority) || priority < 0 || priority > 7) {
        throw new RangeError('Priority must be an integer between 0 and 7');
      }
    }

    let routingKeyBuf = Buffer.alloc(0);
    if (options.routingKey !== undefined && options.routingKey !== null && options.routingKey !== '') {
      routingKeyBuf = Buffer.from(options.routingKey, 'utf8');
      if (routingKeyBuf.length > MAX_ROUTING_KEY_SIZE) {
        throw new RangeError(`Routing key length ${routingKeyBuf.length} exceeds maximum ${MAX_ROUTING_KEY_SIZE} bytes`);
      }
    }

    let finalFlags = flags & 0xFF;
    if (priority !== 3) {
      finalFlags |= 0x04; // PRIORITY_SET (Bit 2)
    }
    if (routingKeyBuf.length > 0) {
      finalFlags |= 0x08; // HAS_ROUTING_KEY (Bit 3)
    }

    const header = Buffer.allocUnsafe(HEADER_SIZE);
    header.writeUInt8(type, 0);
    header.writeUInt8(finalFlags, 1);
    header.writeUInt8(0x02, 2); // Version always 2
    header.writeUInt8(priority, 3);
    header.writeUInt32BE(messageId >>> 0, 4);
    header.writeUInt16BE(routingKeyBuf.length, 8);
    header.writeUInt32BE(payload.length, 10);
    header.writeUInt16BE(0, 14); // Reserved/padding bytes to reach 16 bytes fixed header

    if (routingKeyBuf.length > 0) {
      return Buffer.concat([header, routingKeyBuf, payload]);
    }
    return Buffer.concat([header, payload]);
  }

  static decode(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < HEADER_SIZE) return null;

    const type = buffer.readUInt8(0);
    const flags = buffer.readUInt8(1);
    const version = buffer.readUInt8(2);
    const priority = buffer.readUInt8(3);
    const messageId = buffer.readUInt32BE(4);
    const routingKeyLen = buffer.readUInt16BE(8);
    const payloadLen = buffer.readUInt32BE(10);

    if (payloadLen > MAX_PAYLOAD_SIZE) {
      throw new RangeError(`Frame payload length ${payloadLen} exceeds maximum ${MAX_PAYLOAD_SIZE}`);
    }
    if (routingKeyLen > MAX_ROUTING_KEY_SIZE) {
      throw new RangeError(`Routing key length ${routingKeyLen} exceeds maximum ${MAX_ROUTING_KEY_SIZE}`);
    }

    const totalSize = HEADER_SIZE + routingKeyLen + payloadLen;
    if (buffer.length < totalSize) return null;

    let routingKey = '';
    if (routingKeyLen > 0) {
      routingKey = buffer.toString('utf8', HEADER_SIZE, HEADER_SIZE + routingKeyLen);
    }

    const payload = buffer.slice(HEADER_SIZE + routingKeyLen, totalSize);

    return {
      type,
      flags,
      version,
      priority,
      messageId,
      routingKeyLen,
      routingKey,
      payload,
      totalSize,
    };
  }

  static headerSize() {
    return HEADER_SIZE;
  }

  static maxPayloadSize() {
    return MAX_PAYLOAD_SIZE;
  }
}

FrameV2.HEADER_SIZE = HEADER_SIZE;

module.exports = FrameV2;
