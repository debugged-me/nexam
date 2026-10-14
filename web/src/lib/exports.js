/**
 * exports.js — client-side report downloads.
 *
 * `downloadCsv` builds a standards-escaped CSV with a report header block;
 * `downloadXlsx` lazy-loads ExcelJS to emit a designed multi-sheet workbook —
 * an Overview sheet with KPI tiles and embedded charts, then styled data
 * tables with heat-tinted score cells, frozen headers, and filters.
 * Both stream via a blob link — no server round-trip, no files left in the API.
 */

const INK = 'FF0F172A';      // slate-900 — title text, thin brand strip
const NAVY = 'FF1F3A5F';     // institutional navy — table header fill
const BAND = 'FFDDEBF7';     // light blue — merged section bands
const ACCENT = 'FF2563EB';   // blue-600 — links, accents
const ZEBRA = 'FFF8FAFC';    // slate-50  — alternating row wash
const TOTAL_BG = 'FFF2F2F2'; // light gray — footer/total rows
const LINE = 'FFE2E8F0';     // slate-200 — thin borders
const SUB = 'FF64748B';      // slate-500 — subtitle/meta text

const TONES = {
  blue: { bg: 'FFEFF6FF', fg: 'FF1D4ED8' },
  green: { bg: 'FFECFDF3', fg: 'FF15803D' },
  amber: { bg: 'FFFFFBEB', fg: 'FFB45309' },
  rose: { bg: 'FFFFF1F2', fg: 'FFBE123C' },
};

// Score/status cell tinting — light wash + bold colored text.
const GOOD = { bg: 'FFE7F6EF', fg: 'FF15803D' };
const WARN = { bg: 'FFFDF3E3', fg: 'FFB45309' };
const BAD = { bg: 'FFFCEBEC', fg: 'FFDC2626' };

/**
 * Heat rules keyed on header names. Score-like columns tint by the 75/50
 * bands; Status and Difficulty tint by keyword. Returns null = no tint.
 */
