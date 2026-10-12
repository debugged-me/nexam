import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/nexam_app_bar.dart';
import '../../exams/domain/exam.dart';
import '../data/omr_scanner.dart';
import '../data/scan_api.dart';
import '../data/scan_outbox.dart';

/// Capture screen — dark camera UI with an A4 framing guide, student
/// fields in a glass card, torch toggle, and a shutter button. The photo
/// goes to the OMR engine in a background isolate, then to review.
class BubbleScannerScreen extends StatefulWidget {
  const BubbleScannerScreen({
    super.key,
    required this.qrPayload,
    required this.examSetId,
    required this.ownerId,
    required this.baseUrl,
    required this.token,
  });

  final OmrQrPayload qrPayload;
  final String? examSetId;

  /// Instructor account id — namespaces the offline outbox so queued
  /// scans can never be flushed under a different login.
  final String ownerId;
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
  bool _torchOn = false;
  String? _cameraError;
  final _scanApi = ScanApi();

  /// Receipt for the sheet just submitted — shown as a banner while the
  /// camera stays live for the next one (every sheet of a set shares the
  /// same QR, so one decode covers the whole pile).
  _ScanOutcome? _lastSaved;

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
      setState(() {
        _cameraReady = false;
        _cameraController = null;
      });
      controller.dispose();
    } else if (state == AppLifecycleState.resumed) {
      _initCamera();
    }
  }

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        if (mounted) {
          setState(() =>
              _cameraError = 'No camera available on this device.');
        }
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

  Future<void> _toggleTorch() async {
    final controller = _cameraController;
    if (controller == null || !controller.value.isInitialized) return;
    try {
      await controller
          .setFlashMode(_torchOn ? FlashMode.off : FlashMode.torch);
      if (mounted) setState(() => _torchOn = !_torchOn);
    } catch (_) {
      // Some devices lack a torch — fail quietly.
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
      if (_torchOn) {
        // Leave the torch off for the next capture.
        await _cameraController!.setFlashMode(FlashMode.off);
        _torchOn = false;
      }
      final imageBytes = await xFile.readAsBytes();

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
        final retake = await _showAlignmentWarning();
        if (retake) {
          setState(() => _processing = false);
          return;
        }
      }

      if (!mounted) return;
      final outcome = await Navigator.of(context).push<_ScanOutcome>(
        MaterialPageRoute(
          builder: (_) => ScanReviewScreen(
            detections: output.detections,
            qrPayload: widget.qrPayload,
            examSetId: widget.examSetId,
            ownerId: widget.ownerId,
            studentName: _nameController.text,
            studentNumber: _numberController.text,
            baseUrl: widget.baseUrl,
            token: widget.token,
            scanApi: _scanApi,
          ),
        ),
      );

      // Saved (or queued) — clear the student fields so the next sheet can
      // never inherit a name, and flash the receipt while the camera stays
      // live. Backing out manually ends the burst.
      if (outcome != null && mounted) {
        setState(() {
          _lastSaved = outcome;
          _nameController.clear();
          _numberController.clear();
        });
      }
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

  Future<bool> _showAlignmentWarning() async {
    final choice = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        ),
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
      backgroundColor: Colors.black,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: Text(
          'Set ${widget.qrPayload.set} — ${widget.qrPayload.count} items',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Camera preview (or error / loading states).
          if (_cameraError != null)
            _buildCameraError()
          else if (_cameraReady && _cameraController != null)
            CameraPreview(_cameraController!)
          else
            const Center(
              child: CircularProgressIndicator(color: Colors.white),
            ),

          // Sheet framing guide.
          if (_cameraReady) const _SheetGuide(),

          // Last-sheet receipt — proof the previous submission landed
          // while framing the next one.
          if (_lastSaved != null && _cameraReady)
            Positioned(
              left: 16,
              right: 16,
              top: 0,
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.only(top: 56),
                  child: _SavedBanner(
                    outcome: _lastSaved!,
                    onDismiss: () => setState(() => _lastSaved = null),
                  ),
                ),
              ),
            ),

          // Bottom stack: student card + shutter row.
          if (_cameraReady)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 18),
                  child: Column(
                    children: [
                      _buildStudentCard(),
                      const SizedBox(height: 18),
                      _buildShutterRow(),
                    ],
                  ),
                ),
              ),
            ),

          // Processing scrim.
          if (_processing)
            Container(
              color: Colors.black.withValues(alpha: 0.65),
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: Colors.white),
                    SizedBox(height: 16),
                    Text(
                      'Reading bubbles…',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildCameraError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Icon(
                Icons.videocam_off_rounded,
                color: Colors.white70,
                size: 26,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              _cameraError!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white70, fontSize: 14),
            ),
            const SizedBox(height: 18),
            OutlinedButton(
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                side: BorderSide(
                  color: Colors.white.withValues(alpha: 0.4),
                ),
                minimumSize: const Size(140, 46),
              ),
              onPressed: _initCamera,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  /// Frosted card holding the student fields — floats over the preview so
  /// the camera keeps the maximum vertical space.
  Widget _buildStudentCard() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
      ),
      child: Row(
        children: [
          Expanded(
            child: _darkField(
              controller: _nameController,
              hint: 'Student name',
              icon: Icons.person_outline_rounded,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _darkField(
              controller: _numberController,
              hint: 'Student ID',
              icon: Icons.badge_rounded,
            ),
          ),
        ],
      ),
    );
  }

  Widget _darkField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
  }) {
    return TextField(
      controller: controller,
      style: const TextStyle(color: Colors.white, fontSize: 13.5),
      decoration: InputDecoration(
        isDense: true,
        filled: true,
        fillColor: Colors.white.withValues(alpha: 0.10),
        hintText: hint,
        hintStyle:
            TextStyle(color: Colors.white.withValues(alpha: 0.45), fontSize: 13),
        prefixIcon: Icon(icon,
            size: 17, color: Colors.white.withValues(alpha: 0.55)),
        prefixIconConstraints:
            const BoxConstraints(minWidth: 36, minHeight: 20),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }

  /// Torch toggle + camera-app shutter button.
  Widget _buildShutterRow() {
    return Row(
      children: [
        const SizedBox(width: 52),
        const Spacer(),
        GestureDetector(
          onTap: _processing ? null : _captureAndScan,
          child: Container(
            width: 74,
            height: 74,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 4),
              color: Colors.transparent,
            ),
            child: Center(
              child: Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _processing ? Colors.white54 : Colors.white,
                ),
                child: const Icon(
                  Icons.document_scanner_outlined,
                  color: AppTheme.ink,
                  size: 24,
                ),
              ),
            ),
          ),
        ),
        const Spacer(),
        Material(
          color: _torchOn
              ? AppTheme.primary
              : Colors.white.withValues(alpha: 0.14),
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: _toggleTorch,
            child: SizedBox(
              width: 52,
              height: 52,
              child: Icon(
                _torchOn
                    ? Icons.flashlight_on_rounded
                    : Icons.flashlight_off_rounded,
                color: Colors.white,
                size: 21,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// What the review screen reports back after a submit — enough to render
/// the "saved" receipt on the camera screen.
class _ScanOutcome {
  const _ScanOutcome({required this.label, required this.queued});
  final String label;
  final bool queued;
}

/// Small glass pill pinned under the app bar — confirms the sheet just
/// submitted (score, or "queued for sync") and dismisses on tap.
class _SavedBanner extends StatelessWidget {
  const _SavedBanner({required this.outcome, required this.onDismiss});
  final _ScanOutcome outcome;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final accent = outcome.queued ? AppTheme.warning : AppTheme.success;
    return GestureDetector(
      onTap: onDismiss,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.62),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: accent.withValues(alpha: 0.55)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              outcome.queued
                  ? Icons.cloud_off_rounded
                  : Icons.check_circle_rounded,
              size: 15,
              color: accent,
            ),
            const SizedBox(width: 7),
            Flexible(
              child: Text(
                outcome.label,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(width: 7),
            Icon(
              Icons.close_rounded,
              size: 14,
              color: Colors.white.withValues(alpha: 0.5),
            ),
          ],
        ),
      ),
    );
  }
}

