import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/network/api_exception.dart';
import '../../../core/network/net_error.dart';

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
      id: json['id']?.toString() ?? '',
      examId: json['examId']?.toString() ?? json['exam_id']?.toString() ?? '',
      studentName: json['studentName']?.toString() ?? json['student_name']?.toString(),
      totalItems: int.tryParse((json['totalItems'] ?? json['total_items'])?.toString() ?? '') ?? 0,
      correctCount: int.tryParse((json['correctCount'] ?? json['correct_count'])?.toString() ?? '') ?? 0,
      score: (json['score'] as num?)?.toDouble() ?? 0,
      needsReview: json['needsReview'] == true ||
          json['needsReview'] == 1 ||
          json['needs_review'] == true ||
          json['needs_review'] == 1,
      ambiguousCount:
          int.tryParse((json['ambiguousCount'] ?? json['ambiguous_count'])?.toString() ?? '') ?? 0,
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
      itemNumber: int.tryParse(json['item_number']?.toString() ?? '') ?? 0,
      markedAnswer: json['marked_answer']?.toString() ?? '',
      correctAnswer: json['correct_answer']?.toString(),
      isCorrect: json['is_correct'] == null
          ? null
          : (json['is_correct'] == true || json['is_correct'] == 1),
      ambiguous: json['ambiguous'] == true || json['ambiguous'] == 1,
      questionType: json['question_type']?.toString(),
      stem: json['stem']?.toString(),
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

  /// Reads/writes carry a hard ceiling — a stalled connection must surface
  /// as a network failure (outbox-queued), not a spinner that never ends.
  static const _timeout = Duration(seconds: 15);

  /// POST /api/scans — submit a scanned OMR result.
  ///
  /// [clientScanId] is the idempotency key: minted once per scan and reused
  /// on retries and outbox replays, so a re-sent upload returns the stored
  /// result instead of writing a duplicate.
  Future<ScanResult> submitScan({
    required String baseUrl,
    required String token,
    required String examId,
    String? examSetId,
    String? set,
    String? studentName,
    String? studentNumber,
    String? clientScanId,
    bool replaceExisting = false,
    required List<ScannedAnswer> answers,
  }) async {
    final response = await _safeRequest(
      () => _client.post(
        Uri.parse('$baseUrl/api/scans'),
        headers: _headers(token),
        body: jsonEncode({
          'examId': examId,
          if (examSetId != null) 'examSetId': examSetId,
          if (set != null) 'set': set,
          if (studentName != null) 'studentName': studentName,
          if (studentNumber != null) 'studentNumber': studentNumber,
          if (clientScanId != null) 'clientScanId': clientScanId,
          if (replaceExisting) 'replaceExisting': true,
          'answers': answers.map((a) => a.toJson()).toList(),
        }),
      ).timeout(_timeout),
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
      ).timeout(_timeout),
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
      ).timeout(_timeout),
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
      ).timeout(_timeout),
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
          'correctedAnswers': corrections.entries
              .map((e) => {'itemNumber': e.key, 'markedAnswer': e.value})
              .toList(),
        }),
      ).timeout(_timeout),
    );
    final data = _decode(response);
    return ScanResult.fromJson(data);
  }

  Map<String, String> _headers(String token) => {
        'accept': 'application/json',
        'content-type': 'application/json',
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
      throw ApiException(message, statusCode: response.statusCode, code: data['code']?.toString());
    }
    return data;
  }
}
