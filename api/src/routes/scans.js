/**
 * Scan routes — mobile OMR scanning + score synchronization.
 *
 * POST /api/scans              — submit a scanned OMR result from the mobile app
 * GET  /api/scans              — list scan results for the authenticated instructor
 * GET  /api/scans/:id          — single scan result with per-item breakdown
 * POST /api/scans/:id/review   — mark a scan as reviewed (instructor confirms/edits)
 * GET  /api/scans/exam/:examId — all scan results for a specific exam
 *
 * The Flutter app scans the OMR sheet, decodes the QR code (exam/set identity),
 * detects filled bubbles, computes the score, and POSTs the result here.
 */
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import pool from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/scans — submit a scanned OMR result.
 *
 * Body:
 *   {
 *     examId, examSetId, studentName, studentNumber,
 *     answers: [{ itemNumber, markedAnswer, ambiguous }]
 *   }
 *
 * The server loads the correct answers from the exam set questions,
 * computes is_correct for each item, and stores the result.
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { examId, examSetId, studentName, studentNumber, answers } = req.body;

    if (!examId) return res.status(400).json({ error: 'examId is required.' });
    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: 'answers array is required.' });
    }

    // Ownership check — the exam must belong to the instructor
    const [examRows] = await pool.query(
      `SELECT e.id FROM exams e
       JOIN subjects s ON s.id = e.subject_id
       WHERE e.id = :examId AND s.instructor_id = :userId`,
      { examId, userId: req.user.id }
    );
    if (!examRows.length) return res.status(404).json({ error: 'Exam not found.' });

    // Load the correct answers from the exam set (or exam questions)
    let correctAnswers;
    if (examSetId) {
      const [setQs] = await pool.query(
        `SELECT q.id, q.type, q.answer, q.options, esq.sort_order
         FROM exam_set_questions esq
         JOIN questions q ON q.id = esq.question_id
         WHERE esq.exam_set_id = :examSetId
         ORDER BY esq.sort_order ASC`,
        { examSetId }
      );
      correctAnswers = setQs;
    } else {
      const [examQs] = await pool.query(
        `SELECT q.id, q.type, q.answer, q.options, eq.sort_order
         FROM exam_questions eq
         JOIN questions q ON q.id = eq.question_id
         WHERE eq.exam_id = :examId
         ORDER BY eq.sort_order ASC`,
        { examId }
      );
      correctAnswers = examQs;
    }

    if (correctAnswers.length === 0) {
      return res.status(400).json({ error: 'No questions found for this exam/set.' });
    }

    // Find or create the student record
    let studentId = null;
    if (studentNumber || studentName) {
      // Try to find existing student by name + instructor
      const [existing] = await pool.query(
        `SELECT id FROM students
         WHERE instructor_id = :userId AND full_name = :name
         LIMIT 1`,
        { userId: req.user.id, name: studentName || 'Unknown' }
      );
      if (existing.length) {
        studentId = existing[0].id;
      } else {
        // Create new student record
        studentId = uuid();
        await pool.query(
          `INSERT INTO students (id, instructor_id, student_number, full_name)
           VALUES (:id, :userId, :studentNumber, :name)`,
          {
            id: studentId,
            userId: req.user.id,
            studentNumber: studentNumber || null,
            name: studentName || 'Unknown',
          }
        );
      }
    }

    // Compute per-item correctness
    let correctCount = 0;
    let ambiguousCount = 0;
    const scanAnswers = [];

    for (const ans of answers) {
      const idx = ans.itemNumber - 1;
      const question = correctAnswers[idx];
      if (!question) continue;

      const correctAnswer = normalizeAnswer(question.answer, question.type);
      const markedAnswer = normalizeAnswer(ans.markedAnswer, question.type);
      const isCorrect = markedAnswer && correctAnswer && markedAnswer === correctAnswer;
      const ambiguous = !!ans.ambiguous;

      if (isCorrect) correctCount++;
      if (ambiguous) ambiguousCount++;

      scanAnswers.push({
        itemNumber: ans.itemNumber,
        markedAnswer: ans.markedAnswer || null,
        correctAnswer: question.answer,
        isCorrect: isCorrect ? 1 : 0,
        ambiguous: ambiguous ? 1 : 0,
      });
    }

    // Check if any ambiguous answers need review
    const needsReview = ambiguousCount > 0 ? 1 : 0;
    const totalItems = correctAnswers.length;
    const score = totalItems > 0 ? (correctCount / totalItems * 100).toFixed(2) : 0;

    // Store the scan result
    const scanId = uuid();
    await pool.query(
      `INSERT INTO scan_results
         (id, exam_id, exam_set_id, student_id, student_name,
          total_items, correct_count, score, needs_review, scanned_by)
       VALUES (:id, :examId, :examSetId, :studentId, :studentName,
               :totalItems, :correctCount, :score, :needsReview, :scannedBy)`,
      {
        id: scanId,
        examId,
        examSetId: examSetId || null,
        studentId,
        studentName: studentName || null,
        totalItems,
        correctCount,
        score,
        needsReview,
        scannedBy: req.user.id,
      }
    );

    // Store per-item answers
    for (const sa of scanAnswers) {
      await pool.query(
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

    res.status(201).json({
      id: scanId,
      examId,
      studentName,
      totalItems,
      correctCount,
      score: parseFloat(score),
      needsReview,
      ambiguousCount,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/scans — list scan results for the authenticated instructor. */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { exam_id, needs_review } = req.query;

    let query = `
      SELECT sr.*, e.title AS exam_title
      FROM scan_results sr
      JOIN exams e ON e.id = sr.exam_id
      JOIN subjects s ON s.id = e.subject_id
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
    res.json({ scans: rows });
  } catch (err) {
    next(err);
  }
});

/** GET /api/scans/:id — single scan result with per-item breakdown. */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const scanId = req.params.id;

    // Ownership check
    const [scanRows] = await pool.query(
      `SELECT sr.*, e.title AS exam_title
       FROM scan_results sr
       JOIN exams e ON e.id = sr.exam_id
       JOIN subjects s ON s.id = e.subject_id
       WHERE sr.id = :scanId AND s.instructor_id = :userId`,
      { scanId, userId: req.user.id }
    );
    if (!scanRows.length) return res.status(404).json({ error: 'Scan result not found.' });

    const [answers] = await pool.query(
      `SELECT * FROM scan_answers WHERE scan_result_id = :scanId ORDER BY item_number ASC`,
      { scanId }
    );

    res.json({ scan: scanRows[0], answers });
  } catch (err) {
    next(err);
  }
});

/** POST /api/scans/:id/review — mark a scan as reviewed (instructor confirms). */
router.post('/:id/review', requireAuth, async (req, res, next) => {
  try {
    const scanId = req.params.id;
    const { correctedAnswers } = req.body;

    // Ownership check
    const [scanRows] = await pool.query(
      `SELECT sr.id FROM scan_results sr
       JOIN exams e ON e.id = sr.exam_id
       JOIN subjects s ON s.id = e.subject_id
       WHERE sr.id = :scanId AND s.instructor_id = :userId`,
      { scanId, userId: req.user.id }
    );
    if (!scanRows.length) return res.status(404).json({ error: 'Scan result not found.' });

    // If corrected answers are provided, update them
    if (Array.isArray(correctedAnswers)) {
      let correctCount = 0;
      for (const ca of correctedAnswers) {
        const [existing] = await pool.query(
          `SELECT correct_answer FROM scan_answers WHERE scan_result_id = :scanId AND item_number = :itemNumber`,
          { scanId, itemNumber: ca.itemNumber }
        );
        if (!existing.length) continue;

        const isCorrect = ca.markedAnswer === existing[0].correct_answer ? 1 : 0;
        if (isCorrect) correctCount++;

        await pool.query(
          `UPDATE scan_answers SET marked_answer = :markedAnswer, is_correct = :isCorrect, ambiguous = 0
           WHERE scan_result_id = :scanId AND item_number = :itemNumber`,
          {
            scanId,
            itemNumber: ca.itemNumber,
            markedAnswer: ca.markedAnswer,
            isCorrect,
          }
        );
      }

      // Update scan result
      const [totalRows] = await pool.query(
        `SELECT total_items FROM scan_results WHERE id = :scanId`,
        { scanId }
      );
      const totalItems = totalRows[0]?.total_items || 0;
      const score = totalItems > 0 ? (correctCount / totalItems * 100).toFixed(2) : 0;

      await pool.query(
        `UPDATE scan_results SET needs_review = 0, correct_count = :correctCount, score = :score WHERE id = :scanId`,
        { scanId, correctCount, score }
      );
    } else {
      await pool.query(
        `UPDATE scan_results SET needs_review = 0 WHERE id = :scanId`,
        { scanId }
      );
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** Normalize an answer string for comparison. */
function normalizeAnswer(answer, type) {
  if (!answer) return '';
  let a = String(answer).trim().toUpperCase();
  // For MCQ, strip "A) " prefix
  if (type === 'mcq') {
    a = a.replace(/^[A-Z][).]\s*/i, '');
    // If it's a single letter, keep it
    if (a.length === 1 && /[A-D]/.test(a)) return a;
  }
  if (type === 'true_false') {
    if (a.startsWith('T') || a === 'TRUE') return 'TRUE';
    if (a.startsWith('F') || a === 'FALSE') return 'FALSE';
  }
  return a;
}

export default router;
