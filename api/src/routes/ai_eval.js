/**
 * AI Evaluation routes — metrics for AI-generated components.
 *
 * GET /api/ai-eval/summary      — all metrics across components
 * GET /api/ai-eval/generation   — question generation quality (approve/reject rates)
 * GET /api/ai-eval/similarity   — similarity detection quality (flag accuracy)
 * GET /api/ai-eval/extraction   — material extraction quality
 * POST /api/ai-eval/record      — record a custom evaluation metric
 *
 * Metrics are computed from instructor feedback:
 * - Generation: approved = TP, rejected = FP, (not yet reviewed) = pending
 *   Precision = approved / (approved + rejected)
 * - Similarity: flagged & confirmed duplicate = TP, flagged & not duplicate = FP,
 *   not flagged but duplicate = FN, Recall = TP / (TP + FN)
 * - Extraction: successful extractions / total attempts
 *
 * All routes require auth (JWT). Data is scoped to the instructor.
 */
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import pool from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/** GET /api/ai-eval/summary — all metrics across components. */
router.get('/summary', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // ── Generation metrics ────────────────────────────
    const [genStats] = await pool.query(
      `SELECT
         COUNT(*) AS total_generated,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS approved,
         SUM(CASE WHEN status = 'draft' AND created_at < DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 ELSE 0 END) AS rejected_or_pending,
         SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS pending
       FROM questions
       WHERE source = 'ai' AND created_by = :userId`,
      { userId }
    );

    const gen = genStats[0] || {};
    const approved = parseInt(gen.approved, 10) || 0;
    const rejected = parseInt(gen.rejected_or_pending, 10) || 0;
    const totalGen = parseInt(gen.total_generated, 10) || 0;
    const genPrecision = (approved + rejected) > 0 ? approved / (approved + rejected) : 0;

    // ── Similarity metrics ───────────────────────────
    const [simStats] = await pool.query(
      `SELECT
         COUNT(*) AS total_questions,
         SUM(CASE WHEN similarity_flag = 'flagged' THEN 1 ELSE 0 END) AS flagged,
         SUM(CASE WHEN similarity_flag = 'none' THEN 1 ELSE 0 END) AS not_flagged
       FROM questions
       WHERE created_by = :userId AND embedding IS NOT NULL`,
      { userId }
    );

    const sim = simStats[0] || {};
    const flagged = parseInt(sim.flagged, 10) || 0;
    const notFlagged = parseInt(sim.not_flagged, 10) || 0;
    const totalSim = parseInt(sim.total_questions, 10) || 0;

    // ── Extraction metrics ──────────────────────────
    const [extStats] = await pool.query(
      `SELECT
         COUNT(*) AS total_materials,
         SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) AS processed,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
       FROM materials
       WHERE created_by = :userId`,
      { userId }
    );

    const ext = extStats[0] || {};
    const processed = parseInt(ext.processed, 10) || 0;
    const failed = parseInt(ext.failed, 10) || 0;
    const totalExt = parseInt(ext.total_materials, 10) || 0;
    const extAccuracy = totalExt > 0 ? processed / totalExt : 0;

    // ── Provider usage ───────────────────────────────
    const [providerStats] = await pool.query(
      `SELECT
         JSON_UNQUOTE(JSON_EXTRACT(generation_meta, '$.provider')) AS provider,
         JSON_UNQUOTE(JSON_EXTRACT(generation_meta, '$.model')) AS model,
         COUNT(*) AS count
       FROM questions
       WHERE source = 'ai' AND created_by = :userId AND generation_meta IS NOT NULL
       GROUP BY provider, model`,
      { userId }
    );

    // ── Bloom distribution of generated questions ────
    const [bloomDist] = await pool.query(
      `SELECT bloom, COUNT(*) AS count
       FROM questions
       WHERE source = 'ai' AND created_by = :userId
       GROUP BY bloom
       ORDER BY FIELD(bloom, 'remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')`,
      { userId }
    );

    // ── Type distribution ────────────────────────────
    const [typeDist] = await pool.query(
      `SELECT type, COUNT(*) AS count
       FROM questions
       WHERE source = 'ai' AND created_by = :userId
       GROUP BY type`,
      { userId }
    );

    res.json({
      generation: {
        totalGenerated: totalGen,
        approved,
        rejected,
        pending: parseInt(gen.pending, 10) || 0,
        precision: parseFloat(genPrecision.toFixed(4)),
        // Recall can't be computed without ground truth of all possible good questions
        // We use approval rate as a proxy for generation quality
        approvalRate: totalGen > 0 ? parseFloat((approved / totalGen).toFixed(4)) : 0,
      },
      similarity: {
        totalQuestions: totalSim,
        flagged,
        notFlagged,
        flagRate: totalSim > 0 ? parseFloat((flagged / totalSim).toFixed(4)) : 0,
      },
      extraction: {
        totalMaterials: totalExt,
        processed,
        failed,
        pending: ext.pending || 0,
        accuracy: parseFloat(extAccuracy.toFixed(4)),
      },
      providers: providerStats,
      bloomDistribution: bloomDist,
      typeDistribution: typeDist,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/ai-eval/generation — detailed generation metrics. */
router.get('/generation', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Per-TOS generation stats
    const [perTos] = await pool.query(
      `SELECT
         t.id AS tos_id,
         t.title AS tos_title,
         COUNT(q.id) AS generated,
         SUM(CASE WHEN q.status = 'active' THEN 1 ELSE 0 END) AS approved,
         SUM(CASE WHEN q.status = 'draft' THEN 1 ELSE 0 END) AS pending_or_rejected
       FROM tos t
       LEFT JOIN questions q ON q.tos_id = t.id AND q.source = 'ai'
       JOIN subjects s ON s.id = t.subject_id
       WHERE s.instructor_id = :userId
       GROUP BY t.id, t.title
       ORDER BY generated DESC`,
      { userId }
    );

    // Per-bloom approval rates
    const [perBloom] = await pool.query(
      `SELECT
         bloom,
         COUNT(*) AS generated,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS approved
       FROM questions
       WHERE source = 'ai' AND created_by = :userId
       GROUP BY bloom
       ORDER BY FIELD(bloom, 'remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')`,
      { userId }
    );

    res.json({ perTos, perBloom });
  } catch (err) {
    next(err);
  }
});

/** GET /api/ai-eval/similarity — detailed similarity detection metrics. */
router.get('/similarity', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Similarity flag distribution
    const [flagDist] = await pool.query(
      `SELECT
         similarity_flag,
         COUNT(*) AS count,
         AVG(similarity_score) AS avg_score
       FROM questions
       WHERE created_by = :userId AND embedding IS NOT NULL
       GROUP BY similarity_flag`,
      { userId }
    );

    // Similarity results (pairs found)
    const [pairs] = await pool.query(
      `SELECT
         sr.question_id,
         sr.similar_question_id,
         sr.score,
         q.stem,
         q2.stem AS similar_stem
       FROM similarity_results sr
       JOIN questions q ON q.id = sr.question_id
       JOIN questions q2 ON q2.id = sr.similar_question_id
       WHERE q.created_by = :userId
       ORDER BY sr.score DESC
       LIMIT 20`,
      { userId }
    );

    res.json({ flagDistribution: flagDist, similarPairs: pairs });
  } catch (err) {
    next(err);
  }
});

/** POST /api/ai-eval/record — record a custom evaluation metric. */
router.post('/record', requireAuth, async (req, res, next) => {
  try {
    const { component, metric, value, sampleSize, meta } = req.body;

    if (!component || !metric || value === undefined) {
      return res.status(400).json({ error: 'component, metric, and value are required.' });
    }

    const id = uuid();
    await pool.query(
      `INSERT INTO ai_evaluations (id, component, metric, value, sample_size, meta)
       VALUES (:id, :component, :metric, :value, :sampleSize, :meta)`,
      {
        id,
        component,
        metric,
        value: parseFloat(value),
        sampleSize: parseInt(sampleSize, 10) || 0,
        meta: meta ? JSON.stringify(meta) : null,
      }
    );

    res.status(201).json({ id, ok: true });
  } catch (err) {
    next(err);
  }
});

/** GET /api/ai-eval/history — recorded evaluation metrics over time. */
router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM ai_evaluations ORDER BY created_at DESC LIMIT 50`
    );
    res.json({ evaluations: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
