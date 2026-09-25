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
const NUM_W = 34;
const BUBBLE = 18;
const BUBBLE_GAP = 8;
const BUBBLE_PITCH = BUBBLE + BUBBLE_GAP; // 26

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
function assignRows(questions) {
  const rows = [];
  let col = 0;
  let row = 0;

  for (let i = 0; i < questions.length; i++) {
    const need = rowsFor(questions[i]);
    if (row + need > ROWS_PER_COL) {
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
 * @param {string} opts.examTitle
 * @param {string} opts.setLabel — 'A' | 'B'
 * @param {Array}  opts.questions — ordered items (type + options drive layout)
 * @param {string} opts.filename
 */
export async function generateOMRSheet(opts) {
  const filePath = path.join(STORAGE_DIR, opts.filename);

  // Self-describing QR payload: exam + set id (no server lookup needed) and
  // the per-item layout so the scanner reconstructs the grid exactly.
  const qrPayload = JSON.stringify({
    v: 1,
    examId: opts.examId,
    setId: opts.examSetId || null,
    set: opts.setLabel,
    count: opts.questions.length,
    types: opts.questions.map(typeCode),
  });
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    width: 220,
    margin: 1,
    errorCorrectionLevel: 'M',
  });

  // ── Bubble rows (absolutely positioned — deterministic geometry) ──
  const assignments = assignRows(opts.questions);
  const rowsHtml = assignments.map(({ item, sub, col, row }) => {
    const q = opts.questions[item - 1];
    const multi = rowsFor(q) > 1;
    const choices = rowChoices(q, sub);
    const top = GRID_Y + row * ROW_H;
    const left = COL_X[col];

    const bubbles = choices.map((choice, c) => {
      const bx = left + NUM_W + c * BUBBLE_PITCH;
      return `<div class="bubble" style="left:${bx}px;top:${top}px">${esc(choice)}</div>`;
    }).join('');

    return `<div class="num" style="left:${left}px;top:${top}px">${esc(rowLabel(item, sub, multi))}</div>${bubbles}`;
  }).join('\n');

  // Items that didn't fit (sheet capacity = 2 × 25 rows)
  const renderedItems = new Set(assignments.map((a) => a.item));
  const overflow = opts.questions.length - renderedItems.size;
  const overflowHtml = overflow > 0
    ? `<div class="overflow">⚠ ${overflow} item(s) exceed sheet capacity — print a second sheet.</div>`
    : '';

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
    .header { position: absolute; left: 70px; top: 40px; right: 200px; }
    .header .title { font-size: 14pt; font-weight: bold; }
    .header .subtitle { font-size: 11pt; margin-top: 4px; }
    .header .meta { font-size: 9pt; margin-top: 2px; color: #444; }
    .qr { position: absolute; left: 620px; top: 36px; width: 120px; height: 120px; }
    .qr img { width: 120px; height: 120px; }
    .student-info {
      position: absolute; left: 70px; top: 190px; right: 70px;
      font-size: 10pt; line-height: 2.1;
    }
    .student-info div { margin-bottom: 4px; }
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
      position: absolute; left: 70px; top: ${GRID_Y + ROWS_PER_COL * ROW_H + 12}px;
      font-size: 9pt; color: #B91C1C; font-weight: bold;
    }
    .footer {
      position: absolute; left: 70px; right: 70px; bottom: 14px;
      font-size: 8pt; color: #666; font-style: italic;
    }
    .footer div { margin-top: 3px; }
  `;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body>
  <!-- Corner anchors: the mobile scanner locates these for registration -->
  <div class="anchor" style="left:${ANCHOR_OFFSET}px;top:${ANCHOR_OFFSET}px"></div>
  <div class="anchor" style="left:${PAGE_W - ANCHOR_OFFSET - ANCHOR_SIZE}px;top:${ANCHOR_OFFSET}px"></div>
  <div class="anchor" style="left:${ANCHOR_OFFSET}px;top:${PAGE_H - ANCHOR_OFFSET - ANCHOR_SIZE}px"></div>
  <div class="anchor" style="left:${PAGE_W - ANCHOR_OFFSET - ANCHOR_SIZE}px;top:${PAGE_H - ANCHOR_OFFSET - ANCHOR_SIZE}px"></div>

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

  ${rowsHtml}
  ${overflowHtml}

  <div class="footer">
    <div>Instructions: Fill one bubble per row completely with a dark pen. For matching items, fill one bubble per sub-row (a, b, c…). For True/False: T = True, F = False.</div>
    <div>Identification items: after grading the written answer, the instructor marks C (Correct) or I (Incorrect).</div>
  </div>
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

export { STORAGE_DIR };
