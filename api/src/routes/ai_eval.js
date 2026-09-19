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

/** Build a confusion matrix from rows of {ai_predicted_bloom, bloom}. */
function buildConfusionMatrix(rows) {
  if (!rows || rows.length === 0) {
    return {
      sampleSize: 0,
      classes: [],
      matrix: {},
      overall: { accuracy: 0, precision: 0, recall: 0, f1: 0 },
      perClass: [],
    };
  }

  const classSet = new Set();
  for (const r of rows) {
    classSet.add(r.ai_predicted_bloom);
    classSet.add(r.bloom);
  }
  const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
  const classes = BLOOM_ORDER.filter((b) => classSet.has(b));
  for (const b of [...classSet].sort()) {
    if (!classes.includes(b)) classes.push(b);
  }

  const matrix = {};
  for (const p of classes) {
    matrix[p] = {};
    for (const a of classes) matrix[p][a] = 0;
  }
  for (const r of rows) matrix[r.ai_predicted_bloom][r.bloom]++;

  const total = rows.length;
  const perClass = [];
  let totalTP = 0, totalFP = 0, totalFN = 0;

  for (const c of classes) {
    let tp = matrix[c][c];
    let fp = 0, fn = 0;
    for (const p of classes) {
      for (const a of classes) {
        if (p === c && a !== c) fp += matrix[p][a];
        if (a === c && p !== c) fn += matrix[p][a];
      }
    }
    const tn = total - tp - fp - fn;
    totalTP += tp; totalFP += fp; totalFN += fn;
    const accuracy  = total > 0 ? (tp + tn) / total : 0;
    const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
    const recall    = (tp + fn) > 0 ? tp / (tp + fn) : 0;
    const f1        = (precision + recall) > 0 ? 2 * precision * recall / (precision + recall) : 0;
    perClass.push({
      bloom: c, tp, fp, fn, tn,
      accuracy:  parseFloat(accuracy.toFixed(4)),
      precision: parseFloat(precision.toFixed(4)),
      recall:    parseFloat(recall.toFixed(4)),
      f1:        parseFloat(f1.toFixed(4)),
    });
  }

  const overallAccuracy  = total > 0 ? totalTP / total : 0;
  const overallPrecision = (totalTP + totalFP) > 0 ? totalTP / (totalTP + totalFP) : 0;
  const overallRecall    = (totalTP + totalFN) > 0 ? totalTP / (totalTP + totalFN) : 0;
  const overallF1        = (overallPrecision + overallRecall) > 0
    ? 2 * overallPrecision * overallRecall / (overallPrecision + overallRecall) : 0;

  return {
    sampleSize: total,
    classes,
    matrix,
    overall: {
      accuracy:  parseFloat(overallAccuracy.toFixed(4)),
      precision: parseFloat(overallPrecision.toFixed(4)),
      recall:    parseFloat(overallRecall.toFixed(4)),
      f1:        parseFloat(overallF1.toFixed(4)),
    },
    perClass,
  };
}

