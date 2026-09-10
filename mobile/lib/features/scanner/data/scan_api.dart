import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../../../core/network/api_exception.dart';

/// A single detected answer from the OMR scanner.
class ScannedAnswer {
  const ScannedAnswer({
    required this.itemNumber,
    required this.markedAnswer,
    this.ambiguous = false,
  });

  final int itemNumber;
  final String markedAnswer;
  final bool ambiguous;

  Map<String, dynamic> toJson() => {
        'itemNumber': itemNumber,
        'markedAnswer': markedAnswer,
        'ambiguous': ambiguous,
      };
}

/// Result returned by POST /api/scans.
class ScanResult {
  const ScanResult({
    required this.id,
    required this.examId,
    required this.studentName,
    required this.totalItems,
    required this.correctCount,
    required this.score,
    required this.needsReview,
    required this.ambiguousCount,
  });

  final String id;
  final String examId;
  final String? studentName;
  final int totalItems;
  final int correctCount;
  final double score;
  final bool needsReview;
  final int ambiguousCount;

  factory ScanResult.fromJson(Map<String, dynamic> json) {
    return ScanResult(
      id: json['id'] as String? ?? '',
      examId: json['examId'] as String? ?? '',
      studentName: json['studentName'] as String?,
      totalItems: json['totalItems'] as int? ?? 0,
      correctCount: json['correctCount'] as int? ?? 0,
      score: (json['score'] as num?)?.toDouble() ?? 0,
      needsReview: json['needsReview'] == true || json['needsReview'] == 1,
      ambiguousCount: json['ambiguousCount'] as int? ?? 0,
    );
  }
}

/// API client for scan submission and review.
class ScanApi {
  ScanApi({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  /// POST /api/scans — submit a scanned OMR result.
  Future<ScanResult> submitScan({
    required String baseUrl,
    required String token,
    required String examId,
    String? examSetId,
    String? studentName,
    String? studentNumber,
    required List<ScannedAnswer> answers,
  }) async {
    final response = await _safeRequest(
      () => _client.post(
        Uri.parse('$baseUrl/api/scans'),
        headers: _headers(token),
        body: jsonEncode({
          'examId': examId,
          if (examSetId != null) 'examSetId': examSetId,
          if (studentName != null) 'studentName': studentName,
          if (studentNumber != null) 'studentNumber': studentNumber,
          'answers': answers.map((a) => a.toJson()).toList(),
        }),
      ),
    );
    final data = _decode(response);
    return ScanResult.fromJson(data);
  }

  /// GET /api/scans — list recent scan results.
  Future<List<Map<String, dynamic>>> listScans({
    required String baseUrl,
    required String token,
    String? examId,
    bool needsReview = false,
  }) async {
    final params = <String, String>{};
    if (examId != null) params['exam_id'] = examId;
    if (needsReview) params['needs_review'] = 'true';
    final query = params.isNotEmpty
        ? '?${params.entries.map((e) => '${e.key}=${e.value}').join('&')}'
        : '';
    final response = await _safeRequest(
      () => _client.get(
        Uri.parse('$baseUrl/api/scans$query'),
        headers: _headers(token),
      ),
    );
    final data = _decode(response);
    final scans = data['scans'] as List? ?? [];
    return scans.map((s) => Map<String, dynamic>.from(s as Map)).toList();
  }

  Map<String, String> _headers(String token) => {
        HttpHeaders.acceptHeader: 'application/json',
        HttpHeaders.contentTypeHeader: 'application/json',
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
