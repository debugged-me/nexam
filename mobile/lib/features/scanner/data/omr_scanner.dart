import 'dart:math' as math;
import 'dart:typed_data';

import 'package:image/image.dart' as img;

import '../../exams/domain/exam.dart';
import 'omr_layout.dart';

/// OMR detection result for a single item.
class OmrDetection {
  const OmrDetection({
    required this.itemNumber,
    required this.type,
    required this.choices,
    required this.detectedAnswer,
    this.subAnswers = const [],
    this.ambiguous = false,
  });

  final int itemNumber;

  /// 'mcq' | 'true_false' | 'matching' | 'identification'
  final String type;

  /// Bubble labels for the review UI (single-row items).
  final List<String> choices;

  /// Canonical answer submitted to the API:
  ///   mcq / true_false   — letter ('B', 'T')
  ///   matching           — comma-joined letters in premise order ('B,A,D')
  ///   identification     — 'CORRECT' | 'INCORRECT' | '' (ungraded)
  final String detectedAnswer;

  /// Per-sub-row letters for matching items (for the review UI).
  final List<String> subAnswers;

  /// True when detection was uncertain — needs instructor eyes.
  final bool ambiguous;
}

/// Full scan result including alignment quality.
class OmrScanOutput {
  const OmrScanOutput({required this.detections, required this.aligned});

  final List<OmrDetection> detections;

  /// False when corner anchors weren't found and the scan fell back to
  /// whole-frame mapping — results should be treated as provisional.
  final bool aligned;
}

/// OMR scanner — detects filled bubbles on a captured answer sheet.
///
/// Pipeline:
///   1. Decode + grayscale + downscale for marker search.
///   2. Locate the four black corner anchor squares (connected components).
///   3. Fit a homography design→image from the anchor centers.
///   4. For every bubble row of the shared layout, project each bubble
///      center into the photo and measure dark-pixel fill ratio.
///   5. Per item, reduce row readings to the canonical answer form the
///      scoring service expects.
///
/// Stateless — safe to run inside an isolate via [scanImage].
class OmrScanner {
  /// A bubble counts as filled when its interior dark ratio passes this.
  static const double fillThreshold = 0.35;

  /// Minimum gap between the best and second-best bubble for a confident read.
  static const double ambiguityMargin = 0.10;

  /// Detect answers on a captured sheet image.
  ///
  /// [payload] carries the item layouts decoded from the sheet's QR code,
  /// so the scanner reconstructs the exact grid the PDF generator used.
  OmrScanOutput detect({
    required Uint8List imageBytes,
    required OmrQrPayload payload,
  }) {
    final image = img.decodeImage(imageBytes);
    if (image == null) {
      throw const OmrException('Could not decode the captured image.');
    }
    final gray = img.grayscale(image);

    // ── Anchor detection → homography ─────────────────
    final anchors = _findAnchorCenters(gray);
    math.Point<double> Function(double, double) toImage;
    var aligned = true;

    if (anchors != null) {
      final h = _homography(kAnchorCenters, anchors);
      if (h != null) {
        toImage = (dx, dy) => _applyHomography(h, dx, dy);
      } else {
        aligned = false;
        toImage = _fallbackMapper(gray);
      }
    } else {
      aligned = false;
      toImage = _fallbackMapper(gray);
    }

    // Approximate pixel size of a bubble in the photo (for patch sampling).
    final center1 = toImage(kColX[0] + kNumW, kGridY);
    final center2 = toImage(kColX[0] + kNumW + kBubblePitch, kGridY);
    final pxPerBubble =
        ((center2.x - center1.x).abs() / kBubblePitch * kBubble).clamp(6.0, 60.0);

    // ── Read every sheet row ──────────────────────────
    final sheetRows = computeSheetRows(payload.items);
    final itemAnswers = <int, _ItemRead>{};

    for (final sheetRow in sheetRows) {
      final ratios = <double>[];
      for (var c = 0; c < sheetRow.choices.length; c++) {
        final design = bubbleCenter(sheetRow.col, sheetRow.row, c);
        final pt = toImage(design[0], design[1]);
        ratios.add(_fillRatio(gray, pt.x, pt.y, pxPerBubble * 0.45));
      }
      final read = _reduceRow(sheetRow.choices, ratios);
      itemAnswers.putIfAbsent(sheetRow.itemNumber, () => _ItemRead()).subReads.add(read);
    }

    // ── Reduce rows to per-item canonical answers ─────
    final detections = <OmrDetection>[];
    for (var i = 0; i < payload.count; i++) {
      final item = i < payload.items.length ? payload.items[i] : null;
      final read = itemAnswers[i + 1];
      detections.add(_finalize(item, i + 1, read));
    }

    return OmrScanOutput(detections: detections, aligned: aligned);
  }

  /// Whole-frame mapping fallback when anchors aren't found — assumes the
  /// sheet fills the photo edge-to-edge (what the old code assumed).
  math.Point<double> Function(double, double) _fallbackMapper(img.Image gray) {
    final sx = gray.width / kPageW;
    final sy = gray.height / kPageH;
    return (dx, dy) => math.Point(dx * sx, dy * sy);
  }

