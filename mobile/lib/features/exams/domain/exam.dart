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
      label: json['label'] as String? ?? '',
      questionCount: json['question_count'] as int? ?? 0,
    );
  }
}

/// QR code payload embedded in the OMR answer sheet.
class OmrQrPayload {
  const OmrQrPayload({
    required this.examId,
    required this.set,
    required this.count,
  });

  final String examId;
  final String set;
  final int count;

  factory OmrQrPayload.fromJson(Map<String, dynamic> json) {
    return OmrQrPayload(
      examId: json['examId'] as String? ?? '',
      set: json['set'] as String? ?? '',
      count: json['count'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'examId': examId,
        'set': set,
        'count': count,
      };
}
