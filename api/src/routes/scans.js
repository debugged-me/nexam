/**
 * Scan routes — mobile OMR scanning + score synchronization.
 *
 * POST /api/scans              — submit a scanned OMR result from the mobile app
 * GET  /api/scans              — list scan results for the authenticated instructor
 * GET  /api/scans/exam/:examId — all scan results for a specific exam
 * GET  /api/scans/:id          — single scan result with per-item breakdown
 * POST /api/scans/:id/review   — apply instructor corrections and recount
 *
 * The Flutter app scans the OMR sheet, decodes the QR code (exam/set identity),
 * detects filled bubbles, and POSTs canonical marked answers here. The server
 * resolves the set (by id or set label), scores each item against the key
 * (letter↔option normalization lives in services/scoring.js), and stores the
 * result inside a single transaction.
 */
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import pool from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { scoreItem } from '../services/scoring.js';
import { blindIndex, protectText, unprotectText } from '../services/storageCrypto.js';

const router = Router();
router.use(requireAuth);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ITEMS = 200;

/**
 * Resolve which question ordering to score against.
 * Priority: explicit examSetId → set label → exam_questions fallback.
 * @returns {Promise<{examSetId: string|null, questions: Array}>}
 */
async function resolveSetQuestions(conn, examId, examSetId, setLabel) {
  let resolvedSetId = null;

  if (examSetId && UUID_RE.test(String(examSetId))) {
    const [rows] = await conn.query(
      `SELECT id FROM exam_sets WHERE id = :id AND exam_id = :examId`,
      { id: examSetId, examId }
    );
    if (rows.length) resolvedSetId = rows[0].id;
  }

  if (!resolvedSetId && setLabel) {
    const [rows] = await conn.query(
      `SELECT id FROM exam_sets WHERE exam_id = :examId AND set_label = :label`,
      { examId, label: String(setLabel).trim().toUpperCase() }
    );
    if (rows.length) resolvedSetId = rows[0].id;
  }

  if (resolvedSetId) {
    const [setQs] = await conn.query(
      `SELECT q.id, q.type, q.answer, q.options, esq.sort_order
       FROM exam_set_questions esq
       JOIN questions q ON q.id = esq.question_id
       WHERE esq.exam_set_id = :examSetId
       ORDER BY esq.sort_order ASC`,
      { examSetId: resolvedSetId }
    );
    return { examSetId: resolvedSetId, questions: setQs };
  }

  // Legacy fallback: unshuffled exam question order (pre-setId sheets).
  const [examQs] = await conn.query(
    `SELECT q.id, q.type, q.answer, q.options, eq.sort_order
     FROM exam_questions eq
     JOIN questions q ON q.id = eq.question_id
     WHERE eq.exam_id = :examId
     ORDER BY eq.sort_order ASC`,
    { examId }
  );
  return { examSetId: null, questions: examQs };
}

/** Find or create the student record (student_number match, then name). */
async function findOrCreateStudent(conn, userId, subjectId, studentName, studentNumber) {
  const name = (studentName || '').trim();
  const number = (studentNumber || '').trim();
  if (!name && !number) return null;
  const numberHash = blindIndex(number);
  const nameHash = blindIndex(name);

  // Strongest identity: instructor + student_number.
  if (number) {
    const [byNum] = await conn.query(
      `SELECT id FROM students
       WHERE instructor_id = :uid AND student_number_hash = :numberHash LIMIT 1`,
      { uid: userId, numberHash }
    );
    if (byNum.length) return byNum[0].id;
  }
  // Then instructor + full name.
  if (name) {
    const [byName] = await conn.query(
      `SELECT id FROM students
       WHERE instructor_id = :uid AND full_name_hash = :nameHash LIMIT 1`,
      { uid: userId, nameHash }
    );
    if (byName.length) return byName[0].id;
  }

  const id = uuid();
  await conn.query(
    `INSERT INTO students
       (id, instructor_id, subject_id, student_number, student_number_hash, full_name, full_name_hash)
     VALUES (:id, :uid, :subjectId, :num, :numberHash, :name, :nameHash)`,
    {
      id,
      uid: userId,
      subjectId: subjectId || null,
      num: number ? protectText(number) : null,
      numberHash,
      name: protectText(name || 'Unknown'),
      nameHash: nameHash || blindIndex('Unknown'),
    }
  );
  return id;
}

function revealScanIdentity(row) {
  if (!row) return row;
  return { ...row, student_name: unprotectText(row.student_name) };
}

