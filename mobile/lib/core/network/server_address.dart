import 'package:flutter/foundation.dart';

const configuredServerUrl = String.fromEnvironment('NEXAM_API_BASE');

bool isLoopbackServer(String value) {
  final host = Uri.tryParse(value.trim())?.host.toLowerCase();
  return host == 'localhost' || host == '127.0.0.1' || host == '::1';
}

String platformDefaultServerUrl(TargetPlatform platform) {
  if (configuredServerUrl.trim().isNotEmpty) {
    return configuredServerUrl.trim();
  }
  return platform == TargetPlatform.android
      ? 'http://10.0.2.2:3000'
      : 'http://localhost:3000';
}

/// Prefer an explicitly saved remote/LAN server. A release configured for a
/// physical iPhone replaces only stale loopback values left by older builds.
String initialServerUrl({
  required String saved,
  required TargetPlatform platform,
}) {
  final savedUrl = saved.trim();
  final configured = configuredServerUrl.trim();
  if (configured.isNotEmpty &&
      (savedUrl.isEmpty ||
          (platform == TargetPlatform.iOS && isLoopbackServer(savedUrl)))) {
    return configured;
  }
  return savedUrl.isNotEmpty ? savedUrl : platformDefaultServerUrl(platform);
}
