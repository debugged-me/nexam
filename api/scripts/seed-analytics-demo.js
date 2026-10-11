/**
 * seed-analytics-demo.js — populate a demo exam with realistic OMR scans so
 * the analytics/insights dashboards have real data to render.
 *
 * Creates for the first instructor that owns active questions:
 *   - one exam ("Demo Midterm — Analytics Seed") with Set A + Set B
 *   - ~20 questions placed into both sets (Set B shuffled, like production)
 *   - ~14 students (names encrypted via storageCrypto, like production)
 *   - ~26 scans over the last 9 days with per-item scan_answers
 *
 * Performance is shaped so the thematic insights fire: two topics are made
 * weak, one strong, and higher-order items trail lower-order by ~12pts.
 *
 * Usage:  node scripts/seed-analytics-demo.js --yes [--clean]
 *   --yes    required acknowledgment — this writes fake data to the database
 *   --clean  removes the demo exam + its scans (students are kept, they're
 *            harmless roster rows; delete them from the Students UI if unwanted)
 *   Refuses to run when NODE_ENV=production.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from '../src/config/db.js';
import env from '../src/config/env.js';
import { protectText, blindIndex } from '../src/services/storageCrypto.js';
import { generateExamPDF, generateAnswerKeyPDF, generateTOSReportPDF } from '../src/services/pdfService.js';
import { generateOMRSheet } from '../src/services/omrService.js';

// Safety: this script writes fake exams/scans. Never run against a production
// database — refuse outright in prod, and require an explicit --yes elsewhere.
if (env.isProd) {
  console.error('Refusing to seed demo data: NODE_ENV=production. This script is for local development only.');
  process.exit(1);
}
if (!process.argv.includes('--yes')) {
  console.error('This inserts a fake exam + scans into your database.');
  console.error('Run with --yes to proceed (or --clean to remove demo data).');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.join(__dirname, '..', 'storage', 'exams');

const uuid = () => crypto.randomUUID();
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

const EXAM_TITLE = 'Demo Midterm — Analytics Seed';
const ITEM_COUNT = 20;
const STUDENT_NAMES = [
  'Santos, Maria', 'Reyes, Juan', 'Cruz, Ana', 'Bautista, Jose', 'Ocampo, Liza',
  'Garcia, Paolo', 'Mendoza, Carla', 'Torres, Mark', 'Flores, Nina', 'Ramos, Kyle',
  'Aquino, Bea', 'Navarro, John', 'Salazar, Kim', 'Mercado, Dan',
];

const WRONG_MARKS = { mcq: ['A', 'B', 'C', 'D'], true_false: ['T', 'F'] };

function wrongAnswerFor(q) {
  const pool_ = WRONG_MARKS[q.type];
  if (pool_) {
    const choices = pool_.filter((m) => m !== q.answer);
    return pick(choices.length ? choices : pool_);
  }
  return 'INCORRECT';
}

async function main() {
  const clean = process.argv.includes('--clean');

  if (clean) {
    const [exams] = await pool.query(`SELECT id FROM exams WHERE title = ?`, [EXAM_TITLE]);
    for (const e of exams) {
      // Remove generated artefacts from disk alongside the rows.
      const [files] = await pool.query(
        `SELECT pdf_path, answer_key_path, omr_sheet_path FROM exam_sets WHERE exam_id = ?`, [e.id]
      );
      for (const f of files) {
        for (const name of [f.pdf_path, f.answer_key_path, f.omr_sheet_path]) {
          if (!name) continue;
          try { fs.unlinkSync(path.join(STORAGE_DIR, path.basename(name))); } catch { /* already gone */ }
        }
      }
      await pool.query(`DELETE sa FROM scan_answers sa JOIN scan_results sr ON sr.id = sa.scan_result_id WHERE sr.exam_id = ?`, [e.id]);
      await pool.query(`DELETE FROM scan_results WHERE exam_id = ?`, [e.id]);
      await pool.query(`DELETE esq FROM exam_set_questions esq JOIN exam_sets es ON es.id = esq.exam_set_id WHERE es.exam_id = ?`, [e.id]);
      await pool.query(`DELETE FROM exam_sets WHERE exam_id = ?`, [e.id]);
      await pool.query(`DELETE FROM exam_questions WHERE exam_id = ?`, [e.id]);
      await pool.query(`DELETE FROM exams WHERE id = ?`, [e.id]);
    }
    console.log(`Removed ${exams.length} demo exam(s), their scans, and generated files.`);
    process.exit(0);
  }

  // Find the subject with the most active questions
  const [owners] = await pool.query(
    `SELECT s.id AS subject_id, s.instructor_id, s.name, s.code, COUNT(q.id) AS n
     FROM subjects s
     JOIN questions q ON q.subject_id = s.id AND q.status = 'active'
     GROUP BY s.id, s.instructor_id, s.name, s.code
     ORDER BY n DESC LIMIT 1`
  );
  if (!owners.length) {
    console.error('No subject with active questions found — generate and approve questions first.');
    process.exit(1);
  }
  const { subject_id: subjectId, instructor_id: instructorId, name: subjectName, code: subjectCode } = owners[0];

  const [allQuestions] = await pool.query(
    `SELECT id, topic, bloom, type, stem, options, answer FROM questions
     WHERE subject_id = ? AND status = 'active'`,
    [subjectId]
  );

  // Stratified pick — round-robin across topics so the exam spans many themes
  const byTopic = {};
  for (const q of allQuestions) (byTopic[q.topic || 'General'] ||= []).push(q);
  const topics = shuffle(Object.keys(byTopic));
  const items = [];
  for (const t of topics) byTopic[t] = shuffle(byTopic[t]);
  let i = 0;
  while (items.length < Math.min(ITEM_COUNT, allQuestions.length)) {
    const t = topics[i % topics.length];
    if (!byTopic[t].length) break;
    items.push(byTopic[t].pop());
    i++;
  }
  if (items.length < 6) {
    console.error('Not enough active questions to seed a demo exam.');
    process.exit(1);
  }

  // Thematic shaping: two weak topics, one strong
  const weakTopics = new Set(topics.slice(0, 2));
  const strongTopic = topics[2];
  const topicAdj = (t) => (weakTopics.has(t) ? -0.26 : t === strongTopic ? 0.10 : 0);
  const bloomAdj = (b) => (['analyze', 'evaluate', 'create'].includes(b) ? -0.12 : 0);

  const examId = uuid();

  // Generate the real PDF artefacts first — same filenames and contents the
  // generate-sets endpoint produces, so every download link works.
  const setIds = { A: uuid(), B: uuid() };
  const orders = { A: items, B: shuffle(items) };
  const setFiles = {};
  console.log('Generating exam PDFs (Set A + Set B)…');
  for (const label of ['A', 'B']) {
    const [examFilename, answerKeyFilename, omrFilename] = [
      `exam_${examId}_set${label}.pdf`,
      `answerkey_${examId}_set${label}.pdf`,
      `omr_${examId}_set${label}.pdf`,
    ];
    await generateExamPDF({
      examTitle: EXAM_TITLE, subjectName, subjectCode,
      setLabel: label, durationMinutes: 60,
      instructions: 'Demo exam generated by the analytics seed script.',
      questions: orders[label], filename: examFilename,
    });
    await generateAnswerKeyPDF({
      examTitle: EXAM_TITLE, setLabel: label,
      questions: orders[label], filename: answerKeyFilename,
    });
    await generateOMRSheet({
      examId, examSetId: setIds[label], examTitle: EXAM_TITLE,
      setLabel: label, questions: orders[label], filename: omrFilename,
    });
    setFiles[label] = { examFilename, answerKeyFilename, omrFilename };
  }

  // TOS coverage report — matches what the exam page's report link downloads.
  const [tosRows] = await pool.query(
    `SELECT * FROM tos WHERE subject_id = ? AND status = 'finalized' LIMIT 1`, [subjectId]
  );
  const tosRow = tosRows[0];
  if (tosRow) {
    const [tosTopics] = await pool.query(
      `SELECT * FROM tos_topics WHERE tos_id = ? ORDER BY sort_order ASC`, [tosRow.id]
    );
    const bloomCounts = {};
    for (const q of items) bloomCounts[q.bloom] = (bloomCounts[q.bloom] || 0) + 1;
    try { tosRow.bloom_weights = typeof tosRow.bloom_weights === 'string' ? JSON.parse(tosRow.bloom_weights || '{}') : tosRow.bloom_weights; } catch { tosRow.bloom_weights = {}; }
    await generateTOSReportPDF({
      examTitle: EXAM_TITLE, tos: tosRow, topics: tosTopics,
      actualDistribution: Object.entries(bloomCounts).map(([bloom, actual]) => ({ bloom, actual })),
      filename: `tos_report_${examId}.pdf`,
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO exams (id, subject_id, tos_id, title, format, set_count, duration_minutes, instructions, status, created_by)
       VALUES (?, ?, ?, ?, 'print', 2, 60, 'Demo exam generated by the analytics seed script.', 'published', ?)`,
      [examId, subjectId, tosRow?.id || null, EXAM_TITLE, instructorId]
    );

    for (let n = 0; n < items.length; n++) {
      await conn.query(
        `INSERT INTO exam_questions (exam_id, question_id, sort_order) VALUES (?, ?, ?)`,
        [examId, items[n].id, n + 1]
      );
    }

    for (const label of ['A', 'B']) {
      const setId = setIds[label];
      await conn.query(
        `INSERT INTO exam_sets (id, exam_id, set_label, pdf_path, answer_key_path, omr_sheet_path)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [setId, examId, label, setFiles[label].examFilename, setFiles[label].answerKeyFilename, setFiles[label].omrFilename]
      );
      for (let n = 0; n < orders[label].length; n++) {
        await conn.query(
          `INSERT INTO exam_set_questions (id, exam_set_id, question_id, sort_order) VALUES (?, ?, ?, ?)`,
          [uuid(), setId, orders[label][n].id, n + 1]
        );
      }
    }

    // Students — reuse existing roster for this instructor, create the rest
    const [existing] = await conn.query(
      `SELECT id FROM students WHERE instructor_id = ? LIMIT ?`, [instructorId, STUDENT_NAMES.length]
    );
    const studentIds = existing.map((s) => s.id);
    for (const name of STUDENT_NAMES.slice(existing.length)) {
      const sid = uuid();
      studentIds.push(sid);
      await conn.query(
        `INSERT INTO students (id, instructor_id, subject_id, student_number, student_number_hash, full_name, full_name_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [sid, instructorId, subjectId, protectText(`2025-${String(studentIds.length).padStart(4, '0')}`),
         blindIndex(`2025-${String(studentIds.length).padStart(4, '0')}`),
         protectText(name), blindIndex(name)]
      );
    }

    // ~26 scans across the last 9 days, split across sets
    const scanCount = 26;
    for (let s = 0; s < scanCount; s++) {
      const label = Math.random() < 0.55 ? 'A' : 'B';
      const setId = setIds[label];
      const studentIdx = s % studentIds.length;
      const name = studentIdx < existing.length ? null : STUDENT_NAMES[studentIdx];
      const ability = Math.min(0.95, Math.max(0.4, 0.72 + rand(-0.18, 0.2)));
      const needsReview = Math.random() < 0.12 ? 1 : 0;
      const daysAgo = Math.floor(rand(0, 9));
      const scanId = uuid();

      const answers = [];
      let correct = 0;
      orders[label].forEach((q, n) => {
        const p = Math.min(0.97, Math.max(0.03, ability + topicAdj(q.topic || 'General') + bloomAdj(q.bloom) + rand(-0.08, 0.08)));
        const ok = Math.random() < p;
        if (ok) correct++;
        const ambiguous = needsReview && n < 2 ? 1 : 0;
        answers.push({
          id: uuid(), item: n + 1,
          marked: ok ? q.answer : wrongAnswerFor(q),
          correctAnswer: q.answer,
          isCorrect: ok ? 1 : 0,
          ambiguous,
        });
      });

      await conn.query(
        `INSERT INTO scan_results
           (id, exam_id, exam_set_id, student_id, student_name, total_items, correct_count, score, needs_review, scanned_by, scanned_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
        [scanId, examId, setId, studentIds[studentIdx], protectText(name || `Student ${studentIdx + 1}`),
         items.length, correct, (correct / items.length) * 100, needsReview, instructorId, daysAgo]
      );
      for (const a of answers) {
        await conn.query(
          `INSERT INTO scan_answers (id, scan_result_id, item_number, marked_answer, correct_answer, is_correct, ambiguous)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [a.id, scanId, a.item, a.marked, a.correctAnswer, a.isCorrect, a.ambiguous]
        );
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  console.log(`Seeded "${EXAM_TITLE}" in subject "${subjectName}"`);
  console.log(`  ${items.length} questions across ${topics.length} topics, Sets A + B`);
  console.log(`  26 scans · weak topics: ${[...weakTopics].join(', ')} · strong: ${strongTopic}`);
  console.log('  Open http://localhost:5173/analytics to see it. Remove with --clean.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
