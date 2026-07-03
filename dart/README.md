# AfterLink Dart Client SDK

Dart and Flutter client SDK for the binary AfterLink protocol.

## Installation

Add the dependency to your `pubspec.yaml`:

```yaml
dependencies:
  afterlink:
    path: ./path/to/afterlink
```

## Usage

```dart
import 'package:afterlink/afterlink.dart';

void main() async {
  final client = AfterLinkClient(url: 'tcp://localhost:4000');
  await client.connect();
  
  final result = await client.request<Map>('users/get', {'id': 1});
  print(result);
  
  await client.disconnect();
}
```
