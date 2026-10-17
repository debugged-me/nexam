/**
 * OMR answer sheet generation service.
 *
 * Generates printable PDF answer sheets using Puppeteer (headless Chrome → PDF):
 * - 4 corner anchor markers the mobile scanner uses for perspective correction
 * - QR code containing exam/set identity AND the per-item layout descriptor
 * - Per-type bubble rows: A–D MCQ, T/F true-false, per-premise rows for
 *   matching, and instructor-grade CORRECT/INCORRECT bubbles for identification
 *
 * SHEET LAYOUT CONTRACT (shared with mobile/lib/.../omr_layout.dart — the
 * Dart scanner mirrors these exact constants; keep them in sync):
 *
 *   Design space      794 × 1123 px  (A4 @ 96dpi — matches PDF 595×842 pt × 4/3)
 *   Anchors           22×22 px solid squares, centers at
 *                     (41,41) (753,41) (41,1082) (753,1082)
 *   Grid              2 columns × 25 rows
 *     Column X        col 0 → x=64, col 1 → x=424  (bubble-row left edge)
 *     First row Y     y=310  (row top edge)
 *     Row pitch       30 px
 *     Item number     x = colX, width 34, row vertically centered
 *     Bubbles start   x = colX + 36
 *     Bubble size     18 px, gap 8 px → pitch 26 px
 *
 * Row assignment: items are laid out top-to-bottom, column 0 first then
 * column 1. An item occupies 1 row (mcq/true_false/identification) or N rows
 * (matching, one per premise). A matching item never splits across columns —
 * if it doesn't fit in the remaining rows it starts the next column.
 *
 * Auto-fit (v:2 sheets): when the item list needs more than 25 rows/column,
 * the grid grows rows and shrinks pitch (down to BUBBLE+6) until everything
 * fits. The rendered geometry is embedded in the QR `ly` block
 * `{gy, rh, rpc}` — the scanner (v>=2 payloads) reads bubbles at those
 * coordinates; older payloads fall back to the constants above.
 */
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseOptions } from './scoring.js';
import { launchBrowser } from './browserLauncher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage', 'exams');

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// ── Shared layout contract (keep in sync with omr_layout.dart) ──
const PAGE_W = 794;
const PAGE_H = 1123;
const ANCHOR_OFFSET = 30;   // anchor square top-left distance from page edge
const ANCHOR_SIZE = 22;
const COLS = 2;
const ROWS_PER_COL = 25;
const COL_X = [64, 424];
const GRID_Y = 310;
const ROW_H = 30;
// Auto-fit bounds: rows render from GRID_Y down to GRID_BOTTOM (clear of the
// bottom anchors + footer). When an exam needs more than 25 rows/column the
// pitch shrinks toward ROW_H_MIN rather than dropping items off the sheet;
// the chosen geometry travels in the QR `ly` block so the scanner reads the
// same coordinates it was rendered with.
const GRID_BOTTOM = 1060;
const NUM_W = 34;
const BUBBLE = 18;
const BUBBLE_GAP = 8;
const BUBBLE_PITCH = BUBBLE + BUBBLE_GAP; // 26
const ROW_H_MIN = BUBBLE + 6; // tightest pitch that keeps 18px bubbles legible