/**
 * POST /api/scans — submit a scanned OMR result.
 *
 * Body: { examId, examSetId?, set?, studentName?, studentNumber?,
 *         answers: [{ itemNumber, markedAnswer, ambiguous }] }
 */
router.post('/', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { examId, examSetId, set, studentName, studentNumber, answers } = req.body || {};

    if (!examId || !UUID_RE.test(String(examId))) {
      return res.status(400).json({ error: 'Valid examId is required.' });
    }
    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: 'answers array is required.' });
    }
    if (answers.length > MAX_ITEMS) {
      return res.status(400).json({ error: `answers may contain at most ${MAX_ITEMS} items.` });
    }
    for (const a of answers) {
      if (!Number.isInteger(a?.itemNumber) || a.itemNumber < 1 || a.itemNumber > MAX_ITEMS) {
        return res.status(400).json({ error: 'Each answer needs a valid itemNumber.' });
      }
      if (a.markedAnswer != null && String(a.markedAnswer).length > 500) {
        return res.status(400).json({ error: 'markedAnswer is too long.' });
      }
    }

    // Ownership check — the exam must belong to the instructor.
    const [examRows] = await conn.query(
      `SELECT e.id, e.subject_id FROM exams e
       JOIN subjects s ON s.id = e.subject_id
       WHERE e.id = :examId AND s.instructor_id = :userId`,
      { examId, userId: req.user.id }
    );
    if (!examRows.length) return res.status(404).json({ error: 'Exam not found.' });
    const exam = examRows[0];

    await conn.beginTransaction();

    const { examSetId: resolvedSetId, questions } =
      await resolveSetQuestions(conn, examId, examSetId, set);
    if (questions.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'No questions found for this exam/set.' });
    }

    const studentId = await findOrCreateStudent(
      conn, req.user.id, exam.subject_id, studentName, studentNumber
    );

    // Score each submitted item against the canonical key.
    let correctCount = 0;
    let ambiguousCount = 0;
    const scanAnswers = [];

    for (const ans of answers) {
      const question = questions[ans.itemNumber - 1];
      if (!question) continue;

      const scored = scoreItem(question, ans.markedAnswer);
      const ambiguous = !!ans.ambiguous || !scored.autoScorable;

      if (scored.isCorrect === true) correctCount++;
      if (ambiguous) ambiguousCount++;

      scanAnswers.push({
        itemNumber: ans.itemNumber,
        markedAnswer: scored.marked || null,
        correctAnswer: scored.correct ?? scored.displayCorrect ?? null,
        isCorrect: scored.isCorrect === true ? 1 : 0,
        ambiguous: ambiguous ? 1 : 0,
        type: question.type,
      });
    }

    const needsReview = ambiguousCount > 0 ? 1 : 0;
    const totalItems = questions.length;
    const score = totalItems > 0 ? (correctCount / totalItems * 100).toFixed(2) : '0.00';

    const scanId = uuid();
    await conn.query(
      `INSERT INTO scan_results
         (id, exam_id, exam_set_id, student_id, student_name,
          total_items, correct_count, score, needs_review, scanned_by)
       VALUES (:id, :examId, :examSetId, :studentId, :studentName,
               :totalItems, :correctCount, :score, :needsReview, :scannedBy)`,
      {
        id: scanId,
        examId,
        examSetId: resolvedSetId,
        studentId,
        studentName: (studentName || '').trim() ? protectText(String(studentName).trim()) : null,
        totalItems,
        correctCount,
        score,
        needsReview,
        scannedBy: req.user.id,
      }
    );

    for (const sa of scanAnswers) {
      await conn.query(
        `INSERT INTO scan_answers
           (id, scan_result_id, item_number, marked_answer, correct_answer, is_correct, ambiguous)
         VALUES (:id, :scanId, :itemNumber, :markedAnswer, :correctAnswer, :isCorrect, :ambiguous)`,
        {
          id: uuid(),
          scanId,
          itemNumber: sa.itemNumber,
          markedAnswer: sa.markedAnswer,
          correctAnswer: sa.correctAnswer,
          isCorrect: sa.isCorrect,
          ambiguous: sa.ambiguous,
        }
      );
    }

    await conn.commit();

    res.status(201).json({
      id: scanId,
      examId,
      examSetId: resolvedSetId,
      studentName: (studentName || '').trim() || null,
      totalItems,
      correctCount,
      score: parseFloat(score),
      needsReview,
      ambiguousCount,
      // Per-item results let the app show item-level feedback immediately.
      results: scanAnswers.map((sa) => ({
        itemNumber: sa.itemNumber,
        markedAnswer: sa.markedAnswer,
        correctAnswer: sa.correctAnswer,
        isCorrect: !!sa.isCorrect,
        ambiguous: !!sa.ambiguous,
        type: sa.type,
      })),
    });
  } catch (err) {
    try { await conn.rollback(); } catch { /* not in a transaction */ }
    next(err);
  } finally {
    conn.release();
  }
});

