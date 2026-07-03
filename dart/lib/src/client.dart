import 'dart:async';
import 'dart:typed_data';
import 'dart:math';

import 'protocol/frame.dart';
import 'protocol/codec.dart';
import 'errors.dart';
import 'options.dart';
import 'subscription.dart';
import 'transport/transport.dart';
import 'transport/transport_factory.dart';

class DisconnectInfo {
  final Object? error;
  DisconnectInfo(this.error);
}

class ReconnectInfo {
  final int attempt;
  ReconnectInfo(this.attempt);
}

class ServerClosingInfo {
  final String? reason;
  ServerClosingInfo(this.reason);
}

class RequestOptions {
  final int? priority;
  final String? routingKey;
  RequestOptions({this.priority, this.routingKey});
}

class AfterLinkClient {
  final String url;
  final AfterLinkClientOptions options;
  
  Transport? _transport;
  bool _connected = false;
  String? _sessionId;
  int _version = 1; 
  int _messageId = 0;
  bool _isClosing = false;
  StreamSubscription? _streamSub;

  final Map<int, Completer<Map<String, dynamic>>> _pendingRequests = {};
  final Map<String, Set<Function(Map<String, dynamic>)>> _subscriptions = {};

  final _onConnectedController = StreamController<void>.broadcast();
  final _onDisconnectedController = StreamController<DisconnectInfo>.broadcast();
  final _onReconnectingController = StreamController<ReconnectInfo>.broadcast();
  final _onServerClosingController = StreamController<ServerClosingInfo>.broadcast();

  AfterLinkClient({required this.url, AfterLinkClientOptions? options})
      : options = options ?? AfterLinkClientOptions();

  bool get connected => _connected;
  String? get sessionId => _sessionId;
  int get version => _version;

  Stream<void> get onConnected => _onConnectedController.stream;
  Stream<DisconnectInfo> get onDisconnected => _onDisconnectedController.stream;
  Stream<ReconnectInfo> get onReconnecting => _onReconnectingController.stream;
  Stream<ServerClosingInfo> get onServerClosing => _onServerClosingController.stream;

  Future<void> connect() async {
    _isClosing = false;
    _transport = getTransport();
    
    await _transport!.connect(url);
    
    _streamSub = _transport!.stream.listen(
      _handleIncomingData,
      onError: _handleConnectionError,
      onDone: _handleConnectionClosed,
    );

    await _handshake();
    _connected = true;
    _onConnectedController.add(null);
  }

  Future<void> _handshake() async {
    final helloPayload = {
      'version': 'AL/${options.protocol == AfterLinkProtocol.v2 ? '2' : '1'}',
      'capabilities': ['json', 'msgpack'],
      'auth': options.auth?.token,
    };
    
    final msgId = _nextMessageId();
    final payloadBytes = MessagePackCodec.serialize(helloPayload);
    
    final frameBytes = FrameCodec.encodeV1(FrameType.hello, 0, msgId, payloadBytes);
    _transport!.write(frameBytes);
    
    final completer = Completer<Map<String, dynamic>>();
    _pendingRequests[msgId] = completer;
    
    try {
      final ackFrame = await completer.future.timeout(options.timeout);
      final ackData = MessagePackCodec.deserialize(ackFrame['payload']);
      
      if (ackFrame['type'] == FrameType.error) {
        throw AfterLinkError.fromMap(ackData);
      }
      
      _sessionId = ackData['session_id'];
      final acceptedProto = ackData['accepted_protocol'] ?? 'v1';
      _version = acceptedProto == 'v2' ? 2 : 1;
    } on TimeoutException {
      throw AfterLinkError(
        code: AfterLinkErrorCode.connectionTimeout,
        message: 'Handshake timed out',
      );
    } finally {
      _pendingRequests.remove(msgId);
    }
  }

  int _nextMessageId() {
    _messageId = (_messageId + 1) & 0xFFFFFFFF;
    return _messageId;
  }

  Future<T> request<T>(String route, [Map<String, dynamic>? body, RequestOptions? reqOptions]) async {
    if (!_connected) {
      throw AfterLinkError(
        code: AfterLinkErrorCode.connectionClosed,
        message: 'Client not connected',
      );
    }

    final reqPayload = {
      'route': route,
      'body': body ?? {},
    };
    
    final msgId = _nextMessageId();
    final payloadBytes = MessagePackCodec.serialize(reqPayload);
    
    Uint8List frameBytes;
    if (_version == 2) {
      frameBytes = FrameCodec.encodeV2(
        FrameType.request,
        0,
        msgId,
        payloadBytes,
        priority: reqOptions?.priority ?? 3,
        routingKey: reqOptions?.routingKey ?? '',
      );
    } else {
      frameBytes = FrameCodec.encodeV1(FrameType.request, 0, msgId, payloadBytes);
    }

    _transport!.write(frameBytes);
    
    final completer = Completer<Map<String, dynamic>>();
    _pendingRequests[msgId] = completer;
    
    try {
      final resFrame = await completer.future.timeout(options.timeout);
      final resPayload = resFrame['payload'];
      final resData = MessagePackCodec.deserialize(resPayload);
      
      if (resFrame['type'] == FrameType.error) {
        throw AfterLinkError.fromMap(resData);
      }
      
      return resData['body'] as T;
    } on TimeoutException {
      throw AfterLinkError(
        code: AfterLinkErrorCode.connectionTimeout,
        message: 'Request timed out',
      );
    } finally {
      _pendingRequests.remove(msgId);
    }
  }

