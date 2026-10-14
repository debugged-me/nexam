import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../domain/exam.dart';

/// Read-only exam summary — mobile is for grading; assembly stays on the
/// web platform. Shown from both the Exams list and dashboard rows.
void showExamDetailSheet(BuildContext context, ExamSummary exam) {
  final published = exam.status.toLowerCase() == 'published';
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    backgroundColor: AppTheme.card,
    shape: const RoundedRectangleBorder(
      borderRadius:
          BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (ctx) => SafeArea(
      child: Padding(
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
                    crossAxisAlignment:
                        CrossAxisAlignment.start,
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
                borderRadius:
                    BorderRadius.circular(AppTheme.radiusMd),
              ),
              child: Column(
                children: [
                  _detailRow(
                    'Status',
                    value: exam.status.isEmpty
                        ? '—'
                        : exam.status[0].toUpperCase() +
                            exam.status.substring(1),
                    valueColor: published
                        ? AppTheme.success
                        : AppTheme.textMuted,
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
            const SizedBox(height: 14),
            Row(
              children: [
                Icon(Icons.info_outline_rounded,
                    size: 15, color: AppTheme.textFaint),
                const SizedBox(width: 7),
                Expanded(
                  child: Text(
                    'Exams are assembled on the web platform — this app scans and grades them.',
                    style: AppTheme.body(
                        size: 12, color: AppTheme.textMuted),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}

Widget _detailRow(String label,
    {required String value, Color? valueColor, bool last = false}) {
  return Container(
    padding: const EdgeInsets.symmetric(
        horizontal: 16, vertical: 13),
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
