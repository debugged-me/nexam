import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/motion.dart';
import '../../../core/widgets/nexam_app_bar.dart';
import '../../../core/widgets/scan_row.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../core/widgets/states.dart';
import '../../auth/domain/instructor_session.dart';
import '../data/scan_api.dart';
import '../data/scan_outbox.dart';
import 'scan_detail_screen.dart';

/// Scans tab — every scanned sheet as a ledger list, newest first,
/// filterable by review state. Sheets queued offline sit in their own
/// "waiting to sync" section above the server list.
class ScansScreen extends StatefulWidget {
  const ScansScreen({
    super.key,
    required this.session,
    required this.onSessionExpired,
    this.onLoaded,
  });

  final InstructorSession session;
  final VoidCallback onSessionExpired;

  /// Reports each load to the shell so it can badge the nav icon —
  /// server scans plus the count still waiting in the offline outbox.
  final void Function(List<Map<String, dynamic>> scans, int pendingSync)? onLoaded;

  @override
  State<ScansScreen> createState() => _ScansScreenState();
}

enum _ScanFilter { all, flagged, done }

class _ScansScreenState extends State<ScansScreen> {
  final _scanApi = ScanApi();
  List<Map<String, dynamic>> _scans = [];
  List<PendingScan> _pending = [];
  ScanOutbox? _outbox;
  _ScanFilter _filter = _ScanFilter.all;
  bool _loading = true;
  bool _syncing = false;
  String? _error;

  bool _isFlagged(Map<String, dynamic> s) =>
      s['needs_review'] == 1 || s['needs_review'] == true;

