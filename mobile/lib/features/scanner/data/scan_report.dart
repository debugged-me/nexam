import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import 'scan_api.dart';

/// Builds printable PDF reports from scan data — the mobile counterpart
/// of the web's window.print() surfaces. Rendered client-side with the
/// bundled Sora fonts so the document keeps the product's look offline.
class ScanReport {
  ScanReport._();

  static const _brand = PdfColor.fromInt(0xFF2383E2);
  static const _ink = PdfColor.fromInt(0xFF26292E);
  static const _muted = PdfColor.fromInt(0xFF4E545B);
  static const _line = PdfColor.fromInt(0xFFE8EBEF);
  static const _ok = PdfColor.fromInt(0xFF23A265);
  static const _warn = PdfColor.fromInt(0xFFB07D1E);
  static const _bad = PdfColor.fromInt(0xFFDC4445);
  static const _stripe = PdfColor.fromInt(0xFFF6F8FA);

  static pw.Font? _regular;
  static pw.Font? _bold;

  /// Sora, loaded once — falls back to Helvetica if assets can't load.
  static Future<(pw.Font?, pw.Font?)> _fonts() async {
    if (_regular != null && _bold != null) return (_regular, _bold);
    try {
      final reg = await rootBundle.load('assets/fonts/Sora-Regular.ttf');
      final bold = await rootBundle.load('assets/fonts/Sora-Bold.ttf');
      _regular = pw.Font.ttf(reg);
      _bold = pw.Font.ttf(bold);
    } catch (_) {
      _regular = null;
      _bold = null;
    }
    return (_regular, _bold);
  }

  static String _fmtDate(String? iso) {
    if (iso == null || iso.isEmpty) return '';
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return iso;
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    final h12 = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
    final ampm = dt.hour < 12 ? 'AM' : 'PM';
    return '${months[dt.month - 1]} ${dt.day}, ${dt.year} '
        '$h12:${dt.minute.toString().padLeft(2, '0')} $ampm';
  }

  static String _fmtNow() => _fmtDate(DateTime.now().toIso8601String());

  static String _setLabel(Map<String, dynamic> scan) =>
      scan['set_label']?.toString() ??
      scan['exam_set']?.toString() ??
      '';

