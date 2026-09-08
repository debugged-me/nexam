/**
 * OMR answer sheet generation service.
 *
 * Generates printable PDF answer sheets with:
 * - QR code containing exam/set identity (for mobile scanning)
 * - Student name and ID fields
 * - One bubble per item (A/B/C/D for MCQ, T/F for true_false)
 * - Grid layout optimized for mobile camera scanning
 */
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage', 'exams');

const BUBBLE_SIZE = 14;
const BUBBLE_GAP = 6;
const COLS_PER_PAGE = 25; // items per column
const ITEMS_PER_PAGE = 50; // 2 columns of 25

/**
 * Generate an OMR answer sheet PDF for an exam set.
 *
 * @param {object} opts
 * @param {string} opts.examId
 * @param {string} opts.examTitle
 * @param {string} opts.setLabel — 'A' or 'B'
 * @param {Array} opts.questions — [{ type, stem }] (type determines bubble options)
 * @param {string} opts.filename
 * @returns {Promise<string>} — absolute path to the generated PDF
 */
export async function generateOMRSheet(opts) {
  const filePath = path.join(STORAGE_DIR, opts.filename);

  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // ── QR Code (top-right) ────────────────────────────────
    const qrPayload = JSON.stringify({
      examId: opts.examId,
      set: opts.setLabel,
      count: opts.questions.length,
    });
    const qrBuffer = await QRCode.toBuffer(qrPayload, {
      width: 120,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
    doc.image(qrBuffer, 450, 40, { width: 100, height: 100 });

    // ── Header ────────────────────────────────────────────
    doc.fontSize(14).font('Helvetica-Bold').text(opts.examTitle, 50, 50, { width: 380 });
    doc.fontSize(11).font('Helvetica').text(`Set ${opts.setLabel} — OMR Answer Sheet`, 50, 70, { width: 380 });
    doc.fontSize(9).text(`Items: ${opts.questions.length}`, 50, 85, { width: 380 });

    // ── Student info fields ────────────────────────────────
    doc.moveDown(1);
    doc.fontSize(10).font('Helvetica');
    doc.text('Name: _________________________________', 50, 120, { width: 380 });
    doc.text('Student ID: ____________________________', 50, 140, { width: 380 });
    doc.text('Section: ____________', 50, 160, { width: 380 });
    doc.text('Date: _______________', 50, 180, { width: 380 });

    // ── Bubble grid ────────────────────────────────────────
    let y = 210;
    let itemNum = 1;

    for (let col = 0; col < 2 && itemNum <= opts.questions.length; col++) {
      const x = col === 0 ? 60 : 320;
      y = 210;

      for (let row = 0; row < COLS_PER_PAGE && itemNum <= opts.questions.length; row++) {
        const question = opts.questions[itemNum - 1];
        const choices = getBubbleChoices(question.type);

        // Item number
        doc.fontSize(9).font('Helvetica-Bold').text(String(itemNum) + '.', x, y + 2, { width: 20 });

        // Bubbles
        let bubbleX = x + 25;
        for (const choice of choices) {
          drawBubble(doc, bubbleX, y, choice);
          bubbleX += BUBBLE_SIZE + BUBBLE_GAP;
        }

        y += 22;
        itemNum++;
      }
    }

    // ── Footer instructions ───────────────────────────────
    doc.fontSize(8).font('Helvetica-Oblique');
    doc.text('Instructions: Use a dark pen or pencil to fill the bubble completely. Do not make any stray marks.', 50, 760, { width: 500 });
    doc.text('For True/False: fill T for True, F for False.', 50, 772, { width: 500 });

    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

/**
 * Draw a single bubble (circle with letter inside).
 */
function drawBubble(doc, x, y, label) {
  doc.save();
  doc.lineWidth(1);
  doc.circle(x + BUBBLE_SIZE / 2, y + BUBBLE_SIZE / 2, BUBBLE_SIZE / 2);
  doc.stroke();
  doc.restore();

  doc.fontSize(8).font('Helvetica').text(label, x, y + 2, {
    width: BUBBLE_SIZE,
    align: 'center',
  });
}

/**
 * Get the bubble choices for a question type.
 */
function getBubbleChoices(type) {
  switch (type) {
    case 'mcq':
      return ['A', 'B', 'C', 'D'];
    case 'true_false':
      return ['T', 'F'];
    case 'identification':
      return ['✎']; // write-in marker
    case 'matching':
      return ['A', 'B', 'C', 'D', 'E'];
    default:
      return ['A', 'B', 'C', 'D'];
  }
}

export { STORAGE_DIR };
