/**
 * OMR answer sheet generation service.
 *
 * Generates printable PDF answer sheets using Puppeteer (headless Chrome → PDF):
 * - QR code containing exam/set identity (for mobile scanning)
 * - Student name and ID fields
 * - One bubble per item (A/B/C/D for MCQ, T/F for true_false)
 * - Grid layout optimized for mobile camera scanning
 */
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage', 'exams');

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

const COLS_PER_PAGE = 25; // items per column
const BUBBLE_SIZE = 14;   // px

/** Escape text for safe HTML rendering. */
function esc(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

/** Get the bubble choices for a question type. */
function getBubbleChoices(type) {
  switch (type) {
    case 'mcq':       return ['A', 'B', 'C', 'D'];
    case 'true_false': return ['T', 'F'];
    case 'identification': return ['✎'];
    case 'matching':  return ['A', 'B', 'C', 'D', 'E'];
    default:          return ['A', 'B', 'C', 'D'];
  }
}

/**
 * Generate an OMR answer sheet PDF for an exam set.
 */
export async function generateOMRSheet(opts) {
  const filePath = path.join(STORAGE_DIR, opts.filename);

  // Generate QR code as a data URL
  const qrPayload = JSON.stringify({
    examId: opts.examId,
    set: opts.setLabel,
    count: opts.questions.length,
  });
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    width: 120,
    margin: 1,
    errorCorrectionLevel: 'M',
  });

  // Build the bubble grid HTML
  const columns = [];
  let itemNum = 1;

  for (let col = 0; col < 2 && itemNum <= opts.questions.length; col++) {
    const rows = [];
    for (let row = 0; row < COLS_PER_PAGE && itemNum <= opts.questions.length; row++) {
      const question = opts.questions[itemNum - 1];
      const choices = getBubbleChoices(question.type);
      const bubbles = choices.map((choice) => `
        <span class="bubble">${esc(choice)}</span>
      `).join('');

      rows.push(`
        <div class="item-row">
          <span class="item-num">${itemNum}.</span>
          <span class="bubbles">${bubbles}</span>
        </div>
      `);
      itemNum++;
    }
    columns.push(`<div class="col">${rows.join('')}</div>`);
  }

  const css = `
    @page { margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 10pt;
      color: #1a1a1a;
      padding: 50px;
    }
    .header { display: flex; justify-content: space-between; margin-bottom: 16px; }
    .header .title { font-size: 14pt; font-weight: bold; }
    .header .subtitle { font-size: 11pt; margin-top: 4px; }
    .header .meta { font-size: 9pt; margin-top: 2px; }
    .header .qr { width: 100px; height: 100px; }
    .header .qr img { width: 100px; height: 100px; }
    .student-info { font-size: 10pt; line-height: 2.2; margin-bottom: 16px; }
    .student-info div { margin-bottom: 4px; }
    .bubble-grid { display: flex; gap: 80px; margin-top: 10px; }
    .col { flex: 1; }
    .item-row { display: flex; align-items: center; margin-bottom: 8px; page-break-inside: avoid; }
    .item-num { font-weight: bold; width: 24px; font-size: 9pt; }
    .bubbles { display: flex; gap: 6px; }
    .bubble {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: ${BUBBLE_SIZE}px;
      height: ${BUBBLE_SIZE}px;
      border: 1px solid #333;
      border-radius: 50%;
      font-size: 7pt;
      font-weight: normal;
    }
    .footer { position: fixed; bottom: 20px; left: 50px; right: 50px; font-size: 8pt; color: #888; font-style: italic; }
    .footer div { margin-top: 4px; }
  `;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body>
  <div class="header">
    <div>
      <div class="title">${esc(opts.examTitle)}</div>
      <div class="subtitle">Set ${esc(opts.setLabel)} — OMR Answer Sheet</div>
      <div class="meta">Items: ${opts.questions.length}</div>
    </div>
    <div class="qr"><img src="${qrDataUrl}" alt="QR Code"></div>
  </div>

  <div class="student-info">
    <div>Name: _________________________________</div>
    <div>Student ID: ____________________________</div>
    <div>Section: ____________   Date: _______________</div>
  </div>

  <div class="bubble-grid">
    ${columns.join('')}
  </div>

  <div class="footer">
    <div>Instructions: Use a dark pen or pencil to fill the bubble completely. Do not make any stray marks.</div>
    <div>For True/False: fill T for True, F for False.</div>
  </div>
</body></html>`;

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

export { STORAGE_DIR };
