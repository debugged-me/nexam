import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/network/api_exception.dart';
import '../../../core/network/net_error.dart';

/// One roster entry, decrypted server-side — enough to autocomplete the
/// capture form without ever exposing another instructor's students.
class StudentSuggestion {
  const StudentSuggestion({
    required this.id,
    required this.fullName,
    this.studentNumber,
    this.scanCount = 0,
  });

  final String id;
  final String fullName;
  final String? studentNumber;
  final int scanCount;

  factory StudentSuggestion.fromJson(Map<String, dynamic> json) =>
      StudentSuggestion(
        id: json['id'] as String,
        fullName: (json['full_name'] ?? '').toString(),
        studentNumber: json['student_number']?.toString(),
        scanCount: (json['scan_count'] as num?)?.toInt() ?? 0,
      );
}

/// GET /api/students?q= — the roster search used by the capture form's
/// autocomplete. Picking a suggestion fills the exact stored name + number
/// so the server-side number/name match lands on the same record instead
/// of spawning a typo'd duplicate.
class StudentsApi {
  StudentsApi({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;
  static const _timeout = Duration(seconds: 10);

  Future<List<StudentSuggestion>> search({
    required String baseUrl,
    required String token,
    String query = '',
  }) async {
    final uri = Uri.parse('$baseUrl/api/students').replace(
      queryParameters: query.isEmpty ? null : {'q': query},
    );
    http.Response response;
    try {
      response = await _client
          .get(uri, headers: {
            'accept': 'application/json',
            'authorization': 'Bearer $token',
          })
          .timeout(_timeout);
    } catch (e) {
      if (isNetworkError(e)) {
        throw const ApiException(
          'Cannot reach the server. Check your network connection.',
          isNetworkError: true,
        );
      }
      rethrow;
    }
    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        (decoded is Map ? decoded['error'] : null)?.toString() ?? 'Request failed.',
        statusCode: response.statusCode,
      );
    }
    final list = (decoded as Map)['students'] as List? ?? const [];
    return list
        .map((s) => StudentSuggestion.fromJson(Map<String, dynamic>.from(s)))
        .toList();
  }
}
