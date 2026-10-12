import 'package:flutter/material.dart';

import '../../../core/network/api_exception.dart';
import '../../auth/domain/instructor_session.dart';
import '../../exams/data/exam_api.dart';
import '../../exams/domain/exam.dart';
import 'bubble_scanner_screen.dart';
import 'qr_scanner_screen.dart';

/// Launches the full scan flow: QR decode → (legacy set-id lookup) →
/// bubble capture → review. Shared by the dashboard CTA and the nav bar's
/// center Scan action so the behavior stays identical.
void launchScanFlow(
  BuildContext context, {
  required InstructorSession session,
  required VoidCallback onSessionExpired,
}) {
  Navigator.of(context).push(
    MaterialPageRoute(
      builder: (_) => QrScannerScreen(
        onQrDecoded: (payload) =>
            _openBubbleScanner(context, session, onSessionExpired, payload),
      ),
    ),
  );
}

Future<void> _openBubbleScanner(
  BuildContext context,
  InstructorSession session,
  VoidCallback onSessionExpired,
  OmrQrPayload payload,
) async {
  // The QR payload carries the exact set id — no lookup needed for
  // new-format sheets. Legacy sheets only have the label, so resolve
  // via the API as a fallback.
  String? examSetId = payload.setId;
  if (examSetId == null || examSetId.isEmpty) {
    try {
      final sets = await ExamApi().listExamSets(
        baseUrl: session.baseUrl,
        token: session.token,
        examId: payload.examId,
      );
      final matching = sets.where((s) => s.label == payload.set).toList();
      if (matching.isNotEmpty) examSetId = matching.first.id;
    } on ApiException catch (e) {
      if (e.isSessionExpired) {
        onSessionExpired();
        return;
      }
    } catch (_) {
      // If we can't find the set, we'll submit without it.
    }
  }

  if (!context.mounted) return;

  Navigator.of(context).pushReplacement(
    MaterialPageRoute(
      builder: (_) => BubbleScannerScreen(
        qrPayload: payload,
        examSetId: examSetId,
        ownerId: session.id,
        baseUrl: session.baseUrl,
        token: session.token,
      ),
    ),
  );
}
