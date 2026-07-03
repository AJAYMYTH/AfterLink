import 'dart:typed_data';
import 'dart:convert';

class FrameType {
  static const int request = 0x01;
  static const int response = 0x02;
  static const int streamStart = 0x03;
  static const int streamData = 0x04;
  static const int streamEnd = 0x05;
  static const int error = 0x06;
  static const int ping = 0x07;
  static const int pong = 0x08;
  static const int broadcast = 0x09;
  static const int subscribe = 0x0A;
  static const int unsubscribe = 0x0B;
  static const int publish = 0x0C;
  static const int close = 0x0D;
  static const int closeAck = 0x0E;
  static const int hello = 0x0F;
  static const int helloAck = 0x10;
  static const int serverClosing = 0x11;
  static const int routeRequest = 0x12;
  static const int priorityAck = 0x13;
}

class AfterLinkFlags {
  static const int compressed = 0x01;
  static const int encrypted = 0x02;
  static const int prioritySet = 0x04;
  static const int hasRoutingKey = 0x08;
  static const int fragmented = 0x10;
}

class Priority {
  static const int lowest = 0;
  static const int low = 1;
  static const int belowNormal = 2;
  static const int normal = 3;
  static const int aboveNormal = 4;
  static const int high = 5;
  static const int critical = 6;
  static const int realTime = 7;
}

class ProtocolVersion {
  static const int v1 = 0x01;
  static const int v2 = 0x02;
}

class FrameCodec {
  static const int v1HeaderSize = 10;
  static const int v2HeaderSize = 16;
  static const int maxPayloadSize = 16 * 1024 * 1024;

  static Uint8List encodeV1(int type, int flags, int messageId, Uint8List payload) {
    if (payload.length > maxPayloadSize) {
      throw RangeError('Payload exceeds maximum allowed size');
    }
    
    final header = Uint8List(v1HeaderSize);
    final bd = ByteData.view(header.buffer);
    
    bd.setUint8(0, type);
    bd.setUint8(1, flags & 0xFF);
    bd.setUint32(2, messageId, Endian.big);
    bd.setUint32(6, payload.length, Endian.big);
    
    final out = Uint8List(v1HeaderSize + payload.length);
    out.setRange(0, v1HeaderSize, header);
    out.setRange(v1HeaderSize, out.length, payload);
    return out;
  }

  static Map<String, dynamic>? decodeV1(Uint8List buffer) {
    if (buffer.length < v1HeaderSize) return null;
    
    final bd = ByteData.view(buffer.buffer, buffer.offsetInBytes, v1HeaderSize);
    final type = bd.getUint8(0);
    final flags = bd.getUint8(1);
    final messageId = bd.getUint32(2, Endian.big);
    final payloadLen = bd.getUint32(6, Endian.big);
    
    if (payloadLen > maxPayloadSize) {
      throw RangeError('Payload size exceeds maximum allowed size');
    }
    
    final totalSize = v1HeaderSize + payloadLen;
    if (buffer.length < totalSize) return null;
    
    final payload = Uint8List.view(buffer.buffer, buffer.offsetInBytes + v1HeaderSize, payloadLen);
    
    return {
      'type': type,
      'flags': flags,
      'messageId': messageId,
      'payload': payload,
      'totalSize': totalSize
    };
  }

  static Uint8List encodeV2(int type, int flags, int messageId, Uint8List payload, {int priority = 3, String routingKey = ''}) {
    if (payload.length > maxPayloadSize) {
      throw RangeError('Payload exceeds maximum allowed size');
    }
    
    final routingKeyBytes = utf8.encode(routingKey);
    if (routingKeyBytes.length > 255) {
      throw RangeError('Routing key exceeds maximum allowed length of 255 bytes');
    }
    
    if (priority < 0 || priority > 7) {
      throw RangeError('Priority must be between 0 and 7');
    }

    var finalFlags = flags & 0xFF;
    if (priority != 3) {
      finalFlags |= AfterLinkFlags.prioritySet;
    }
    if (routingKeyBytes.isNotEmpty) {
      finalFlags |= AfterLinkFlags.hasRoutingKey;
    }
    
    final header = Uint8List(v2HeaderSize);
    final bd = ByteData.view(header.buffer);
    
    bd.setUint8(0, type);
    bd.setUint8(1, finalFlags);
    bd.setUint8(2, 0x02); 
    bd.setUint8(3, priority);
    bd.setUint32(4, messageId, Endian.big);
    bd.setUint16(8, routingKeyBytes.length, Endian.big);
    bd.setUint32(10, payload.length, Endian.big);
    bd.setUint16(14, 0, Endian.big); 
    
    final out = Uint8List(v2HeaderSize + routingKeyBytes.length + payload.length);
    out.setRange(0, v2HeaderSize, header);
    if (routingKeyBytes.isNotEmpty) {
      out.setRange(v2HeaderSize, v2HeaderSize + routingKeyBytes.length, routingKeyBytes);
    }
    out.setRange(v2HeaderSize + routingKeyBytes.length, out.length, payload);
    return out;
  }

  static Map<String, dynamic>? decodeV2(Uint8List buffer) {
    if (buffer.length < v2HeaderSize) return null;
    
    final bd = ByteData.view(buffer.buffer, buffer.offsetInBytes, v2HeaderSize);
    final type = bd.getUint8(0);
    final flags = bd.getUint8(1);
    final version = bd.getUint8(2);
    final priority = bd.getUint8(3);
    final messageId = bd.getUint32(4, Endian.big);
    final routingKeyLen = bd.getUint16(8, Endian.big);
    final payloadLen = bd.getUint32(10, Endian.big);
    
    if (payloadLen > maxPayloadSize) {
      throw RangeError('Payload size exceeds maximum allowed size');
    }
    
    final totalSize = v2HeaderSize + routingKeyLen + payloadLen;
    if (buffer.length < totalSize) return null;
    
    final routingKeyBytes = Uint8List.view(buffer.buffer, buffer.offsetInBytes + v2HeaderSize, routingKeyLen);
    final routingKey = utf8.decode(routingKeyBytes);
    
    final payload = Uint8List.view(buffer.buffer, buffer.offsetInBytes + v2HeaderSize + routingKeyLen, payloadLen);
    
    return {
      'type': type,
      'flags': flags,
      'version': version,
      'priority': priority,
      'messageId': messageId,
      'routingKeyLen': routingKeyLen,
      'routingKey': routingKey,
      'payload': payload,
      'totalSize': totalSize
    };
  }

  static Map<String, dynamic>? decodeAuto(Uint8List buffer) {
    if (buffer.length < 3) return null;
    final version = buffer[2];
    if (version == 0x02) {
      return decodeV2(buffer);
    }
    return decodeV1(buffer);
  }
}
