import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/network/net_error.dart';
import '../domain/instructor_session.dart';

/// Talks to the Nexam Node.js API for authentication.
///
/// The base URL is configurable so the app can target a local dev server
/// or a production deployment. All calls return typed [InstructorSession]
/// objects or throw [ApiException] on failure.
class AuthApi {
  AuthApi({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  String normalizeBaseUrl(String value) {
    var normalized = value.trim();
    if (normalized.isEmpty) return '';
    if (!normalized.startsWith('http://') &&
        !normalized.startsWith('https://')) {
      normalized = 'http://$normalized';
    }
    return normalized.replaceFirst(RegExp(r'/+$'), '');
  }

  /// POST /api/auth/login — exchange email + password for a JWT.
  Future<InstructorSession> login({
    required String baseUrl,
    required String email,
    required String password,
  }) async {
    final response = await _safeRequest(
      () => _client.post(
        _uri(baseUrl, '/api/auth/login'),
        headers: _jsonHeaders,
        body: jsonEncode({'email': email.trim(), 'password': password}),
      ),
    );
    final data = _decode(response);
    return InstructorSession.fromApi(data, baseUrl: normalizeBaseUrl(baseUrl));
  }

  /// GET /api/auth/google-client — the web client ID used as serverClientId
  /// when minting a Google ID token. Empty string means the server has no
  /// Google sign-in configured and the button should stay hidden.
  Future<String> fetchGoogleClientId({required String baseUrl}) async {
    try {
      final response = await _safeRequest(
        () => _client.get(_uri(baseUrl, '/api/auth/google-client')),
      );
      final data = _decode(response);
      return data['clientId']?.toString() ?? '';
    } catch (_) {
      // SSO status is best-effort — a failure hides the button, it should
      // never block the password form.
      return '';
    }
  }

  /// POST /api/auth/google — exchange a Google ID token for a JWT. New
  /// emails are provisioned as instructors (active on auto-approve domains,
  /// pending otherwise); the server returns the same shape as /login.
  Future<InstructorSession> loginWithGoogle({
    required String baseUrl,
    required String idToken,
  }) async {
    final response = await _safeRequest(
      () => _client.post(
        _uri(baseUrl, '/api/auth/google'),
        headers: _jsonHeaders,
        body: jsonEncode({'credential': idToken}),
      ),
    );
    final data = _decode(response);
    return InstructorSession.fromApi(data, baseUrl: normalizeBaseUrl(baseUrl));
  }

  /// GET /api/auth/me — verify the token is still valid and fetch the profile.
  Future<InstructorSession> fetchCurrentSession({
    required String baseUrl,
    required String token,
  }) async {
    final response = await _safeRequest(
      () => _client.get(
        _uri(baseUrl, '/api/auth/me'),
        headers: {
          ..._jsonHeaders,
          'authorization': 'Bearer $token',
        },
      ),
    );
    final data = _decode(response);
    return InstructorSession.fromApi(
      data,
      baseUrl: normalizeBaseUrl(baseUrl),
      fallbackToken: token,
    );
  }

  /// POST /api/auth/register — create a pending instructor account.
  /// Returns { message, verifyToken, email } — feed verifyToken to the
  /// OTP screen. (Web CAPTCHA is skipped for non-web clients.)
  Future<Map<String, dynamic>> register({
    required String baseUrl,
    required String firstName,
    required String lastName,
    required String email,
    required String password,
    String middleName = '',
    String nameExt = '',
  }) async {
    final response = await _safeRequest(
      () => _client.post(
        _uri(baseUrl, '/api/auth/register'),
        headers: _jsonHeaders,
        body: jsonEncode({
          'first_name': firstName.trim(),
          'middle_name': middleName.trim(),
          'last_name': lastName.trim(),
          'name_ext': nameExt.trim(),
          'email': email.trim(),
          'password': password,
        }),
      ),
    );
    return _decode(response);
  }

  /// POST /api/auth/verify — confirm the 6-char email code.
  Future<void> verifyEmail({
    required String baseUrl,
    required String verifyToken,
    required String code,
  }) async {
    final response = await _safeRequest(
      () => _client.post(
        _uri(baseUrl, '/api/auth/verify'),
        headers: _jsonHeaders,
        body: jsonEncode({
          'verifyToken': verifyToken,
          'code': code.trim(),
        }),
      ),
    );
    _decode(response);
  }

  /// POST /api/auth/resend — request a fresh verification code.
  Future<void> resendVerification({
    required String baseUrl,
    required String verifyToken,
  }) async {
    final response = await _safeRequest(
      () => _client.post(
        _uri(baseUrl, '/api/auth/resend'),
        headers: _jsonHeaders,
        body: jsonEncode({'verifyToken': verifyToken}),
      ),
    );
    _decode(response);
  }

  /// POST /api/auth/forgot — request a password-reset code.
  /// Returns the response body; `resetToken` is present only when the
  /// account exists (the API keeps responses generic otherwise).
  Future<Map<String, dynamic>> forgotPassword({
    required String baseUrl,
    required String email,
  }) async {
    final response = await _safeRequest(
      () => _client.post(
        _uri(baseUrl, '/api/auth/forgot'),
        headers: _jsonHeaders,
        body: jsonEncode({'email': email.trim()}),
      ),
    );
    return _decode(response);
  }

  /// POST /api/auth/reset — complete a password reset with the code.
  Future<void> resetPassword({
    required String baseUrl,
    required String resetToken,
    required String code,
    required String password,
  }) async {
    final response = await _safeRequest(
      () => _client.post(
        _uri(baseUrl, '/api/auth/reset'),
        headers: _jsonHeaders,
        body: jsonEncode({
          'resetToken': resetToken,
          'code': code.trim(),
          'password': password,
        }),
      ),
    );
    _decode(response);
  }

  /// PUT /api/auth/me — update the instructor's name fields. Returns the
  /// refreshed session (same token, new profile fields).
  Future<InstructorSession> updateProfile({
    required String baseUrl,
    required String token,
    required String firstName,
    required String lastName,
    String middleName = '',
    String nameExt = '',
  }) async {
    final response = await _safeRequest(
      () => _client.put(
        _uri(baseUrl, '/api/auth/me'),
        headers: {
          ..._jsonHeaders,
          'authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'first_name': firstName.trim(),
          'middle_name': middleName.trim(),
          'last_name': lastName.trim(),
          'name_ext': nameExt.trim(),
        }),
      ),
    );
    final data = _decode(response);
    return InstructorSession.fromApi(
      data,
      baseUrl: normalizeBaseUrl(baseUrl),
      fallbackToken: token,
    );
  }

  /// PUT /api/auth/appearance — persist the account's theme mode
  /// ('light' | 'dark' | 'system') so it follows the user across the
  /// web app and this app.
  Future<void> updateAppearance({
    required String baseUrl,
    required String token,
    required String theme,
  }) async {
    final response = await _safeRequest(
      () => _client.put(
        _uri(baseUrl, '/api/auth/appearance'),
        headers: {
          ..._jsonHeaders,
          'authorization': 'Bearer $token',
        },
        body: jsonEncode({'theme': theme}),
      ),
    );
    _decode(response);
  }

  /// POST /api/auth/change-password — requires the current password.
  Future<void> changePassword({
    required String baseUrl,
    required String token,
    required String currentPassword,
    required String newPassword,
  }) async {
    final response = await _safeRequest(
      () => _client.post(
        _uri(baseUrl, '/api/auth/change-password'),
        headers: {
          ..._jsonHeaders,
          'authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'current_password': currentPassword,
          'new_password': newPassword,
        }),
      ),
    );
    _decode(response);
  }

