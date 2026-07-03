import 'package:test/test.dart';
import 'package:afterlink/afterlink.dart';

void main() {
  group('AfterLinkError', () {
    test('creates from map correctly', () {
      final map = {
        'code': 5,
        'message': 'Route not found',
        'meta': {'foo': 'bar'}
      };
      
      final err = AfterLinkError.fromMap(map);
      expect(err.code, AfterLinkErrorCode.routeNotFound);
      expect(err.message, 'Route not found');
      expect(err.meta?['foo'], 'bar');
    });
  });
}
