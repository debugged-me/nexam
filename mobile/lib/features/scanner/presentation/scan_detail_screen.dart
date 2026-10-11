import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/nexam_app_bar.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../core/widgets/states.dart';
import '../data/scan_api.dart';

/// Scan detail screen — score hero on top, per-item ledger below. The
/// instructor taps an item to correct it; corrections batch into one
/// review POST that recounts the whole scan server-side.
class ScanDetailScreen extends StatefulWidget {
  const ScanDetailScreen({
    super.key,
    required this.scanId,
    required this.baseUrl,
    required this.token,
    required this.onSessionExpired,
    this.onReviewed,
  });

  final String scanId;
  final String baseUrl;
  final String token;
  final VoidCallback onSessionExpired;

  /// Called after a successful review so the dashboard can refresh.
  final VoidCallback? onReviewed;

  @override
  State<ScanDetailScreen> createState() => _ScanDetailScreenState();
}

class _ScanDetailScreenState extends State<ScanDetailScreen> {
  final _scanApi = ScanApi();
  ScanDetail? _detail;
  bool _loading = true;
  String? _error;
  bool _submitting = false;

  /// item_number → corrected marked answer (canonical form).
  final Map<int, String> _corrections = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final detail = await _scanApi.getScan(
        baseUrl: widget.baseUrl,
        token: widget.token,
        scanId: widget.scanId,
      );
      if (mounted) {
        setState(() {
          _detail = detail;
          _loading = false;
        });
      }
    } on ApiException catch (e) {
      if (e.isSessionExpired) {
        widget.onSessionExpired();
        return;
      }
      if (mounted) setState(() { _error = e.message; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = '$e'; _loading = false; });
    }
  }

  Future<void> _submitReview() async {
    if (_corrections.isEmpty) return;
    setState(() => _submitting = true);
    try {
      final result = await _scanApi.reviewScan(
        baseUrl: widget.baseUrl,
        token: widget.token,
        scanId: widget.scanId,
        corrections: _corrections,
      );
      if (!mounted) return;
      _corrections.clear();
      widget.onReviewed?.call();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Updated score: ${result.score}% '
              '(${result.correctCount}/${result.totalItems})'),
          backgroundColor: AppTheme.success,
        ),
      );
      await _load();
    } on ApiException catch (e) {
      if (e.isSessionExpired) {
        widget.onSessionExpired();
        return;
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  /// Correctable choices depend on the stored question type.
  List<String> _choicesFor(ScanAnswerItem item) {
    switch (item.questionType) {
      case 'true_false':
        return const ['T', 'F'];
      case 'identification':
        return const ['CORRECT', 'INCORRECT'];
      case 'matching':
        return const []; // edited via sub-row dialog
      default:
        return const ['A', 'B', 'C', 'D', 'E', 'F'];
    }
  }

  Future<void> _editMatching(ScanAnswerItem item) async {
    final letters = (item.markedAnswer.isEmpty
            ? <String>[]
            : item.markedAnswer.split(','))
        .toList();
    final controller = TextEditingController(text: letters.join(','));
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        ),
        title: Text('Item ${item.itemNumber} — matching'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            labelText: 'Answers in order (e.g. B,A,D,C)',
          ),
          textCapitalization: TextCapitalization.characters,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(controller.text),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (result != null && result != item.markedAnswer) {
      setState(() => _corrections[item.itemNumber] = result.toUpperCase());
    }
  }

  @override
  Widget build(BuildContext context) {
    final scan = _detail?.scan;
    final student = scan?['student_name']?.toString() ?? 'Scan';

    return Scaffold(
      appBar: NexamAppBar(
        title: student,
        subtitle: 'Scan review',
      ),
      body: _loading
          ? _buildSkeleton()
          : _error != null
              ? ErrorState(message: _error!, onRetry: _load)
              : _buildBody(),
      bottomSheet:
          _corrections.isNotEmpty ? _buildSaveBar() : null,
    );
  }

  /// Loading placeholders shaped like the real layout — hero + item rows.
  Widget _buildSkeleton() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      child: Shimmer(
        child: Column(
          children: [
            const SkeletonBox.expand(height: 130, radius: 22),
            const SizedBox(height: 20),
            const Align(
              alignment: Alignment.centerLeft,
              child: SkeletonBox(width: 100, height: 12),
            ),
            const SizedBox(height: 10),
            for (var i = 0; i < 6; i++) ...[
              const SkeletonBox.expand(height: 58, radius: 16),
              const SizedBox(height: 8),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    final bottomPad = _corrections.isNotEmpty ? 110.0 : 24.0;
    return ListView(
      padding: EdgeInsets.fromLTRB(16, 8, 16, bottomPad),
      children: [
        if (_detail!.scan.isNotEmpty) _buildScoreHero(),
        const SizedBox(height: 16),
        Row(
          children: [
            const Text(
              'ITEM LEDGER',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.4,
                color: AppTheme.textFaint,
              ),
            ),
            const Spacer(),
            Text(
              'tap a row to correct',
              style: TextStyle(
                fontSize: 11.5,
                color: AppTheme.textFaint.withValues(alpha: 0.8),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        for (final item in _detail!.answers) ...[
          _buildItemCard(item),
          const SizedBox(height: 8),
        ],
      ],
    );
  }

  /// Dark hero — big score number, circular ring, student/exam meta.
  Widget _buildScoreHero() {
    final scan = _detail!.scan;
    final score = double.tryParse(scan['score']?.toString() ?? '') ?? 0;
    final correct = int.tryParse(scan['correct_count']?.toString() ?? '') ?? 0;
    final total = int.tryParse(scan['total_items']?.toString() ?? '') ?? 0;
    final needsReview =
        scan['needs_review'] == true || scan['needs_review'] == 1;
    final setLabel = scan['set_label']?.toString() ??
        scan['exam_set']?.toString() ??
        '';
    final studentNo = scan['student_number']?.toString() ?? '';

    final ringColor = needsReview
        ? AppTheme.warning
        : score >= 75
            ? AppTheme.success
            : AppTheme.error;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: AppTheme.heroGradient,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Row(
        children: [
          SizedBox(
            width: 92,
            height: 92,
            child: Stack(
              alignment: Alignment.center,
              children: [
                CustomPaint(
                  size: const Size(92, 92),
                  painter: _ScoreRingPainter(
                    progress: (score / 100).clamp(0, 1).toDouble(),
                    color: ringColor,
                  ),
                ),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '${score.round()}',
                      style: AppTheme.display(30,
                          weight: FontWeight.w700,
                          color: Colors.white,
                          letterSpacing: -1),
                    ),
                    Text(
                      'SCORE',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.6,
                        color: Colors.white.withValues(alpha: 0.55),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 18),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  scan['student_name']?.toString() ?? 'Unknown student',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                if (studentNo.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    '#$studentNo',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.white.withValues(alpha: 0.6),
                    ),
                  ),
                ],
                const SizedBox(height: 6),
                Text(
                  scan['exam_title']?.toString() ?? '',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12.5,
                    color: Colors.white.withValues(alpha: 0.72),
                  ),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    _heroPill(
                      '$correct/$total correct',
                      Colors.white.withValues(alpha: 0.14),
                      Colors.white,
                    ),
                    if (setLabel.isNotEmpty)
                      _heroPill(
                        setLabel,
                        Colors.white.withValues(alpha: 0.14),
                        Colors.white,
                      ),
                    if (needsReview)
                      _heroPill(
                        'Needs review',
                        AppTheme.warning.withValues(alpha: 0.2),
                        AppTheme.warning,
                        icon: Icons.flag_outlined,
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _heroPill(String label, Color bg, Color fg, {IconData? icon}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: fg),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: fg,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildItemCard(ScanAnswerItem item) {
    final corrected = _corrections.containsKey(item.itemNumber);
    final marked =
        corrected ? _corrections[item.itemNumber]! : item.markedAnswer;
    final correct = item.isCorrect;

    final accent = corrected
        ? AppTheme.primary
        : correct == true
            ? AppTheme.success
            : correct == false
                ? AppTheme.error
                : AppTheme.warning;

    final icon = corrected
        ? Icons.edit_rounded
        : correct == true
            ? Icons.check_rounded
            : correct == false
                ? Icons.close_rounded
                : Icons.edit_note_rounded;

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      child: InkWell(
        onTap: () => _correctItem(item),
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTheme.radiusMd),
            border: Border.all(
              color: corrected
                  ? AppTheme.primary.withValues(alpha: 0.55)
                  : item.ambiguous
                      ? AppTheme.warning.withValues(alpha: 0.5)
                      : AppTheme.cardBorder,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Text(
                  '${item.itemNumber}',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                    color: accent,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      marked.isEmpty ? '(blank)' : marked,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color:
                            corrected ? AppTheme.primary : AppTheme.ink,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      [
                        _shortType(item.questionType),
                        if (item.correctAnswer != null &&
                            item.correctAnswer!.isNotEmpty)
                          'key: ${item.correctAnswer}',
                      ].join('  •  '),
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: AppTheme.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
              if (item.ambiguous)
                const Padding(
                  padding: EdgeInsets.only(right: 6),
                  child: Icon(Icons.warning_amber_rounded,
                      color: AppTheme.warning, size: 17),
                ),
              Icon(icon, color: accent, size: 19),
            ],
          ),
        ),
      ),
    );
  }

  String _shortType(String? type) {
    switch (type) {
      case 'true_false':
        return 'T/F';
      case 'matching':
        return 'matching';
      case 'identification':
        return 'fill-in';
      default:
        return 'MCQ';
    }
  }

  Widget _buildSaveBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppTheme.cardBorder)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: ElevatedButton(
            onPressed: _submitting ? null : _submitReview,
            child: _submitting
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.2,
                      color: Colors.white,
                    ),
                  )
                : Text(
                    'Save ${_corrections.length} correction'
                    '${_corrections.length == 1 ? '' : 's'}',
                  ),
          ),
        ),
      ),
    );
  }

  /// Per-type correction UI.
  Future<void> _correctItem(ScanAnswerItem item) async {
    if (item.questionType == 'matching') {
      await _editMatching(item);
      return;
    }
    final choices = _choicesFor(item);
    if (choices.isEmpty) return;

    final current = _corrections[item.itemNumber] ?? item.markedAnswer;
    final picked = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Item ${item.itemNumber}',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final c in choices)
                    _correctionChip(ctx, c, current == c),
                  _correctionChip(ctx, 'Blank', current.isEmpty, value: ''),
                ],
              ),
            ],
          ),
        ),
      ),
    );
    if (picked != null && picked != item.markedAnswer) {
      setState(() => _corrections[item.itemNumber] = picked);
    }
  }

  Widget _correctionChip(BuildContext ctx, String label, bool selected,
      {String? value}) {
    return Material(
      color: selected ? AppTheme.primary : AppTheme.surfaceAlt,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: () => Navigator.of(ctx).pop(value ?? label),
        borderRadius: BorderRadius.circular(10),
        child: Container(
          constraints: const BoxConstraints(minWidth: 48, minHeight: 42),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: selected ? Colors.white : AppTheme.textMuted,
            ),
          ),
        ),
      ),
    );
  }
}

/// Circular score ring for the hero card.
class _ScoreRingPainter extends CustomPainter {
  const _ScoreRingPainter({required this.progress, required this.color});

  final double progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = (size.shortestSide / 2) - 4;
    const start = -math.pi / 2;

    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.15)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 7,
    );

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      start,
      2 * math.pi * progress,
      false,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 7
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(_ScoreRingPainter old) =>
      old.progress != progress || old.color != color;
}
