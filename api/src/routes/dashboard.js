/**
 * Dashboard API route — returns the KPI summary for the authenticated
 * instructor's home screen in the shape consumed by the React dashboard.
 *
 * Ownership mapping:
 *   - subjects:   instructor_id = user_id
 *   - materials:  created_by = user_id
 *   - questions:  created_by = user_id
 *   - exams:      created_by = user_id
 *   - tos:        scoped via subject_id → subjects.instructor_id
 *
 * GET /api/dashboard — { stats, deltas, bloom, bank, examStatus, blueprint, recent }
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import pool from '../config/db.js';

const router = Router();

const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
const HISTORY_DAYS = 180;

/** Percentage change between two period counts. */
function delta(current, previous) {
  let pct, dir;
  if (previous > 0) {
    pct = Math.round(((current - previous) / previous) * 100);
    dir = pct > 0 ? 'up' : (pct < 0 ? 'down' : 'flat');
  } else if (current > 0) {
    pct = 100; dir = 'up';
  } else {
    pct = 0; dir = 'flat';
  }
  return { current, previous, pct: Math.abs(pct), dir };
}

function fmt(d) {
  return (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 19).replace('T', ' ');
}
function fmtDay(d) {
  return (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // ── Totals ─────────────────────────────────────────
    // subjects uses instructor_id; tos is scoped via subject join.
    const [[sSubj], [sMat], [sQ], [sTos], [sExam]] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS n FROM subjects WHERE instructor_id = :uid`, { uid: userId }),
      pool.query(`SELECT COUNT(*) AS n FROM materials WHERE created_by = :uid`, { uid: userId }),
      pool.query(`SELECT COUNT(*) AS n FROM questions WHERE created_by = :uid`, { uid: userId }),
      pool.query(
        `SELECT COUNT(*) AS n FROM tos t JOIN subjects s ON s.id = t.subject_id WHERE s.instructor_id = :uid`,
        { uid: userId }
      ),
      pool.query(`SELECT COUNT(*) AS n FROM exams WHERE created_by = :uid`, { uid: userId }),
    ]);

    const stats = {
      subjects: sSubj[0].n,
      materials: sMat[0].n,
      questions: sQ[0].n,
      tos: sTos[0].n,
      exams: sExam[0].n,
    };

    // ── 30-day deltas ─────────────────────────────────
    const now = new Date();
    const winStart = new Date(now.getTime() - 29 * 86400000);
    const prevStart = new Date(now.getTime() - 59 * 86400000);
    const winS = fmt(winStart), prevS = fmt(prevStart);

    const [dSubj] = await pool.query(
      `SELECT
         SUM(CASE WHEN created_at >= :win THEN 1 ELSE 0 END) AS cur,
         SUM(CASE WHEN created_at >= :prev AND created_at < :win THEN 1 ELSE 0 END) AS prev
       FROM subjects WHERE instructor_id = :uid`,
      { win: winS, prev: prevS, uid: userId }
    );
    const [dQ] = await pool.query(
      `SELECT
         SUM(CASE WHEN created_at >= :win THEN 1 ELSE 0 END) AS cur,
         SUM(CASE WHEN created_at >= :prev AND created_at < :win THEN 1 ELSE 0 END) AS prev
       FROM questions WHERE created_by = :uid`,
      { win: winS, prev: prevS, uid: userId }
    );
    const [dTos] = await pool.query(
      `SELECT
         SUM(CASE WHEN t.created_at >= :win THEN 1 ELSE 0 END) AS cur,
         SUM(CASE WHEN t.created_at >= :prev AND t.created_at < :win THEN 1 ELSE 0 END) AS prev
       FROM tos t JOIN subjects s ON s.id = t.subject_id WHERE s.instructor_id = :uid`,
      { win: winS, prev: prevS, uid: userId }
    );
    const [dExam] = await pool.query(
      `SELECT
         SUM(CASE WHEN created_at >= :win THEN 1 ELSE 0 END) AS cur,
         SUM(CASE WHEN created_at >= :prev AND created_at < :win THEN 1 ELSE 0 END) AS prev
       FROM exams WHERE created_by = :uid`,
      { win: winS, prev: prevS, uid: userId }
    );

    const deltas = {
      subjects: delta(dSubj[0].cur || 0, dSubj[0].prev || 0),
      questions: delta(dQ[0].cur || 0, dQ[0].prev || 0),
      tos: delta(dTos[0].cur || 0, dTos[0].prev || 0),
      exams: delta(dExam[0].cur || 0, dExam[0].prev || 0),
    };

    // ── Bloom coverage ────────────────────────────────
    const [bloomRows] = await pool.query(
      `SELECT bloom, COUNT(*) AS n FROM questions WHERE created_by = :uid GROUP BY bloom`,
      { uid: userId }
    );
    const bloomRaw = {};
    for (const r of bloomRows) bloomRaw[r.bloom] = r.n;
    const bloom = {};
    let unclassified = 0;
    for (const level of BLOOM_LEVELS) bloom[level] = bloomRaw[level] || 0;
    for (const [k, v] of Object.entries(bloomRaw)) {
      if (!BLOOM_LEVELS.includes(k)) unclassified += v;
    }

    // ── Question bank readiness ─────────────────────
    const [qStatus] = await pool.query(
      `SELECT status, COUNT(*) AS n FROM questions WHERE created_by = :uid GROUP BY status`,
      { uid: userId }
    );
    const qMap = {};
    for (const r of qStatus) qMap[r.status] = r.n;
    const approved = qMap.active || 0;
    const draft = qMap.draft || 0;
    const rejected = qMap.rejected || 0;
    const other = Math.max(0, stats.questions - approved - draft - rejected);
    const bank = {
      approved, draft, rejected, other, total: stats.questions,
      readyPct: stats.questions > 0 ? Math.round((approved / stats.questions) * 100) : 0,
    };

    // ── Exam pipeline ────────────────────────────────
    const [eStatus] = await pool.query(
      `SELECT status, COUNT(*) AS n FROM exams WHERE created_by = :uid GROUP BY status`,
      { uid: userId }
    );
    const eMap = {};
    for (const r of eStatus) eMap[r.status] = r.n;
    const examStatus = {
      published: eMap.published || 0,
      draft: eMap.draft || 0,
    };

    // ── Blueprint capacity ───────────────────────────
    const [plannedRow] = await pool.query(
      `SELECT COALESCE(SUM(t.total_items), 0) AS planned
       FROM tos t JOIN subjects s ON s.id = t.subject_id WHERE s.instructor_id = :uid`,
      { uid: userId }
    );
    const planned = plannedRow[0].planned;
    const blueprint = {
      planned,
      onHand: stats.questions,
      fillPct: planned > 0 ? Math.min(100, Math.round((stats.questions / planned) * 100)) : 0,
    };

    // ── Recent subjects + exams ──────────────────────
    const [recentSubjects] = await pool.query(
      `SELECT id, code, name AS title, created_at FROM subjects WHERE instructor_id = :uid
       ORDER BY created_at DESC LIMIT 5`,
      { uid: userId }
    );
    const [subjCounts] = await pool.query(
      `SELECT subject_id, COUNT(*) AS n FROM questions WHERE created_by = :uid GROUP BY subject_id`,
      { uid: userId }
    );
    const subjCountMap = {};
    for (const r of subjCounts) subjCountMap[r.subject_id] = r.n;
    for (const s of recentSubjects) s.question_count = subjCountMap[s.id] || 0;

    const [recentExams] = await pool.query(
      `SELECT e.id, e.title, e.status, e.subject_id, s.name AS subject_name,
              (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = e.id) AS total_items,
              e.created_at
       FROM exams e
       LEFT JOIN subjects s ON s.id = e.subject_id
       WHERE e.created_by = :uid
       ORDER BY e.created_at DESC LIMIT 5`,
      { uid: userId }
    );

    // ── Drafts waiting on review ─────────────────────
    const [recentDrafts] = await pool.query(
      `SELECT q.id, LEFT(q.stem, 180) AS stem, q.type, s.name AS subject_name, q.created_at
       FROM questions q
       LEFT JOIN subjects s ON s.id = q.subject_id
       WHERE q.created_by = :uid AND q.status = 'draft'
       ORDER BY q.created_at DESC LIMIT 3`,
      { uid: userId }
    );

    // ── Signals for the "Next up" queue ─────────────
    // Scanned sheets flagged for review — graded results stay provisional
    // until someone confirms them, so these lead the queue.
    const [pendingScans] = await pool.query(
      `SELECT e.id AS exam_id, e.title AS exam_title, COUNT(*) AS n
       FROM scan_results sr
       JOIN exams e ON e.id = sr.exam_id
       WHERE e.created_by = :uid AND sr.needs_review = 1
       GROUP BY e.id, e.title
       ORDER BY n DESC, e.title ASC`,
      { uid: userId }
    );

    // Named blueprint gaps — finalized TOS whose banked (linked, live)
    // question count is short of its item target. Same linkage rules the
    // generation worker uses to compute coverage.
    const [gapTos] = await pool.query(
      `SELECT t.id, t.title, t.total_items,
         COALESCE(banked.n, 0) AS banked
       FROM tos t
       JOIN subjects s ON s.id = t.subject_id
       LEFT JOIN (
         SELECT links.tos_id, COUNT(DISTINCT links.question_id) AS n
         FROM (
           SELECT q.id AS question_id, q.tos_id AS tos_id FROM questions q
           WHERE q.created_by = :uid AND q.tos_id IS NOT NULL
             AND q.status <> 'rejected'
             AND (q.similarity_flag IS NULL OR q.similarity_flag <> 'rejected')
           UNION
           SELECT qt.question_id, qt.tos_id FROM question_tos qt
           JOIN questions q ON q.id = qt.question_id
           WHERE q.created_by = :uid
             AND q.status <> 'rejected'
             AND (q.similarity_flag IS NULL OR q.similarity_flag <> 'rejected')
         ) links
         GROUP BY links.tos_id
       ) banked ON banked.tos_id = t.id
       WHERE s.instructor_id = :uid AND t.status = 'finalized'
       HAVING banked < t.total_items
       ORDER BY (t.total_items - banked) DESC, t.title ASC
       LIMIT 3`,
      { uid: userId }
    );

    // Draft exams that already have questions — assembled and ready to publish.
    const [readyExams] = await pool.query(
      `SELECT e.id, e.title, COUNT(eq.question_id) AS items
       FROM exams e
       JOIN exam_questions eq ON eq.exam_id = e.id
       WHERE e.created_by = :uid AND e.status = 'draft'
       GROUP BY e.id, e.title
       ORDER BY e.created_at DESC
       LIMIT 2`,
      { uid: userId }
    );

    // Background work still in flight (informational — the jobs badge carries it).
    const [[jobRow]] = await pool.query(
      `SELECT COUNT(*) AS n FROM ai_jobs
       WHERE user_id = :uid AND status IN ('queued', 'running')`,
      { uid: userId }
    );

    // Weak items — questions students keep missing (mirrors the
    // /analytics/attention criteria: ≥3 responses, under 50% correct).
    const [[weakRow]] = await pool.query(
      `SELECT COUNT(*) AS n FROM (
         SELECT q.id
         FROM scan_answers sa
         JOIN scan_results sr ON sr.id = sa.scan_result_id
         JOIN exams e ON e.id = sr.exam_id
         JOIN subjects s ON s.id = e.subject_id
         LEFT JOIN exam_set_questions esq
           ON sr.exam_set_id IS NOT NULL
          AND esq.exam_set_id = sr.exam_set_id
          AND esq.sort_order = sa.item_number
         LEFT JOIN exam_questions eq
           ON sr.exam_set_id IS NULL
          AND eq.exam_id = sr.exam_id
          AND eq.sort_order = sa.item_number
         JOIN questions q ON q.id = COALESCE(esq.question_id, eq.question_id)
         WHERE s.instructor_id = :uid
         GROUP BY q.id
         HAVING COUNT(*) >= 3 AND SUM(sa.is_correct) / COUNT(*) < 0.5
       ) weak`,
      { uid: userId }
    );

    // ── Daily activity series ────────────────────────
    const from = new Date(now.getTime() - (HISTORY_DAYS - 1) * 86400000);
    const [qDaily] = await pool.query(
      `SELECT DATE(created_at) AS d, COUNT(*) AS n FROM questions
       WHERE created_by = :uid AND created_at >= :from GROUP BY DATE(created_at)`,
      { uid: userId, from: fmt(from) }
    );
    const [eDaily] = await pool.query(
      `SELECT DATE(created_at) AS d, COUNT(*) AS n FROM exams
       WHERE created_by = :uid AND created_at >= :from GROUP BY DATE(created_at)`,
      { uid: userId, from: fmt(from) }
    );
    const qDailyMap = {};
    for (const r of qDaily) qDailyMap[fmtDay(r.d)] = r.n;
    const eDailyMap = {};
    for (const r of eDaily) eDailyMap[fmtDay(r.d)] = r.n;
    const series = [];
    for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = fmtDay(d);
      series.push({
        d: key,
        l: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        q: qDailyMap[key] || 0,
        e: eDailyMap[key] || 0,
      });
    }

    res.json({
      stats, deltas, bloom, bloomUnclassified: unclassified,
      bloomCovered: Object.values(bloom).filter(Boolean).length,
      bank, examStatus, blueprint,
      recentSubjects, recentExams, recentDrafts, series,
      signals: {
        pendingScans,
        gapTos,
        readyExams,
        weakItems: weakRow?.n || 0,
        runningJobs: jobRow?.n || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