function heatFor(header, value) {
  const h = String(header);
  const s = String(value ?? '');
  if (/^status$/i.test(h)) {
    if (/pass|reviewed|active|success/i.test(s)) return GOOD;
    if (/fail|needs|reject|error/i.test(s)) return BAD;
    return null;
  }
  if (/difficulty/i.test(h)) {
    if (/^easy/i.test(s)) return GOOD;
    if (/^med/i.test(s)) return WARN;
    if (/^hard/i.test(s)) return BAD;
    return null;
  }
  if (/correct|average|score|rate|avg/i.test(h) && !/correct answer/i.test(h)) {
    const n = parseFloat(s);
    if (!Number.isFinite(n)) return null;
    return n >= 75 ? GOOD : n >= 50 ? WARN : BAD;
  }
  return null;
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Download one table as CSV.
 * @param {string} name    base filename (stamp + .csv appended)
 * @param {string[]} headers
 * @param {Array<Array>} rows
 * @param {{title?: string, pairs?: Array<[string, string]>}} [meta]
 *        report block prepended above the table (title line + key,value rows)
 */
export function downloadCsv(name, headers, rows, meta) {
  const head = [];
  if (meta?.title) head.push([`nexam — ${meta.title}`]);
  for (const [k, v] of meta?.pairs || []) head.push([k, v]);
  if (head.length) head.push([]);
  const lines = [...head, headers, ...rows].map((r) => r.map(csvCell).join(','));
  // BOM so Excel opens UTF-8 text correctly.
  const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${name}-${stamp()}.csv`);
}

const thin = { style: 'thin', color: { argb: LINE } };
const box = { top: thin, left: thin, bottom: thin, right: thin };

function solidFill(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function fillRow(ws, row, ncols, argb) {
  for (let c = 1; c <= ncols; c += 1) ws.getCell(row, c).fill = solidFill(argb);
}

const LINK_FONT = { name: 'Calibri', size: 9, color: { argb: ACCENT }, underline: true };

/** Slim brand strip + title/subtitle/meta block shared by every sheet. */
function writeReportHead(ws, spec, ncols, subtitle, backLink) {
  // Row 1 — 6px ink strip.
  ws.getRow(1).height = 6;
  fillRow(ws, 1, ncols, INK);
  // Row 2 — report title.
  ws.mergeCells(2, 1, 2, ncols);
  const t = ws.getCell(2, 1);
  t.value = `nexam — ${spec.title || 'Report'}`;
  t.font = { name: 'Calibri', size: 15, bold: true, color: { argb: INK } };
  t.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(2).height = 26;
  // Row 3 — subtitle.
  ws.mergeCells(3, 1, 3, ncols);
  const st = ws.getCell(3, 1);
  st.value = subtitle || '';
  st.font = { name: 'Calibri', size: 10, bold: true, color: { argb: ACCENT } };
  st.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(3).height = 16;
  // Row 4 — meta line.
  const metaLine = (spec.meta || [])
    .filter(([, v]) => v !== undefined && v !== null && String(v) !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join('   ·   ');
  ws.mergeCells(4, 1, 4, ncols);
  const m = ws.getCell(4, 1);
  m.value = metaLine || `Generated ${new Date().toLocaleString()}`;
  m.font = { name: 'Calibri', size: 9, italic: true, color: { argb: SUB } };
  m.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(4).height = 15;
  // Row 5 — spacer, or a back-to-Overview link on data sheets.
  if (backLink) {
    const back = ws.getCell(5, 1);
    back.value = { text: '← Back to Overview', hyperlink: "#'Overview'!A1" };
    back.font = LINK_FONT;
  }
  ws.getRow(5).height = 14;
}

/** Light-blue section band merged across the sheet (e.g. "KEY METRICS"). */
function writeBand(ws, row, ncols, text) {
  ws.mergeCells(row, 1, row, ncols);
  fillRow(ws, row, ncols, BAND);
  const c = ws.getCell(row, 1);
  c.value = text;
  c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: NAVY } };
  c.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(row).height = 18;
}

/**
 * Overview sheet — KPI tiles then chart images. Charts arrive as
 * { title, image: { dataUrl, w, h } } from lib/reportCharts.js.
 */
function buildOverview(wb, spec) {
  const ws = wb.addWorksheet('Overview', {
    properties: { tabColor: { argb: ACCENT } },
    views: [{ showGridLines: false }],
  });
  const COLS = 12;
  ws.columns = Array.from({ length: COLS }, () => ({ width: 11 }));

  writeReportHead(ws, spec, COLS, spec.subtitle || 'Report summary', false);

  let row = 6;

  // Contents — hyperlinked index to each data sheet, like a registrar report.
  const links = (spec.sheets || []).map((s) => String(s.title).replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Sheet');
  if (links.length > 1) {
    writeBand(ws, row, COLS, 'CONTENTS');
    row += 1;
    links.forEach((nm) => {
      const c = ws.getCell(row, 1);
      c.value = { text: `›  ${nm}`, hyperlink: `#'${nm}'!A1` };
      c.font = { name: 'Calibri', size: 10, color: { argb: ACCENT }, underline: true };
      c.alignment = { vertical: 'middle', indent: 1 };
      ws.getRow(row).height = 15;
      row += 1;
    });
    row += 1;
  }

  const kpis = (spec.overview.kpis || []).slice(0, 8);
  if (kpis.length) {
    writeBand(ws, row, COLS, 'KEY METRICS');
    row += 1;
  }
  // KPI tiles — three per row, each spanning 4 columns and 3 rows.
  for (let i = 0; i < kpis.length; i += 1) {
    const tone = TONES[kpis[i].tone] || TONES.blue;
    const col = 1 + (i % 3) * 4;
    const r = row + Math.floor(i / 3) * 4;
    ws.mergeCells(r, col, r + 2, col + 3);
    for (let rr = r; rr <= r + 2; rr += 1) {
      for (let cc = col; cc <= col + 3; cc += 1) ws.getCell(rr, cc).fill = solidFill(tone.bg);
    }
    const cell = ws.getCell(r, col);
    cell.value = {
      richText: [
        { text: `${kpis[i].value}\n`, font: { name: 'Calibri', size: 22, bold: true, color: { argb: tone.fg } } },
        { text: String(kpis[i].label), font: { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } } },
      ],
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  }
  if (kpis.length) row += Math.ceil(kpis.length / 3) * 4 + 1;

  // Charts — band + per-chart label + embedded PNG, stacked full width.
  const charts = (spec.overview.charts || []).filter((ch) => ch.image?.dataUrl);
  if (charts.length) {
    writeBand(ws, row, COLS, 'CHARTS');
    row += 1;
  }
  for (const ch of charts) {
    ws.mergeCells(row, 1, row, COLS);
    const hcell = ws.getCell(row, 1);
    hcell.value = ch.title;
    hcell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: INK } };
    hcell.alignment = { vertical: 'middle' };
    ws.getRow(row).height = 22;
    row += 1;

    const imgId = wb.addImage({ base64: ch.image.dataUrl.split(',')[1], extension: 'png' });
    ws.addImage(imgId, { tl: { col: 0, row: row - 1 }, ext: { width: ch.image.w, height: ch.image.h } });
    row += Math.ceil(ch.image.h / 19) + 2;
  }
}

