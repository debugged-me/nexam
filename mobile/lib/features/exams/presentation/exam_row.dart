import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme/app_theme.dart';
import '../../auth/domain/instructor_session.dart';
import '../domain/exam.dart';
import 'exam_detail_sheet.dart';

/// Exam ledger row — blue doc tile, title + subject meta, status pill.
/// Shared by the dashboard card and the Exams list. Tapping opens the
/// detail sheet (which prints documents when [session] is provided).
class ExamRow extends StatelessWidget {
  const ExamRow({super.key, required this.exam, this.session, this.onTap});

  final ExamSummary exam;
  final InstructorSession? session;

  /// Custom tap behavior; defaults to the exam detail sheet.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final published = exam.status.toLowerCase() == 'published';
    return InkWell(
      onTap: () {
        HapticFeedback.selectionClick();
        final session = this.session;
        (onTap ??
            () {
              if (session == null) return;
              showExamDetailSheet(context, exam, session: session);
            })();
      },
      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      child: Padding(
        padding: const EdgeInsets.symmetric(
            horizontal: 14, vertical: 13),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppTheme.tintBlue,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                Icons.description_rounded,
                size: 19,
                color: AppTheme.primary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    exam.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTheme.rowTitle(),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${exam.subjectName} • ${exam.questionCount} questions',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTheme.body(size: 12),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 9, vertical: 4),
              decoration: BoxDecoration(
                color: published
                    ? AppTheme.tintGreen
                    : AppTheme.surfaceAlt,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                exam.status.isEmpty
                    ? ''
                    : exam.status[0].toUpperCase() +
                        exam.status.substring(1),
                style: AppTheme.label(
                  size: 11,
                  weight: FontWeight.w700,
                  color: published
                      ? AppTheme.success
                      : AppTheme.textMuted,
                ),
              ),
            ),
            const SizedBox(width: 2),
            Icon(Icons.chevron_right_rounded,
                size: 18, color: AppTheme.textFaint),
          ],
        ),
      ),
    );
  }
}
