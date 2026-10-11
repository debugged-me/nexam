import 'package:flutter/material.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/motion.dart';
import '../../../core/widgets/nexam_app_bar.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../core/widgets/states.dart';
import '../../auth/domain/instructor_session.dart';
import '../../exams/data/exam_api.dart';
import '../../exams/domain/exam.dart';
import '../../scanner/data/scan_api.dart';
import '../../scanner/presentation/scan_detail_screen.dart';
import '../../scanner/presentation/scan_flow.dart';

/// Home — the post-login screen, styled like a fintech wallet: greeting
/// header, a dark summary hero with the primary action, stat tiles, and
/// transaction-style activity rows. Logic is unchanged — this is a reskin
/// of the scanner dashboard, not a rewrite of its behavior.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({
    super.key,
    required this.session,
    required this.onLogout,
    required this.onSessionExpired,
    this.onNavigate,
  });

  final InstructorSession session;
  final VoidCallback onLogout;

  /// Called when any API call returns 401 — the app should drop the
  /// session and return to login.
  final VoidCallback onSessionExpired;

  /// Switches the bottom-nav tab (0 Home, 1 Scans, 2 Exams, 3 Profile)
  /// — powers "See all" links on the dashboard sections.
  final ValueChanged<int>? onNavigate;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _examApi = ExamApi();
  final _scanApi = ScanApi();
  List<ExamSummary> _exams = [];
  List<Map<String, dynamic>> _recentScans = [];
  bool _loading = true;
  String? _error;

  int get _pendingReview => _recentScans
      .where((s) => s['needs_review'] == 1 || s['needs_review'] == true)
      .length;

  /// Display-cased first name — account data is often stored SHOUTED
  /// or all-lowercase, which reads badly in a greeting.
  String get _firstName {
    final name = widget.session.fullName.trim();
    if (name.isEmpty) return 'Instructor';
    final first = name.split(' ').first.toLowerCase();
    if (first.isEmpty) return 'Instructor';
    return first[0].toUpperCase() + first.substring(1);
  }

  String get _greeting {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  /// 'Tuesday, June 3' — no intl dependency, tiny lookup tables.
  String get _dateLine {
    const weekdays = [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday',
      'Friday', 'Saturday', 'Sunday',
    ];
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    final now = DateTime.now();
    return '${weekdays[now.weekday - 1]}, ${months[now.month - 1]} ${now.day}';
  }

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final exams = await _examApi.listExams(
        baseUrl: widget.session.baseUrl,
        token: widget.session.token,
      );
      final scans = await _scanApi.listScans(
        baseUrl: widget.session.baseUrl,
        token: widget.session.token,
      );

      if (mounted) {
        setState(() {
          _exams = exams;
          _recentScans = scans;
          _loading = false;
        });
      }
    } on ApiException catch (e) {
      if (e.isSessionExpired) {
        widget.onSessionExpired();
        return;
      }
      if (mounted) {
        setState(() {
          _error = e.message;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  void _startScan() {
    launchScanFlow(
      context,
      session: widget.session,
      onSessionExpired: widget.onSessionExpired,
    );
  }

  void _openScanDetail(Map<String, dynamic> scan) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ScanDetailScreen(
          scanId: scan['id']?.toString() ?? '',
          baseUrl: widget.session.baseUrl,
          token: widget.session.token,
          onSessionExpired: widget.onSessionExpired,
          onReviewed: _loadData,
        ),
      ),
    );
  }

  // ── UI ───────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: NexamAppBar(
        title: '$_greeting, $_firstName',
        subtitle: _dateLine,
        showLogo: true,
        actions: [
          IconButton(
            onPressed: _loadData,
            icon: const Icon(Icons.refresh_rounded,
                size: 20, color: AppTheme.textMuted),
            tooltip: 'Refresh',
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: _loading
          ? _buildSkeleton()
          : _error != null
              ? _buildError()
              : RefreshIndicator(
                  onRefresh: _loadData,
                  color: AppTheme.primary,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                    children: [
                      _buildHeroCard(),
                      const SizedBox(height: 14),
                      _buildStatStrip(),
                      const SizedBox(height: 26),
                      _buildSectionTitle('Recent scans', tab: 1),
                      const SizedBox(height: 10),
                      _buildScansCard(),
                      const SizedBox(height: 26),
                      _buildSectionTitle('Your exams', tab: 2),
                      const SizedBox(height: 10),
                      _buildExamsCard(),
                    ],
                  ),
                ),
    );
  }

  /// Loading placeholders shaped like the real layout — reads as
  /// instant content instead of a spinner.
  Widget _buildSkeleton() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      child: Shimmer(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SkeletonBox.expand(height: 158, radius: 22),
            const SizedBox(height: 14),
            const SkeletonBox.expand(height: 64, radius: 16),
            const SizedBox(height: 26),
            const SkeletonBox(width: 110, height: 14),
            const SizedBox(height: 10),
            for (var i = 0; i < 3; i++) ...[
              const SkeletonBox.expand(height: 66, radius: 16),
              const SizedBox(height: 8),
            ],
            const SizedBox(height: 18),
            const SkeletonBox(width: 90, height: 14),
            const SizedBox(height: 10),
            const SkeletonBox.expand(height: 66, radius: 16),
          ],
        ),
      ),
    );
  }

  /// The "balance card" — blue gradient hero with a large scan-frame
  /// motif watermark (thematic to OMR), the headline, weekly activity
  /// when it exists, and the app's primary action.
  Widget _buildHeroCard() {
    final weekTotal = _weekCounts().fold(0, (a, b) => a + b);
    return Container(
      decoration: BoxDecoration(
        gradient: AppTheme.heroGradient,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        boxShadow: [
          BoxShadow(
            color: AppTheme.primary.withValues(alpha: 0.30),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        child: Stack(
          children: [
            // Card art — a scan reticle bleeding off the right edge.
            Positioned(
              right: -34,
              top: -12,
              child: CustomPaint(
                size: const Size(170, 170),
                painter: _ScanFramePainter(
                  Colors.white.withValues(alpha: 0.10),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 20, 22, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'GRADING DESK',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.4,
                      color: Colors.white.withValues(alpha: 0.65),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    _pendingReview > 0
                        ? '$_pendingReview scan${_pendingReview == 1 ? '' : 's'} need${_pendingReview == 1 ? 's' : ''} review'
                        : 'All caught up',
                    style: AppTheme.display(25,
                        weight: FontWeight.w700, color: Colors.white),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _pendingReview > 0
                        ? 'Ambiguous marks are waiting for your call'
                        : 'No sheets are waiting for review',
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.white.withValues(alpha: 0.72),
                    ),
                  ),
                  // The chart only earns its space when there's real
                  // activity — seven flat stubs reads as broken.
                  if (weekTotal > 0) ...[
                    const SizedBox(height: 16),
                    _weekStrip(),
                  ],
                  const SizedBox(height: 18),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: AppTheme.primaryDark,
                      minimumSize: const Size(double.infinity, 50),
                      elevation: 0,
                    ),
                    onPressed: _startScan,
                    icon: const Icon(Icons.qr_code_scanner_rounded,
                        size: 20),
                    label: const Text('Scan answer sheet'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Scan counts for each of the last 7 days, oldest → today.
  List<int> _weekCounts() {
    final counts = List<int>.filled(7, 0);
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    for (final scan in _recentScans) {
      final raw = scan['scanned_at']?.toString();
      final dt = raw == null ? null : DateTime.tryParse(raw)?.toLocal();
      if (dt == null) continue;
      final day = DateTime(dt.year, dt.month, dt.day);
      final diff = today.difference(day).inDays;
      if (diff >= 0 && diff < 7) counts[6 - diff]++;
    }
    return counts;
  }

  /// Mini activity chart — scans per day for the last 7 days, drawn
  /// from `scanned_at` timestamps already on the dashboard payload.
  Widget _weekStrip() {
    final counts = _weekCounts();
    final total = counts.fold(0, (a, b) => a + b);
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final max = counts.fold(0, (a, b) => a > b ? a : b);

    const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    // Map index 0..6 (oldest→today) onto weekday letters.
    String labelFor(int i) {
      final day = today.subtract(Duration(days: 6 - i));
      return dayLabels[day.weekday - 1];
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'LAST 7 DAYS${total > 0 ? ' · $total scan${total == 1 ? '' : 's'}' : ''}',
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
            color: Colors.white.withValues(alpha: 0.55),
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 34,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (var i = 0; i < 7; i++) ...[
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Align(
                          alignment: Alignment.bottomCenter,
                          child: Container(
                            width: 20,
                            height: 4 +
                                (max == 0
                                    ? 0
                                    : (counts[i] / max) * 20),
                            decoration: BoxDecoration(
                              color: counts[i] == 0
                                  ? Colors.white.withValues(alpha: 0.16)
                                  : Colors.white.withValues(
                                      alpha: i == 6 ? 0.95 : 0.6),
                              borderRadius: BorderRadius.circular(3),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        labelFor(i),
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w600,
                          color: Colors.white.withValues(alpha: 0.55),
                        ),
                      ),
                    ],
                  ),
                ),
                if (i < 6) const SizedBox(width: 6),
              ],
            ],
          ),
        ),
      ],
    );
  }

  /// Slim inline stat strip — value + micro-label pairs separated by
  /// hairlines, like a brokerage position summary. Mobile-native
  /// replacement for the old three-boxed-tile dashboard row.
  Widget _buildStatStrip() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: AppTheme.cardBorder),
      ),
      child: Row(
        children: [
          _statCell(
            value: _exams.length,
            label: 'Exams',
            color: AppTheme.primary,
          ),
          _hairline(),
          _statCell(
            value: _recentScans.length,
            label: 'Scans',
            color: AppTheme.success,
          ),
          _hairline(),
          _statCell(
            value: _pendingReview,
            label: 'To review',
            color: AppTheme.warning,
          ),
        ],
      ),
    );
  }

  Widget _statCell({
    required int value,
    required String label,
    required Color color,
  }) {
    return Expanded(
      child: Column(
        children: [
          CountUp(
            value,
            style: AppTheme.display(21,
                weight: FontWeight.w700, color: color),
          ),
          const SizedBox(height: 2),
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontSize: 10,
              letterSpacing: 0.9,
              color: AppTheme.textFaint,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _hairline() => Container(
        width: 1,
        height: 34,
        color: AppTheme.cardBorder,
      );

  Widget _buildSectionTitle(String title, {int? tab}) {
    return Row(
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.2,
            color: AppTheme.textDark,
          ),
        ),
        const Spacer(),
        if (tab != null && widget.onNavigate != null)
          InkWell(
            onTap: () => widget.onNavigate!(tab),
            borderRadius: BorderRadius.circular(999),
            child: const Padding(
              padding: EdgeInsets.symmetric(
                  horizontal: 8, vertical: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'See all',
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.primary,
                    ),
                  ),
                  SizedBox(width: 2),
                  Icon(Icons.chevron_right_rounded,
                      size: 16, color: AppTheme.primary),
                ],
              ),
            ),
          ),
      ],
    );
  }

  /// Transaction-style rows: tinted icon tile, name + meta, right-aligned
  /// score — the same read as a bank activity feed.
  Widget _buildScansCard() {
    if (_recentScans.isEmpty) {
      return EmptyState(
        inCard: true,
        icon: Icons.document_scanner_outlined,
        title: 'No scans yet',
        message:
            'Grade your first OMR sheet — it takes under a minute.',
        actionLabel: 'Scan a sheet',
        onAction: _startScan,
      );
    }
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: AppTheme.cardBorder),
      ),
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        padding: EdgeInsets.zero,
        itemCount: _recentScans.length,
        separatorBuilder: (_, __) =>
            const Divider(indent: 68, height: 1),
        itemBuilder: (_, i) => StaggerIn(
          index: i,
          child: _scanRow(_recentScans[i]),
        ),
      ),
    );
  }

  Widget _scanRow(Map<String, dynamic> scan) {
    final score =
        double.tryParse(scan['score']?.toString() ?? '0') ?? 0;
    final needsReview =
        scan['needs_review'] == 1 || scan['needs_review'] == true;
    final accent = needsReview ? AppTheme.warning : AppTheme.success;
    final tint = needsReview ? AppTheme.tintAmber : AppTheme.tintGreen;

    return InkWell(
      onTap: () => _openScanDetail(scan),
      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
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
                    ? Icons.flag_outlined
                    : Icons.check_circle_outline,
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
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textDark,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${scan['exam_title'] ?? ''} • ${_formatDate(scan['scanned_at']?.toString())}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppTheme.textMuted,
                    ),
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
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: AppTheme.textFaint,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
            const SizedBox(width: 2),
            const Icon(Icons.chevron_right_rounded,
                size: 18, color: AppTheme.textFaint),
          ],
        ),
      ),
    );
  }

  Widget _buildExamsCard() {
    if (_exams.isEmpty) {
      return const EmptyState(
        inCard: true,
        icon: Icons.assignment_outlined,
        title: 'No exams yet',
        message: 'Create exams on the web platform — they appear here.',
      );
    }
    final visible = _exams.take(4).toList();
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: AppTheme.cardBorder),
      ),
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        padding: EdgeInsets.zero,
        itemCount: visible.length,
        separatorBuilder: (_, __) =>
            const Divider(indent: 68, height: 1),
        itemBuilder: (_, i) => StaggerIn(
          index: i,
          child: _examRow(visible[i]),
        ),
      ),
    );
  }

  Widget _examRow(ExamSummary exam) {
    final published = exam.status.toLowerCase() == 'published';
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppTheme.tintBlue,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.description_outlined,
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
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textDark,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${exam.subjectName} • ${exam.questionCount} questions',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppTheme.textMuted,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
            decoration: BoxDecoration(
              color: published ? AppTheme.tintGreen : AppTheme.surfaceAlt,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              exam.status,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: published ? AppTheme.success : AppTheme.textMuted,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildError() =>
      ErrorState(message: _error!, onRetry: _loadData);

  String _formatDate(String? dateStr) {
    if (dateStr == null || dateStr.isEmpty) return '';
    try {
      final dt = DateTime.parse(dateStr);
      return '${dt.month}/${dt.day} ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return '';
    }
  }
}

/// Watermark card art — the OMR scan-frame corner brackets at low
/// opacity, bleeding off the card edge. Same motif as the camera guide.
class _ScanFramePainter extends CustomPainter {
  const _ScanFramePainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;

    const arm = 26.0;
    const r = 8.0;
    const inset = 12.0;
    final w = size.width;
    final h = size.height;

    Path corner(double x, double y, double dx, double dy) {
      // An L with a rounded elbow: horizontal arm then vertical arm.
      return Path()
        ..moveTo(x + arm * dx, y)
        ..lineTo(x + r * dx, y)
        ..quadraticBezierTo(x, y, x, y + r * dy)
        ..lineTo(x, y + arm * dy);
    }

    canvas.drawPath(corner(inset, inset, 1, 1), paint);
    canvas.drawPath(corner(w - inset, inset, -1, 1), paint);
    canvas.drawPath(corner(inset, h - inset, 1, -1), paint);
    canvas.drawPath(corner(w - inset, h - inset, -1, -1), paint);
  }

  @override
  bool shouldRepaint(_ScanFramePainter old) => old.color != color;
}
