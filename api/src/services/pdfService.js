/**
 * PDF generation service — produces print-ready exam PDFs, answer keys,
 * and TOS summary reports using pdfkit.
 *
 * All PDFs are stored under api/storage/exams/ with predictable filenames
 * so the PHP app can serve them via a download endpoint.
 */
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage', 'exams');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// ── Helpers ──────────────────────────────────────────

/** Strip a leading "A)" or "A." prefix that AI sometimes bakes into options. */
function cleanOption(text) {
  if (typeof text !== 'string') return String(text ?? '');
  return text.replace(/^\s*[A-Z][).]\s*/i, '');
}

/** Draw a horizontal line across the page at the current Y position. */
function drawLine(doc, y, x1, x2) {
  doc.moveTo(x1, y).lineTo(x2, y).strokeColor('#999999').lineWidth(0.5).stroke();
}

/** Page dimensions for A4 with 72pt margins. */
const PAGE = { left: 72, right: 523, width: 451 };

// ── Exam PDF ─────────────────────────────────────────

/**
 * Generate an exam PDF for a set of questions.
 *
 * @param {object} opts
 * @param {string} opts.examTitle
 * @param {string} opts.subjectName
 * @param {string} opts.subjectCode
 * @param {string} opts.setLabel — 'A' or 'B'
 * @param {number} opts.durationMinutes
 * @param {string} opts.instructions
 * @param {Array} opts.questions — [{ stem, type, options, bloom, topic }]
 * @param {string} opts.filename — output filename
 * @returns {Promise<string>} — absolute path to the generated PDF
 */
