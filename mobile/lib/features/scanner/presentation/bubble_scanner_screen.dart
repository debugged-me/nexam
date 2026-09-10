import 'dart:io';
import 'dart:typed_data';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../exams/domain/exam.dart';
import '../data/omr_scanner.dart';
import '../data/scan_api.dart';

/// Bubble scanner screen — after the QR code identifies the exam, the
/// instructor captures a photo of the answer sheet. The OMR algorithm
/// detects filled bubbles and shows a review screen before submitting.
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

class _BubbleScannerScreenState extends State<BubbleScannerScreen> {
  CameraController? _cameraController;
  bool _cameraReady = false;
  bool _processing = false;
  final _scanner = OmrScanner();
  final _scanApi = ScanApi();

  // Student info
  final _nameController = TextEditingController();
  final _numberController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  Future<void> _initCamera() async {
    final cameras = await availableCameras();
    if (cameras.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No camera available.')),
        );
      }
      return;
    }

    // Prefer the back camera.
    final back = cameras.firstWhere(
      (c) => c.lensDirection == CameraLensDirection.back,
      orElse: () => cameras.first,
    );

    _cameraController = CameraController(
      back,
      ResolutionPreset.high,
      enableAudio: false,
    );

    await _cameraController!.initialize();
    if (mounted) setState(() => _cameraReady = true);
  }

  @override
  void dispose() {
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

      // Run OMR detection.
      final detections = _scanner.detect(
        imageBytes: Uint8List.fromList(imageBytes),
        itemCount: widget.qrPayload.count,
      );

      if (!mounted) return;

      // Navigate to the review screen.
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ScanReviewScreen(
            detections: detections,
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

          // Camera preview
          Expanded(
            child: _cameraReady && _cameraController != null
                ? CameraPreview(_cameraController!)
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
              label: Text(_processing ? 'Processing...' : 'Capture & Detect'),
            ),
          ),
        ],
      ),
    );
  }
}

/// Review screen — shows the detected answers and lets the instructor
/// correct any ambiguous or incorrect detections before submitting.
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
  late List<String> _answers;
  late List<bool> _ambiguous;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _answers = widget.detections.map((d) => d.detectedAnswer).toList();
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

      // Show result and pop back to dashboard.
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
              color: AppTheme.warning.withOpacity(0.1),
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
              itemBuilder: (context, index) {
                final detection = widget.detections[index];
                final isAmbiguous = _ambiguous[index];

                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: isAmbiguous
                        ? AppTheme.warning.withOpacity(0.2)
                        : AppTheme.surface,
                    child: Text('${index + 1}'),
                  ),
                  title: Wrap(
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
                  ),
                  trailing: isAmbiguous
                      ? const Icon(Icons.warning, color: AppTheme.warning, size: 20)
                      : _answers[index].isEmpty
                          ? const Text('—',
                              style: TextStyle(color: AppTheme.textMuted))
                          : const Icon(Icons.check, color: AppTheme.success, size: 20),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
