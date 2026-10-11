/**
 * exports.js — client-side report downloads.
 *
 * `downloadCsv` builds a standards-escaped CSV; `downloadXlsx` uses SheetJS
 * to emit a real multi-sheet workbook. Both stream via a blob link — no
 * server round-trip, no files left in the API.
 */
import * as XLSX from 'xlsx';

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
 */
export function downloadCsv(name, headers, rows) {
  const lines = [headers, ...rows].map((r) => r.map(csvCell).join(','));
  // BOM so Excel opens UTF-8 text correctly.
  const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${name}-${stamp()}.csv`);
}

/**
 * Download several tables as one XLSX workbook.
 * @param {string} name     base filename (stamp + .xlsx appended)
 * @param {Array<{title: string, headers: string[], rows: Array<Array>}>} sheets
 */
export function downloadXlsx(name, sheets) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([sheet.headers, ...(sheet.rows || [])]);
    // Reasonable column widths from the longest cell per column.
    ws['!cols'] = sheet.headers.map((h, i) => ({
      wch: Math.min(60, Math.max(String(h).length + 2, ...(sheet.rows || []).map((r) => String(r[i] ?? '').length + 2))),
    }));
    // Excel sheet names: ≤31 chars, no []:*?/\
    const title = String(sheet.title).replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Sheet';
    XLSX.utils.book_append_sheet(wb, ws, title);
  }
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  triggerDownload(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${name}-${stamp()}.xlsx`);
}
