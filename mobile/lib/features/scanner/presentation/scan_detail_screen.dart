import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:printing/printing.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/nexam_app_bar.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../core/widgets/states.dart';
import '../data/scan_api.dart';
import '../data/scan_report.dart';

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
    this.instructorName = '',
    this.onReviewed,
  });

  final String scanId;
  final String baseUrl;
  final String token;
  final VoidCallback onSessionExpired;

  /// Signed-in instructor — printed on the report header.
  final String instructorName;

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
  bool _printing = false;

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
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: AppTheme.card,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => _MatchingCorrectionSheet(item: item),
    );
    if (result != null && result != item.markedAnswer) {
      setState(() => _corrections[item.itemNumber] = result);
    }
  }

  /// This student's sheet as a PDF — the printable counterpart of the
  /// web ScanReviewModal's print view.
  Future<void> _printReport() async {
    final detail = _detail;
    if (detail == null || _printing) return;
    setState(() => _printing = true);
    try {
      final bytes = await ScanReport.buildScanDetailPdf(
        scan: detail.scan,
        answers: detail.answers,
        instructorName: widget.instructorName,
      );
      if (!mounted) return;
      final student =
          detail.scan['student_name']?.toString() ?? 'scan';
      await Printing.layoutPdf(
        name: 'nexam-scan-$student',
        onLayout: (_) async => bytes,
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not build the report.')),
        );
      }
    } finally {
      if (mounted) setState(() => _printing = false);
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
        actions: [
          IconButton(
            onPressed: (_detail == null || _printing) ? null : _printReport,
            icon: _printing
                ? SizedBox(
                    width: 17,
                    height: 17,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppTheme.textMuted,
                    ),
                  )
                : Icon(Icons.print_outlined,
                    size: 20, color: AppTheme.textMuted),
            tooltip: 'Print this sheet',
          ),
        ],
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
    return RefreshIndicator(
      onRefresh: _load,
      color: AppTheme.primary,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(16, 8, 16, bottomPad),
        children: [
          if (_detail!.scan.isNotEmpty) _buildScoreHero(),
          const SizedBox(height: 16),
          Row(
            children: [
              Text('ITEM LEDGER', style: AppTheme.micro()),
              const Spacer(),
              Text(
                'tap a row to correct',
                style: AppTheme.body(size: 11.5),
              ),
            ],
          ),
          const SizedBox(height: 8),
          for (final item in _detail!.answers) ...[
            _buildItemCard(item),
            const SizedBox(height: 8),
          ],
        ],
      ),
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
                        icon: Icons.flag_rounded,
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
      color: AppTheme.card,
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
                    _markedAnswer(marked, accent: accent),
                    const SizedBox(height: 3),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(_shortType(item.questionType),
                            style: AppTheme.body(size: 11.5)),
                        if (item.correctAnswer != null &&
                            item.correctAnswer!.isNotEmpty) ...[
                          Text('key:',
                              style: AppTheme.body(size: 11.5)),
                          _keyAnswer(item.correctAnswer!, accent),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              if (item.ambiguous)
                Padding(
                  padding: const EdgeInsets.only(right: 6),
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

  /// Letters like 'B', 'T', 'F' or comma lists like 'B,A,D,C' render as
  /// OMR bubble rings; free text (identification answers) stays text.
  static bool _isBubbleAnswer(String value) {
    final parts = value.split(',');
    return parts.every((p) => RegExp(r'^[A-Z]$').hasMatch(p.trim()));
  }

  /// The student's mark — filled rings, one per letter in order.
  Widget _markedAnswer(String marked, {required Color accent}) {
    if (marked.isEmpty) {
      return Text('(blank)',
          style: AppTheme.body(size: 14, color: AppTheme.textFaint));
    }
    if (!_isBubbleAnswer(marked)) {
      return Text(
        marked,
        style: TextStyle(
            fontSize: 14, fontWeight: FontWeight.w700, color: accent),
      );
    }
    final letters = marked.split(',').map((l) => l.trim());
    return Wrap(
      spacing: 5,
      runSpacing: 4,
      children: [
        for (final l in letters) _bubble(l, accent, filled: true, size: 24),
      ],
    );
  }

  /// The key — hollow rings, smaller and quieter than the mark.
  Widget _keyAnswer(String key, Color accent) {
    if (!_isBubbleAnswer(key)) {
      return Text(key, style: AppTheme.body(size: 11.5));
    }
    final letters = key.split(',').map((l) => l.trim());
    return Wrap(
      spacing: 3,
      runSpacing: 3,
      children: [
        for (final l in letters)
          _bubble(l, AppTheme.textMuted, filled: false, size: 17),
      ],
    );
  }

  /// A single OMR ring — solid fill + white letter for the mark, hollow
  /// ring + muted letter for the key.
  Widget _bubble(String letter, Color accent,
      {required bool filled, required double size}) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: filled ? accent : Colors.transparent,
        border: Border.all(
          color: filled ? accent : AppTheme.textFaint,
          width: filled ? 1 : 1.2,
        ),
      ),
      child: Text(
        letter,
        style: TextStyle(
          fontSize: size * 0.46,
          fontWeight: FontWeight.w800,
          height: 1.1,
          color: filled ? Colors.white : AppTheme.textMuted,
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
      decoration: BoxDecoration(
        color: AppTheme.card,
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
        onTap: () {
          HapticFeedback.selectionClick();
          Navigator.of(ctx).pop(value ?? label);
        },
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

/// Matching-type correction — one letter chip per premise, each letter
/// usable once (matching can't repeat a response). Premise count comes
/// from the marked/keyed comma-joined answer; option count derives from
/// the largest letter seen, floored at 5 (the OMR sheet's A–E).
class _MatchingCorrectionSheet extends StatefulWidget {
  const _MatchingCorrectionSheet({required this.item});

  final ScanAnswerItem item;

  @override
  State<_MatchingCorrectionSheet> createState() =>
      _MatchingCorrectionSheetState();
}

class _MatchingCorrectionSheetState
    extends State<_MatchingCorrectionSheet> {
  late final List<String?> _picks;
  late final List<String> _letters;

  static List<String> _split(String? s) =>
      (s == null || s.isEmpty) ? <String>[] : s.split(',');

  @override
  void initState() {
    super.initState();
    final marked = _split(widget.item.markedAnswer);
    final keyed = _split(widget.item.correctAnswer);

    // Highest letter seen anywhere drives the option range (min A–E).
    var maxIndex = 4;
    for (final l in [...marked, ...keyed]) {
      if (l.isNotEmpty) {
        final idx = l.codeUnitAt(0) - 65;
        if (idx > maxIndex) maxIndex = idx;
      }
    }
    _letters = List.generate(
      math.min(maxIndex + 1, 8),
      (i) => String.fromCharCode(65 + i),
    );

    final premiseCount =
        math.max(math.max(marked.length, keyed.length), 4);
    _picks = List.generate(
      premiseCount,
      (i) => i < marked.length && marked[i].isNotEmpty
          ? marked[i]
          : null,
    );
  }

  bool get _complete => _picks.every((p) => p != null);

  void _pick(int premise, String letter) {
    HapticFeedback.selectionClick();
    setState(() {
      if (_picks[premise] == letter) {
        _picks[premise] = null;
      } else {
        // Enforce uniqueness — steal the letter from its old premise.
        final other = _picks.indexOf(letter);
        if (other != -1) _picks[other] = null;
        _picks[premise] = letter;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
            20, 0, 20, MediaQuery.of(context).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Item ${widget.item.itemNumber} — matching',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(''),
                  child: const Text('Mark blank'),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Tap a letter per premise — each can be used once.',
              style: AppTheme.body(size: 12.5),
            ),
            const SizedBox(height: 14),
            for (var i = 0; i < _picks.length; i++) ...[
              Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceAlt,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '${i + 1}',
                      style: AppTheme.label(size: 12.5,
                          weight: FontWeight.w700),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        for (final letter in _letters)
                          _letterChip(i, letter),
                      ],
                    ),
                  ),
                ],
              ),
              if (i < _picks.length - 1) const SizedBox(height: 8),
            ],
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _complete
                  ? () => Navigator.of(context)
                      .pop(_picks.join(','))
                  : null,
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _letterChip(int premise, String letter) {
    final selected = _picks[premise] == letter;
    return Material(
      color: selected ? AppTheme.primary : AppTheme.surfaceAlt,
      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      child: InkWell(
        onTap: () => _pick(premise, letter),
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        child: Container(
          constraints:
              const BoxConstraints(minWidth: 38, minHeight: 38),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Text(
            letter,
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w700,
              color:
                  selected ? Colors.white : AppTheme.textMuted,
            ),
          ),
        ),
      ),
    );
  }
}
