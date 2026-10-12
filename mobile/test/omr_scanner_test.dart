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
    double gridY = kGridY,
    double rowH = kRowH,
    int rowsPerCol = kRowsPerCol,
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
    final rows = computeSheetRows(items, rowsPerCol: rowsPerCol);
    for (final row in rows) {
      for (var c = 0; c < row.choices.length; c++) {
        final center =
            bubbleCenter(row.col, row.row, c, gridY: gridY, rowH: rowH);
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

  OmrQrPayload payloadFor(List<String> codes, {Map<String, dynamic>? ly}) {
    return OmrQrPayload.fromJson({
      'examId': 'exam-1',
      'setId': 'set-1',
      'set': 'A',
      'count': codes.length,
      'types': codes,
      if (ly != null) 'ly': ly,
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
        1: [0], // C (Correct)
        2: [1], // I (Incorrect)
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

  test('v:2 auto-fit sheet — shrunken pitch reads correctly from the ly block', () {
    // Dense exam: 50 items incl. a 5-premise matching → 54 grid rows, so the
    // generator packs 27/col at a 27px pitch and ships that geometry in `ly`.
    const rowH = 27.0;
    const rowsPerCol = 27;
    final codes = <String>[
      ...List<String>.filled(8, 'm4'),
      'M5',
      ...List<String>.filled(41, 'm4'),
    ];
    final bytes = renderSheet(
      types: {'types': codes},
      rowH: rowH,
      rowsPerCol: rowsPerCol,
      marks: {
        9: [2, 4, 0, 1, 3], // matching → all five premises
        50: [1],            // last item — the row v:1 sheets dropped
      },
    );
    final out = OmrScanner().detect(
      imageBytes: bytes,
      payload: payloadFor(codes, ly: {'gy': kGridY, 'rh': rowH, 'rpc': rowsPerCol}),
    );

    expect(out.detections[8].subAnswers, ['C', 'E', 'A', 'B', 'D']);
    expect(out.detections[49].detectedAnswer, 'B');
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

  test('finds anchors when the sheet sits inside a larger photo', () {
    // A real capture: the sheet is downscaled and offset inside a frame
    // with visible background — the old expected-corner search failed
    // here because the anchors were nowhere near the image corners.
    final sheetBytes = renderSheet(
      types: {'types': ['m4', 'm4']},
      marks: {
        1: [1], // B
        2: [2], // C
      },
    );
    final sheet = img.decodePng(sheetBytes)!;
    final small = img.copyResize(sheet, width: 520);
    final frame = img.Image(width: 720, height: 920);
    img.fill(frame, color: img.ColorRgb8(196, 196, 196)); // desk
    img.compositeImage(frame, small, dstX: 130, dstY: 90);
    final bytes = Uint8List.fromList(img.encodePng(frame));

    final out = OmrScanner().detect(
      imageBytes: bytes,
      payload: payloadFor(['m4', 'm4']),
    );

    expect(out.aligned, isTrue,
        reason: 'extreme-corner anchors should be found with margin');
    expect(out.detections[0].detectedAnswer, 'B');
    expect(out.detections[1].detectedAnswer, 'C');
  });

  test('still detects on a slightly rotated capture', () {
    final sheetBytes = renderSheet(
      types: {'types': ['m4', 'm4']},
      marks: {
        1: [0], // A
        2: [3], // D
      },
    );
    final sheet = img.decodePng(sheetBytes)!;
    final small = img.copyResize(sheet, width: 500);
    final rotated = img.copyRotate(small, angle: 6);
    final frame = img.Image(width: 720, height: 960);
    img.fill(frame, color: img.ColorRgb8(196, 196, 196));
    img.compositeImage(frame, rotated, dstX: 110, dstY: 80);
    final bytes = Uint8List.fromList(img.encodePng(frame));

    final out = OmrScanner().detect(
      imageBytes: bytes,
      payload: payloadFor(['m4', 'm4']),
    );

    expect(out.aligned, isTrue,
        reason: 'homography should correct a modest rotation');
    expect(out.detections[0].detectedAnswer, 'A');
    expect(out.detections[1].detectedAnswer, 'D');
  });
}
