/**
 * PDF generation service — produces print-ready exam PDFs, answer keys,
 * and TOS summary reports using Puppeteer (headless Chrome → PDF).
 *
 * All PDFs are stored under api/storage/exams/ with predictable filenames
 * so the web app can serve them via a download endpoint.
 *
 * Puppeteer renders HTML templates to PDF via headless Chromium, which
 * produces higher-quality print output than programmatic PDF libraries
 * (proper CSS, page breaks, font rendering).
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage', 'exams');

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// ── Helpers ──────────────────────────────────────────

/** Escape text for safe HTML rendering. */
function esc(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

/** Strip a leading "A)" or "A." prefix that AI sometimes bakes into options. */
function cleanOption(text) {
  if (typeof text !== 'string') return String(text ?? '');
  return text.replace(/^\s*[A-Z][).]\s*/i, '');
}

/** Parse options (string JSON or array). */
function parseOptions(options) {
  if (!options) return [];
  if (Array.isArray(options)) return options;
  try { return JSON.parse(options); } catch { return []; }
}

/** Shared CSS for all exam-related PDFs. */
const BASE_CSS = `
  @page { margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 11pt;
    color: #1a1a1a;
    line-height: 1.5;
    padding: 72px 72px 72px 72px;
  }
  .header { text-align: center; margin-bottom: 24px; }
  .header .institution { font-size: 16pt; font-weight: bold; letter-spacing: 2px; }
  .header .tagline { font-size: 9pt; color: #666; margin-top: 2px; }
  .header hr { border: none; border-top: 1px solid #ccc; margin-top: 10px; }
  .exam-title { text-align: center; font-size: 15pt; font-weight: bold; margin-bottom: 4px; }
  .exam-subtitle { text-align: center; font-size: 10pt; color: #555; margin-bottom: 4px; }
  .set-label { text-align: center; font-size: 12pt; font-weight: bold; margin-bottom: 12px; }
  .info-line { text-align: center; font-size: 10pt; color: #444; margin-bottom: 12px; }
  .fields { font-size: 10pt; margin-bottom: 16px; line-height: 2; }
  .fields span { display: inline-block; margin-right: 24px; }
  .instructions { font-size: 10pt; margin-bottom: 16px; }
  .instructions h3 { font-size: 10pt; text-decoration: underline; margin-bottom: 4px; }
  .question { margin-bottom: 14px; page-break-inside: avoid; }
  .question .stem { font-weight: normal; }
  .question .num { font-weight: bold; }
  .options { margin-left: 20px; margin-top: 4px; }
  .options div { margin-bottom: 2px; }
  .tf-line { margin-left: 20px; margin-top: 4px; }
  .match-list { margin-left: 20px; margin-top: 4px; }
  .match-list div { margin-bottom: 2px; }
  .answer-line { margin-left: 20px; margin-top: 4px; }
  .footer { margin-top: 24px; border-top: 1px solid #ccc; padding-top: 8px; text-align: center; font-size: 8pt; color: #888; font-style: italic; }
  .answer-key .answer { color: #B91C1C; font-weight: bold; }
  .answer-key .explanation { color: #555; font-style: italic; font-size: 9pt; margin-left: 20px; margin-top: 2px; }
  table.tos-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 9pt; }
  table.tos-table th, table.tos-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  table.tos-table th { background: #f5f5f5; font-weight: bold; }
  table.tos-table .match-yes { color: #16a34a; font-weight: bold; }
  table.tos-table .match-no { color: #dc2626; font-weight: bold; }
  .section-title { font-size: 11pt; font-weight: bold; text-decoration: underline; margin-bottom: 8px; margin-top: 16px; }
  .summary-line { font-size: 10pt; margin-bottom: 4px; }
`;

/** Render HTML to PDF via Puppeteer and save to disk. */
async function htmlToPDF(html, filePath) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
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

// ── Exam PDF ─────────────────────────────────────────

/**
 * Generate an exam PDF for a set of questions.
 */
export async function generateExamPDF(opts) {
  const filePath = path.join(STORAGE_DIR, opts.filename);

  const questionsHTML = opts.questions.map((q, i) => {
    const num = i + 1;
    let body = '';

    if (q.type === 'mcq') {
      const options = parseOptions(q.options);
      body = `<div class="options">${options.map((opt, j) => {
        const letter = String.fromCharCode(65 + j);
        return `<div><strong>${letter})</strong> ${esc(cleanOption(opt))}</div>`;
      }).join('')}</div>`;
    } else if (q.type === 'true_false') {
      body = `<div class="tf-line">[ &nbsp; ] True &nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp; ] False</div>`;
    } else if (q.type === 'matching') {
      const options = parseOptions(q.options);
      body = `<div class="match-list"><em>Match the following:</em>${options.map((opt, j) => `<div>${j + 1}. ______ &nbsp; ${esc(cleanOption(opt))}</div>`).join('')}</div>`;
    } else if (q.type === 'identification') {
      body = `<div class="answer-line">Answer: _________________________________________</div>`;
    }

    return `<div class="question"><span class="num">${num}.</span> <span class="stem">${esc(q.stem)}</span>${body}</div>`;
  }).join('\n');

  const infoParts = [];
  if (opts.durationMinutes) infoParts.push(`Time: ${opts.durationMinutes} minutes`);
  infoParts.push(`Items: ${opts.questions.length}`);

  const subtitle = [opts.subjectName, opts.subjectCode && `Code: ${opts.subjectCode}`]
    .filter(Boolean).join('  |  ');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head>
