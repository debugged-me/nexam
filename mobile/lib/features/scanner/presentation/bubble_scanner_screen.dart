import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../exams/domain/exam.dart';
import '../data/omr_scanner.dart';
import '../data/scan_api.dart';

/// Bubble scanner screen — after the QR code identifies the exam, the
/// instructor captures a photo of the answer sheet. The OMR algorithm
/// detects filled bubbles (in a background isolate) and shows a review
/// screen before submitting.
class BubbleScannerScreen extends StatefulWidget {
  const BubbleScannerScreen({
    super.key,
    required this.qrPayload,
    required this.examSetId,
    required this.baseUrl,
    required this.token,
  });

  final OmrQrPayload qrPayload;
  final String? examSetId;
  final String baseUrl;
  final String token;

  @override
  State<BubbleScannerScreen> createState() => _BubbleScannerScreenState();
}

class _BubbleScannerScreenState extends State<BubbleScannerScreen>
    with WidgetsBindingObserver {
  CameraController? _cameraController;
  bool _cameraReady = false;
  bool _processing = false;
  String? _cameraError;
  final _scanApi = ScanApi();

  // Student info
  final _nameController = TextEditingController();
  final _numberController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initCamera();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final controller = _cameraController;
    if (controller == null || !controller.value.isInitialized) return;
    if (state == AppLifecycleState.inactive) {
      controller.dispose();
    } else if (state == AppLifecycleState.resumed) {
      _initCamera();
    }
  }

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        if (mounted) setState(() => _cameraError = 'No camera available on this device.');
        return;
      }

      final back = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );

      final controller = CameraController(
        back,
        ResolutionPreset.high,
        enableAudio: false,
      );
      await controller.initialize();

      if (!mounted) {
        await controller.dispose();
        return;
      }
      setState(() {
        _cameraController = controller;
        _cameraReady = true;
        _cameraError = null;
      });
    } on CameraException catch (e) {
      if (mounted) {
        setState(() => _cameraError =
            e.description ?? 'Camera failed to start. Check app permissions.');
      }
    } catch (e) {
      if (mounted) setState(() => _cameraError = 'Camera error: $e');
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _cameraController?.dispose();
    _nameController.dispose();
    _numberController.dispose();
    super.dispose();
  }

  Future<void> _captureAndScan() async {
    if (_cameraController == null || !_cameraReady) return;

    setState(() => _processing = true);

    try {
      final xFile = await _cameraController!.takePicture();
      final imageBytes = await File(xFile.path).readAsBytes();

      // OMR detection is CPU-heavy (decode + homography + per-bubble
      // sampling) — run it in a background isolate so the UI stays fluid.
      final output = await compute(
        scanImage,
        <String, Object?>{
          'imageBytes': Uint8List.fromList(imageBytes),
          'payload': widget.qrPayload,
        },
      );

      if (!mounted) return;

      if (!output.aligned) {
        // Anchors weren't found — offer a retake before reviewing.
        final retake = await _showAlignmentWarning();
        if (retake) {
          setState(() => _processing = false);
          return;
        }
      }

      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ScanReviewScreen(
            detections: output.detections,
            qrPayload: widget.qrPayload,
            examSetId: widget.examSetId,
            studentName: _nameController.text,
            studentNumber: _numberController.text,
            baseUrl: widget.baseUrl,
            token: widget.token,
            scanApi: _scanApi,
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Scan failed: $e'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  /// Returns true when the user wants to retake the photo.
  Future<bool> _showAlignmentWarning() async {
    final choice = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Alignment uncertain'),
        content: const Text(
          'The corner markers on the sheet could not be found, so answers '
          'were detected using an approximate layout. Results may be wrong.\n\n'
          'Retake the photo with the whole sheet inside the guide?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Review anyway'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Retake'),
          ),
        ],
      ),
    );
    return choice ?? true;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Set ${widget.qrPayload.set} — ${widget.qrPayload.count} items'),
      ),
      body: Column(
        children: [
          // Student info fields
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _nameController,
                    decoration: const InputDecoration(
                      labelText: 'Student Name',
                      isDense: true,
                      prefixIcon: Icon(Icons.person),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _numberController,
                    decoration: const InputDecoration(
                      labelText: 'Student ID',
                      isDense: true,
                      prefixIcon: Icon(Icons.badge),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Camera preview + alignment guide
          Expanded(
            child: _cameraError != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.videocam_off, size: 48, color: AppTheme.error),
                          const SizedBox(height: 12),
                          Text(_cameraError!, textAlign: TextAlign.center),
                          const SizedBox(height: 16),
                          OutlinedButton(
                            onPressed: _initCamera,
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                    ),
                  )
                : _cameraReady && _cameraController != null
                    ? Stack(
                        fit: StackFit.expand,
                        children: [
                          CameraPreview(_cameraController!),
                          // Sheet alignment guide — the four corner marks
                          // should sit inside these boxes.
                          const _SheetGuide(),
                          Positioned(
                            bottom: 12,
                            left: 0,
                            right: 0,
                            child: Center(
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 16, vertical: 8),
                                decoration: BoxDecoration(
                                  color: Colors.black.withValues(alpha: 0.6),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Text(
                                  'Fit the whole sheet inside the frame —\nall four corner marks must be visible',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(color: Colors.white, fontSize: 12),
                                ),
                              ),
                            ),
                          ),
                        ],
                      )
                    : const Center(child: CircularProgressIndicator()),
          ),

          // Capture button
          Padding(
            padding: const EdgeInsets.all(16),
            child: ElevatedButton.icon(
              onPressed: _processing || !_cameraReady ? null : _captureAndScan,
              icon: _processing
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.camera_alt),
              label: Text(_processing ? 'Detecting…' : 'Capture & Detect'),
            ),
          ),
        ],
      ),
    );
  }
}

