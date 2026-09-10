import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../../../core/network/api_exception.dart';
import '../domain/exam.dart';

/// API client for exam-related endpoints.
///
/// All calls require a valid JWT token (from the instructor session).
class ExamApi {
  ExamApi({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  /// GET /api/exams — list all exams for the authenticated instructor.
  Future<List<ExamSummary>> listExams({
    required String baseUrl,
    required String token,
  }) async {
    final response = await _safeRequest(
      () => _client.get(
        Uri.parse('$baseUrl/api/exams'),
        headers: _headers(token),
      ),
    );
    final data = _decode(response);
    final exams = data['exams'] as List? ?? [];
    return exams
        .map((e) => ExamSummary.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  /// GET /api/exams/:id/sets — list exam sets (A/B) for an exam.
  Future<List<ExamSet>> listExamSets({
    required String baseUrl,
    required String token,
    required String examId,
  }) async {
    final response = await _safeRequest(
      () => _client.get(
        Uri.parse('$baseUrl/api/exams/$examId/sets'),
        headers: _headers(token),
      ),
    );
    final data = _decode(response);
    final sets = data['sets'] as List? ?? [];
    return sets
        .map((s) => ExamSet.fromJson(Map<String, dynamic>.from(s as Map)))
        .toList();
  }

  Map<String, String> _headers(String token) => {
        HttpHeaders.acceptHeader: 'application/json',
        HttpHeaders.authorizationHeader: 'Bearer $token',
      };

  Future<http.Response> _safeRequest(
    Future<http.Response> Function() request,
  ) async {
    try {
      return await request();
    } on SocketException {
      throw const ApiException(
        'Cannot reach the server. Check your network connection.',
        isNetworkError: true,
      );
    }
  }

  Map<String, dynamic> _decode(http.Response response) {
    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    if (decoded is! Map) {
      throw const ApiException('Invalid server response.');
    }
    final data = Map<String, dynamic>.from(decoded);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = (data['error'] ?? 'Request failed.').toString();
      throw ApiException(message, statusCode: response.statusCode);
    }
    return data;
  }
}