/** GET /api/scans — list scan results for the authenticated instructor. */
router.get('/', async (req, res, next) => {
  try {
    const { exam_id, needs_review } = req.query;

    let query = `
      SELECT sr.*, e.title AS exam_title, es.set_label
      FROM scan_results sr
      JOIN exams e ON e.id = sr.exam_id
      JOIN subjects s ON s.id = e.subject_id
      LEFT JOIN exam_sets es ON es.id = sr.exam_set_id
      WHERE s.instructor_id = :userId
    `;
    const params = { userId: req.user.id };

    if (exam_id) {
      query += ' AND sr.exam_id = :examId';
      params.examId = exam_id;
    }
    if (needs_review === 'true') {
      query += ' AND sr.needs_review = 1';
    }
    query += ' ORDER BY sr.scanned_at DESC LIMIT 100';

    const [rows] = await pool.query(query, params);
    res.json({ scans: rows.map(revealScanIdentity) });
  } catch (err) {
    next(err);
  }
});

/** GET /api/scans/exam/:examId — all scan results for a specific exam. */
router.get('/exam/:examId', async (req, res, next) => {
  try {
    const { examId } = req.params;

    const [examRows] = await pool.query(
      `SELECT e.id FROM exams e
       JOIN subjects s ON s.id = e.subject_id
       WHERE e.id = :examId AND s.instructor_id = :userId`,
      { examId, userId: req.user.id }
    );
    if (!examRows.length) return res.status(404).json({ error: 'Exam not found.' });

    const [rows] = await pool.query(
      `SELECT sr.*, es.set_label
       FROM scan_results sr
       LEFT JOIN exam_sets es ON es.id = sr.exam_set_id
       WHERE sr.exam_id = :examId
       ORDER BY sr.scanned_at DESC`,
      { examId }
    );
    res.json({ scans: rows.map(revealScanIdentity) });
  } catch (err) {
    next(err);
  }
});

