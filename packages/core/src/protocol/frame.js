const FrameV1 = require('./frame-v1');
const FrameV2 = require('./frame-v2');

class Frame {
  static encode(type, flags, messageId, payload, options = {}) {
    const useV2 = options.version === 2 || 
                  (options.version !== 1 && (
                    (options.routingKey !== undefined && options.routingKey !== null && options.routingKey !== '') ||
                    (options.priority !== undefined && options.priority !== null)
                  ));
    if (useV2) {
      return FrameV2.encode(type, flags, messageId, payload, options);
    }
    return FrameV1.encode(type, flags, messageId, payload);
  }

  static decode(buffer, version = 1) {
    if (version === 2) {
      return FrameV2.decode(buffer);
    }
    return FrameV1.decode(buffer);
  }

  static decodeAuto(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 3) return null;
    // For V2, the 3rd byte (offset 2) is the version field, which is 0x02.
    // For V1, the 3rd byte is the first byte of messageId (which could occasionally be 0x02,
    // but in practice is negotiated via hello handshake or we check header fields).
    // Let's check offset 2: if it is 0x02, we decode as V2, otherwise V1.
    const version = buffer.readUInt8(2);
    if (version === 0x02) {
      return FrameV2.decode(buffer);
    }
    return FrameV1.decode(buffer);
  }

  static headerSize(version = 1) {
    return version === 2 ? FrameV2.HEADER_SIZE : FrameV1.HEADER_SIZE;
  }

  static maxPayloadSize() {
    return FrameV1.maxPayloadSize();
  }
}

module.exports = Frame;
