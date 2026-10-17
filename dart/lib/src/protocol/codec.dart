import 'dart:typed_data';
import 'package:msgpack_dart/msgpack_dart.dart' as msgpack;

/// MessagePackCodec handles msgpack packing and unpacking.
class MessagePackCodec {
  static Uint8List serialize(dynamic data) {
    return msgpack.serialize(data);
  }

  static dynamic deserialize(Uint8List data) {
    return _normalize(msgpack.deserialize(data));
  }

  /// msgpack_dart decodes maps as Map<dynamic, dynamic>; normalize them to
  /// Map<String, dynamic> so callers can use typed maps consistently.
  static dynamic _normalize(dynamic value) {
    if (value is Map) {
      return value.map((key, v) => MapEntry(key.toString(), _normalize(v)));
    }
    if (value is List) {
      return value.map(_normalize).toList();
    }
    return value;
  }
}
