import 'dart:typed_data';
import 'dart:async';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'transport.dart';

class WsTransport implements Transport {
  WebSocketChannel? _channel;
  final _streamController = StreamController<Uint8List>.broadcast();
  StreamSubscription? _sub;

  @override
  Future<void> connect(String url) async {
    final wsUrl = url.replaceFirst('tcp://', 'ws://').replaceFirst('tcps://', 'wss://');
    _channel = WebSocketChannel.connect(Uri.parse(wsUrl));
    await _channel!.ready;
    
    _sub = _channel!.stream.listen(
      (data) {
        if (data is Uint8List) {
          _streamController.add(data);
        } else if (data is List<int>) {
          _streamController.add(Uint8List.fromList(data));
        }
      },
      onError: (err) => _streamController.addError(err),
      onDone: () => _streamController.close(),
    );
  }

  @override
  void write(Uint8List data) {
    _channel?.sink.add(data);
  }

  @override
  Stream<Uint8List> get stream => _streamController.stream;

  @override
  Future<void> close() async {
    await _sub?.cancel();
    await _channel?.sink.close();
  }
}