/** GET /api/ai-eval/summary — all metrics across components. */
router.get('/summary', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // ── Generation metrics ────────────────────────────
    const [genStats] = await pool.query(
      `SELECT
         COUNT(*) AS total_generated,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS approved,
         SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected_or_pending,
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
       WHERE created_by = :userId AND similarity_flag IS NOT NULL`,
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

    // ── Confusion matrix (Bloom classification accuracy) ─
    const [cmRows] = await pool.query(
      `SELECT ai_predicted_bloom, bloom
       FROM questions
       WHERE source = 'ai'
         AND created_by = :userId
         AND ai_predicted_bloom IS NOT NULL
         AND bloom IS NOT NULL
         AND status IN ('active', 'rejected')`,
      { userId }
    );

    const confusionMatrix = buildConfusionMatrix(cmRows);

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
      confusionMatrix,
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
         SUM(CASE WHEN q.status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
         SUM(CASE WHEN q.status = 'draft' THEN 1 ELSE 0 END) AS pending
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
       WHERE created_by = :userId AND similarity_flag IS NOT NULL
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

/** GET /api/ai-eval/confusion-matrix — Bloom classification accuracy.
 *
 * Compares the AI's predicted Bloom level (ai_predicted_bloom, set at
 * generation time) against the instructor's confirmed Bloom level (bloom,
 * which the instructor may edit during review).  Only questions that have
 * been reviewed (status = 'active' or explicitly rejected) are counted, so
 * draft questions still pending review are excluded.
 *
 * Returns per-class and overall Accuracy, Precision, Recall, and F1-Score
 * using the standard confusion-matrix formulas from the thesis scope.
 */
router.get('/confusion-matrix', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Only count reviewed AI questions where the instructor confirmed a Bloom
    // level (i.e. the question was approved → status='active').  Rejected
    // questions are also counted because the instructor's correction of the
    // Bloom level is still a valid ground-truth signal.
    const [rows] = await pool.query(
      `SELECT ai_predicted_bloom, bloom
       FROM questions
       WHERE source = 'ai'
         AND created_by = :userId
         AND ai_predicted_bloom IS NOT NULL
         AND bloom IS NOT NULL
         AND status IN ('active', 'rejected')`,
      { userId }
    );

    if (rows.length === 0) {
      return res.json({
        sampleSize: 0,
        classes: [],
        matrix: {},
        overall: { accuracy: 0, precision: 0, recall: 0, f1: 0 },
        perClass: [],
      });
    }

    // Collect the set of Bloom levels present (union of predicted + actual).
    const classSet = new Set();
    for (const r of rows) {
      classSet.add(r.ai_predicted_bloom);
      classSet.add(r.bloom);
    }
    // Canonical Bloom order — only levels that appear in the data.
    const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
    const classes = BLOOM_ORDER.filter((b) => classSet.has(b));
    // Include any unexpected levels at the end, sorted.
    for (const b of [...classSet].sort()) {
      if (!classes.includes(b)) classes.push(b);
    }

    // Build the confusion matrix: matrix[predicted][actual] = count.
    const matrix = {};
    for (const p of classes) {
      matrix[p] = {};
      for (const a of classes) matrix[p][a] = 0;
    }
    for (const r of rows) {
      matrix[r.ai_predicted_bloom][r.bloom]++;
    }

    // Per-class metrics.  For each class C:
    //   TP = matrix[C][C]
    //   FP = sum(matrix[C][*]) - TP          (predicted C but actually something else)
    //   FN = sum(matrix[*][C]) - TP          (actually C but predicted something else)
    //   TN = total - TP - FP - FN
    const total = rows.length;
    const perClass = [];
    for (const c of classes) {
      let tp = matrix[c][c];
      let fp = 0;
      let fn = 0;
      for (const p of classes) {
        for (const a of classes) {
          if (p === c && a !== c) fp += matrix[p][a];
          if (a === c && p !== c) fn += matrix[p][a];
        }
      }
      const tn = total - tp - fp - fn;
      const accuracy  = total > 0 ? (tp + tn) / total : 0;
      const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
      const recall    = (tp + fn) > 0 ? tp / (tp + fn) : 0;
      const f1        = (precision + recall) > 0 ? 2 * precision * recall / (precision + recall) : 0;
      perClass.push({
        bloom: c,
        tp, fp, fn, tn,
        accuracy:  parseFloat(accuracy.toFixed(4)),
        precision: parseFloat(precision.toFixed(4)),
        recall:    parseFloat(recall.toFixed(4)),
        f1:        parseFloat(f1.toFixed(4)),
      });
    }

    // Overall metrics (micro-averaged).
    let totalTP = 0, totalFP = 0, totalFN = 0;
    for (const c of classes) {
      totalTP += matrix[c][c];
      for (const p of classes) {
        for (const a of classes) {
          if (p === c && a !== c) totalFP += matrix[p][a];
          if (a === c && p !== c) totalFN += matrix[p][a];
        }
      }
    }
    const totalTN = total * classes.length - totalTP - totalFP - totalFN;
    const overallAccuracy  = total > 0 ? totalTP / total : 0;
    const overallPrecision = (totalTP + totalFP) > 0 ? totalTP / (totalTP + totalFP) : 0;
    const overallRecall    = (totalTP + totalFN) > 0 ? totalTP / (totalTP + totalFN) : 0;
    const overallF1        = (overallPrecision + overallRecall) > 0
      ? 2 * overallPrecision * overallRecall / (overallPrecision + overallRecall)
      : 0;

    res.json({
      sampleSize: total,
      classes,
      matrix,
      overall: {
        accuracy:  parseFloat(overallAccuracy.toFixed(4)),
        precision: parseFloat(overallPrecision.toFixed(4)),
        recall:    parseFloat(overallRecall.toFixed(4)),
        f1:        parseFloat(overallF1.toFixed(4)),
      },
      perClass,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
