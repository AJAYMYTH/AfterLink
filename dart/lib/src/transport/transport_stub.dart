import 'transport.dart';

Transport createTransport() {
  throw UnsupportedError('Cannot create a transport without dart:html or dart:io');
}
