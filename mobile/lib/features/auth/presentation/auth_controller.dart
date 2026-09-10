import '../../../core/network/api_exception.dart';
import '../data/auth_api.dart';
import '../data/session_store.dart';
import '../domain/instructor_session.dart';

/// Manages authentication state for the app.
///
/// On bootstrap it tries to restore a saved session. If the token is still
/// valid (verified via /api/auth/me) the app goes straight to the dashboard.
/// Otherwise the user is sent to the login screen.
class AuthController {
  AuthController({required AuthApi api, required SessionStore store})
      : _api = api,
        _store = store;

  final AuthApi _api;
  final SessionStore _store;

  InstructorSession? session;
  bool _loading = true;
  String? _error;

  bool get isLoading => _loading;
  String? get error => _error;
  bool get isAuthenticated => session != null;

  /// Try to restore a saved session on app start.
  Future<void> bootstrap() async {
    _loading = true;
    _error = null;

    final saved = _store.readSession();
    if (saved == null) {
      _loading = false;
      return;
    }

    try {
      session = await _api.fetchCurrentSession(
        baseUrl: saved.baseUrl,
        token: saved.token,
      );
    } on ApiException catch (e) {
      // If the token is expired or invalid, clear it silently.
      if (e.isSessionExpired) {
        await _store.clearSession();
      }
      // Network errors — keep the saved session so the user can retry offline.
      // But don't set it as the active session if the server rejected it.
      if (!e.isNetworkError) {
        await _store.clearSession();
      }
    } catch (_) {
      // Any other error — clear and continue.
    }

    _loading = false;
  }

  /// Log in with email + password.
  Future<bool> login({
    required String baseUrl,
    required String email,
    required String password,
  }) async {
    _loading = true;
    _error = null;

    try {
      session = await _api.login(
        baseUrl: baseUrl,
        email: email,
        password: password,
      );
      await _store.saveSession(session!);
      _loading = false;
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _loading = false;
      return false;
    } catch (e) {
      _error = 'An unexpected error occurred.';
      _loading = false;
      return false;
    }
  }

  /// Log out and clear the stored session.
  Future<void> logout() async {
    session = null;
    await _store.clearSession();
  }
}
