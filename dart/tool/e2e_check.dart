// Cross-SDK E2E smoke check: Dart client against a live Node.js AfterLink server.
// Start the server first (see scratch/e2e-server.js), then:
//   dart run tool/e2e_check.dart

import 'dart:async';

import 'package:afterlink/afterlink.dart';

Future<void> main() async {
  final client = AfterLinkClient(url: 'tcp://localhost:5100');
  await client.connect();
  print('connected: session=${client.sessionId} protocol=v${client.version}');
  assert(client.version == 2, 'expected v2 negotiation, got v${client.version}');

  final pong = await client.request<Map<String, dynamic>>('ping');
  print('ping -> $pong');
  assert(pong['pong'] == true);

  final echo = await client.request<Map<String, dynamic>>('echo', {'hello': 'dart', 'n': 7});
  print('echo -> $echo');
  assert(echo['echoed']['hello'] == 'dart');
  assert(echo['echoed']['n'] == 7);

  // v2-only: routing key + priority on the request frame
  final routed = await client.request<Map<String, dynamic>>(
    'echo',
    {'routed': true},
    RequestOptions(priority: 5, routingKey: 'ml-inference'),
  );
  print('routed echo -> $routed');
  assert(routed['echoed']['routed'] == true);

  // error path (Node server sends the canonical string code)
  try {
    await client.request<Map<String, dynamic>>('does/not/exist');
    throw StateError('expected ROUTE_NOT_FOUND');
  } on AfterLinkError catch (err) {
    print('route-not-found error -> $err');
    assert(err.code == AfterLinkErrorCode.routeNotFound, 'unexpected code: ${err.code}');
  }

  await client.disconnect();

  // pub/sub (SUBSCRIBE/PUBLISH frames)
  final subscriber = AfterLinkClient(url: 'tcp://localhost:5100');
  final publisher = AfterLinkClient(url: 'tcp://localhost:5100');
  await subscriber.connect();
  await publisher.connect();

  final received = Completer<Map<String, dynamic>>();
  final sub = await subscriber.subscribe('e2e.chat', (msg) {
    if (!received.isCompleted) received.complete(msg);
  });

  await publisher.publish('e2e.chat', {'from': 'dart', 'text': 'hello pubsub'});
  final msg = await received.future.timeout(const Duration(seconds: 5));
  print('pubsub received -> $msg');
  assert(msg['text'] == 'hello pubsub', 'unexpected pubsub message: $msg');

  await sub.cancel();
  await subscriber.disconnect();
  await publisher.disconnect();

  print('DART CLIENT E2E: PASS');
}
