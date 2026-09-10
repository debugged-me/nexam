import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/theme/app_theme.dart';
import '../../exams/domain/exam.dart';

/// QR scanner screen — the instructor points the camera at the OMR sheet's
/// QR code to identify the exam and set. Once decoded, the app transitions
/// to the bubble-scanning phase.
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

class _QrScannerScreenState extends State<QrScannerScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  bool _detected = false;

  @override
  void dispose() {
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scan OMR Sheet')),
      body: Stack(
        children: [
          // Camera preview
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
          ),

          // Scanning overlay
          Center(
            child: Container(
              width: 250,
              height: 250,
              decoration: BoxDecoration(
                border: Border.all(color: AppTheme.primary, width: 3),
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),

          // Instructions
          Positioned(
            bottom: 48,
            left: 0,
            right: 0,
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  margin: const EdgeInsets.symmetric(horizontal: 40),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.7),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'Point the camera at the QR code on the OMR answer sheet',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white, fontSize: 14),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