/// Overlay that frames where the A4 sheet should sit — portrait aspect.
class _SheetGuide extends StatelessWidget {
  const _SheetGuide();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // A4 portrait aspect ratio (width/height).
        const aspect = 794 / 1123;
        var w = constraints.maxWidth * 0.9;
        var h = w / aspect;
        if (h > constraints.maxHeight * 0.9) {
          h = constraints.maxHeight * 0.9;
          w = h * aspect;
        }
        final left = (constraints.maxWidth - w) / 2;
        final top = (constraints.maxHeight - h) / 2;

        // Corner boxes matching the sheet's anchor positions.
        const corner = 26.0;
        const inset = 0.03; // ~3% margin like the sheet's 30px offset
        return Stack(
          children: [
            Positioned(
              left: left,
              top: top,
              child: Container(
                width: w,
                height: h,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.white.withValues(alpha: 0.7), width: 2),
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
            for (final pos in [
              [left + w * inset, top + h * inset],
              [left + w * (1 - inset) - corner, top + h * inset],
              [left + w * inset, top + h * (1 - inset) - corner],
              [left + w * (1 - inset) - corner, top + h * (1 - inset) - corner],
            ])
              Positioned(
                left: pos[0],
                top: pos[1],
                child: Container(
                  width: corner,
                  height: corner,
                  decoration: BoxDecoration(
                    border: Border.all(color: AppTheme.primary, width: 2.5),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

/// Review screen — shows the detected answers and lets the instructor
/// correct any ambiguous or incorrect detections before submitting.
/// Supports all question types: MCQ/true-false chips, matching sub-rows,
/// and identification correct/incorrect verdicts.
class ScanReviewScreen extends StatefulWidget {
  const ScanReviewScreen({
    super.key,
    required this.detections,
    required this.qrPayload,
    required this.examSetId,
    required this.studentName,
    required this.studentNumber,
    required this.baseUrl,
    required this.token,
    required this.scanApi,
  });

  final List<OmrDetection> detections;
  final OmrQrPayload qrPayload;
  final String? examSetId;
  final String studentName;
  final String studentNumber;
  final String baseUrl;
  final String token;
  final ScanApi scanApi;

  @override
  State<ScanReviewScreen> createState() => _ScanReviewScreenState();
}

class _ScanReviewScreenState extends State<ScanReviewScreen> {
  /// Canonical marked answer per item (letter, 'B,A,D', 'CORRECT', or '').
  late List<String> _answers;

  /// Matching items: per-sub-row letters (parallel to _answers).
  late List<List<String>> _subAnswers;
  late List<bool> _ambiguous;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _answers = widget.detections.map((d) => d.detectedAnswer).toList();
    _subAnswers = widget.detections
        .map((d) => List<String>.from(d.subAnswers))
        .toList();
    _ambiguous = widget.detections.map((d) => d.ambiguous).toList();
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);

    try {
      final scannedAnswers = <ScannedAnswer>[];
      for (int i = 0; i < _answers.length; i++) {
        scannedAnswers.add(ScannedAnswer(
          itemNumber: i + 1,
          markedAnswer: _answers[i],
          ambiguous: _ambiguous[i],
        ));
      }

      final result = await widget.scanApi.submitScan(
        baseUrl: widget.baseUrl,
        token: widget.token,
        examId: widget.qrPayload.examId,
        examSetId: widget.examSetId,
        studentName: widget.studentName.isEmpty ? null : widget.studentName,
        studentNumber: widget.studentNumber.isEmpty ? null : widget.studentNumber,
        answers: scannedAnswers,
      );

      if (!mounted) return;

      Navigator.of(context)
        ..pop() // review screen
        ..pop() // scanner screen
        ..pop(); // qr scanner screen

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Score: ${result.score}% (${result.correctCount}/${result.totalItems})'
            '${result.needsReview ? ' — needs review' : ''}',
          ),
          backgroundColor: result.needsReview ? AppTheme.warning : AppTheme.success,
          duration: const Duration(seconds: 4),
        ),
      );
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.isSessionExpired
                ? 'Session expired — please sign in again.'
                : 'Submit failed: ${e.message}'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Submit failed: $e'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Widget _buildItemEditor(int index) {
    final detection = widget.detections[index];
    final isAmbiguous = _ambiguous[index];

    Widget editor;
    switch (detection.type) {
      case 'matching':
        // One chip row per premise sub-row.
        editor = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var s = 0; s < _subAnswers[index].length; s++)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Wrap(
                  spacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text('${String.fromCharCode(97 + s)})',
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    ...detection.choices.map((choice) {
                      final isSelected = _subAnswers[index][s] == choice;
                      return ChoiceChip(
                        label: Text(choice),
                        selected: isSelected,
                        onSelected: (selected) {
                          setState(() {
                            _subAnswers[index][s] = selected ? choice : '';
                            _answers[index] = _subAnswers[index].join(',');
                            _ambiguous[index] = false;
                          });
                        },
                      );
                    }),
                  ],
                ),
              ),
          ],
        );
        break;
      case 'identification':
        // Instructor verdict: Correct / Incorrect.
        editor = Wrap(
          spacing: 8,
          children: [
            for (final opt in ['CORRECT', 'INCORRECT'])
              ChoiceChip(
                label: Text(opt == 'CORRECT' ? '✓ Correct' : '✗ Incorrect'),
                selected: _answers[index] == opt,
                onSelected: (selected) {
                  setState(() {
                    _answers[index] = selected ? opt : '';
                    _ambiguous[index] = false;
                  });
                },
              ),
          ],
        );
        break;
      default:
        editor = Wrap(
          spacing: 8,
          children: detection.choices.map((choice) {
            final isSelected = _answers[index] == choice;
            return ChoiceChip(
              label: Text(choice),
              selected: isSelected,
              onSelected: (selected) {
                setState(() {
                  _answers[index] = selected ? choice : '';
                  _ambiguous[index] = false;
                });
              },
            );
          }).toList(),
        );
    }

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: isAmbiguous
            ? AppTheme.warning.withValues(alpha: 0.2)
            : AppTheme.surface,
        child: Text('${index + 1}'),
      ),
      title: editor,
      subtitle: detection.type == 'matching' || detection.type == 'identification'
          ? Text(detection.type == 'matching' ? 'Matching' : 'Identification — instructor grades',
              style: const TextStyle(fontSize: 11, color: AppTheme.textMuted))
          : null,
      trailing: isAmbiguous
          ? const Icon(Icons.warning, color: AppTheme.warning, size: 20)
          : _answers[index].isEmpty
              ? const Text('—', style: TextStyle(color: AppTheme.textMuted))
              : const Icon(Icons.check, color: AppTheme.success, size: 20),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ambiguousCount = _ambiguous.where((a) => a).length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Review Answers'),
        actions: [
          TextButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Submit'),
          ),
        ],
      ),
      body: Column(
        children: [
          if (ambiguousCount > 0)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              color: AppTheme.warning.withValues(alpha: 0.1),
              child: Row(
                children: [
                  const Icon(Icons.warning, color: AppTheme.warning, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '$ambiguousCount ambiguous answer(s) need review.',
                      style: const TextStyle(color: AppTheme.warning, fontSize: 14),
                    ),
                  ),
                ],
              ),
            ),

          // Student info summary
          if (widget.studentName.isNotEmpty || widget.studentNumber.isNotEmpty)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Text(widget.studentName,
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  if (widget.studentNumber.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(left: 12),
                      child: Text(
                        widget.studentNumber,
                        style: const TextStyle(color: AppTheme.textMuted),
                      ),
                    ),
                ],
              ),
            ),

          // Answer list
          Expanded(
            child: ListView.builder(
              itemCount: _answers.length,
              itemBuilder: (context, index) => _buildItemEditor(index),
            ),
          ),
        ],
      ),
    );
  }
}
