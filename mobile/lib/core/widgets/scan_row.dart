import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_theme.dart';

/// "6/3 14:05" — the compact timestamp used in scan row subtitles.
String formatScanTimestamp(String? dateStr) {
  if (dateStr == null || dateStr.isEmpty) return '';
  try {
    final dt = DateTime.parse(dateStr);
    return '${dt.month}/${dt.day} '
        '${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
  } catch (_) {
    return '';
  }
}

/// Transaction-style scan row — tinted status tile, student + exam meta,
/// right-aligned score. Shared by the dashboard card (inside a bordered
/// card with hairlines) and the Scans list (standalone cards), so wrap
/// it in whichever container fits.
class ScanRow extends StatelessWidget {
  const ScanRow({super.key, required this.scan, this.onTap});

  final Map<String, dynamic> scan;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final score =
        double.tryParse(scan['score']?.toString() ?? '0') ?? 0;
    final needsReview =
        scan['needs_review'] == 1 || scan['needs_review'] == true;
    final accent = needsReview ? AppTheme.warning : AppTheme.success;
    final tint = needsReview ? AppTheme.tintAmber : AppTheme.tintGreen;

    final row = Padding(
      padding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: tint,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              needsReview
                  ? Icons.flag_rounded
                  : Icons.check_circle_outline_rounded,
              size: 19,
              color: accent,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  scan['student_name']?.toString() ?? 'Unknown',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTheme.rowTitle(),
                ),
                const SizedBox(height: 2),
                Text(
                  '${scan['exam_title'] ?? ''} • ${formatScanTimestamp(scan['scanned_at']?.toString())}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTheme.body(size: 12),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${score.toStringAsFixed(0)}%',
                style: AppTheme.display(16,
                    weight: FontWeight.w700,
                    color: accent,
                    letterSpacing: -0.3),
              ),
              Text(
                '${scan['correct_count'] ?? 0}/${scan['total_items'] ?? 0}',
                style: AppTheme.body(size: 11.5),
              ),
            ],
          ),
          if (onTap != null) ...[
            const SizedBox(width: 2),
            const Icon(Icons.chevron_right_rounded,
                size: 18, color: AppTheme.textFaint),
          ],
        ],
      ),
    );

    if (onTap == null) return row;
    return InkWell(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap!();
      },
      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      child: row,
    );
  }
}
