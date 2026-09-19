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

/// Result returned by POST /api/scans and the review endpoint.
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
      examId: json['examId'] as String? ?? json['exam_id'] as String? ?? '',
      studentName: json['studentName'] as String? ?? json['student_name'] as String?,
      totalItems: json['totalItems'] as int? ?? json['total_items'] as int? ?? 0,
      correctCount: json['correctCount'] as int? ?? json['correct_count'] as int? ?? 0,
      score: (json['score'] as num?)?.toDouble() ?? 0,
      needsReview: json['needsReview'] == true ||
          json['needsReview'] == 1 ||
          json['needs_review'] == true ||
          json['needs_review'] == 1,
      ambiguousCount:
          json['ambiguousCount'] as int? ?? json['ambiguous_count'] as int? ?? 0,
    );
  }
}

/// One stored answer row from GET /api/scans/:id.
class ScanAnswerItem {
  const ScanAnswerItem({
    required this.itemNumber,
    required this.markedAnswer,
    required this.correctAnswer,
    required this.isCorrect,
    required this.ambiguous,
    this.questionType,
    this.stem,
  });

  final int itemNumber;
  final String markedAnswer;
  final String? correctAnswer;
  final bool? isCorrect;
  final bool ambiguous;
  final String? questionType;
  final String? stem;

  factory ScanAnswerItem.fromJson(Map<String, dynamic> json) {
    return ScanAnswerItem(
      itemNumber: json['item_number'] as int? ?? 0,
      markedAnswer: json['marked_answer'] as String? ?? '',
      correctAnswer: json['correct_answer'] as String?,
      isCorrect: json['is_correct'] == null
          ? null
          : (json['is_correct'] == true || json['is_correct'] == 1),
      ambiguous: json['ambiguous'] == true || json['ambiguous'] == 1,
      questionType: json['question_type'] as String?,
      stem: json['stem'] as String?,
    );
  }
}

/// Full scan detail: the scan row plus its per-item answers.
class ScanDetail {
  const ScanDetail({required this.scan, required this.answers});

  final Map<String, dynamic> scan;
  final List<ScanAnswerItem> answers;
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

  /// GET /api/scans — list recent scan results (optionally per exam).
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
        ? '?${params.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&')}'
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

  /// GET /api/scans/exam/:examId — scans for one exam.
  Future<List<Map<String, dynamic>>> listScansForExam({
    required String baseUrl,
    required String token,
    required String examId,
  }) async {
    final response = await _safeRequest(
      () => _client.get(
        Uri.parse('$baseUrl/api/scans/exam/$examId'),
        headers: _headers(token),
      ),
    );
    final data = _decode(response);
    final scans = data['scans'] as List? ?? [];
    return scans.map((s) => Map<String, dynamic>.from(s as Map)).toList();
  }

  /// GET /api/scans/:id — full scan detail with per-item answers.
  Future<ScanDetail> getScan({
    required String baseUrl,
    required String token,
    required String scanId,
  }) async {
    final response = await _safeRequest(
      () => _client.get(
        Uri.parse('$baseUrl/api/scans/$scanId'),
        headers: _headers(token),
      ),
    );
    final data = _decode(response);
    final answers = (data['answers'] as List? ?? [])
        .map((a) => ScanAnswerItem.fromJson(Map<String, dynamic>.from(a as Map)))
        .toList();
    return ScanDetail(
      scan: Map<String, dynamic>.from(data['scan'] as Map? ?? {}),
      answers: answers,
    );
  }

  /// POST /api/scans/:id/review — submit instructor corrections.
  ///
  /// [corrections] maps item_number → corrected canonical marked answer.
  /// The server recounts the whole scan and returns the updated result.
  Future<ScanResult> reviewScan({
    required String baseUrl,
    required String token,
    required String scanId,
    required Map<int, String> corrections,
  }) async {
    final response = await _safeRequest(
      () => _client.post(
        Uri.parse('$baseUrl/api/scans/$scanId/review'),
        headers: _headers(token),
        body: jsonEncode({
          'corrections': corrections.entries
              .map((e) => {'itemNumber': e.key, 'markedAnswer': e.value})
              .toList(),
        }),
      ),
    );
    final data = _decode(response);
    return ScanResult.fromJson(data);
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
