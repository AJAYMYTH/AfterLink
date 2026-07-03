import 'dart:typed_data';
import 'package:messagepack/messagepack.dart';

/**
 * MessagePackCodec handles msgpack packing and unpacking.
 */
class MessagePackCodec {
  static Uint8List serialize(dynamic data) {
    final packer = Packer();
    packer.pack(data);
    return packer.takeBytes();
  }

  static dynamic deserialize(Uint8List data) {
    final unpacker = Unpacker(data);
    return unpacker.unpack();
  }
}
