import 'package:flutter/material.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/domain/instructor_session.dart';
import '../../exams/data/exam_api.dart';
import '../../exams/domain/exam.dart';
import '../../scanner/data/scan_api.dart';
import '../../scanner/presentation/bubble_scanner_screen.dart';
import '../../scanner/presentation/qr_scanner_screen.dart';
import '../../scanner/presentation/scan_detail_screen.dart';

/// Dashboard — the main screen after login.
///
/// Shows the instructor's exams and recent scan results, with a prominent
/// FAB to start scanning a new OMR answer sheet.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({
    super.key,
    required this.session,
    required this.onLogout,
    required this.onSessionExpired,
  });

  final InstructorSession session;
  final VoidCallback onLogout;

  /// Called when any API call returns 401 — the app should drop the
  /// session and return to login.
  final VoidCallback onSessionExpired;

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
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => QrScannerScreen(
          onQrDecoded: (payload) {
            // After QR decode, go to bubble scanner.
            // We need to find the exam set ID from the exam's sets.
            _navigateToBubbleScanner(payload);
          },
        ),
      ),
    );
  }

  Future<void> _navigateToBubbleScanner(OmrQrPayload payload) async {
    // The QR payload carries the exact set id — no lookup needed for
    // new-format sheets. Legacy sheets only have the label, so resolve
    // via the API as a fallback.
    String? examSetId = payload.setId;
    if (examSetId == null || examSetId.isEmpty) {
      try {
        final sets = await _examApi.listExamSets(
          baseUrl: widget.session.baseUrl,
          token: widget.session.token,
          examId: payload.examId,
        );
        final matching = sets.where((s) => s.label == payload.set).toList();
        if (matching.isNotEmpty) examSetId = matching.first.id;
      } on ApiException catch (e) {
        if (e.isSessionExpired) {
          widget.onSessionExpired();
          return;
        }
      } catch (_) {
        // If we can't find the set, we'll submit without it.
      }
    }

    if (!mounted) return;

    // Replace the QR scanner with the bubble scanner.
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => BubbleScannerScreen(
          qrPayload: payload,
          examSetId: examSetId,
          baseUrl: widget.session.baseUrl,
          token: widget.session.token,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Nexam OMR'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
            tooltip: 'Refresh',
          ),
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'logout') widget.onLogout();
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'logout', child: Text('Sign Out')),
            ],
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.error_outline, size: 48, color: AppTheme.error),
                      const SizedBox(height: 12),
                      Text(_error!, textAlign: TextAlign.center),
                      const SizedBox(height: 16),
                      OutlinedButton(onPressed: _loadData, child: const Text('Retry')),
                    ],
                  ),
                )
              : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Welcome card
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          const CircleAvatar(
                            backgroundColor: AppTheme.primary,
                            child: Icon(Icons.person, color: Colors.white),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  widget.session.fullName,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                Text(
                                  widget.session.email,
                                  style: const TextStyle(
                                    color: AppTheme.textMuted,
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Exams section
                  Text('Exams',
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  if (_exams.isEmpty)
                    const Card(
                      child: ListTile(
                        leading: Icon(Icons.folder_open, color: AppTheme.textMuted),
                        title: Text('No exams yet'),
                        subtitle: Text(
                          'Create exams on the web platform first.',
                        ),
                      ),
                    )
                  else
                    ..._exams.map((exam) => Card(
                          child: ListTile(
                            leading: const Icon(Icons.assignment),
                            title: Text(exam.title),
                            subtitle: Text(
                              '${exam.subjectName} • ${exam.questionCount} questions • ${exam.setItemCount} sets',
                            ),
                            trailing: Chip(
                              label: Text(exam.status,
                                  style: const TextStyle(fontSize: 12)),
                            ),
                          ),
                        )),

                  const SizedBox(height: 16),

                  // Recent scans section
                  Text('Recent Scans',
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  if (_recentScans.isEmpty)
                    const Card(
                      child: ListTile(
                        leading: Icon(Icons.scanner, color: AppTheme.textMuted),
                        title: Text('No scans yet'),
                        subtitle: Text(
                          'Tap the scan button to scan an OMR answer sheet.',
                        ),
                      ),
                    )
                  else
                    ..._recentScans.map((scan) {
                      final score = double.tryParse(
                              scan['score']?.toString() ?? '0') ??
                          0;
                      final needsReview = scan['needs_review'] == 1 ||
                          scan['needs_review'] == true;
                      return Card(
                        child: ListTile(
                          leading: Icon(
                            needsReview ? Icons.warning : Icons.check_circle,
                            color: needsReview
                                ? AppTheme.warning
                                : AppTheme.success,
                          ),
                          title: Text(scan['student_name'] ?? 'Unknown'),
                          subtitle: Text(
                            '${scan['exam_title']} • ${score.toStringAsFixed(1)}% (${scan['correct_count']}/${scan['total_items']})',
                          ),
                          trailing: Text(
                            _formatDate(scan['scanned_at']?.toString()),
                            style: const TextStyle(
                                color: AppTheme.textMuted, fontSize: 12),
                          ),
                          onTap: () => _openScanDetail(scan),
                        ),
                      );
                    }),
                ],
              ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _startScan,
        icon: const Icon(Icons.qr_code_scanner),
        label: const Text('Scan Sheet'),
      ),
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
