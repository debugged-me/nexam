/// Shared OMR sheet layout contract — the Dart mirror of the constants in
/// api/src/services/omrService.js. KEEP THESE IN SYNC: the generator and
/// the scanner must agree on every coordinate.
///
/// Design space: 794 × 1123 px (A4 @ 96dpi — matches the PDF's 595×842 pt
/// at a 4/3 scale). The scanner maps captured photos into this space with
/// a homography fitted to the four corner anchors.
library;

import '../../exams/domain/exam.dart';

/// Design-space page dimensions (px).
const double kPageW = 794;
const double kPageH = 1123;

/// Corner anchors: 22 px solid squares, 30 px from the page edge.
const double kAnchorOffset = 30;
const double kAnchorSize = 22;

/// Anchor CENTERS in design space — the four known points for the
/// homography (top-left, top-right, bottom-left, bottom-right).
const List<List<double>> kAnchorCenters = [
  [kAnchorOffset + kAnchorSize / 2, kAnchorOffset + kAnchorSize / 2], // 41, 41
  [kPageW - kAnchorOffset - kAnchorSize / 2, kAnchorOffset + kAnchorSize / 2], // 753, 41
  [kAnchorOffset + kAnchorSize / 2, kPageH - kAnchorOffset - kAnchorSize / 2], // 41, 1082
  [kPageW - kAnchorOffset - kAnchorSize / 2, kPageH - kAnchorOffset - kAnchorSize / 2], // 753, 1082
];

/// Bubble grid: 2 columns × 25 rows.
const int kCols = 2;
const int kRowsPerCol = 25;
const List<double> kColX = [64, 424];
const double kGridY = 310;
const double kRowH = 30;
const double kNumW = 34;
const double kBubble = 18;
const double kBubbleGap = 8;
const double kBubblePitch = kBubble + kBubbleGap; // 26

/// A physical bubble row on the sheet.
class SheetRow {
  const SheetRow({
    required this.itemNumber,
    required this.subIndex,
    required this.col,
    required this.row,
    required this.choices,
  });

  /// 1-based item number.
  final int itemNumber;

  /// 0 for single-row items; 0..N-1 for matching premise sub-rows.
  final int subIndex;
  final int col;
  final int row;
  final List<String> choices;
}

/// Assign grid rows exactly like omrService.assignRows(): fill column 0
/// top-to-bottom, then column 1; multi-row (matching) items never split
/// across a column boundary.
List<SheetRow> computeSheetRows(List<OmrItemLayout> items) {
  final rows = <SheetRow>[];
  var col = 0;
  var row = 0;

  for (var i = 0; i < items.length; i++) {
    final item = items[i];
    final need = item.rows;
    if (row + need > kRowsPerCol) {
      col++;
      row = 0;
      if (col >= kCols) break; // sheet overflow — item not rendered
    }
    for (var s = 0; s < need; s++) {
      rows.add(SheetRow(
        itemNumber: i + 1,
        subIndex: s,
        col: col,
        row: row + s,
        choices: item.choices,
      ));
    }
    row += need;
  }
  return rows;
}

/// Design-space center of bubble [bubbleIndex] in the given grid row.
List<double> bubbleCenter(int col, int row, int bubbleIndex) {
  final x = kColX[col] + kNumW + bubbleIndex * kBubblePitch + kBubble / 2;
  final y = kGridY + row * kRowH + kBubble / 2;
  return [x, y];
}

/// Number of grid rows an item type occupies (for overflow warnings).
int rowsForType(String typeCode) {
  if (typeCode.startsWith('M')) {
    return (int.tryParse(typeCode.substring(1)) ?? 1).clamp(1, 8);
  }
  return 1;
}