  Future<AfterLinkSubscription> subscribe(String topic, Function(Map<String, dynamic>) callback) async {
    await request<Map<String, dynamic>>('pubsub/subscribe', {'topic': topic});
    
    _subscriptions.putIfAbsent(topic, () => {}).add(callback);
    
    return AfterLinkSubscription(
      topic: topic,
      callback: callback,
      onCancel: () async {
        final subs = _subscriptions[topic];
        if (subs != null) {
          subs.remove(callback);
          if (subs.isEmpty) {
            _subscriptions.remove(topic);
            await request<Map<String, dynamic>>('pubsub/unsubscribe', {'topic': topic});
          }
        }
      },
    );
  }

  Future<void> publish(String topic, Map<String, dynamic> data) async {
    await request<Map<String, dynamic>>('pubsub/publish', {'topic': topic, 'data': data});
  }

  Stream<Map<String, dynamic>> stream(String route, [Map<String, dynamic>? body]) {
    final controller = StreamController<Map<String, dynamic>>();
    controller.addError(UnimplementedError('Streaming is not fully supported in Dart client draft'));
    return controller.stream;
  }

  final List<int> _buffer = [];

  void _handleIncomingData(Uint8List chunk) {
    _buffer.addAll(chunk);
    
    while (true) {
      final frameMap = FrameCodec.decodeAuto(Uint8List.fromList(_buffer));
      if (frameMap == null) break;
      
      final int totalSize = frameMap['totalSize'];
      _buffer.removeRange(0, totalSize);
      
      _processIncomingFrame(frameMap);
    }
  }

  void _processIncomingFrame(Map<String, dynamic> f) {
    final int type = f['type'];
    final int msgId = f['messageId'];
    
    if (type == FrameType.response || type == FrameType.error) {
      final completer = _pendingRequests[msgId];
      if (completer != null && !completer.isCompleted) {
        completer.complete(f);
      }
    } else if (type == FrameType.ping) {
      final pongBytes = FrameCodec.encodeV1(FrameType.pong, 0, msgId, Uint8List(0));
      _transport?.write(pongBytes);
    } else if (type == FrameType.publish || type == FrameType.broadcast) {
      final data = MessagePackCodec.deserialize(f['payload']);
      final String topic = data['topic'];
      final Map<String, dynamic> msgData = Map<String, dynamic>.from(data['data'] ?? {});
      
      final subs = _subscriptions[topic];
      if (subs != null) {
        for (final cb in subs) {
          try {
            cb(msgData);
          } catch (e) {
            // Callback error ignored
          }
        }
      }
    } else if (type == FrameType.serverClosing) {
      final data = MessagePackCodec.deserialize(f['payload']);
      _onServerClosingController.add(ServerClosingInfo(data['reason']));
    }
  }

  void _handleConnectionError(Object error) {
    _connected = false;
    _onDisconnectedController.add(DisconnectInfo(error));
    _cleanupPending(error);
    _reconnectLoop();
  }

  void _handleConnectionClosed() {
    _connected = false;
    if (!_isClosing) {
      _onDisconnectedController.add(DisconnectInfo(null));
      _cleanupPending(null);
      _reconnectLoop();
    }
  }

  void _cleanupPending(Object? error) {
    final err = AfterLinkError(
      code: AfterLinkErrorCode.connectionClosed,
      message: 'Connection closed: ${error ?? 'Normal closure'}',
    );
    for (final completer in _pendingRequests.values) {
      if (!completer.isCompleted) completer.completeError(err);
    }
    _pendingRequests.clear();
  }

  bool _reconnecting = false;
  Future<void> _reconnectLoop() async {
    if (!options.autoReconnect || _reconnecting || _isClosing) return;
    _reconnecting = true;

    var attempt = 0;
    while (!_connected && !_isClosing) {
      attempt++;
      if (attempt > options.maxReconnectAttempts) {
        _reconnecting = false;
        break;
      }

      _onReconnectingController.add(ReconnectInfo(attempt));
      
      final delay = options.reconnectDelay * pow(2, attempt) + Duration(milliseconds: Random().nextInt(500));
      await Future.delayed(delay);

      try {
        await connect();
        for (final topic in _subscriptions.keys) {
          await request<Map<String, dynamic>>('pubsub/subscribe', {'topic': topic});
        }
        _reconnecting = false;
        break;
      } catch (e) {
        // Reconnect failed
      }
    }
  }

  Future<void> disconnect() async {
    _isClosing = true;
    _connected = false;
    await _streamSub?.cancel();
    await _transport?.close();
    _cleanupPending(null);
  }

  Future<void> reconnect({AuthOptions? auth}) async {
    await disconnect();
    await connect();
  }
}
