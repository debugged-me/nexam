import 'package:flutter/material.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/motion.dart';
import '../../../core/widgets/nexam_app_bar.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../core/widgets/states.dart';
import '../../auth/domain/instructor_session.dart';
import '../data/exam_api.dart';
import '../domain/exam.dart';
import 'exam_row.dart';

/// Exams tab — the instructor's exam library, read-only on mobile.
/// (Assembly happens on the web; the phone is for grading.)
class ExamsScreen extends StatefulWidget {
  const ExamsScreen({
    super.key,
    required this.session,
    required this.onSessionExpired,
  });

  final InstructorSession session;
  final VoidCallback onSessionExpired;

  @override
  State<ExamsScreen> createState() => _ExamsScreenState();
}

class _ExamsScreenState extends State<ExamsScreen> {
  final _examApi = ExamApi();
  List<ExamSummary> _exams = [];
  bool _loading = true;
  String? _error;

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
      final exams = await _examApi.listExams(
        baseUrl: widget.session.baseUrl,
        token: widget.session.token,
      );
      if (mounted) {
        setState(() {
          _exams = exams;
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: NexamAppBar(
        title: 'Exams',
        subtitle: '${_exams.length} exam${_exams.length == 1 ? '' : 's'}',
        actions: [
          IconButton(
            onPressed: _load,
            icon: Icon(Icons.refresh_rounded,
                size: 20, color: AppTheme.textMuted),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _loading
          ? _buildSkeleton()
          : _error != null
              ? _buildError()
              : RefreshIndicator(
                  onRefresh: _load,
                  color: AppTheme.primary,
                  child: _exams.isEmpty
                      ? _buildEmpty()
                      : ListView.separated(
                          physics:
                              const AlwaysScrollableScrollPhysics(),
                          padding:
                              const EdgeInsets.fromLTRB(16, 16, 16, 24),
                          itemCount: _exams.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (_, i) => StaggerIn(
                            index: i,
                            child: _examCard(_exams[i]),
                          ),
                        ),
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

  Widget _examCard(ExamSummary exam) {
    return Material(
      color: AppTheme.card,
      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          border: Border.all(color: AppTheme.cardBorder),
        ),
        child: ExamRow(exam: exam, session: widget.session),
      ),
    );
  }

  Widget _buildEmpty() {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: const [
        SizedBox(height: 130),
        EmptyState(
          icon: Icons.assignment_rounded,
          title: 'No exams yet',
          message:
              'Create exams on the web platform — they appear here.',
        ),
      ],
    );
  }

  Widget _buildError() =>
      ErrorState(message: _error!, onRetry: _load);
}
