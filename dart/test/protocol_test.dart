import 'dart:io';
import 'dart:convert';
import 'dart:typed_data';
import 'package:test/test.dart';
import 'package:afterlink/src/protocol/frame.dart';

void main() {
  group('FrameCodec', () {
    test('encode/decode v1', () {
      final payload = Uint8List.fromList([1, 2, 3, 4]);
      final encoded = FrameCodec.encodeV1(1, 0, 42, payload);
      final decoded = FrameCodec.decodeV1(encoded);
      
      expect(decoded, isNotNull);
      expect(decoded!['type'], 1);
      expect(decoded['flags'], 0);
      expect(decoded['messageId'], 42);
      expect(decoded['payload'], payload);
    });

    test('encode/decode v2', () {
      final payload = Uint8List.fromList([1, 2, 3, 4]);
      final encoded = FrameCodec.encodeV2(1, 0, 42, payload, priority: 5, routingKey: 'test');
      final decoded = FrameCodec.decodeV2(encoded);
      
      expect(decoded, isNotNull);
      expect(decoded!['type'], 1);
      expect(decoded['flags'], 12); 
      expect(decoded['version'], 2);
      expect(decoded['priority'], 5);
      expect(decoded['messageId'], 42);
      expect(decoded['routingKey'], 'test');
      expect(decoded['payload'], payload);
    });

    test('validates test vectors from protocol-vectors.json', () {
      final file = File('../test/protocol-vectors.json');
      final content = file.readAsStringSync();
      final data = json.decode(content);
      
      for (final vec in data['vectors']) {
        final payload = Uint8List.fromList(HEX.decode(vec['payloadHex']));
        final expected = Uint8List.fromList(HEX.decode(vec['expectedHex']));
        
        Uint8List encoded;
        if (vec['version'] == 1) {
          encoded = FrameCodec.encodeV1(vec['type'], vec['flags'], vec['messageId'], payload);
        } else {
          encoded = FrameCodec.encodeV2(
            vec['type'],
            vec['flags'],
            vec['messageId'],
            payload,
            priority: vec['priority'] ?? 3,
            routingKey: vec['routingKey'] ?? '',
          );
        }
        
        expect(encoded, expected);
        
        final decoded = FrameCodec.decodeAuto(expected);
        expect(decoded, isNotNull);
        expect(decoded!['type'], vec['type']);
        expect(decoded['flags'], vec['flags']);
        expect(decoded['messageId'], vec['messageId']);
        
        if (vec['version'] == 2) {
          expect(decoded['version'], 2);
          expect(decoded['priority'], vec['priority'] ?? 3);
          expect(decoded['routingKey'], vec['routingKey'] ?? '');
        }
      }
    });
  });
}

class HEX {
  static List<int> decode(String hex) {
    final list = <int>[];
    for (var i = 0; i < hex.length; i += 2) {
      list.add(int.parse(hex.substring(i, i + 2), radix: 16));
    }
    return list;
  }
}
