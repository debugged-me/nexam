import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:nexam_omr/features/exams/domain/exam.dart';
import 'package:nexam_omr/features/scanner/data/omr_layout.dart';
import 'package:nexam_omr/features/scanner/data/omr_scanner.dart';

/// Synthetic-sheet OMR test: renders an answer sheet in the design
/// coordinate space using the SAME layout constants as omrService.js,
/// draws the four corner anchors + filled bubbles, then runs the real
/// scanner over it. This validates the whole generator↔scanner geometry
/// contract end to end.
void main() {
  /// Paint a filled circle (dark) centered at (cx, cy) with radius r.
  void fillCircle(img.Image image, double cx, double cy, double r) {
    final x0 = (cx - r).floor();
    final y0 = (cy - r).floor();
    final x1 = (cx + r).ceil();
    final y1 = (cy + r).ceil();
    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        final dx = x - cx;
        final dy = y - cy;
        if (x >= 0 && x < image.width && y >= 0 && y < image.height &&
            dx * dx + dy * dy <= r * r) {
          image.setPixelRgb(x, y, 20, 20, 20);
        }
      }
    }
  }

  /// Render a synthetic OMR sheet: white page, 4 anchor squares,
  /// then filled bubbles at the given (itemNumber → choiceIndex) marks.
  /// Returns PNG bytes.
  Uint8List renderSheet({
    required Map<String, List<String>> types,
    required Map<int, List<int>> marks, // itemNumber → bubble indices per sub-row
  }) {
    final image = img.Image(width: kPageW.round(), height: kPageH.round());
    img.fill(image, color: img.ColorRgb8(255, 255, 255));

    // Corner anchors (filled black squares at kAnchorOffset).
    const a = kAnchorOffset, s = kAnchorSize;
    for (final (x, y) in [
      (a, a), (kPageW - a - s, a), (a, kPageH - a - s), (kPageW - a - s, kPageH - a - s)
    ]) {
      for (var yy = y.round(); yy < y + s; yy++) {
        for (var xx = x.round(); xx < x + s; xx++) {
          image.setPixelRgb(xx, yy, 0, 0, 0);
        }
      }
    }

    // Bubble rows — outline circles, then fill the marked ones.
    final items = types['types']!
        .map((c) => OmrItemLayout.fromCode(c))
        .toList();
    final rows = computeSheetRows(items);
    for (final row in rows) {
      for (var c = 0; c < row.choices.length; c++) {
        final center = bubbleCenter(row.col, row.row, c);
        // Outline ring (thin dark circle).
        for (var t = 0.0; t < 2 * math.pi; t += 0.05) {
          final px = (center[0] + (kBubble / 2) * math.cos(t)).round();
          final py = (center[1] + (kBubble / 2) * math.sin(t)).round();
          if (px >= 0 && px < image.width && py >= 0 && py < image.height) {
            image.setPixelRgb(px, py, 30, 30, 30);
          }
        }
        // Fill if marked.
        final marked = marks[row.itemNumber];
        if (marked != null && row.subIndex < marked.length && marked[row.subIndex] == c) {
          fillCircle(image, center[0], center[1], kBubble / 2 - 2);
        }
      }
    }

    return Uint8List.fromList(img.encodePng(image));
  }

  OmrQrPayload payloadFor(List<String> codes) {
    return OmrQrPayload.fromJson({
      'examId': 'exam-1',
      'setId': 'set-1',
      'set': 'A',
      'count': codes.length,
      'types': codes,
    });
  }

  test('detects MCQ + true/false marks on a synthetic anchored sheet', () {
    // 3 MCQ + 1 T/F — all in column 0.
    final bytes = renderSheet(
      types: {'types': ['m4', 'm4', 'm4', 't']},
      marks: {
        1: [1], // item 1 → B
        2: [3], // item 2 → D
        4: [0], // item 4 → T
      },
    );
    final out = OmrScanner().detect(
      imageBytes: bytes,
      payload: payloadFor(['m4', 'm4', 'm4', 't']),
    );

    expect(out.aligned, isTrue, reason: 'anchors should be found on a clean sheet');
    expect(out.detections[0].detectedAnswer, 'B');
    expect(out.detections[1].detectedAnswer, 'D');
    expect(out.detections[2].detectedAnswer, ''); // blank item
    expect(out.detections[3].detectedAnswer, 'T');
  });

  test('matching items read one letter per premise sub-row', () {
    final bytes = renderSheet(
      types: {'types': ['M3']},
      marks: {
        1: [1, 0, 3], // 1a→B, 1b→A, 1c→D
      },
    );
    final out = OmrScanner().detect(
      imageBytes: bytes,
      payload: payloadFor(['M3']),
    );

    expect(out.detections[0].type, 'matching');
    expect(out.detections[0].subAnswers, ['B', 'A', 'D']);
    expect(out.detections[0].detectedAnswer, 'B,A,D');
  });

  test('identification bubbles map to CORRECT/INCORRECT verdicts', () {
    final bytes = renderSheet(
      types: {'types': ['i', 'i']},
      marks: {
        1: [0], // ✓
        2: [1], // ✗
      },
    );
    final out = OmrScanner().detect(
      imageBytes: bytes,
      payload: payloadFor(['i', 'i']),
    );

    expect(out.detections[0].detectedAnswer, 'CORRECT');
    expect(out.detections[1].detectedAnswer, 'INCORRECT');
  });

  test('a second column is used after 25 rows', () {
    // 30 single-row items → items 26+ land in column 1.
    final codes = List<String>.filled(30, 'm4');
    final bytes = renderSheet(
      types: {'types': codes},
      marks: {
        26: [2], // first row of column 1 → C
        30: [0], // last row → A
      },
    );
    final out = OmrScanner().detect(
      imageBytes: bytes,
      payload: payloadFor(codes),
    );

    expect(out.detections[25].detectedAnswer, 'C');
    expect(out.detections[29].detectedAnswer, 'A');
  });

  test('matching item never splits across the column boundary', () {
    // 24 single-row items + one 3-row matching item → starts column 1.
    final codes = [...List<String>.filled(24, 'm4'), 'M3'];
    final bytes = renderSheet(
      types: {'types': codes},
      marks: {
        25: [4, 2, 0], // in column 1 rows 0-2
      },
    );
    final out = OmrScanner().detect(
      imageBytes: bytes,
      payload: payloadFor(codes),
    );

    expect(out.detections[24].subAnswers, ['E', 'C', 'A']);
  });
}