  List<Map<String, dynamic>> get _visible => _scans.where((s) {
        return switch (_filter) {
          _ScanFilter.all => true,
          _ScanFilter.flagged => _isFlagged(s),
          _ScanFilter.done => !_isFlagged(s),
        };
      }).toList();

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
    _outbox ??= await ScanOutbox.forOwner(widget.session.id);
    if (!mounted) return;
    final pending = await _outbox!.list();
    if (mounted) setState(() => _pending = pending);
    try {
      var scans = await _scanApi.listScans(
        baseUrl: widget.session.baseUrl,
        token: widget.session.token,
      );

      // Connectivity proven — replay anything the offline outbox is holding.
      if (pending.isNotEmpty) {
        setState(() => _syncing = true);
        final outcome = await _outbox!.flush(
          baseUrl: widget.session.baseUrl,
          token: widget.session.token,
        );
        if (!mounted) return;
        if (outcome.sessionExpired) {
          widget.onSessionExpired();
          return;
        }
        _pending = await _outbox!.list();
        if (outcome.synced > 0) {
          scans = await _scanApi.listScans(
            baseUrl: widget.session.baseUrl,
            token: widget.session.token,
          );
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                    'Synced ${outcome.synced} offline scan${outcome.synced == 1 ? '' : 's'}.'),
                backgroundColor: AppTheme.success,
              ),
            );
          }
        }
      }

      if (mounted) {
        setState(() {
          _scans = scans;
          _loading = false;
          _syncing = false;
        });
        widget.onLoaded?.call(scans, _pending.length);
      }
    } on ApiException catch (e) {
      if (e.isSessionExpired) {
        widget.onSessionExpired();
        return;
      }
      if (mounted) setState(() { _error = e.message; _loading = false; _syncing = false; });
    } catch (e) {
      if (mounted) setState(() { _error = '$e'; _loading = false; _syncing = false; });
    }
  }

  Future<void> _discardPending(PendingScan entry) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Discard queued scan?'),
        content: const Text(
            'This sheet was never synced. Discarding it deletes the recorded answers permanently.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Keep'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Discard', style: TextStyle(color: AppTheme.error)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await _outbox?.remove(entry.clientScanId);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: NexamAppBar(
        title: 'Scans',
        subtitle: '${_scans.length} sheet${_scans.length == 1 ? '' : 's'}',
        actions: [
          IconButton(
            onPressed: _load,
            icon: const Icon(Icons.refresh_rounded,
                size: 20, color: AppTheme.textMuted),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _loading
          ? _buildSkeleton()
          : _error != null
              ? _buildError()
              : Column(
                  children: [
                    if (_pending.isNotEmpty || _syncing) _buildPendingSection(),
                    _buildFilterChips(),
                    Expanded(
                      child: RefreshIndicator(
                        onRefresh: _load,
                        color: AppTheme.primary,
                        child: _visible.isEmpty
                            ? _buildEmpty()
                            : ListView.separated(
                                physics:
                                    const AlwaysScrollableScrollPhysics(),
                                padding:
                                    const EdgeInsets.fromLTRB(16, 4, 16, 24),
                                itemCount: _visible.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(height: 8),
                                itemBuilder: (_, i) => StaggerIn(
                                  index: i,
                                  child: _scanRow(_visible[i]),
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
    );
  }

  Widget _buildSkeleton() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      child: Shimmer(
        child: Column(
          children: [
            for (var i = 0; i < 6; i++) ...[
              const SkeletonBox.expand(height: 66, radius: 16),
              const SizedBox(height: 8),
            ],
          ],
        ),
      ),
    );
  }

  /// Offline outbox — sheets captured while the server was unreachable.
  /// They replay automatically whenever this screen can load the list;
  /// a rejected entry keeps its error until the instructor discards it.
  Widget _buildPendingSection() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
      decoration: BoxDecoration(
        color: AppTheme.warning.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: AppTheme.warning.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                _syncing ? Icons.sync_rounded : Icons.cloud_off_rounded,
                size: 16,
                color: AppTheme.warning,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _syncing
                      ? 'Syncing offline scans…'
                      : '${_pending.length} sheet${_pending.length == 1 ? '' : 's'} waiting to sync',
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textDark,
                  ),
                ),
              ),
            ],
          ),
          for (final entry in _pending) _pendingRow(entry),
        ],
      ),
    );
  }

  Widget _pendingRow(PendingScan entry) {
    final ago = _timeAgo(entry.queuedAt);
    final name = (entry.studentName?.isNotEmpty == true)
        ? entry.studentName!
        : 'Unnamed sheet';
    final setLabel = (entry.set?.isNotEmpty == true) ? ' · Set ${entry.set}' : '';
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$name$setLabel',
                  style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppTheme.textDark),
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  entry.lastError != null
                      ? '${entry.lastError} — queued $ago'
                      : 'Queued $ago · ${entry.answers.length} answers',
                  style: TextStyle(
                    fontSize: 11,
                    color: entry.lastError != null ? AppTheme.error : AppTheme.textMuted,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => _discardPending(entry),
            icon: const Icon(Icons.delete_outline_rounded, size: 18, color: AppTheme.textMuted),
            tooltip: 'Discard queued scan',
            visualDensity: VisualDensity.compact,
          ),
        ],
      ),
    );
  }

  String _timeAgo(DateTime at) {
    final diff = DateTime.now().difference(at);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  Widget _buildFilterChips() {
    final flagged = _scans.where(_isFlagged).length;
    final chips = <(_ScanFilter, String)>[
      (_ScanFilter.all, 'All · ${_scans.length}'),
      (_ScanFilter.flagged, 'Flagged · $flagged'),
      (_ScanFilter.done, 'Done · ${_scans.length - flagged}'),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Row(
        children: [
          for (final (filter, label) in chips) ...[
            _chip(
              label: label,
              selected: _filter == filter,
              accent: filter == _ScanFilter.flagged
                  ? AppTheme.warning
                  : AppTheme.primary,
              onTap: () => setState(() => _filter = filter),
            ),
            if (filter != _ScanFilter.done) const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }

  Widget _chip({
    required String label,
    required bool selected,
    required Color accent,
    required VoidCallback onTap,
  }) {
    return Material(
      color: selected
          ? accent.withValues(alpha: 0.12)
          : Colors.white,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(
              horizontal: 13, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected
                  ? accent.withValues(alpha: 0.5)
                  : AppTheme.cardBorder,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: selected ? accent : AppTheme.textMuted,
            ),
          ),
        ),
      ),
    );
  }

  Widget _scanRow(Map<String, dynamic> scan) {
    final needsReview =
        scan['needs_review'] == 1 || scan['needs_review'] == true;
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          border: Border.all(
            color: needsReview
                ? AppTheme.warning.withValues(alpha: 0.35)
                : AppTheme.cardBorder,
          ),
        ),
        child: ScanRow(
          scan: scan,
          onTap: () {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ScanDetailScreen(
                  scanId: scan['id']?.toString() ?? '',
                  baseUrl: widget.session.baseUrl,
                  token: widget.session.token,
                  onSessionExpired: widget.onSessionExpired,
                  onReviewed: _load,
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildEmpty() {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const SizedBox(height: 130),
        EmptyState(
          icon: _scans.isEmpty
              ? Icons.document_scanner_rounded
              : Icons.filter_list_off_rounded,
          title: _scans.isEmpty
              ? 'No scans yet'
              : 'Nothing in this filter',
          message: _scans.isEmpty
              ? 'Scanned sheets will appear here.'
              : 'Try a different filter.',
        ),
      ],
    );
  }

  Widget _buildError() =>
      ErrorState(message: _error!, onRetry: _load);
}
