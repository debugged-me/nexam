import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../domain/instructor_session.dart';

/// Persists the instructor session across app restarts.
///
/// Uses SharedPreferences (not secure storage) for the session blob because
/// the token is already short-lived (JWT) and the app needs to read it on
/// every cold start. The base URL is also stored so the user only enters it
/// once.
class SessionStore {
  SessionStore(this._preferences);

  final SharedPreferences _preferences;

  static const _sessionKey = 'nexam_session';
  static const _baseUrlKey = 'nexam_base_url';

  String readBaseUrl() => _preferences.getString(_baseUrlKey) ?? '';

  Future<void> saveBaseUrl(String baseUrl) =>
      _preferences.setString(_baseUrlKey, baseUrl);

  InstructorSession? readSession() {
    final raw = _preferences.getString(_sessionKey);
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
    await _preferences.setString(_sessionKey, jsonEncode(session.toJson()));
  }

  Future<void> clearSession() => _preferences.remove(_sessionKey);
}
