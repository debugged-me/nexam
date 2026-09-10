import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../../../core/network/api_exception.dart';
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
          HttpHeaders.authorizationHeader: 'Bearer $token',
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
    } on SocketException {
      throw const ApiException(
        'Cannot reach the server. Check the address and your network.',
        isNetworkError: true,
      );
    } on HttpException {
      throw const ApiException(
        'Unexpected HTTP error while contacting the server.',
        isNetworkError: true,
      );
    } on FormatException {
      throw const ApiException('Invalid server response format.');
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
    HttpHeaders.acceptHeader: 'application/json',
    HttpHeaders.contentTypeHeader: 'application/json',
  };
}
