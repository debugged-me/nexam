import 'package:flutter/material.dart';
import 'package:printing/printing.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/domain/instructor_session.dart';
import '../data/exam_api.dart';
import '../domain/exam.dart';

/// Read-only exam summary plus the print-ready documents the server
/// renders — exam papers, answer keys, and OMR sheets per set, and the
/// TOS report. Documents are fetched as PDF bytes and handed to the
/// system print dialog (which can also save/share them).
/// (Assembly stays on the web platform; mobile prints what it makes.)
void showExamDetailSheet(
  BuildContext context,
  ExamSummary exam, {
  required InstructorSession session,
}) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    backgroundColor: AppTheme.card,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (ctx) => _ExamDetailSheet(exam: exam, session: session),
  );
}

class _ExamDetailSheet extends StatefulWidget {
  const _ExamDetailSheet({required this.exam, required this.session});

  final ExamSummary exam;
  final InstructorSession session;

  @override
  State<_ExamDetailSheet> createState() => _ExamDetailSheetState();
}

class _ExamDetailSheetState extends State<_ExamDetailSheet> {
  final _api = ExamApi();

  /// "type:set" of the document currently downloading — shows a spinner
  /// in that row and blocks double taps.
  String? _busy;

  Future<void> _print(String type, {String? set}) async {
    final key = '$type:${set ?? ''}';
    if (_busy != null) return;
    setState(() => _busy = key);
    try {
      final (bytes, name) = await _api.downloadExamPdf(
        baseUrl: widget.session.baseUrl,
        token: widget.session.token,
        examId: widget.exam.id,
        type: type,
        set: set,
      );
      if (!mounted) return;
      await Printing.layoutPdf(
        name: name.replaceAll('.pdf', ''),
        onLayout: (_) async => bytes,
      );
    } on ApiException catch (e) {
      _toast(e.message);
    } catch (_) {
      _toast('Could not load the document.');
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final exam = widget.exam;
    final published = exam.status.toLowerCase() == 'published';
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppTheme.tintBlue,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(Icons.description_rounded,
                      size: 21, color: AppTheme.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        exam.title,
                        style: AppTheme.rowTitle(size: 16),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        exam.subjectName,
                        style: AppTheme.body(size: 13),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Container(
              decoration: BoxDecoration(
                color: AppTheme.surface,
                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              ),
              child: Column(
                children: [
                  _detailRow(
                    'Status',
                    value: exam.status.isEmpty
                        ? '—'
                        : exam.status[0].toUpperCase() +
                            exam.status.substring(1),
                    valueColor:
                        published ? AppTheme.success : AppTheme.textMuted,
                  ),
                  _detailRow(
                    'Questions per set',
                    value: '${exam.questionCount}',
                  ),
                  _detailRow(
                    'Set items',
                    value: '${exam.setItemCount}',
                    last: true,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            Text(
              'PRINT DOCUMENTS',
              style: AppTheme.micro(),
            ),
            const SizedBox(height: 10),
            _docGroup('SET A', [
              ('Exam paper', 'exam', 'A'),
              ('Answer key', 'answerkey', 'A'),
              ('OMR sheet', 'omr', 'A'),
            ]),
            const SizedBox(height: 8),
            _docGroup('SET B', [
              ('Exam paper', 'exam', 'B'),
              ('Answer key', 'answerkey', 'B'),
              ('OMR sheet', 'omr', 'B'),
            ]),
            const SizedBox(height: 8),
            _docGroup('REPORT', [
              ('Table of specifications', 'tos-report', null),
            ]),
            const SizedBox(height: 14),
            Row(
              children: [
                Icon(Icons.info_outline_rounded,
                    size: 15, color: AppTheme.textFaint),
                const SizedBox(width: 7),
                Expanded(
                  child: Text(
                    'Documents are rendered on the server with your letterhead — the print sheet can also save them as PDF.',
                    style: AppTheme.body(size: 12, color: AppTheme.textMuted),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// A labelled group of printable documents — header micro label plus
  /// one row per document.
  Widget _docGroup(String label, List<(String, String, String?)> docs) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
            child: Text(
              label,
              style: AppTheme.micro(color: AppTheme.textFaint),
            ),
          ),
          for (var i = 0; i < docs.length; i++)
            _docRow(
              docs[i].$1,
              type: docs[i].$2,
              set: docs[i].$3,
              last: i == docs.length - 1,
            ),
        ],
      ),
    );
  }

  Widget _docRow(
    String label, {
    required String type,
    String? set,
    bool last = false,
  }) {
    final busy = _busy == '$type:${set ?? ''}';
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: busy ? null : () => _print(type, set: set),
        borderRadius: last
            ? const BorderRadius.vertical(
                bottom: Radius.circular(AppTheme.radiusMd))
            : null,
        child: Container(
          padding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          decoration: BoxDecoration(
            border: last
                ? null
                : Border(
                    bottom: BorderSide(
                        color: AppTheme.cardBorder
                            .withValues(alpha: 0.6)),
                  ),
          ),
          child: Row(
            children: [
              Icon(
                switch (type) {
                  'exam' => Icons.description_outlined,
                  'answerkey' => Icons.key_rounded,
                  'omr' => Icons.bubble_chart_outlined,
                  _ => Icons.table_chart_outlined,
                },
                size: 18,
                color: AppTheme.primary,
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Text(
                  label,
                  style: AppTheme.label(
                    size: 13.5,
                    weight: FontWeight.w600,
                  ),
                ),
              ),
              if (busy)
                const SizedBox(
                  width: 17,
                  height: 17,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else
                Icon(
                  Icons.print_rounded,
                  size: 18,
                  color: AppTheme.textMuted,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

Widget _detailRow(String label,
    {required String value, Color? valueColor, bool last = false}) {
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
    decoration: BoxDecoration(
      border: last
          ? null
          : Border(
              bottom: BorderSide(color: AppTheme.cardBorder),
            ),
    ),
    child: Row(
      children: [
        Text(label, style: AppTheme.body(size: 13.5)),
        const Spacer(),
        Text(
          value,
          style: AppTheme.label(
            size: 13.5,
            weight: FontWeight.w700,
            color: valueColor ?? AppTheme.textDark,
          ),
        ),
      ],
    ),
  );
}
