/// Exam summary returned by GET /api/exams.
class ExamSummary {
  const ExamSummary({
    required this.id,
    required this.title,
    required this.subjectId,
    required this.subjectName,
    required this.status,
    required this.setItemCount,
    required this.questionCount,
  });

  final String id;
  final String title;
  final String subjectId;
  final String subjectName;
  final String status;
  final int setItemCount;
  final int questionCount;

  factory ExamSummary.fromJson(Map<String, dynamic> json) {
    return ExamSummary(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      subjectId: json['subject_id'] as String? ?? '',
      subjectName: json['subject_name'] as String? ?? '',
      status: json['status'] as String? ?? 'draft',
      setItemCount: json['set_item_count'] as int? ?? 0,
      questionCount: json['question_count'] as int? ?? 0,
    );
  }
}

/// Exam set (A/B) returned by GET /api/exams/:id/sets.
///
/// The API column is `set_label` — reading `label` here was the bug that
/// made every scan fall back to Set A's ordering.
class ExamSet {
  const ExamSet({
    required this.id,
    required this.examId,
    required this.label,
    required this.questionCount,
  });

  final String id;
  final String examId;
  final String label;
  final int questionCount;

  factory ExamSet.fromJson(Map<String, dynamic> json) {
    return ExamSet(
      id: json['id'] as String? ?? '',
      examId: json['exam_id'] as String? ?? '',
      // API returns set_label; accept label as a fallback for compatibility.
      label: (json['set_label'] ?? json['label']) as String? ?? '',
      questionCount: json['question_count'] as int? ?? 0,
    );
  }
}

/// One item's bubble-row layout decoded from the QR `types` code.
///
/// Codes (written by omrService.js):
///   'm4'  — MCQ with N option bubbles (letter = option count)
///   't'   — true/false, bubbles [T, F]
///   'M4'  — matching with N premise sub-rows of A–E bubbles
///   'i'   — identification, instructor-grade bubbles [C, I]
class OmrItemLayout {
  const OmrItemLayout({
    required this.type,
    required this.rows,
    required this.choices,
  });

  /// 'mcq' | 'true_false' | 'matching' | 'identification'
  final String type;

  /// Number of bubble rows this item occupies (matching = premise count).
  final int rows;

  /// Bubble labels per row.
  final List<String> choices;

  static const _letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  static OmrItemLayout fromCode(String code) {
    if (code.isEmpty) {
      return const OmrItemLayout(type: 'mcq', rows: 1, choices: ['A', 'B', 'C', 'D']);
    }
    switch (code[0]) {
      case 'm': {
        final n = int.tryParse(code.substring(1)) ?? 4;
        final count = n.clamp(2, 8);
        return OmrItemLayout(
          type: 'mcq',
          rows: 1,
          choices: _letters.substring(0, count).split(''),
        );
      }
      case 't':
        return const OmrItemLayout(type: 'true_false', rows: 1, choices: ['T', 'F']);
      case 'M': {
        final n = int.tryParse(code.substring(1)) ?? 4;
        final count = n.clamp(1, 8);
        return OmrItemLayout(
          type: 'matching',
          rows: count,
          choices: _letters.substring(0, 5).split(''),
        );
      }
      case 'i':
        return const OmrItemLayout(type: 'identification', rows: 1, choices: ['C', 'I']);
      default:
        return const OmrItemLayout(type: 'mcq', rows: 1, choices: ['A', 'B', 'C', 'D']);
    }
  }
}

/// QR code payload embedded in the OMR answer sheet.
///
/// Written by omrService.js — the sheet is self-describing: the scanner
/// knows the exam, the exact set, and every item's bubble layout before a
/// single API call.
class OmrQrPayload {
  const OmrQrPayload({
    required this.version,
    required this.examId,
    required this.setId,
    required this.set,
    required this.count,
    required this.items,
  });

  final int version;

  final String examId;

  /// Exact exam_sets.id from the QR — no server-side set lookup needed.
  final String? setId;
  final String set;
  final int count;

  /// Per-item bubble layout decoded from the `types` codes.
  final List<OmrItemLayout> items;

  factory OmrQrPayload.fromJson(Map<String, dynamic> json) {
    final codes = (json['types'] as List?)?.cast<String>() ?? const <String>[];
    final count = json['count'] as int? ?? codes.length;
    final items = List.generate(
      count,
      (i) => i < codes.length
          ? OmrItemLayout.fromCode(codes[i])
          : OmrItemLayout.fromCode('m4'),
    );
    return OmrQrPayload(
      version: json['v'] as int? ?? 1,
      examId: json['examId'] as String? ?? '',
      setId: json['setId'] as String?,
      set: json['set'] as String? ?? '',
      count: count,
      items: items,
    );
  }

  Map<String, dynamic> toJson() => {
        'v': version,
        'examId': examId,
        'setId': setId,
        'set': set,
        'count': count,
      };
}