/** GET /api/scans/:id — single scan result with per-item breakdown. */
router.get('/:id', async (req, res, next) => {
  try {
    const scanId = req.params.id;

    const [scanRows] = await pool.query(
      `SELECT sr.*, e.title AS exam_title, es.set_label
       FROM scan_results sr
       JOIN exams e ON e.id = sr.exam_id
       JOIN subjects s ON s.id = e.subject_id
       LEFT JOIN exam_sets es ON es.id = sr.exam_set_id
       WHERE sr.id = :scanId AND s.instructor_id = :userId`,
      { scanId, userId: req.user.id }
    );
    if (!scanRows.length) return res.status(404).json({ error: 'Scan result not found.' });
    const scan = revealScanIdentity(scanRows[0]);

    // Per-item breakdown, enriched with question type + stem via the set (or
    // exam) item ordering — item_number == sort_order.
    const [answers] = scan.exam_set_id
      ? await pool.query(
          `SELECT sa.*, q.type AS question_type, q.stem
           FROM scan_answers sa
           LEFT JOIN exam_set_questions esq
             ON esq.exam_set_id = :setId AND esq.sort_order = sa.item_number
           LEFT JOIN questions q ON q.id = esq.question_id
           WHERE sa.scan_result_id = :scanId
           ORDER BY sa.item_number ASC`,
          { scanId, setId: scan.exam_set_id }
        )
      : await pool.query(
          `SELECT sa.*, q.type AS question_type, q.stem
           FROM scan_answers sa
           LEFT JOIN exam_questions eq
             ON eq.exam_id = :examId AND eq.sort_order = sa.item_number
           LEFT JOIN questions q ON q.id = eq.question_id
           WHERE sa.scan_result_id = :scanId
           ORDER BY sa.item_number ASC`,
          { scanId, examId: scan.exam_id }
        );

    res.json({ scan, answers });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/scans/:id/review — apply instructor corrections and recount.
 *
 * Body: { correctedAnswers: [{ itemNumber, markedAnswer? , isCorrect? }] }
 * - markedAnswer is re-scored through the canonical normalizer.
 * - isCorrect lets the instructor manually grade non-auto-scorable items
 *   (e.g. identification, text-form matching).
 *
 * The recount runs over ALL scan_answers rows after corrections — not just
 * the corrected ones — so totals stay consistent.
 */
router.post('/:id/review', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const scanId = req.params.id;
    const { correctedAnswers } = req.body || {};

    const [scanRows] = await conn.query(
      `SELECT sr.id, sr.exam_id, sr.exam_set_id
       FROM scan_results sr
       JOIN exams e ON e.id = sr.exam_id
       JOIN subjects s ON s.id = e.subject_id
       WHERE sr.id = :scanId AND s.instructor_id = :userId`,
      { scanId, userId: req.user.id }
    );
    if (!scanRows.length) return res.status(404).json({ error: 'Scan result not found.' });
    const scan = scanRows[0];

    if (Array.isArray(correctedAnswers) && correctedAnswers.length) {
      await conn.beginTransaction();

      // Load the question metadata (type/options) for each item so corrected
      // marks can be re-scored canonically.
      const setId = scan.exam_set_id;
      const [questions] = setId
        ? await conn.query(
            `SELECT esq.sort_order, q.type, q.answer, q.options
             FROM exam_set_questions esq JOIN questions q ON q.id = esq.question_id
             WHERE esq.exam_set_id = :setId`, { setId })
        : await conn.query(
            `SELECT eq.sort_order, q.type, q.answer, q.options
             FROM exam_questions eq JOIN questions q ON q.id = eq.question_id
             WHERE eq.exam_id = :examId`, { examId: scan.exam_id });
      const byItem = {};
      for (const q of questions) byItem[q.sort_order] = q;

      for (const ca of correctedAnswers) {
        const itemNumber = Number(ca?.itemNumber);
        if (!Number.isInteger(itemNumber)) continue;

        const [existing] = await conn.query(
          `SELECT id FROM scan_answers WHERE scan_result_id = :scanId AND item_number = :itemNumber`,
          { scanId, itemNumber }
        );
        if (!existing.length) continue;

        const question = byItem[itemNumber];
        let markedAnswer = null;
        let isCorrect = null;

        if (ca.isCorrect !== undefined && ca.isCorrect !== null) {
          // Explicit instructor verdict (manual-graded types).
          isCorrect = ca.isCorrect === true || ca.isCorrect === 1 ? 1 : 0;
          markedAnswer = isCorrect ? 'CORRECT' : 'INCORRECT';
        } else if (ca.markedAnswer !== undefined && question) {
          const scored = scoreItem(question, ca.markedAnswer);
          markedAnswer = scored.marked || null;
          isCorrect = scored.isCorrect === true ? 1 : 0;
        } else if (ca.markedAnswer !== undefined) {
          markedAnswer = String(ca.markedAnswer).slice(0, 500);
          isCorrect = 0;
        }

        await conn.query(
          `UPDATE scan_answers SET marked_answer = :marked, is_correct = :isCorrect, ambiguous = 0
           WHERE scan_result_id = :scanId AND item_number = :itemNumber`,
          { scanId, itemNumber, marked: markedAnswer, isCorrect: isCorrect ?? 0 }
        );
      }

      // Recount over the full answer set — not just corrected rows.
      const [totals] = await conn.query(
        `SELECT COUNT(*) AS total, SUM(is_correct) AS correct, SUM(ambiguous) AS ambiguous
         FROM scan_answers WHERE scan_result_id = :scanId`,
        { scanId }
      );
      const totalItems = Number(totals[0]?.total) || 0;
      const correctCount = Number(totals[0]?.correct) || 0;
      const remainingAmbiguous = Number(totals[0]?.ambiguous) || 0;
      const score = totalItems > 0 ? (correctCount / totalItems * 100).toFixed(2) : '0.00';

      await conn.query(
        `UPDATE scan_results
         SET needs_review = :needsReview, correct_count = :correctCount, score = :score
         WHERE id = :scanId`,
        { scanId, needsReview: remainingAmbiguous > 0 ? 1 : 0, correctCount, score }
      );

      await conn.commit();
      res.json({ ok: true, correctCount, totalItems, score: parseFloat(score), needsReview: remainingAmbiguous > 0 });
    } else {
      await conn.query(`UPDATE scan_results SET needs_review = 0 WHERE id = :scanId`, { scanId });
      res.json({ ok: true });
    }
  } catch (err) {
    try { await conn.rollback(); } catch { /* not in a transaction */ }
    next(err);
  } finally {
    conn.release();
  }
});

export default router;