<body>
  <div class="header">
    <div class="institution">NEXAM</div>
    <div class="tagline">AI-Assisted Examination System</div>
    <hr>
  </div>
  <div class="exam-title">${esc(opts.examTitle)}</div>
  ${subtitle ? `<div class="exam-subtitle">${esc(subtitle)}</div>` : ''}
  <div class="set-label">Set ${esc(opts.setLabel)}</div>
  <div class="info-line">${infoParts.join('   |   ')}</div>
  <div class="fields">
    <span>Name: _________________________________________</span>
    <span>Score: ______ / ${opts.questions.length}</span><br>
    <span>Date: _________________________________________</span>
    <span>Section: ____________</span>
  </div>
  ${opts.instructions ? `<div class="instructions"><h3>Instructions:</h3><p>${esc(opts.instructions)}</p></div>` : ''}
  ${questionsHTML}
  <div class="footer">— End of Examination —<br>Generated by NEXAM  |  Set ${esc(opts.setLabel)}</div>
</body></html>`;

  return htmlToPDF(html, filePath);
}

// ── Answer Key PDF ───────────────────────────────────

/**
 * Generate an answer key PDF.
 */
export async function generateAnswerKeyPDF(opts) {
  const filePath = path.join(STORAGE_DIR, opts.filename);

  const questionsHTML = opts.questions.map((q, i) => {
    const num = i + 1;
    let answerText = q.answer || 'N/A';

    if (q.type === 'mcq' && q.options) {
      const options = parseOptions(q.options);
      const idx = typeof answerText === 'string' ? answerText.charCodeAt(0) - 65 : -1;
      if (idx >= 0 && idx < options.length) {
        answerText = `${answerText}) ${cleanOption(options[idx])}`;
      }
    }

    return `<div class="question answer-key">
      <span class="num">${num}.</span> ${esc(q.stem)}
      <span class="answer">&rarr; ${esc(answerText)}</span>
      ${q.explanation ? `<div class="explanation">${esc(q.explanation)}</div>` : ''}
    </div>`;
  }).join('\n');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head>
<body>
  <div class="header">
    <div class="institution">NEXAM</div>
    <div class="tagline">AI-Assisted Examination System</div>
    <hr>
  </div>
  <div class="exam-title">${esc(opts.examTitle)}</div>
  <div class="set-label" style="color:#B91C1C">ANSWER KEY — Set ${esc(opts.setLabel)}</div>
  ${questionsHTML}
  <div class="footer">— End of Answer Key —<br>Generated by NEXAM</div>
</body></html>`;

  return htmlToPDF(html, filePath);
}

// ── TOS Report PDF ───────────────────────────────────

/**
 * Generate a TOS summary report PDF showing the blueprint alignment.
 */
export async function generateTOSReportPDF(opts) {
  const filePath = path.join(STORAGE_DIR, opts.filename);

  const bloomLabels = {
    remember: 'Remember', understand: 'Understand', apply: 'Apply',
    analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create',
  };

  const totalHours = opts.topics.reduce((s, t) => s + (t.instructional_hours || 0), 0);

  const bloomRows = opts.actualDistribution.map((dist) => {
    const pct = opts.tos.bloom_weights?.[dist.bloom] || 0;
    const plannedCount = Math.round(pct / 100 * opts.tos.total_items);
    const match = plannedCount === dist.actual;
    return `<tr>
      <td>${esc(bloomLabels[dist.bloom] || dist.bloom)}</td>
      <td>${pct}% (${plannedCount})</td>
      <td>${dist.actual}</td>
      <td class="${match ? 'match-yes' : 'match-no'}">${match ? 'Yes' : 'No'}</td>
    </tr>`;
  }).join('\n');

  const topicRows = opts.topics.map((t, i) => `<tr>
    <td>${i + 1}</td>
    <td>${esc(t.title)}</td>
    <td>${t.instructional_hours || 0}</td>
    <td>${t.item_count || 0}</td>
  </tr>`).join('\n');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head>
<body>
  <div class="header">
    <div class="institution">NEXAM</div>
    <div class="tagline">AI-Assisted Examination System</div>
    <hr>
  </div>
  <div class="exam-title">Table of Specification Report</div>
  <div class="exam-subtitle">${esc(opts.examTitle)}</div>

  <div class="section-title">Summary</div>
  <div class="summary-line">Total Items: ${opts.tos.total_items}</div>
  <div class="summary-line">Topics: ${opts.topics.length}</div>
  <div class="summary-line">Total Instructional Hours: ${totalHours}</div>

  <div class="section-title">Bloom Taxonomy Distribution</div>
  <table class="tos-table">
    <thead><tr><th>Bloom Level</th><th>Planned %</th><th>Actual Count</th><th>Match</th></tr></thead>
    <tbody>${bloomRows}</tbody>
  </table>

  <div class="section-title">Topics</div>
  <table class="tos-table">
    <thead><tr><th>#</th><th>Topic</th><th>Hours</th><th>Items</th></tr></thead>
    <tbody>${topicRows}</tbody>
  </table>

  <div class="footer">Generated by NEXAM  |  Table of Specification Report</div>
</body></html>`;

  return htmlToPDF(html, filePath);
}

export { STORAGE_DIR };
