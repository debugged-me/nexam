/**
 * Analytics routes — performance dashboards from OMR scan results.
 *
 * GET /api/analytics/exam/:examId     — exam-level analytics (class average, score distribution)
 * GET /api/analytics/exam/:examId/items — item-level response distributions
 * GET /api/analytics/overview         — instructor overview (all exams, recent scans)
 *
 * All routes require auth (JWT). Data is scoped to the instructor.
 */
import { Router } from 'express';
import pool from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { unprotectText } from '../services/storageCrypto.js';

const router = Router();

/**
 * Resolve a scanned item back to its question. Set scans use the set's own
 * ordering (Set B is shuffled); scans without a set fall back to the exam
 * ordering. Anything unresolvable is dropped from thematic roll-ups.
 */
const QUESTION_JOINS = `
  LEFT JOIN exam_set_questions esq
    ON sr.exam_set_id IS NOT NULL
   AND esq.exam_set_id = sr.exam_set_id
   AND esq.sort_order = sa.item_number
  LEFT JOIN exam_questions eq
    ON sr.exam_set_id IS NULL
   AND eq.exam_id = sr.exam_id
   AND eq.sort_order = sa.item_number
  JOIN questions q ON q.id = COALESCE(esq.question_id, eq.question_id)`;

/** Mastery per topic (theme) — optionally scoped to one exam. */
async function themeBreakdown(userId, examId = null) {
  const [rows] = await pool.query(
    `SELECT
       COALESCE(NULLIF(q.topic, ''), 'Uncategorized') AS topic,
       COUNT(*) AS responses,
       SUM(sa.is_correct) AS correct_count,
       COUNT(DISTINCT q.id) AS items,
       COUNT(DISTINCT sr.exam_id) AS exams
     FROM scan_answers sa
     JOIN scan_results sr ON sr.id = sa.scan_result_id
     JOIN exams e ON e.id = sr.exam_id
     JOIN subjects s ON s.id = e.subject_id
     ${QUESTION_JOINS}
     WHERE s.instructor_id = :userId ${examId ? 'AND sr.exam_id = :examId' : ''}
     GROUP BY topic
     ORDER BY (SUM(sa.is_correct) / COUNT(*)) ASC, responses DESC`,
    { userId, examId }
  );
  return rows.map((r) => ({
    ...r,
    correctRate: r.responses ? Number(((r.correct_count / r.responses) * 100).toFixed(1)) : 0,
  }));
}

/** Mastery per Bloom level — optionally scoped to one exam. */
async function bloomBreakdown(userId, examId = null) {
  const [rows] = await pool.query(
    `SELECT
       q.bloom,
       COUNT(*) AS responses,
       SUM(sa.is_correct) AS correct_count,
       COUNT(DISTINCT q.id) AS items
     FROM scan_answers sa
     JOIN scan_results sr ON sr.id = sa.scan_result_id
     JOIN exams e ON e.id = sr.exam_id
     JOIN subjects s ON s.id = e.subject_id
     ${QUESTION_JOINS}
     WHERE s.instructor_id = :userId ${examId ? 'AND sr.exam_id = :examId' : ''}
     GROUP BY q.bloom`,
    { userId, examId }
  );
  return rows.map((r) => ({
    ...r,
    correctRate: r.responses ? Number(((r.correct_count / r.responses) * 100).toFixed(1)) : 0,
  }));
}