/// A4 sheet framing guide — the four corner marks should sit inside the
/// accent boxes.
class _SheetGuide extends StatelessWidget {
  const _SheetGuide();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const aspect = 794 / 1123;
        var w = constraints.maxWidth * 0.86;
        var h = w / aspect;
        if (h > constraints.maxHeight * 0.78) {
          h = constraints.maxHeight * 0.78;
          w = h * aspect;
        }
        final left = (constraints.maxWidth - w) / 2;
        final top = (constraints.maxHeight - h) / 2 - 24;

        const corner = 24.0;
        const inset = 0.03;
        return Stack(
          children: [
            Positioned(
              left: left,
              top: top,
              child: Container(
                width: w,
                height: h,
                decoration: BoxDecoration(
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.55),
                    width: 1.5,
                  ),
                  borderRadius: BorderRadius.circular(10),
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
                    border: Border.all(
                      color: AppTheme.primaryLight,
                      width: 2.5,
                    ),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
            Positioned(
              left: left,
              right: constraints.maxWidth - left - w,
              top: top - 30,
              child: Text(
                'Fit all four corner marks in the boxes',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.75),
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  shadows: const [
                    Shadow(color: Colors.black87, blurRadius: 6),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

/// Review screen — grouped card of detected answers with per-type chip
/// editors and a sticky submit bar. Correct anything the scanner was
/// unsure about before the score is committed.
class ScanReviewScreen extends StatefulWidget {
  const ScanReviewScreen({
    super.key,
    required this.detections,
    required this.qrPayload,
    required this.examSetId,
    required this.ownerId,
    required this.studentName,
    required this.studentNumber,
    required this.baseUrl,
    required this.token,
    required this.scanApi,
  });

  final List<OmrDetection> detections;
  final OmrQrPayload qrPayload;
  final String? examSetId;
  final String ownerId;
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
  late List<List<String>> _subAnswers;
  late List<bool> _ambiguous;
  late List<GlobalKey> _itemKeys;
  bool _submitting = false;
  int _flagCursor = -1;

  /// Idempotency key for this sheet — minted once when the review screen
  /// opens, so every retry of THIS submission carries the same id and the
  /// server can dedupe it instead of writing a second scan.
  final String _clientScanId = mintClientScanId();

  int get _answeredCount => _answers.where((a) => a.isNotEmpty).length;
  int get _ambiguousCount => _ambiguous.where((a) => a).length;

  @override
  void initState() {
    super.initState();
    _answers = widget.detections.map((d) => d.detectedAnswer).toList();
    _subAnswers = widget.detections
        .map((d) => List<String>.from(d.subAnswers))
        .toList();
    _ambiguous = widget.detections.map((d) => d.ambiguous).toList();
    _itemKeys = List.generate(_answers.length, (_) => GlobalKey());
  }

  /// Cycles the flagged chip: each tap scrolls the next ambiguous item
  /// into view instead of the instructor hunting a long list by eye.
  void _jumpToNextFlagged() {
    final flagged = [
      for (var i = 0; i < _ambiguous.length; i++)
        if (_ambiguous[i]) i,
    ];
    if (flagged.isEmpty) return;
    _flagCursor = (_flagCursor + 1) % flagged.length;
    final ctx = _itemKeys[flagged[_flagCursor]].currentContext;
    if (ctx != null) {
      Scrollable.ensureVisible(
        ctx,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
        alignment: 0.15,
      );
    }
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);

    final scannedAnswers = <ScannedAnswer>[
      for (int i = 0; i < _answers.length; i++)
        ScannedAnswer(
          itemNumber: i + 1,
          markedAnswer: _answers[i],
          ambiguous: _ambiguous[i],
        ),
    ];

    try {
      final result = await widget.scanApi.submitScan(
        baseUrl: widget.baseUrl,
        token: widget.token,
        examId: widget.qrPayload.examId,
        examSetId: widget.examSetId,
        set: widget.qrPayload.set,
        studentName: widget.studentName.isEmpty ? null : widget.studentName,
        studentNumber:
            widget.studentNumber.isEmpty ? null : widget.studentNumber,
        clientScanId: _clientScanId,
        answers: scannedAnswers,
      );

      if (!mounted) return;

      // Back to the live camera for the next sheet — the outcome becomes
      // the receipt banner there. Exiting the camera ends the burst.
      final who = widget.studentName.isEmpty
          ? 'Sheet'
          : widget.studentName;
      Navigator.of(context).pop(
        _ScanOutcome(
          label: '$who — ${result.score}% '
              '(${result.correctCount}/${result.totalItems})'
              '${result.needsReview ? ' · needs review' : ''}',
          queued: false,
        ),
      );
    } on ApiException catch (e) {
      if (e.isNetworkError) {
        // No connection — nothing is lost. The full payload (with its
        // idempotency key) goes to the instructor's outbox and syncs the
        // next time the app reaches the server.
        try {
          final outbox = await ScanOutbox.forOwner(widget.ownerId);
          await outbox.add(PendingScan(
            clientScanId: _clientScanId,
            examId: widget.qrPayload.examId,
            examSetId: widget.examSetId,
            set: widget.qrPayload.set,
            studentName:
                widget.studentName.isEmpty ? null : widget.studentName,
            studentNumber:
                widget.studentNumber.isEmpty ? null : widget.studentNumber,
            answers: scannedAnswers,
          ));
          if (!mounted) return;
          Navigator.of(context).pop(
            _ScanOutcome(
              label: widget.studentName.isEmpty
                  ? 'Saved offline — syncs when back online'
                  : '${widget.studentName} saved offline — syncs when back online',
              queued: true,
            ),
          );
        } catch (_) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('No connection and the offline save failed — keep this screen open and retry.'),
                backgroundColor: AppTheme.error,
              ),
            );
          }
        }
      } else if (mounted) {
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

  void _pick(int index, String value, {int? sub}) {
    setState(() {
      if (sub != null) {
        _subAnswers[index][sub] =
            _subAnswers[index][sub] == value ? '' : value;
        _answers[index] = _subAnswers[index].join(',');
      } else {
        _answers[index] = _answers[index] == value ? '' : value;
      }
      _ambiguous[index] = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const NexamAppBar(
        title: 'Review answers',
        subtitle: 'Correct anything the scanner flagged',
      ),
      body: Column(
        children: [
          _buildSummary(),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
              itemCount: _answers.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) => _buildItemCard(index),
            ),
          ),
        ],
      ),
      bottomSheet: _buildSubmitBar(),
    );
  }

  /// Dark summary strip — who, how many answered, what needs attention.
  Widget _buildSummary() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: AppTheme.heroGradient,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.studentName.isNotEmpty
                      ? widget.studentName
                      : 'Unnamed student',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  '${widget.qrPayload.set} • $_answeredCount/${_answers.length} answered'
                  '${widget.studentNumber.isNotEmpty ? ' • #${widget.studentNumber}' : ''}',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.62),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          if (_ambiguousCount > 0)
            GestureDetector(
              onTap: _jumpToNextFlagged,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppTheme.warning.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(
                    color: AppTheme.warning.withValues(alpha: 0.45),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.flag_rounded,
                        size: 13, color: AppTheme.warning),
                    const SizedBox(width: 4),
                    Text(
                      '$_ambiguousCount',
                      style: const TextStyle(
                        color: AppTheme.warning,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(width: 3),
                    const Icon(Icons.keyboard_arrow_down_rounded,
                        size: 13, color: AppTheme.warning),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildItemCard(int index) {
    final detection = widget.detections[index];
    final isAmbiguous = _ambiguous[index];

    return Container(
      key: _itemKeys[index],
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(
          color: isAmbiguous
              ? AppTheme.warning.withValues(alpha: 0.55)
              : AppTheme.cardBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 30,
                height: 30,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: isAmbiguous
                      ? AppTheme.tintAmber
                      : AppTheme.surfaceAlt,
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Text(
                  '${index + 1}',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                    color: isAmbiguous
                        ? AppTheme.warning
                        : AppTheme.textMuted,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  _typeLabel(detection.type),
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppTheme.textMuted,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              if (isAmbiguous)
                const Icon(Icons.warning_amber_rounded,
                    color: AppTheme.warning, size: 18)
              else if (_answers[index].isEmpty)
                const Text('blank',
                    style: TextStyle(
                        fontSize: 11.5, color: AppTheme.textMuted))
              else
                const Icon(Icons.check_circle_rounded,
                    color: AppTheme.success, size: 17),
            ],
          ),
          const SizedBox(height: 10),
          _buildEditor(index, detection),
        ],
      ),
    );
  }

  String _typeLabel(String type) {
    switch (type) {
      case 'matching':
        return 'Matching — one letter per premise';
      case 'identification':
        return 'Identification — your verdict';
      case 'true_false':
        return 'True or false';
      default:
        return 'Multiple choice';
    }
  }

  Widget _buildEditor(int index, OmrDetection detection) {
    switch (detection.type) {
      case 'matching':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var s = 0; s < _subAnswers[index].length; s++)
              Padding(
                padding: EdgeInsets.only(top: s == 0 ? 0 : 8),
                child: Row(
                  children: [
                    SizedBox(
                      width: 18,
                      child: Text(
                        '${String.fromCharCode(97 + s)})',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textMuted,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: detection.choices.map((choice) {
                          final selected =
                              _subAnswers[index][s] == choice;
                          return _answerChip(
                            label: choice,
                            selected: selected,
                            onTap: () => _pick(index, choice, sub: s),
                          );
                        }).toList(),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        );
      case 'identification':
        return Row(
          children: [
            for (final (label, value) in [
              ('Correct', 'CORRECT'),
              ('Incorrect', 'INCORRECT'),
            ])
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(
                      right: value == 'CORRECT' ? 8 : 0),
                  child: _verdictButton(
                    label: label,
                    positive: value == 'CORRECT',
                    selected: _answers[index] == value,
                    onTap: () => _pick(index, value),
                  ),
                ),
              ),
          ],
        );
      default:
        return Wrap(
          spacing: 8,
          runSpacing: 8,
          children: detection.choices.map((choice) {
            return _answerChip(
              label: choice,
              selected: _answers[index] == choice,
              onTap: () => _pick(index, choice),
            );
          }).toList(),
        );
    }
  }

  Widget _answerChip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return Material(
      color: selected ? AppTheme.primary : AppTheme.surfaceAlt,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          width: 44,
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected ? AppTheme.primary : Colors.transparent,
            ),
          ),
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

  Widget _verdictButton({
    required String label,
    required bool positive,
    required bool selected,
    required VoidCallback onTap,
  }) {
    final accent = positive ? AppTheme.success : AppTheme.error;
    return Material(
      color: selected
          ? accent.withValues(alpha: 0.14)
          : AppTheme.surfaceAlt,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color:
                  selected ? accent.withValues(alpha: 0.7) : Colors.transparent,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                positive
                    ? Icons.check_rounded
                    : Icons.close_rounded,
                size: 15,
                color: selected ? accent : AppTheme.textMuted,
              ),
              const SizedBox(width: 5),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: selected ? accent : AppTheme.textMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSubmitBar() {
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
            onPressed: _submitting ? null : _submit,
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
                    _ambiguousCount > 0
                        ? 'Submit with $_ambiguousCount flagged'
                        : 'Submit scan',
                  ),
          ),
        ),
      ),
    );
  }
}
