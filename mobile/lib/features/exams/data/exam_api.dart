import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../../../core/network/api_exception.dart';
import '../../../core/network/net_error.dart';
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

  /// GET /api/exams/:id/download/:type — fetch a generated PDF as bytes
  /// for the system print dialog or share sheet.
  ///
  /// [type]: 'exam' | 'answerkey' | 'omr' | 'tos-report'.
  /// [set]: 'A' | 'B' — required for exam/answerkey/omr. Returns
  /// (bytes, filename) so callers can name shared files without parsing
  /// Content-Disposition.
  Future<(Uint8List, String)> downloadExamPdf({
    required String baseUrl,
    required String token,
    required String examId,
    required String type,
    String? set,
  }) async {
    final query = set != null ? '?set=$set' : '';
    final response = await _safeRequest(
      () => _client.get(
        Uri.parse('$baseUrl/api/exams/$examId/download/$type$query'),
        headers: {
          'authorization': 'Bearer $token',
        },
      ),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      try {
        _decode(response); // throws ApiException with the server message
      } on ApiException {
        rethrow;
      } catch (_) {
        throw ApiException(
            'Document request failed (${response.statusCode}).',
            statusCode: response.statusCode);
      }
    }
    final disposition = response.headers['content-disposition'] ?? '';
    final match = RegExp(r'filename="?([^";]+)"?').firstMatch(disposition);
    final name =
        match?.group(1) ?? 'exam_${examId}_$type${set != null ? '_$set' : ''}.pdf';
    return (response.bodyBytes, name);
  }

  Map<String, String> _headers(String token) => {
        'accept': 'application/json',
        'authorization': 'Bearer $token',
      };

  Future<http.Response> _safeRequest(
    Future<http.Response> Function() request,
  ) async {
    try {
      return await request();
    } catch (e) {
      if (isNetworkError(e)) {
        throw const ApiException(
          'Cannot reach the server. Check your network connection.',
          isNetworkError: true,
        );
      }
      rethrow;
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