  /// Reduce one row's fill ratios to a chosen label (+ ambiguity flag).
  _RowRead _reduceRow(List<String> choices, List<double> ratios) {
    var maxIdx = 0;
    var maxRatio = 0.0;
    for (var i = 0; i < ratios.length; i++) {
      if (ratios[i] > maxRatio) {
        maxRatio = ratios[i];
        maxIdx = i;
      }
    }

    var filled = 0;
    var second = 0.0;
    for (var i = 0; i < ratios.length; i++) {
      if (ratios[i] >= fillThreshold) filled++;
      if (i != maxIdx && ratios[i] > second) second = ratios[i];
    }

    if (maxRatio < fillThreshold) {
      return const _RowRead(answer: '', ambiguous: false);
    }
    return _RowRead(
      answer: choices[maxIdx],
      ambiguous: filled > 1 || (maxRatio - second) < ambiguityMargin,
    );
  }

  OmrDetection _finalize(OmrItemLayout? item, int itemNumber, _ItemRead? read) {
    final type = item?.type ?? 'mcq';
    final choices = item?.choices ?? const ['A', 'B', 'C', 'D'];
    final subs = read?.subReads ?? const <_RowRead>[];

    switch (type) {
      case 'matching': {
        final letters = subs.map((s) => s.answer).toList();
        return OmrDetection(
          itemNumber: itemNumber,
          type: type,
          choices: choices,
          detectedAnswer: letters.join(','),
          subAnswers: letters,
          ambiguous: subs.any((s) => s.ambiguous),
        );
      }
      case 'identification': {
        final a = subs.isEmpty ? '' : subs.first.answer;
        final canonical =
            a == 'C' ? 'CORRECT' : a == 'I' ? 'INCORRECT' : '';
        return OmrDetection(
          itemNumber: itemNumber,
          type: type,
          choices: choices,
          detectedAnswer: canonical,
          ambiguous: subs.any((s) => s.ambiguous),
        );
      }
      default: {
        final a = subs.isEmpty ? '' : subs.first.answer;
        return OmrDetection(
          itemNumber: itemNumber,
          type: type,
          choices: choices,
          detectedAnswer: a,
          ambiguous: subs.any((s) => s.ambiguous),
        );
      }
    }
  }

  /// Dark-pixel ratio inside a circle of radius r centered at (cx, cy).
  double _fillRatio(img.Image gray, double cx, double cy, double r) {
    final x0 = (cx - r).floor();
    final y0 = (cy - r).floor();
    final x1 = (cx + r).ceil();
    final y1 = (cy + r).ceil();
    var dark = 0;
    var total = 0;
    final r2 = r * r;

    for (var y = y0; y <= y1; y++) {
      if (y < 0 || y >= gray.height) continue;
      for (var x = x0; x <= x1; x++) {
        if (x < 0 || x >= gray.width) continue;
        final dx = x - cx;
        final dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
        total++;
        if (gray.getPixel(x, y).r < 128) dark++;
      }
    }
    return total == 0 ? 0 : dark / total;
  }

  // ── Anchor detection ────────────────────────────────

  /// Locate the four corner anchor squares; returns their centers in
  /// full-resolution image coordinates [TL, TR, BL, BR], or null.
  List<List<double>>? _findAnchorCenters(img.Image gray) {
    // Downscale for speed — components are found on the small image, then
    // centroids are scaled back to full resolution.
    const targetW = 480;
    final scale = gray.width > targetW ? targetW / gray.width : 1.0;
    final small = scale < 1.0
        ? img.copyResize(gray, width: targetW)
        : gray;
    final w = small.width;
    final h = small.height;

    // Binary threshold.
    final binary = Uint8List(w * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        binary[y * w + x] = small.getPixel(x, y).r < 110 ? 1 : 0;
      }
    }

    // Connected components (flood fill).
    final labels = List<int>.filled(w * h, -1);
    final components = <_Component>[];
    var nextLabel = 0;
    final queue = List<int>.filled(w * h, 0);

    for (var start = 0; start < w * h; start++) {
      if (binary[start] == 0 || labels[start] >= 0) continue;
      var head = 0;
      var tail = 0;
      queue[tail++] = start;
      labels[start] = nextLabel;
      var minX = w, minY = h, maxX = 0, maxY = 0, count = 0;
      var sumX = 0.0, sumY = 0.0;

      while (head < tail) {
        final p = queue[head++];
        final px = p % w;
        final py = p ~/ w;
        count++;
        sumX += px;
        sumY += py;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;

        // 4-neighbors
        if (px > 0 && binary[p - 1] == 1 && labels[p - 1] < 0) { labels[p - 1] = nextLabel; queue[tail++] = p - 1; }
        if (px < w - 1 && binary[p + 1] == 1 && labels[p + 1] < 0) { labels[p + 1] = nextLabel; queue[tail++] = p + 1; }
        if (py > 0 && binary[p - w] == 1 && labels[p - w] < 0) { labels[p - w] = nextLabel; queue[tail++] = p - w; }
        if (py < h - 1 && binary[p + w] == 1 && labels[p + w] < 0) { labels[p + w] = nextLabel; queue[tail++] = p + w; }
      }

      components.add(_Component(
        minX: minX, minY: minY, maxX: maxX, maxY: maxY,
        count: count, cx: sumX / count, cy: sumY / count,
      ));
      nextLabel++;
    }

