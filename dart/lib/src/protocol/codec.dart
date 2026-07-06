import 'dart:typed_data';
import 'package:msgpack_dart/msgpack_dart.dart' as msgpack;

/**
 * MessagePackCodec handles msgpack packing and unpacking.
 */
class MessagePackCodec {
  static Uint8List serialize(dynamic data) {
    return msgpack.serialize(data);
  }

  static dynamic deserialize(Uint8List data) {
    return msgpack.deserialize(data);
  }
}
