import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/theme/app_theme.dart';
import '../../exams/domain/exam.dart';

/// QR scanner — dark native camera UI: corner-bracket reticle, torch
/// toggle, and a single purpose (decode the sheet's QR and hand the
/// payload to the bubble scanner).
class QrScannerScreen extends StatefulWidget {
  const QrScannerScreen({
    super.key,
    required this.onQrDecoded,
  });

  /// Called with the parsed QR payload when a valid code is detected.
  final void Function(OmrQrPayload payload) onQrDecoded;

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen>
    with SingleTickerProviderStateMixin {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  late final AnimationController _scanLine;
  bool _detected = false;
  bool _torchOn = false;

  @override
  void initState() {
    super.initState();
    _scanLine = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _scanLine.dispose();
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_detected) return;

    for (final barcode in capture.barcodes) {
      final raw = barcode.rawValue;
      if (raw == null || raw.isEmpty) continue;

      try {
        final json = jsonDecode(raw);
        if (json is Map &&
            json['examId'] != null &&
            json['set'] != null) {
          _detected = true;
          _controller.stop();
          final payload = OmrQrPayload.fromJson(
            Map<String, dynamic>.from(json),
          );
          widget.onQrDecoded(payload);
          return;
        }
      } catch (_) {
        // Not a valid JSON QR code — keep scanning.
      }
    }
  }

  Future<void> _toggleTorch() async {
    await _controller.toggleTorch();
    if (mounted) setState(() => _torchOn = !_torchOn);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: const Text(
          'Scan sheet QR',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
          ),

          // Dimmed surround with a clear reticle window.
          const _ScanDimmer(),

          // Corner-bracket reticle + traveling scan line.
          Center(
            child: SizedBox(
              width: 240,
              height: 240,
              child: Stack(
                children: [
                  const _CornerBrackets(),
                  AnimatedBuilder(
                    animation: _scanLine,
                    builder: (_, __) => Positioned(
                      left: 14,
                      right: 14,
                      top: 14 + (_scanLine.value * 212),
                      child: Container(
                        height: 2,
                        decoration: BoxDecoration(
                          color: AppTheme.primaryLight,
                          borderRadius: BorderRadius.circular(1),
                          boxShadow: [
                            BoxShadow(
                              color: AppTheme.primaryLight
                                  .withValues(alpha: 0.6),
                              blurRadius: 8,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Bottom controls: hint pill + torch.
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
                child: Column(
                  children: [
                    _darkIconButton(
                      icon: _torchOn
                          ? Icons.flashlight_on_rounded
                          : Icons.flashlight_off_rounded,
                      onTap: _toggleTorch,
                      active: _torchOn,
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 18, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.16),
                        ),
                      ),
                      child: const Text(
                        'Point at the QR code printed on the answer sheet',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _darkIconButton({
    required IconData icon,
    required VoidCallback onTap,
    bool active = false,
  }) {
    return Material(
      color: active
          ? AppTheme.primary
          : Colors.white.withValues(alpha: 0.14),
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 52,
          height: 52,
          child: Icon(icon, color: Colors.white, size: 22),
        ),
      ),
    );
  }
}

/// Darkens everything except a centered square reticle window.
class _ScanDimmer extends StatelessWidget {
  const _ScanDimmer();

  @override
  Widget build(BuildContext context) {
    return ColorFiltered(
      colorFilter: ColorFilter.mode(
        Colors.black.withValues(alpha: 0.55),
        BlendMode.srcOut,
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          Container(
            decoration: const BoxDecoration(
              color: Colors.black,
              backgroundBlendMode: BlendMode.dstOut,
            ),
          ),
          Center(
            child: Container(
              width: 240,
              height: 240,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Four L-shaped corner brackets — the fintech scan-frame look.
class _CornerBrackets extends StatelessWidget {
  const _CornerBrackets();

  static const double _size = 240;
  static const double _arm = 26;
  static const double _stroke = 3.5;

  @override
  Widget build(BuildContext context) {
    const color = AppTheme.primaryLight;
    Widget bracket({required Alignment at}) => Align(
          alignment: at,
          child: SizedBox(
            width: _arm,
            height: _arm,
            child: CustomPaint(painter: _BracketPainter(at, color)),
          ),
        );

    return SizedBox(
      width: _size,
      height: _size,
      child: Stack(
        children: [
          bracket(at: Alignment.topLeft),
          bracket(at: Alignment.topRight),
          bracket(at: Alignment.bottomLeft),
          bracket(at: Alignment.bottomRight),
        ],
      ),
    );
  }
}

class _BracketPainter extends CustomPainter {
  const _BracketPainter(this.corner, this.color);

  final Alignment corner;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = _CornerBrackets._stroke
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final path = Path();
    if (corner == Alignment.topLeft) {
      path.moveTo(size.width, 0);
      path.lineTo(0, 0);
      path.lineTo(0, size.height);
    } else if (corner == Alignment.topRight) {
      path.moveTo(0, 0);
      path.lineTo(size.width, 0);
      path.lineTo(size.width, size.height);
    } else if (corner == Alignment.bottomLeft) {
      path.moveTo(size.width, size.height);
      path.lineTo(0, size.height);
      path.lineTo(0, 0);
    } else {
      path.moveTo(0, size.height);
      path.lineTo(size.width, size.height);
      path.lineTo(size.width, 0);
    }
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(_BracketPainter old) => false;
}
