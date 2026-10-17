import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexam_omr/core/network/server_address.dart';

void main() {
  test('loopback detection distinguishes phone-local and LAN servers', () {
    expect(isLoopbackServer('http://localhost:3000'), isTrue);
    expect(isLoopbackServer('http://127.0.0.1:3000'), isTrue);
    expect(isLoopbackServer('http://192.168.254.101:3000'), isFalse);
  });

  test('a saved LAN server remains the preferred iOS address', () {
    expect(
      initialServerUrl(
        saved: 'http://192.168.1.9:3000',
        platform: TargetPlatform.iOS,
      ),
      'http://192.168.1.9:3000',
    );
  });

  test('Android emulator keeps its host bridge fallback', () {
    expect(
      initialServerUrl(saved: '', platform: TargetPlatform.android),
      configuredServerUrl.isNotEmpty
          ? configuredServerUrl
          : 'http://10.0.2.2:3000',
    );
  });
}
