import 'dart:typed_data';

import 'package:image/image.dart' as img;

/// OMR bubble detection result for a single item.
class OmrDetection {
  const OmrDetection({
    required this.itemNumber,
    required this.choices,
    required this.detectedAnswer,
    this.ambiguous = false,
  });

  final int itemNumber;
  /// All choices for this item, e.g. ['A', 'B', 'C', 'D'].
  final List<String> choices;
  /// The detected answer, or empty string if none detected.
  final String detectedAnswer;
  /// True if multiple bubbles are filled or detection is uncertain.
  final bool ambiguous;
}

/// OMR scanner — detects filled bubbles on a captured answer sheet image.
///
/// Algorithm (per thesis scope §3.1.3):
/// 1. Convert to grayscale and apply adaptive threshold.
/// 2. Detect the QR code region (top-right corner) to identify the exam.
/// 3. Detect bubble grid positions based on the known OMR sheet layout.
/// 4. For each bubble, calculate pixel density (ratio of dark pixels).
/// 5. The bubble with the highest density above a threshold is the marked answer.
/// 6. If multiple bubbles exceed the threshold, mark as ambiguous.
class OmrScanner {
  /// Threshold ratio — a bubble is "filled" if its dark-pixel ratio exceeds this.
  static const double fillThreshold = 0.35;

  /// Minimum ratio difference between the top bubble and second bubble
  /// to consider the detection unambiguous.
  static const double ambiguityMargin = 0.10;

  /// Analyze a captured image and detect filled bubbles.
  ///
  /// [imageBytes] — JPEG/PNG bytes from the camera.
  /// [itemCount] — number of items on the sheet (from QR code).
  /// [bubbleLayout] — for each item, the list of choice labels
  ///   (e.g. ['A','B','C','D'] for MCQ, ['T','F'] for true_false).
  ///   If null, defaults to ['A','B','C','D'] for all items.
  List<OmrDetection> detect({
    required Uint8List imageBytes,
    required int itemCount,
    List<List<String>>? bubbleLayout,
  }) {
    final image = img.decodeImage(imageBytes);
    if (image == null) {
      throw const OmrException('Could not decode the captured image.');
    }

    // Convert to grayscale.
    final gray = img.grayscale(image);

    // For each item, scan the expected bubble positions and compute
    // fill ratios. The actual positions depend on the OMR sheet layout
    // (see omrService.js): 2 columns of 25 items, bubbles at known offsets.
    //
    // In a production implementation, we would detect the QR code and
    // corner anchors to deskew and locate the grid precisely. For the
    // thesis implementation, we use the known fixed layout from the
    // generated PDF.
    final detections = <OmrDetection>[];

    for (int item = 0; item < itemCount; item++) {
      final choices = bubbleLayout != null && item < bubbleLayout.length
          ? bubbleLayout[item]
          : ['A', 'B', 'C', 'D'];

      // Compute fill ratios for each bubble in this item.
      final ratios = <double>[];
      for (int c = 0; c < choices.length; c++) {
        final ratio = _computeBubbleFillRatio(gray, item, c, choices.length);
        ratios.add(ratio);
      }

      // Determine the detected answer.
      int maxIdx = 0;
      double maxRatio = 0;
      for (int i = 0; i < ratios.length; i++) {
        if (ratios[i] > maxRatio) {
          maxRatio = ratios[i];
          maxIdx = i;
        }
      }

      // Check for ambiguity — multiple bubbles filled.
      int filledCount = 0;
      double secondRatio = 0;
      for (int i = 0; i < ratios.length; i++) {
        if (ratios[i] >= fillThreshold) filledCount++;
        if (i != maxIdx && ratios[i] > secondRatio) secondRatio = ratios[i];
      }

      String detectedAnswer = '';
      bool ambiguous = false;

      if (maxRatio >= fillThreshold) {
        detectedAnswer = choices[maxIdx];
        if (filledCount > 1 || (maxRatio - secondRatio) < ambiguityMargin) {
          ambiguous = true;
        }
      }

      detections.add(OmrDetection(
        itemNumber: item + 1,
        choices: choices,
        detectedAnswer: detectedAnswer,
        ambiguous: ambiguous,
      ));
    }

    return detections;
  }

  /// Compute the fill ratio (proportion of dark pixels) for a single bubble.
  ///
  /// This uses the known OMR sheet layout from omrService.js:
  /// - 2 columns of 25 items
  /// - Column 0 starts at x=60, Column 1 at x=320
  /// - Rows start at y=210, each row is 22px tall
  /// - Bubbles start 25px after the item number
  /// - Each bubble is 14px wide with 6px gap
  /// - A4 at 72 DPI: 595 x 842 pixels
  ///
  /// The image is scaled to match the expected A4 dimensions before sampling.
  double _computeBubbleFillRatio(img.Image gray, int itemIndex, int bubbleIndex, int choiceCount) {
    // Determine column (0 or 1) and row within the column.
    final col = itemIndex < 25 ? 0 : 1;
    final row = itemIndex % 25;

    // Scale factor — the OMR sheet is designed for A4 at 72 DPI (595x842).
    // We scale the captured image to match this coordinate system.
    final scaleX = 595.0 / gray.width;
    final scaleY = 842.0 / gray.height;

    // Bubble positions from omrService.js layout.
    const colX = [60.0, 320.0];
    const rowYStart = 210.0;
    const rowHeight = 22.0;
    const bubbleStartOffset = 25.0;
    const bubbleSize = 14.0;
    const bubbleGap = 6.0;

    final itemX = colX[col] + bubbleStartOffset;
    final bubbleX = itemX + bubbleIndex * (bubbleSize + bubbleGap);
    final bubbleY = rowYStart + row * rowHeight;

    // Sample the bubble region. We need to convert from the design coordinate
    // system back to actual pixel coordinates.
    final px = (bubbleX / scaleX).round();
    final py = (bubbleY / scaleY).round();
    final pw = (bubbleSize / scaleX).round();
    final ph = (bubbleSize / scaleY).round();

    // Sample the interior of the bubble (skip the border).
    final sampleX = px + 2;
    final sampleY = py + 2;
    final sampleW = pw > 4 ? pw - 4 : 1;
    final sampleH = ph > 4 ? ph - 4 : 1;

    int darkPixels = 0;
    int totalPixels = 0;

    for (int y = sampleY; y < sampleY + sampleH && y < gray.height; y++) {
      for (int x = sampleX; x < sampleX + sampleW && x < gray.width; x++) {
        if (x < 0 || y < 0) continue;
        final pixel = gray.getPixel(x, y);
        // Grayscale luminance — the image is already grayscale, so r=g=b.
        final luminance = pixel.r;
        if (luminance < 128) darkPixels++;
        totalPixels++;
      }
    }

    if (totalPixels == 0) return 0;
    return darkPixels / totalPixels;
  }
}

/// Exception thrown by the OMR scanner.
class OmrException implements Exception {
  const OmrException(this.message);
  final String message;
  @override
  String toString() => message;
}
