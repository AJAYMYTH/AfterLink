import 'dart:typed_data';

abstract class Transport {
  Future<void> connect(String url);
  void write(Uint8List data);
  Stream<Uint8List> get stream;
  Future<void> close();
}
