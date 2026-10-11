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
import 'scan_detail_screen.dart';

/// Scans tab — every scanned sheet as a ledger list, newest first,
/// filterable by review state.
class ScansScreen extends StatefulWidget {
  const ScansScreen({
    super.key,
    required this.session,
    required this.onSessionExpired,
    this.onLoaded,
  });

  final InstructorSession session;
  final VoidCallback onSessionExpired;

  /// Reports each load to the shell so it can badge the nav icon.
  final void Function(List<Map<String, dynamic>> scans)? onLoaded;

  @override
  State<ScansScreen> createState() => _ScansScreenState();
}

enum _ScanFilter { all, flagged, done }

class _ScansScreenState extends State<ScansScreen> {
  final _scanApi = ScanApi();
  List<Map<String, dynamic>> _scans = [];
  _ScanFilter _filter = _ScanFilter.all;
  bool _loading = true;
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
    try {
      final scans = await _scanApi.listScans(
        baseUrl: widget.session.baseUrl,
        token: widget.session.token,
      );
      if (mounted) {
        setState(() {
          _scans = scans;
          _loading = false;
        });
        widget.onLoaded?.call(scans);
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