export function generateExamPDF(opts) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(STORAGE_DIR, opts.filename);
    const doc = new PDFDocument({ margin: 72, size: 'A4' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // ── Institution header ───────────────────────────
    doc.fontSize(14).font('Helvetica-Bold').text('NEXAM', { align: 'center' });
    doc.fontSize(9).font('Helvetica').text('AI-Assisted Examination System', { align: 'center' });
    drawLine(doc, doc.y + 8, PAGE.left, PAGE.right);
    doc.moveDown(1.5);

    // ── Exam title ──────────────────────────────────
    doc.fontSize(15).font('Helvetica-Bold').text(opts.examTitle, { align: 'center' });
    if (opts.subjectName || opts.subjectCode) {
      const subtitle = [opts.subjectName, opts.subjectCode && `Code: ${opts.subjectCode}`]
        .filter(Boolean).join('  |  ');
      doc.fontSize(10).font('Helvetica').text(subtitle, { align: 'center' });
    }
    doc.fontSize(11).font('Helvetica-Bold').text(`Set ${opts.setLabel}`, { align: 'center' });
    doc.moveDown(0.5);

    // ── Info line ───────────────────────────────────
    const infoParts = [];
    if (opts.durationMinutes) infoParts.push(`Time: ${opts.durationMinutes} minutes`);
    infoParts.push(`Items: ${opts.questions.length}`);
    doc.fontSize(10).font('Helvetica').text(infoParts.join('   |   '), { align: 'center' });
    doc.moveDown(0.5);

    // ── Name/Score/Date/Section ─────────────────────
    doc.fontSize(10).font('Helvetica');
    doc.text('Name: _________________________________________', { continued: true });
    doc.text('    Score: ______ / ' + opts.questions.length);
    doc.moveDown(0.3);
    doc.text('Date: _________________________________________', { continued: true });
    doc.text('    Section: ____________');
    doc.moveDown(1);

    // ── Instructions ────────────────────────────────
    if (opts.instructions) {
      doc.font('Helvetica-Bold').fontSize(10).text('Instructions:', { underline: true });
      doc.moveDown(0.2);
      doc.font('Helvetica').text(opts.instructions, { width: PAGE.width });
      doc.moveDown(1);
    }

    // ── Questions ───────────────────────────────────
    let itemNum = 1;
    for (const q of opts.questions) {
      if (doc.y > 720) doc.addPage();

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(`${itemNum}. `, { continued: true });
      doc.font('Helvetica').text(q.stem, { width: PAGE.width - 15 });

      if (q.type === 'mcq' && q.options) {
        const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        if (Array.isArray(options)) {
          for (let i = 0; i < options.length; i++) {
            const letter = String.fromCharCode(65 + i);
            const text = cleanOption(options[i]);
            doc.font('Helvetica').text(`     ${letter})  ${text}`, { width: PAGE.width - 30, indent: 20 });
          }
        }
      } else if (q.type === 'true_false') {
        doc.font('Helvetica').text('     [  ] True      [  ] False', { indent: 20 });
      } else if (q.type === 'matching') {
        const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        if (Array.isArray(options)) {
          doc.font('Helvetica').text('     Match the following:', { indent: 20 });
          for (let i = 0; i < options.length; i++) {
            const text = cleanOption(options[i]);
            doc.text(`     ${i + 1}. ______  ${text}`, { width: 300, indent: 20 });
          }
        }
      } else if (q.type === 'identification') {
        doc.font('Helvetica').text('     Answer: _________________________________________', { indent: 20 });
      }

      doc.moveDown(0.6);
      itemNum++;
    }

    // ── Footer ──────────────────────────────────────
    if (doc.y > 740) doc.addPage();
    doc.moveDown(1);
    drawLine(doc, doc.y, PAGE.left, PAGE.right);
    doc.moveDown(0.3);
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#666666')
      .text('— End of Examination —', { align: 'center' });
    doc.text(`Generated by NEXAM  |  Set ${opts.setLabel}`, { align: 'center' });

    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

// ── Answer Key PDF ───────────────────────────────────

/**
 * Generate an answer key PDF.
 *
 * @param {object} opts — same as generateExamPDF but with answers
 * @param {Array} opts.questions — [{ stem, type, answer, options }]
 * @returns {Promise<string>}
 */
export function generateAnswerKeyPDF(opts) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(STORAGE_DIR, opts.filename);
    const doc = new PDFDocument({ margin: 72, size: 'A4' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // ── Header ──────────────────────────────────────
    doc.fontSize(14).font('Helvetica-Bold').text('NEXAM', { align: 'center' });
    doc.fontSize(9).font('Helvetica').text('AI-Assisted Examination System', { align: 'center' });
    drawLine(doc, doc.y + 8, PAGE.left, PAGE.right);
    doc.moveDown(1.5);

    // ── Title ───────────────────────────────────────
    doc.fontSize(15).font('Helvetica-Bold').text(`${opts.examTitle}`, { align: 'center' });
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#B91C1C')
      .text(`ANSWER KEY — Set ${opts.setLabel}`, { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(1);

    // ── Answer table ────────────────────────────────
    let itemNum = 1;
    for (const q of opts.questions) {
      if (doc.y > 740) doc.addPage();

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(`${itemNum}. `, { continued: true });
      doc.font('Helvetica').text(q.stem, { width: 340, continued: true });

      // Format the answer based on question type
      let answerText = q.answer || 'N/A';
      if (q.type === 'mcq' && q.options) {
        const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        if (Array.isArray(options)) {
          const idx = typeof answerText === 'string' ? answerText.charCodeAt(0) - 65 : -1;
          if (idx >= 0 && idx < options.length) {
            answerText = `${answerText}) ${cleanOption(options[idx])}`;
          }
        }
      }
      doc.font('Helvetica-Bold').fillColor('#B91C1C').text(`  → ${answerText}`);
      doc.fillColor('#000000');

      if (q.explanation) {
        doc.font('Helvetica-Oblique').fontSize(9).fillColor('#444444')
          .text(`     ${q.explanation}`, { width: PAGE.width - 20, indent: 20 });
        doc.fillColor('#000000').fontSize(10);
      }

      doc.moveDown(0.4);
      itemNum++;
    }

    // ── Footer ──────────────────────────────────────
    if (doc.y > 740) doc.addPage();
    doc.moveDown(1);
    drawLine(doc, doc.y, PAGE.left, PAGE.right);
    doc.moveDown(0.3);
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#666666')
      .text('— End of Answer Key —', { align: 'center' });

    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

// ── TOS Report PDF ──────────────────────────────────

/**
 * Generate a TOS summary report PDF showing the blueprint alignment.
 *
 * @param {object} opts
 * @param {string} opts.examTitle
 * @param {object} opts.tos — { title, total_items, bloom_weights }
 * @param {Array} opts.topics — [{ title, instructional_hours, item_count }]
 * @param {Array} opts.actualDistribution — [{ bloom, planned, actual }]
 * @returns {Promise<string>}
 */
export function generateTOSReportPDF(opts) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(STORAGE_DIR, opts.filename);
    const doc = new PDFDocument({ margin: 72, size: 'A4' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // ── Header ──────────────────────────────────────
    doc.fontSize(14).font('Helvetica-Bold').text('NEXAM', { align: 'center' });
    doc.fontSize(9).font('Helvetica').text('AI-Assisted Examination System', { align: 'center' });
    drawLine(doc, doc.y + 8, PAGE.left, PAGE.right);
    doc.moveDown(1.5);

    // ── Title ───────────────────────────────────────
    doc.fontSize(15).font('Helvetica-Bold').text('Table of Specification Report', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text(opts.examTitle, { align: 'center' });
    doc.moveDown(1);

    // ── Summary stats ───────────────────────────────
    doc.fontSize(10).font('Helvetica-Bold').text('Summary', { underline: true });
    doc.moveDown(0.2);
    doc.font('Helvetica').text(`Total Items: ${opts.tos.total_items}`);
    doc.text(`Topics: ${opts.topics.length}`);
    const totalHours = opts.topics.reduce((s, t) => s + (t.instructional_hours || 0), 0);
    doc.text(`Total Instructional Hours: ${totalHours}`);
    doc.moveDown(1);

    // ── Bloom distribution table ────────────────────
    doc.font('Helvetica-Bold').text('Bloom Taxonomy Distribution', { underline: true });
    doc.moveDown(0.3);

    const bloomLabels = {
      remember: 'Remember', understand: 'Understand', apply: 'Apply',
      analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create',
    };

    // Table header
    const colX = { bloom: 72, planned: 250, actual: 340, match: 430 };
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Bloom Level', colX.bloom, doc.y, { width: 170 });
    doc.text('Planned %', colX.planned, doc.y - 12, { width: 80 });
    doc.text('Actual Count', colX.actual, doc.y, { width: 80 });
    doc.text('Match', colX.match, doc.y, { width: 60 });
    doc.moveDown(0.3);
    drawLine(doc, doc.y, PAGE.left, PAGE.right);
    doc.moveDown(0.2);

    doc.font('Helvetica').fontSize(9);
    for (const dist of opts.actualDistribution) {
      const pct = opts.tos.bloom_weights?.[dist.bloom] || 0;
      const plannedCount = Math.round(pct / 100 * opts.tos.total_items);
      const match = plannedCount === dist.actual ? 'Yes' : 'No';
      doc.text(bloomLabels[dist.bloom] || dist.bloom, colX.bloom, doc.y, { width: 170 });
      doc.text(`${pct}% (${plannedCount})`, colX.planned, doc.y - 12, { width: 80 });
      doc.text(String(dist.actual), colX.actual, doc.y, { width: 80 });
      doc.text(match, colX.match, doc.y, { width: 60 });
      doc.moveDown(0.3);
    }

    doc.moveDown(1);

    // ── Topics table ────────────────────────────────
    if (doc.y > 650) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(10).text('Topics', { underline: true });
    doc.moveDown(0.3);

    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('#', 72, doc.y, { width: 30 });
    doc.text('Topic', 110, doc.y - 12, { width: 280 });
    doc.text('Hours', 400, doc.y, { width: 60 });
    doc.text('Items', 470, doc.y, { width: 50 });
    doc.moveDown(0.3);
    drawLine(doc, doc.y, PAGE.left, PAGE.right);
    doc.moveDown(0.2);

    doc.font('Helvetica').fontSize(9);
    opts.topics.forEach((t, i) => {
      if (doc.y > 740) doc.addPage();
      doc.text(String(i + 1), 72, doc.y, { width: 30 });
      doc.text(t.title, 110, doc.y - 12, { width: 280 });
      doc.text(String(t.instructional_hours || 0), 400, doc.y, { width: 60 });
      doc.text(String(t.item_count || 0), 470, doc.y, { width: 50 });
      doc.moveDown(0.3);
    });

    // ── Footer ──────────────────────────────────────
    if (doc.y > 740) doc.addPage();
    doc.moveDown(1);
    drawLine(doc, doc.y, PAGE.left, PAGE.right);
    doc.moveDown(0.3);
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#666666')
      .text('Generated by NEXAM  |  Table of Specification Report', { align: 'center' });

    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

export { STORAGE_DIR };