/** Escape text for safe HTML rendering. */
function esc(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Compact per-item layout descriptor embedded in the QR payload so the
 * scanner knows each item's row structure without hitting the API.
 *   mcq        → 'm4'  (letter = option count)
 *   true_false → 't'
 *   matching   → 'M4'  (digit = premise count, i.e. number of A–E rows)
 *   identification → 'i'
 */
function typeCode(question) {
  switch (question.type) {
    case 'mcq': {
      const n = Math.min(Math.max(parseOptions(question.options).length, 2), 8);
      return `m${n}`;
    }
    case 'true_false': return 't';
    case 'matching': {
      const n = Math.min(Math.max(parseOptions(question.options).length, 1), 8);
      return `M${n}`;
    }
    case 'identification': return 'i';
    default: return 'm4';
  }
}

/** Choices for one bubble row of the given item. */
function rowChoices(question, subRow) {
  switch (question.type) {
    case 'mcq': {
      const n = Math.min(Math.max(parseOptions(question.options).length, 2), 8);
      return LETTERS.slice(0, n).split('');
    }
    case 'true_false': return ['T', 'F'];
    case 'matching': return LETTERS.slice(0, 5).split(''); // A–E per premise
    case 'identification': return ['C', 'I'];              // Correct / Incorrect
    default: return ['A', 'B', 'C', 'D'];
  }
}

/** Number of grid rows an item consumes. */
function rowsFor(question) {
  if (question.type === 'matching') {
    return Math.min(Math.max(parseOptions(question.options).length, 1), 8);
  }
  return 1;
}

/**
 * Assign grid rows to items with the same rules the Dart scanner uses:
 * fill column 0 top-to-bottom, then column 1. A multi-row (matching) item
 * never splits across a column boundary.
 * @returns {Array<{item:number, sub:number, col:number, row:number}>}
 */
function assignRows(questions, rowsPerCol = ROWS_PER_COL) {
  const rows = [];
  let col = 0;
  let row = 0;

  for (let i = 0; i < questions.length; i++) {
    const need = rowsFor(questions[i]);
    if (row + need > rowsPerCol) {
      col++;
      row = 0;
      if (col >= COLS) break; // overflow — extra items not renderable
    }
    for (let s = 0; s < need; s++) {
      rows.push({ item: i + 1, sub: s, col, row: row + s });
    }
    row += need;
  }
  return rows;
}

/**
 * Compute the sheet's grid geometry for a question set. The default grid is
 * 25 rows/column at 30px pitch; a denser set (matching items consume one row
 * per premise) grows the row count until every item renders, shrinking the
 * pitch to keep the grid inside GRID_BOTTOM. Returns the pitch actually used
 * plus the row assignments — both must reach the scanner via the QR `ly`
 * block so it reads bubbles at the rendered coordinates.
 */
function layoutFor(questions, gridBottom = GRID_BOTTOM, balanceColumns = false) {
  const usableH = gridBottom - GRID_Y;
  const maxRows = Math.floor(usableH / ROW_H_MIN);
  const rendered = (rows) => new Set(rows.map((r) => r.item)).size;

  let rowsPerCol = ROWS_PER_COL;
  if (balanceColumns && questions.length) {
    const totalRows = questions.reduce((sum, question) => sum + rowsFor(question), 0);
    const largestItem = Math.max(...questions.map(rowsFor));
    rowsPerCol = Math.min(ROWS_PER_COL, Math.max(largestItem, Math.ceil(totalRows / COLS)));
  }
  let assignments = assignRows(questions, rowsPerCol);
  while (rendered(assignments) < questions.length && rowsPerCol < maxRows) {
    rowsPerCol += 1;
    assignments = assignRows(questions, rowsPerCol);
  }

  return {
    rowsPerCol,
    rowH: Math.min(ROW_H, Math.floor(usableH / rowsPerCol)),
    assignments,
  };
}

/** Row label shown next to the bubbles ("7." or "7a", "7b" for matching). */
function rowLabel(item, sub, isMulti) {
  if (!isMulti) return `${item}.`;
  return `${item}${String.fromCharCode(97 + sub)}`; // 7a, 7b, 7c…
}

/**
 * Generate an OMR answer sheet PDF for an exam set.
 *
 * @param {object} opts
 * @param {string} opts.examId
 * @param {string} opts.examSetId — embeds set identity in the QR payload
 * @param {number} [opts.setVersion] — print-run version, embedded as `sv`
 * @param {string} opts.examTitle
 * @param {string} opts.setLabel — 'A' | 'B'
 * @param {Array}  opts.questions — ordered items (type + options drive layout)
 * @param {string} opts.filename
 */
export async function generateOMRSheet(opts) {
  const filePath = path.join(STORAGE_DIR, opts.filename);
  // A branded footer reserves a protected strip above the lower anchors.
  // The chosen row pitch is carried in the QR payload, so the mobile scanner
  // reads the same geometry even when a dense sheet is compacted slightly.
  const gridBottom = opts.branding?.footer ? 995 : GRID_BOTTOM;
  const layout = layoutFor(opts.questions, gridBottom, true);

  // Self-describing QR payload: exam + set id (no server lookup needed) and
  // the per-item layout so the scanner reconstructs the grid exactly. `sv`
  // records which print run the sheet belongs to — a sheet from an archived
  // run still resolves its own set id, never the current run's same label.
  const qrPayload = JSON.stringify({
    v: 2,
    examId: opts.examId,
    setId: opts.examSetId || null,
    sv: opts.setVersion ?? 1,
    set: opts.setLabel,
    count: opts.questions.length,
    types: opts.questions.map(typeCode),
    // Rendered grid geometry — v:2 sheets may shrink the row pitch to fit
    // dense exams, so the scanner must read bubbles at these coordinates
    // instead of the compiled-in defaults.
    ly: { gy: GRID_Y, rh: layout.rowH, rpc: layout.rowsPerCol },
  });
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    width: 220,
    margin: 1,
    errorCorrectionLevel: 'M',
  });

  // ── Bubble rows (absolutely positioned — deterministic geometry) ──
  const rowsHtml = layout.assignments.map(({ item, sub, col, row }) => {
    const q = opts.questions[item - 1];
    const multi = rowsFor(q) > 1;
    const choices = rowChoices(q, sub);
    const top = GRID_Y + row * layout.rowH;
    const left = COL_X[col];

    const bubbles = choices.map((choice, c) => {
      const bx = left + NUM_W + c * BUBBLE_PITCH;
      return `<div class="bubble" style="left:${bx}px;top:${top}px">${esc(choice)}</div>`;
    }).join('');

    return `<div class="num" style="left:${left}px;top:${top}px">${esc(rowLabel(item, sub, multi))}</div>${bubbles}`;
  }).join('\n');

  // Items that still didn't fit after auto-fit (extreme densities only)
  const renderedItems = new Set(layout.assignments.map((a) => a.item));
  const overflow = opts.questions.length - renderedItems.size;
  const overflowHtml = overflow > 0
    ? `<div class="overflow">⚠ ${overflow} item(s) exceed sheet capacity — print a second sheet.</div>`
    : '';

  const branded = Boolean(opts.branding?.letterhead);
  const letterheadHtml = branded
    ? `<div class="brand-head"><img src="${esc(opts.branding.letterhead)}" alt=""></div>`
    : '';
  const footerBrandHtml = opts.branding?.footer
    ? `<div class="brand-foot"><img src="${esc(opts.branding.footer)}" alt=""></div>`
    : `<div class="sheet-foot">NEXAM · Set ${esc(opts.setLabel)} · ${opts.questions.length} items</div>`;
  const columnRanges = [0, 1].map((col) => {
    const items = layout.assignments.filter((row) => row.col === col).map((row) => row.item);
    return items.length ? [Math.min(...items), Math.max(...items)] : null;
  });

  const css = `
    @page { margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 10pt;
      color: #1a1a1a;
      width: ${PAGE_W}px;
      height: ${PAGE_H}px;
      position: relative;
    }
    .anchor {
      position: absolute;
      width: ${ANCHOR_SIZE}px;
      height: ${ANCHOR_SIZE}px;
      background: #000;
    }
    .brand-head { position: absolute; left: 70px; top: 38px; width: 520px; height: 76px; }
    .brand-head img { width: 100%; height: 100%; object-fit: contain; object-position: left center; }
    .header { position: absolute; left: 70px; top: ${branded ? 125 : 48}px; right: 190px; }
    .header .title { font-size: ${branded ? 12 : 14}pt; font-weight: bold; line-height: 1.2; }
    .header .subtitle { font-size: 10pt; margin-top: 3px; font-weight: 600; }
    .header .meta { display: inline-block; font-size: 8pt; margin-top: 3px; padding: 2px 7px; color: #444; border: 1px solid #bbb; border-radius: 10px; }
    .qr { position: absolute; left: 624px; top: 40px; width: 116px; height: 116px; }
    .qr img { width: 116px; height: 116px; }
    .student-info {
      position: absolute; left: 70px; top: 194px; right: 70px;
      padding: 9px 12px 7px; border-top: 1.5px solid #222; border-bottom: 1px solid #999;
      font-size: 9.5pt; line-height: 1.7;
    }
    .student-info div { margin-bottom: 2px; }
    .sheet-guide {
      position: absolute; left: 70px; top: 272px; right: 70px;
      font-size: 7.5pt; color: #555;
    }
    .column-label { position: absolute; top: ${GRID_Y - 18}px; font-size: 7.5pt; font-weight: bold; color: #666; text-transform: uppercase; letter-spacing: .08em; }
    .num {
      position: absolute;
      width: ${NUM_W}px;
      height: ${BUBBLE}px;
      font-weight: bold;
      font-size: 9pt;
      line-height: ${BUBBLE}px;
      text-align: right;
      padding-right: 4px;
    }
    .bubble {
      position: absolute;
      width: ${BUBBLE}px;
      height: ${BUBBLE}px;
      border: 1.4px solid #111;
      border-radius: 50%;
      font-size: 7pt;
      line-height: ${BUBBLE - 2}px;
      text-align: center;
    }
    .overflow {
      position: absolute; left: 70px; top: ${GRID_Y - 24}px;
      font-size: 9pt; color: #B91C1C; font-weight: bold;
    }
    .brand-foot { position: absolute; left: 88px; right: 88px; bottom: 38px; height: 72px; }
    .brand-foot img { width: 100%; height: 100%; object-fit: contain; object-position: center; }
    .sheet-foot { position: absolute; left: 70px; right: 70px; bottom: 42px; text-align: center; font-size: 7.5pt; color: #666; }
  `;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body>
  <!-- Corner anchors: the mobile scanner locates these for registration -->
  <div class="anchor" style="left:${ANCHOR_OFFSET}px;top:${ANCHOR_OFFSET}px"></div>
  <div class="anchor" style="left:${PAGE_W - ANCHOR_OFFSET - ANCHOR_SIZE}px;top:${ANCHOR_OFFSET}px"></div>
  <div class="anchor" style="left:${ANCHOR_OFFSET}px;top:${PAGE_H - ANCHOR_OFFSET - ANCHOR_SIZE}px"></div>
  <div class="anchor" style="left:${PAGE_W - ANCHOR_OFFSET - ANCHOR_SIZE}px;top:${PAGE_H - ANCHOR_OFFSET - ANCHOR_SIZE}px"></div>

  ${letterheadHtml}
  <div class="header">
    <div class="title">${esc(opts.examTitle)}</div>
    <div class="subtitle">Set ${esc(opts.setLabel)} — OMR Answer Sheet</div>
    <div class="meta">Items: ${opts.questions.length}</div>
  </div>
  <div class="qr"><img src="${qrDataUrl}" alt="QR Code"></div>

  <div class="student-info">
    <div>Name: _________________________________&nbsp;&nbsp;&nbsp;Student ID: ____________________</div>
    <div>Section: ____________________&nbsp;&nbsp;&nbsp;Date: ____________________</div>
  </div>

  <div class="sheet-guide">Use a dark pen. Fill one bubble completely per row. T/F = True/False · C/I = instructor-marked Correct/Incorrect.</div>
  ${columnRanges.map((range, col) => range
    ? `<div class="column-label" style="left:${COL_X[col]}px">Answers ${range[0]}–${range[1]}</div>`
    : '').join('')}

  ${rowsHtml}
  ${overflowHtml}

  ${footerBrandHtml}
</body></html>`;

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
  } finally {
    if (browser) await browser.close();
  }

  return filePath;
}

export { STORAGE_DIR, layoutFor };
