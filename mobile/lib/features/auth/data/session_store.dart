import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../domain/instructor_session.dart';

/// Persists the instructor session across app restarts.
///
/// The session blob (which contains the JWT) lives in
/// [FlutterSecureStorage] — Keychain on iOS, EncryptedSharedPreferences on
/// Android — instead of plaintext SharedPreferences. The base URL is not a
/// secret, so it stays in SharedPreferences for synchronous reads.
class SessionStore {
  SessionStore(this._preferences, {FlutterSecureStorage? secureStorage})
      : _secure = secureStorage ?? const FlutterSecureStorage();

  final SharedPreferences _preferences;
  final FlutterSecureStorage _secure;

  static const _sessionKey = 'nexam_session';
  static const _baseUrlKey = 'nexam_base_url';

  String readBaseUrl() => _preferences.getString(_baseUrlKey) ?? '';

  Future<void> saveBaseUrl(String baseUrl) =>
      _preferences.setString(_baseUrlKey, baseUrl);

  Future<InstructorSession?> readSession() async {
    // Migrate any session left in SharedPreferences by an older version.
    final legacy = _preferences.getString(_sessionKey);
    if (legacy != null && legacy.isNotEmpty) {
      await _secure.write(key: _sessionKey, value: legacy);
      await _preferences.remove(_sessionKey);
    }

    final raw = await _secure.read(key: _sessionKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      return InstructorSession.fromStorage(Map<String, dynamic>.from(decoded));
    } catch (_) {
      return null;
    }
  }

  Future<void> saveSession(InstructorSession session) async {
    await saveBaseUrl(session.baseUrl);
    await _secure.write(key: _sessionKey, value: jsonEncode(session.toJson()));
  }

  Future<void> clearSession() => _secure.delete(key: _sessionKey);
}