  /// POST /api/auth/avatar — multipart upload; server sniffs the real
  /// image type. Returns (hasAvatar, avatarV) for session refresh.
  Future<(bool, int)> uploadAvatar({
    required String baseUrl,
    required String token,
    required List<int> bytes,
    required String fileName,
  }) async {
    final ext = fileName.split('.').last.toLowerCase();
    final subtype = switch (ext) {
      'png' => 'png',
      'jpg' || 'jpeg' => 'jpeg',
      'webp' => 'webp',
      'gif' => 'gif',
      _ => 'jpeg',
    };
    final request = http.MultipartRequest(
      'POST',
      _uri(baseUrl, '/api/auth/avatar'),
    )
      ..headers['authorization'] = 'Bearer $token'
      ..headers['accept'] = 'application/json'
      ..files.add(http.MultipartFile.fromBytes(
        'file',
        bytes,
        filename: fileName,
        contentType: MediaType('image', subtype),
      ));

    http.StreamedResponse streamed;
    try {
      streamed = await _client.send(request);
    } catch (e) {
      if (isNetworkError(e)) {
        throw const ApiException(
          'Cannot reach the server. Check the address and your network.',
          isNetworkError: true,
        );
      }
      rethrow;
    }
    final response = await http.Response.fromStream(streamed);
    final data = _decode(response);
    return (
      data['has_avatar'] == true || data['has_avatar'] == 1,
      int.tryParse(data['avatar_v']?.toString() ?? '') ?? 0,
    );
  }

  /// DELETE /api/auth/avatar — remove the stored photo.
  Future<void> deleteAvatar({
    required String baseUrl,
    required String token,
  }) async {
    final response = await _safeRequest(
      () => _client.delete(
        _uri(baseUrl, '/api/auth/avatar'),
        headers: {
          ..._jsonHeaders,
          'authorization': 'Bearer $token',
        },
      ),
    );
    _decode(response);
  }

  Uri _uri(String baseUrl, String path) {
    final normalized = normalizeBaseUrl(baseUrl);
    if (normalized.isEmpty) {
      throw const ApiException('Server address is required.');
    }
    return Uri.parse('$normalized$path');
  }

  Future<http.Response> _safeRequest(
    Future<http.Response> Function() request,
  ) async {
    try {
      return await request();
    } on FormatException {
      throw const ApiException('Invalid server response format.');
    } catch (e) {
      if (isNetworkError(e)) {
        throw const ApiException(
          'Cannot reach the server. Check the address and your network.',
          isNetworkError: true,
        );
      }
      rethrow;
    }
  }

  Map<String, dynamic> _decode(http.Response response) {
    if (response.bodyBytes.isEmpty) {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return <String, dynamic>{'ok': true};
      }
      throw const ApiException('The server returned an empty response.');
    }

    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    if (decoded is! Map) {
      throw const ApiException('Invalid server response.');
    }

    final data = Map<String, dynamic>.from(decoded);
    final message =
        (data['error'] ?? data['message'] ?? 'Request failed.').toString();

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(message, statusCode: response.statusCode);
    }

    return data;
  }

  static const Map<String, String> _jsonHeaders = {
    'accept': 'application/json',
    'content-type': 'application/json',
  };
}