  /// The whole scan archive (or the current filter) as a records table.
  static Future<Uint8List> buildScanListPdf({
    required List<Map<String, dynamic>> scans,
    required String instructorName,
    String scope = 'All records',
  }) async {
    final (regular, bold) = await _fonts();
    final base = pw.TextStyle(font: regular, fontSize: 9, color: _ink);
    final strong = base.copyWith(font: bold, fontWeight: pw.FontWeight.bold);

    pw.Widget header() => pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text('nexam',
                    style: strong.copyWith(fontSize: 20, color: _brand)),
                pw.SizedBox(height: 3),
                pw.Text('Scan records',
                    style: strong.copyWith(fontSize: 12, color: _ink)),
                pw.SizedBox(height: 2),
                pw.Text('$scope · ${scans.length} '
                    'sheet${scans.length == 1 ? '' : 's'}',
                    style: base.copyWith(color: _muted)),
              ],
            ),
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.end,
              children: [
                pw.Text(instructorName, style: strong),
                pw.SizedBox(height: 2),
                pw.Text('Printed ${_fmtNow()}',
                    style: base.copyWith(color: _muted)),
              ],
            ),
          ],
        );

    final doc = pw.Document(
      theme: pw.ThemeData.withFont(base: regular, bold: bold),
    );
    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.fromLTRB(40, 36, 40, 48),
        header: (_) => header(),
        footer: _footer,
        build: (ctx) => [
          pw.SizedBox(height: 8),
          pw.TableHelper.fromTextArray(
            headerStyle: strong.copyWith(color: PdfColors.white, fontSize: 8.5),
            headerDecoration: const pw.BoxDecoration(color: _brand),
            cellStyle: base,
            cellAlignments: {
              0: pw.Alignment.centerLeft,
              1: pw.Alignment.centerLeft,
              2: pw.Alignment.center,
              3: pw.Alignment.centerRight,
              4: pw.Alignment.centerRight,
              5: pw.Alignment.centerRight,
              6: pw.Alignment.center,
            },
            cellPadding:
                const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            oddRowDecoration: const pw.BoxDecoration(color: _stripe),
            headers: const [
              'Student', 'Exam', 'Set', 'Score', 'Items', 'Date', 'Status',
            ],
            data: [
              for (final s in scans)
                [
                  s['student_name']?.toString() ?? 'Unknown',
                  s['exam_title']?.toString() ?? '',
                  _setLabel(s),
                  '${(double.tryParse(s['score']?.toString() ?? '0') ?? 0).toStringAsFixed(0)}%',
                  '${s['correct_count'] ?? 0}/${s['total_items'] ?? 0}',
                  _fmtDate(s['scanned_at']?.toString()),
                  (s['needs_review'] == 1 || s['needs_review'] == true)
                      ? 'Review'
                      : 'Done',
                ],
            ],
          ),
        ],
      ),
    );
    return doc.save();
  }

  /// One student's sheet — score block plus the item-by-item ledger.
  static Future<Uint8List> buildScanDetailPdf({
    required Map<String, dynamic> scan,
    required List<ScanAnswerItem> answers,
    required String instructorName,
  }) async {
    final (regular, bold) = await _fonts();
    final base = pw.TextStyle(font: regular, fontSize: 9, color: _ink);
    final strong = base.copyWith(font: bold, fontWeight: pw.FontWeight.bold);

    final score =
        double.tryParse(scan['score']?.toString() ?? '0') ?? 0;
    final correct =
        int.tryParse(scan['correct_count']?.toString() ?? '') ?? 0;
    final total =
        int.tryParse(scan['total_items']?.toString() ?? '') ?? 0;
    final needsReview =
        scan['needs_review'] == true || scan['needs_review'] == 1;
    final studentNo = scan['student_number']?.toString() ?? '';

    pw.Widget meta(String label, String value) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text(label.toUpperCase(),
                style: base.copyWith(
                    fontSize: 7, color: _muted, letterSpacing: 0.8)),
            pw.SizedBox(height: 2),
            pw.Text(value, style: strong.copyWith(fontSize: 10.5)),
          ],
        );

    pw.Widget head() => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text('nexam',
                    style: strong.copyWith(fontSize: 20, color: _brand)),
                pw.Text('Printed ${_fmtNow()}',
                    style: base.copyWith(color: _muted)),
              ],
            ),
            pw.SizedBox(height: 12),
            pw.Container(
              padding: const pw.EdgeInsets.all(14),
              decoration: pw.BoxDecoration(
                border: pw.Border.all(color: _line),
                borderRadius: pw.BorderRadius.circular(8),
              ),
              child: pw.Row(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Expanded(
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text(
                          scan['student_name']?.toString() ??
                              'Unknown student',
                          style: strong.copyWith(fontSize: 15),
                        ),
                        if (studentNo.isNotEmpty) ...[
                          pw.SizedBox(height: 2),
                          pw.Text('#$studentNo',
                              style: base.copyWith(color: _muted)),
                        ],
                        pw.SizedBox(height: 8),
                        pw.Row(
                          children: [
                            meta('Exam',
                                scan['exam_title']?.toString() ?? '—'),
                            pw.SizedBox(width: 28),
                            meta('Set', _setLabel(scan).isEmpty
                                ? '—'
                                : _setLabel(scan)),
                            pw.SizedBox(width: 28),
                            meta('Date',
                                _fmtDate(scan['scanned_at']?.toString())),
                          ],
                        ),
                      ],
                    ),
                  ),
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.end,
                    children: [
                      pw.Text(
                        '${score.toStringAsFixed(0)}%',
                        style: strong.copyWith(
                          fontSize: 24,
                          color: score >= 75 ? _ok : _bad,
                        ),
                      ),
                      pw.Text('$correct of $total correct',
                          style: base.copyWith(color: _muted)),
                      if (needsReview) ...[
                        pw.SizedBox(height: 4),
                        pw.Text('NEEDS REVIEW',
                            style: strong.copyWith(
                                fontSize: 8, color: _warn)),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            pw.SizedBox(height: 6),
            pw.Text('Instructor: $instructorName',
                style: base.copyWith(color: _muted)),
          ],
        );

    final doc = pw.Document(
      theme: pw.ThemeData.withFont(base: regular, bold: bold),
    );
    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.fromLTRB(40, 36, 40, 48),
        header: (_) => head(),
        footer: _footer,
        build: (ctx) => [
          pw.SizedBox(height: 8),
          pw.TableHelper.fromTextArray(
            headerStyle: strong.copyWith(color: PdfColors.white, fontSize: 8.5),
            headerDecoration: const pw.BoxDecoration(color: _brand),
            cellStyle: base,
            cellAlignments: {
              0: pw.Alignment.center,
              1: pw.Alignment.centerLeft,
              2: pw.Alignment.centerLeft,
              3: pw.Alignment.center,
              4: pw.Alignment.centerLeft,
            },
            cellPadding:
                const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 5),
            oddRowDecoration: const pw.BoxDecoration(color: _stripe),
            headers: const ['#', 'Marked', 'Key', 'Result', 'Type'],
            data: [
              for (final a in answers)
                [
                  '${a.itemNumber}',
                  a.markedAnswer.isEmpty ? '(blank)' : a.markedAnswer,
                  a.correctAnswer ?? '—',
                  a.isCorrect == null
                      ? (a.ambiguous ? 'Check' : '—')
                      : (a.isCorrect == true ? 'Correct' : 'Wrong'),
                  _shortType(a.questionType),
                ],
            ],
          ),
        ],
      ),
    );
    return doc.save();
  }

  static String _shortType(String? type) => switch (type) {
        'true_false' => 'T/F',
        'matching' => 'Matching',
        'identification' => 'Fill-in',
        _ => 'MCQ',
      };

  static pw.Widget _footer(pw.Context ctx) => pw.Container(
        alignment: pw.Alignment.centerRight,
        margin: const pw.EdgeInsets.only(top: 12),
        decoration: const pw.BoxDecoration(
          border: pw.Border(
            top: pw.BorderSide(color: _line, width: 0.5),
          ),
        ),
        padding: const pw.EdgeInsets.only(top: 6),
        child: pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text('nexam — OMR companion',
                style: const pw.TextStyle(fontSize: 7.5, color: _muted)),
            pw.Text('Page ${ctx.pageNumber} of ${ctx.pagesCount}',
                style: const pw.TextStyle(fontSize: 7.5, color: _muted)),
          ],
        ),
      );
}
