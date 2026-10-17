## 2.0.3

- **AL/2 protocol negotiation**: the client now negotiates the frame format in the HELLO handshake and honors `accepted_protocol` from `HELLO_ACK` — v2 sessions use the 16-byte header (routing key / priority capable), v1-only servers fall back automatically.
- **Fixed HELLO_ACK handshake**: connecting to a real server resolves the handshake instead of timing out.
- **Fixed MessagePack maps**: decoded maps are normalized to `Map<String, dynamic>`, fixing the `_Map<dynamic, dynamic> is not a subtype of Map<String, dynamic>` crash in `request()`.
- **Fixed typed errors**: canonical string error codes sent by Node.js servers (e.g. `ROUTE_NOT_FOUND`) are mapped to `AfterLinkError`.
- **Fixed pub/sub**: `subscribe()` / `unsubscribe()` / `publish()` now use the protocol's `SUBSCRIBE` / `UNSUBSCRIBE` / `PUBLISH` frame types.
- **Added**: `tool/e2e_check.dart` — a live cross-SDK smoke check (request, routing key, typed errors, pub/sub) against a running Node.js server.

## 2.0.1

- Initial release of the AfterLink Dart Client SDK supporting the Protocol v2 frame changes, cross-version capabilities handshake negotiation, auto-reconnect, and multi-platform compilation support.
