import 'transport.dart';
import 'transport_stub.dart'
    if (dart.library.io) 'transport_loader_io.dart'
    if (dart.library.js_interop) 'transport_loader_web.dart'
    if (dart.library.html) 'transport_loader_web.dart';

Transport getTransport() => createTransport();