/** GET /api/analytics/exam/:examId — exam-level analytics. */
router.get('/exam/:examId', requireAuth, async (req, res, next) => {
  try {
    const examId = req.params.examId;

    // Ownership check
    const [examRows] = await pool.query(
      `SELECT e.id, e.title
       FROM exams e
       JOIN subjects s ON s.id = e.subject_id
       WHERE e.id = :examId AND s.instructor_id = :userId`,
      { examId, userId: req.user.id }
    );
    if (!examRows.length) return res.status(404).json({ error: 'Exam not found.' });

    // Overall stats
    const [stats] = await pool.query(
      `SELECT
         COUNT(*) AS total_scans,
         AVG(score) AS avg_score,
         MIN(score) AS min_score,
         MAX(score) AS max_score,
         SUM(needs_review) AS needs_review_count,
         SUM(CASE WHEN score >= 75 THEN 1 ELSE 0 END) AS passing_count,
         SUM(CASE WHEN score < 75 THEN 1 ELSE 0 END) AS failing_count
       FROM scan_results
       WHERE exam_id = :examId`,
      { examId }
    );

    // Score distribution (histogram by 10-point bins)
    const [distribution] = await pool.query(
      `SELECT
         FLOOR(score / 10) * 10 AS bin_start,
         COUNT(*) AS count
       FROM scan_results
       WHERE exam_id = :examId
       GROUP BY bin_start
       ORDER BY bin_start ASC`,
      { examId }
    );

    // Individual student scores
    const [students] = await pool.query(
      `SELECT
         sr.id AS scan_id,
         sr.student_name,
         sr.student_id,
         sr.score,
         sr.correct_count,
         sr.total_items,
         sr.needs_review,
         sr.scanned_at,
         es.set_label
       FROM scan_results sr
       LEFT JOIN exam_sets es ON es.id = sr.exam_set_id
       WHERE sr.exam_id = :examId
       ORDER BY sr.score DESC`,
      { examId }
    );

    // Set A vs Set B comparison — parallel-form equivalence check
    const [setComparison] = await pool.query(
      `SELECT
         es.set_label,
         COUNT(sr.id) AS scans,
         AVG(sr.score) AS avg_score
       FROM scan_results sr
       JOIN exam_sets es ON es.id = sr.exam_set_id
       WHERE sr.exam_id = :examId
       GROUP BY es.set_label
       ORDER BY es.set_label ASC`,
      { examId }
    );

    const [themes, bloomLevels] = await Promise.all([
      themeBreakdown(req.user.id, examId),
      bloomBreakdown(req.user.id, examId),
    ]);

    res.json({
      exam: examRows[0],
      stats: stats[0] || {},
      distribution,
      students: students.map((student) => ({
        ...student,
        student_name: unprotectText(student.student_name),
      })),
      setComparison,
      themes,
      bloomLevels,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/analytics/exam/:examId/items — item-level response distributions. */
router.get('/exam/:examId/items', requireAuth, async (req, res, next) => {
  try {
    const examId = req.params.examId;

    // Ownership check
    const [examRows] = await pool.query(
      `SELECT e.id FROM exams e
       JOIN subjects s ON s.id = e.subject_id
       WHERE e.id = :examId AND s.instructor_id = :userId`,
      { examId, userId: req.user.id }
    );
    if (!examRows.length) return res.status(404).json({ error: 'Exam not found.' });

    // Item-level analysis — for each item, count how many got it right/wrong
    // and what answers were chosen (for MCQ distribution)
    const [items] = await pool.query(
      `SELECT
         sa.item_number,
         sa.correct_answer,
         COUNT(*) AS total_responses,
         SUM(sa.is_correct) AS correct_count,
         SUM(sa.ambiguous) AS ambiguous_count,
         SUM(CASE WHEN sa.is_correct = 0 AND sa.ambiguous = 0 THEN 1 ELSE 0 END) AS wrong_count
       FROM scan_answers sa
       JOIN scan_results sr ON sr.id = sa.scan_result_id
       WHERE sr.exam_id = :examId
       GROUP BY sa.item_number, sa.correct_answer
       ORDER BY sa.item_number ASC`,
      { examId }
    );

    // For each item, get the distribution of marked answers
    const itemAnalysis = [];
    for (const item of items) {
      const [answerDist] = await pool.query(
        `SELECT
           sa.marked_answer,
           COUNT(*) AS count
         FROM scan_answers sa
         JOIN scan_results sr ON sr.id = sa.scan_result_id
         WHERE sr.exam_id = :examId AND sa.item_number = :itemNumber
         GROUP BY sa.marked_answer
         ORDER BY count DESC`,
        { examId, itemNumber: item.item_number }
      );

      const total = item.total_responses || 1;
      itemAnalysis.push({
        itemNumber: item.item_number,
        correctAnswer: item.correct_answer,
        totalResponses: item.total_responses,
        correctCount: item.correct_count,
        wrongCount: item.wrong_count,
        ambiguousCount: item.ambiguous_count,
        correctRate: parseFloat(((item.correct_count / total) * 100).toFixed(1)),
        answerDistribution: answerDist,
        // Difficulty index: <30% = hard, 30-70% = medium, >70% = easy
        difficulty: item.correct_count / total < 0.3 ? 'hard' :
                    item.correct_count / total > 0.7 ? 'easy' : 'medium',
      });
    }

    res.json({ items: itemAnalysis });
  } catch (err) {
    next(err);
  }
});

/** GET /api/analytics/overview — instructor overview. */
router.get('/overview', requireAuth, async (req, res, next) => {
  try {
    // Total exams, scans, students for this instructor
    const [overview] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM exams e JOIN subjects s ON s.id = e.subject_id WHERE s.instructor_id = :userId) AS total_exams,
         (SELECT COUNT(*) FROM scan_results sr JOIN exams e ON e.id = sr.exam_id JOIN subjects s ON s.id = e.subject_id WHERE s.instructor_id = :userId) AS total_scans,
         (SELECT COUNT(*) FROM students WHERE instructor_id = :userId) AS total_students,
         (SELECT COUNT(*) FROM scan_results sr JOIN exams e ON e.id = sr.exam_id JOIN subjects s ON s.id = e.subject_id WHERE s.instructor_id = :userId AND sr.needs_review = 1) AS needs_review`,
      { userId: req.user.id }
    );

    // Recent scans
    const [recentScans] = await pool.query(
      `SELECT
         sr.id, sr.student_name, sr.score, sr.scanned_at,
         e.title AS exam_title
       FROM scan_results sr
       JOIN exams e ON e.id = sr.exam_id
       JOIN subjects s ON s.id = e.subject_id
       WHERE s.instructor_id = :userId
       ORDER BY sr.scanned_at DESC
       LIMIT 10`,
      { userId: req.user.id }
    );

    // Exam averages
    const [examAverages] = await pool.query(
      `SELECT
         e.id, e.title, s.name AS subject,
         COUNT(sr.id) AS scan_count,
         AVG(sr.score) AS avg_score,
         MIN(sr.score) AS min_score,
         MAX(sr.score) AS max_score
       FROM exams e
       JOIN subjects s ON s.id = e.subject_id
       LEFT JOIN scan_results sr ON sr.exam_id = e.id
       WHERE s.instructor_id = :userId
       GROUP BY e.id, e.title, s.name
       ORDER BY avg_score DESC
       LIMIT 10`,
      { userId: req.user.id }
    );

    // Score trend — one bucket per scan day, most recent 14
    const [scoreTrend] = await pool.query(
      `SELECT
         DATE(sr.scanned_at) AS day,
         COUNT(*) AS scans,
         AVG(sr.score) AS avg_score
       FROM scan_results sr
       JOIN exams e ON e.id = sr.exam_id
       JOIN subjects s ON s.id = e.subject_id
       WHERE s.instructor_id = :userId
       GROUP BY day
       ORDER BY day DESC
       LIMIT 14`,
      { userId: req.user.id }
    );

    // Items needing attention — lowest correct rate across all exams
    const [weakItems] = await pool.query(
      `SELECT
         MIN(sa.item_number) AS item_number,
         e.id AS exam_id,
         e.title AS exam_title,
         q.stem,
         COUNT(*) AS responses,
         SUM(sa.is_correct) AS correct_count
       FROM scan_answers sa
       JOIN scan_results sr ON sr.id = sa.scan_result_id
       JOIN exams e ON e.id = sr.exam_id
       JOIN subjects s ON s.id = e.subject_id
       ${QUESTION_JOINS}
       WHERE s.instructor_id = :userId
       GROUP BY e.id, e.title, q.id, q.stem
       HAVING responses >= 3
       ORDER BY (SUM(sa.is_correct) / COUNT(*)) ASC, responses DESC
       LIMIT 5`,
      { userId: req.user.id }
    );

    const [themes, bloomLevels] = await Promise.all([
      themeBreakdown(req.user.id),
      bloomBreakdown(req.user.id),
    ]);

    res.json({
      overview: overview[0] || {},
      recentScans: recentScans.map((scan) => ({
        ...scan,
        student_name: unprotectText(scan.student_name),
      })),
      examAverages,
      scoreTrend,
      weakItems: weakItems.map((w) => ({
        ...w,
        correctRate: w.responses ? Number(((w.correct_count / w.responses) * 100).toFixed(1)) : 0,
      })),
      themes,
      bloomLevels,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
