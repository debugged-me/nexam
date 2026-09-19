import 'package:flutter/material.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../data/scan_api.dart';

/// Scan detail screen — shows one scan's per-item breakdown and lets the
/// instructor correct marked answers. Corrections are posted to the
/// review endpoint, which recounts the whole scan server-side.
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
    final student = scan?['student_name']?.toString() ?? 'Unknown';

    return Scaffold(
      appBar: AppBar(
        title: Text('Scan — $student'),
        actions: [
          if (_corrections.isNotEmpty)
            TextButton(
              onPressed: _submitting ? null : _submitReview,
              child: _submitting
                  ? const SizedBox(
                      height: 20, width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : Text('Save ${_corrections.length} fix(es)'),
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
                      Text(_error!),
                      const SizedBox(height: 12),
                      OutlinedButton(onPressed: _load, child: const Text('Retry')),
                    ],
                  ),
                )
              : Column(
                  children: [
                    // Scan summary header
                    if (scan != null)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        color: AppTheme.surface,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              scan['exam_title']?.toString() ?? '',
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Score: ${scan['score']}%  •  '
                              '${scan['correct_count']}/${scan['total_items']} correct'
                              '${(scan['needs_review'] == 1 || scan['needs_review'] == true) ? '  •  needs review' : ''}',
                              style: const TextStyle(color: AppTheme.textMuted),
                            ),
                          ],
                        ),
                      ),
                    Expanded(
                      child: ListView.builder(
                        itemCount: _detail!.answers.length,
                        itemBuilder: (context, index) {
                          final item = _detail!.answers[index];
                          final corrected = _corrections.containsKey(item.itemNumber);
                          final marked = corrected
                              ? _corrections[item.itemNumber]!
                              : item.markedAnswer;
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: item.isCorrect == true
                                  ? AppTheme.success.withValues(alpha: 0.15)
                                  : item.isCorrect == false
                                      ? AppTheme.error.withValues(alpha: 0.15)
                                      : AppTheme.surface,
                              child: Text('${item.itemNumber}'),
                            ),
                            title: Text(
                              marked.isEmpty ? '(blank)' : marked,
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: corrected ? AppTheme.primary : null,
                              ),
                            ),
                            subtitle: Text(
                              '${item.questionType ?? ''}'
                              '${item.correctAnswer != null && item.correctAnswer!.isNotEmpty ? ' • key: ${item.correctAnswer}' : ''}',
                              style: const TextStyle(fontSize: 12),
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (item.isCorrect == true)
                                  const Icon(Icons.check, color: AppTheme.success, size: 18)
                                else if (item.isCorrect == false)
                                  const Icon(Icons.close, color: AppTheme.error, size: 18)
                                else
                                  const Icon(Icons.edit_note, color: AppTheme.warning, size: 18),
                                if (item.ambiguous)
                                  const Padding(
                                    padding: EdgeInsets.only(left: 4),
                                    child: Icon(Icons.warning, color: AppTheme.warning, size: 16),
                                  ),
                              ],
                            ),
                            onTap: () => _correctItem(item),
                          );
                        },
                      ),
                    ),
                  ],
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
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Item ${item.itemNumber}',
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                children: [
                  for (final c in choices)
                    ChoiceChip(
                      label: Text(c),
                      selected: current == c,
                      onSelected: (_) => Navigator.of(ctx).pop(c),
                    ),
                  ChoiceChip(
                    label: const Text('Blank'),
                    selected: current.isEmpty,
                    onSelected: (_) => Navigator.of(ctx).pop(''),
                  ),
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
}