/**
 * Download several tables as one styled XLSX workbook.
 *
 * @param {string} name  base filename (stamp + .xlsx appended)
 * @param {object} report
 * @param {string} report.title              report name under the brand strip
 * @param {string} [report.subtitle]         second line (e.g. the exam title)
 * @param {Array<[string,string]>} [report.meta]  "Label — value" meta line
 * @param {{kpis?: Array<{label,value,tone}>, charts?: Array<{title,image}>}} [report.overview]
 *        adds a leading Overview sheet with KPI tiles + chart images
 * @param {Array<{title:string, headers:string[], rows:Array<Array>}>} report.sheets
 */
export async function downloadXlsx(name, report) {
  const mod = await import('exceljs');
  const ExcelJS = mod.default || mod;

  // Back-compat: a bare sheets array becomes a generic report.
  const spec = Array.isArray(report) ? { title: 'nexam report', sheets: report } : report;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'nexam';
  wb.created = new Date();

  const hasOverview = Boolean(spec.overview && (spec.overview.kpis?.length || spec.overview.charts?.length));
  if (hasOverview) buildOverview(wb, spec);

  for (const sheet of spec.sheets || []) {
    const headers = sheet.headers || [];
    const rows = sheet.rows || [];
    const ncols = Math.max(1, headers.length);
    const sheetName = String(sheet.title).replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Sheet';

    const ws = wb.addWorksheet(sheetName, {
      properties: { tabColor: { argb: INK } },
      views: [{ state: 'frozen', ySplit: 6, showGridLines: false }],
    });

    const widths = headers.map((h, i) => Math.min(
      55,
      Math.max(String(h).length + 2, ...rows.map((r) => String(r[i] ?? '').length + 2), 10)
    ));
    ws.columns = widths.map((wd) => ({ width: wd }));

    writeReportHead(ws, spec, ncols, spec.subtitle || sheet.title, hasOverview);

    // ── Table header (row 6) — institutional navy band ───────────
    const hrow = ws.getRow(6);
    headers.forEach((h, i) => {
      const c = hrow.getCell(i + 1);
      c.value = h;
      c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = solidFill(NAVY);
      c.border = box;
      c.alignment = { vertical: 'middle', indent: 1 };
    });
    hrow.height = 20;

    // ── Data rows ────────────────────────────────────────────────
    rows.forEach((r, ri) => {
      const row = ws.getRow(7 + ri);
      headers.forEach((h, i) => {
        const c = row.getCell(i + 1);
        const v = r[i];
        c.value = v === null || v === undefined ? '' : v;
        c.font = { name: 'Calibri', size: 10 };
        c.border = box;
        c.alignment = {
          vertical: 'middle',
          indent: 1,
          wrapText: widths[i] >= 40,         // long-text columns wrap
          horizontal: typeof v === 'number' ? 'right' : 'left',
        };
        const heat = heatFor(h, v);
        if (heat) {
          c.fill = solidFill(heat.bg);
          c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: heat.fg } };
        } else if (ri % 2 === 1) {
          c.fill = solidFill(ZEBRA);
        }
      });
    });

    // ── Optional footer/total row — gray band, bold, heavy top rule ──
    if (sheet.footer?.length) {
      const frow = ws.getRow(7 + rows.length);
      headers.forEach((_, i) => {
        const c = frow.getCell(i + 1);
        const v = sheet.footer[i];
        c.value = v === null || v === undefined ? '' : v;
        c.fill = solidFill(TOTAL_BG);
        c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: INK } };
        c.border = { ...box, top: { style: 'medium', color: { argb: NAVY } } };
        c.alignment = { vertical: 'middle', indent: 1, horizontal: typeof v === 'number' ? 'right' : 'left' };
      });
      frow.height = 18;
    }

    if (headers.length) {
      ws.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: ncols } };
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${name}-${stamp()}.xlsx`
  );
}
