import 'dart:io';
import 'dart:typed_data';
import 'dart:async';
import 'transport.dart';

class TcpTransport implements Transport {
  Socket? _socket;
  final _streamController = StreamController<Uint8List>.broadcast();
  StreamSubscription? _sub;

  @override
  Future<void> connect(String url) async {
    final cleanUrl = url.replaceFirst('tcp://', '').replaceFirst('tcps://', '');
    final parts = cleanUrl.split(':');
    final host = parts[0];
    final port = parts.length > 1 ? int.parse(parts[1]) : 4000;
    
    _socket = await Socket.connect(host, port);
    _socket!.setOption(SocketOption.tcpNoDelay, true);
    
    _sub = _socket!.listen(
      (data) => _streamController.add(Uint8List.fromList(data)),
      onError: (err) => _streamController.addError(err),
      onDone: () => _streamController.close(),
    );
  }

  @override
  void write(Uint8List data) {
    _socket?.add(data);
  }

  @override
  Stream<Uint8List> get stream => _streamController.stream;

  @override
  Future<void> close() async {
    await _sub?.cancel();
    await _socket?.close();
  }
}

Transport createTransport() => TcpTransport();