    // Candidate anchors: roughly square, solid, plausible size.
    final pageArea = w * h;
    bool isAnchorLike(_Component c) {
      final bw = c.maxX - c.minX + 1;
      final bh = c.maxY - c.minY + 1;
      if (bw < 8 || bh < 8) return false;
      final aspect = bw / bh;
      if (aspect < 0.6 || aspect > 1.7) return false;
      final area = bw * bh;
      if (area < pageArea * 0.0004 || area > pageArea * 0.03) return false;
      // Solid fill — a real anchor is mostly dark inside its bbox.
      return c.count / area > 0.6;
    }

    // Pick the best anchor candidate nearest each expected corner.
    // Expected anchor centers (fractions of the design space).
    const fracs = [
      [0.052, 0.037], // TL ≈ 41/794, 41/1123
      [0.948, 0.037], // TR
      [0.052, 0.963], // BL
      [0.948, 0.963], // BR
    ];

    final centers = <List<double>>[];
    for (final f in fracs) {
      final ex = f[0] * w;
      final ey = f[1] * h;
      _Component? best;
      var bestDist = double.infinity;
      for (final c in components) {
        if (!isAnchorLike(c)) continue;
        final d = (c.cx - ex) * (c.cx - ex) + (c.cy - ey) * (c.cy - ey);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      // Anchor must land in the expected quadrant-ish region (within 30%
      // of the small image dimension of its nominal position).
      final limit = (w * 0.30) * (w * 0.30);
      if (best == null || bestDist > limit) return null;
      centers.add([best.cx / scale, best.cy / scale]);
    }

    return centers;
  }

  // ── Homography (DLT, 4 points, Gaussian elimination) ──

  /// Solve for H mapping design coords → image coords from 4 point pairs.
  /// Returns 9 coefficients (row-major), or null if the system is singular.
  List<double>? _homography(List<List<double>> src, List<List<double>> dst) {
    // Build the 8×9 system: for each pair (x,y)→(u,v)
    //   [x y 1 0 0 0 -ux -uy] → u
    //   [0 0 0 x y 1 -vx -vy] → v
    final a = List.generate(8, (_) => List<double>.filled(9, 0));
    for (var i = 0; i < 4; i++) {
      final x = src[i][0];
      final y = src[i][1];
      final u = dst[i][0];
      final v = dst[i][1];
      a[2 * i] = [x, y, 1, 0, 0, 0, -u * x, -u * y, u];
      a[2 * i + 1] = [0, 0, 0, x, y, 1, -v * x, -v * y, v];
    }

    // Gaussian elimination with partial pivoting.
    for (var col = 0; col < 8; col++) {
      var pivot = col;
      for (var r = col + 1; r < 8; r++) {
        if (a[r][col].abs() > a[pivot][col].abs()) pivot = r;
      }
      if (a[pivot][col].abs() < 1e-10) return null;
      final tmp = a[col];
      a[col] = a[pivot];
      a[pivot] = tmp;
      for (var r = 0; r < 8; r++) {
        if (r == col) continue;
        final factor = a[r][col] / a[col][col];
        for (var c = col; c < 9; c++) {
          a[r][c] -= factor * a[col][c];
        }
      }
    }

    final h = List<double>.filled(9, 0);
    for (var i = 0; i < 8; i++) {
      h[i] = a[i][8] / a[i][i];
    }
    h[8] = 1;
    return h;
  }

  math.Point<double> _applyHomography(List<double> h, double x, double y) {
    final w = h[6] * x + h[7] * y + h[8];
    if (w.abs() < 1e-10) return const math.Point(0, 0);
    return math.Point(
      (h[0] * x + h[1] * y + h[2]) / w,
      (h[3] * x + h[4] * y + h[5]) / w,
    );
  }
}

/// Intermediate per-row read.
class _RowRead {
  const _RowRead({required this.answer, required this.ambiguous});
  final String answer;
  final bool ambiguous;
}

/// Accumulator for all sub-row reads of one item.
class _ItemRead {
  final List<_RowRead> subReads = [];
}

/// A connected dark component from the anchor search.
class _Component {
  const _Component({
    required this.minX,
    required this.minY,
    required this.maxX,
    required this.maxY,
    required this.count,
    required this.cx,
    required this.cy,
  });
  final int minX, minY, maxX, maxY, count;
  final double cx, cy;
}

/// Top-level function for isolate execution — signature must be a single
/// serializable argument for `compute()`.
OmrScanOutput scanImage(Map<String, Object?> args) {
  return OmrScanner().detect(
    imageBytes: args['imageBytes'] as Uint8List,
    payload: args['payload'] as OmrQrPayload,
  );
}

/// Exception thrown by the OMR scanner.
class OmrException implements Exception {
  const OmrException(this.message);
  final String message;
  @override
  String toString() => message;
}
