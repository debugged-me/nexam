/**
 * AI Evaluation routes — metrics for AI-generated components.
 *
 * GET /api/ai-eval/summary      — all metrics across components
 * GET /api/ai-eval/generation   — question generation quality (approve/reject rates)
 * GET /api/ai-eval/similarity   — similarity detection quality (flag accuracy)
 * GET /api/ai-eval/extraction   — material extraction quality
 * POST /api/ai-eval/record      — record a custom evaluation metric
 *
 * Review acceptance and processing success are operational rates, not AI
 * accuracy. Bloom Accuracy, Precision, Recall and F1 use a separate explicit
 * instructor/SME ground-truth label so approval gates cannot manufacture
 * agreement with the independent AI classification.
 *
 * All routes require auth (JWT). Data is scoped to the instructor.
 */
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import pool from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { BLOOM_LEVELS } from '../services/objectiveBlueprint.js';
import { QUALITY_VERSION } from '../services/questionQuality.js';

const router = Router();

/** Build a confusion matrix from rows of {ai_predicted_bloom, bloom}. */
export function buildConfusionMatrix(rows) {
  if (!rows || rows.length === 0) {
    return {
      sampleSize: 0,
      classes: [],
      matrix: {},
      overall: { accuracy: 0, precision: 0, recall: 0, f1: 0 },
      macro: { accuracy: 0, precision: 0, recall: 0, f1: 0 },
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
  const macro = perClass.reduce((totals, row) => ({
    accuracy: totals.accuracy + row.accuracy,
    precision: totals.precision + row.precision,
    recall: totals.recall + row.recall,
    f1: totals.f1 + row.f1,
  }), { accuracy: 0, precision: 0, recall: 0, f1: 0 });
  const classCount = perClass.length || 1;

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
    macro: {
      accuracy: parseFloat((macro.accuracy / classCount).toFixed(4)),
      precision: parseFloat((macro.precision / classCount).toFixed(4)),
      recall: parseFloat((macro.recall / classCount).toFixed(4)),
      f1: parseFloat((macro.f1 / classCount).toFixed(4)),
    },
    perClass,
  };
}

async function loadBloomEvaluation(userId) {
  const [rows] = await pool.query(
    `SELECT ai_predicted_bloom, sme_bloom AS bloom
     FROM questions
     WHERE source = "ai"
       AND created_by = :userId
       AND ai_predicted_bloom IS NOT NULL
       AND sme_bloom IS NOT NULL
       AND JSON_EXTRACT(generation_meta, "$.quality.version") = :qualityVersion`,
    { userId, qualityVersion: QUALITY_VERSION }
  );
  return rows;
}

async function loadEvaluationQuestions(userId) {
  const [rows] = await pool.query(
    `SELECT q.id, q.stem, q.options, q.topic, q.type, q.status, q.sme_bloom, q.sme_labeled_at,
            CASE WHEN q.sme_bloom IS NULL THEN NULL ELSE q.ai_predicted_bloom END AS ai_predicted_bloom,
            s.name AS subject_name
     FROM questions q
     JOIN subjects s ON s.id = q.subject_id
     WHERE q.source = "ai"
       AND q.created_by = :userId
       AND s.instructor_id = :userId
       AND q.ai_predicted_bloom IS NOT NULL
       AND JSON_EXTRACT(q.generation_meta, "$.quality.version") = :qualityVersion
     ORDER BY q.sme_bloom IS NULL DESC, q.created_at DESC
     LIMIT 200`,
    { userId, qualityVersion: QUALITY_VERSION }
  );
  return rows.map((question) => {
    let options = [];
    if (question.options) {
      try { options = JSON.parse(question.options); } catch { options = []; }
    }
    return { ...question, options };
  });
}

async function loadEvaluationCounts(userId) {
  const [[counts]] = await pool.query(
    `SELECT COUNT(*) AS eligible_count,
            SUM(CASE WHEN q.sme_bloom IS NULL THEN 1 ELSE 0 END) AS unlabeled_count
     FROM questions q
     JOIN subjects s ON s.id = q.subject_id
     WHERE q.source = "ai"
       AND q.created_by = :userId
       AND s.instructor_id = :userId
       AND q.ai_predicted_bloom IS NOT NULL
       AND JSON_EXTRACT(q.generation_meta, "$.quality.version") = :qualityVersion`,
    { userId, qualityVersion: QUALITY_VERSION }
  );
  return {
    eligibleCount: Number(counts?.eligible_count || 0),
    unlabeledCount: Number(counts?.unlabeled_count || 0),
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
         SUM(CASE WHEN status = "active" THEN 1 ELSE 0 END) AS approved,
         SUM(CASE WHEN status = "rejected" THEN 1 ELSE 0 END) AS rejected_or_pending,
         SUM(CASE WHEN status = "draft" THEN 1 ELSE 0 END) AS pending
       FROM questions
       WHERE source = "ai" AND created_by = :userId`,
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
         SUM(CASE WHEN similarity_flag = "flagged" THEN 1 ELSE 0 END) AS flagged,
         SUM(CASE WHEN similarity_flag = "none" THEN 1 ELSE 0 END) AS not_flagged
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
         SUM(CASE WHEN status = "processed" THEN 1 ELSE 0 END) AS processed,
         SUM(CASE WHEN status = "failed" THEN 1 ELSE 0 END) AS failed,
         SUM(CASE WHEN status = "pending" THEN 1 ELSE 0 END) AS pending
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
         JSON_UNQUOTE(JSON_EXTRACT(generation_meta, "$.provider")) AS provider,
         JSON_UNQUOTE(JSON_EXTRACT(generation_meta, "$.model")) AS model,
         COUNT(*) AS count
       FROM questions
       WHERE source = "ai" AND created_by = :userId AND generation_meta IS NOT NULL
       GROUP BY provider, model`,
      { userId }
    );

    // ── Bloom distribution of generated questions ────
    const [bloomDist] = await pool.query(
      `SELECT bloom, COUNT(*) AS count
       FROM questions
       WHERE source = "ai" AND created_by = :userId
       GROUP BY bloom
       ORDER BY FIELD(bloom, "remember", "understand", "apply", "analyze", "evaluate", "create")`,
      { userId }
    );

    // ── Type distribution ────────────────────────────
    const [typeDist] = await pool.query(
      `SELECT type, COUNT(*) AS count
       FROM questions
       WHERE source = "ai" AND created_by = :userId
       GROUP BY type`,
      { userId }
    );

    // ── Confusion matrix (Bloom classification accuracy) ─
    const cmRows = await loadBloomEvaluation(userId);
    const evaluationQuestions = await loadEvaluationQuestions(userId);
    const evaluationCounts = await loadEvaluationCounts(userId);
    const confusionMatrix = {
      ...buildConfusionMatrix(cmRows),
      ...evaluationCounts,
      qualityVersion: QUALITY_VERSION,
      groundTruth: 'explicit_sme',
    };

    res.json({
      generation: {
        totalGenerated: totalGen,
        approved,
        rejected,
        pending: parseInt(gen.pending, 10) || 0,
        reviewAcceptanceRate: parseFloat(genPrecision.toFixed(4)),
        precision: parseFloat(genPrecision.toFixed(4)), // Legacy API alias; not factual accuracy.
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
        processingSuccessRate: parseFloat(extAccuracy.toFixed(4)),
        accuracy: parseFloat(extAccuracy.toFixed(4)), // Legacy API alias; measures completion only.
      },
      providers: providerStats,
      bloomDistribution: bloomDist,
      typeDistribution: typeDist,
      confusionMatrix,
      evaluationQuestions,
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
         SUM(CASE WHEN q.status = "active" THEN 1 ELSE 0 END) AS approved,
         SUM(CASE WHEN q.status = "rejected" THEN 1 ELSE 0 END) AS rejected,
         SUM(CASE WHEN q.status = "draft" THEN 1 ELSE 0 END) AS pending
       FROM tos t
       LEFT JOIN questions q ON q.tos_id = t.id AND q.source = "ai"
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
         SUM(CASE WHEN status = "active" THEN 1 ELSE 0 END) AS approved
       FROM questions
       WHERE source = "ai" AND created_by = :userId
       GROUP BY bloom
       ORDER BY FIELD(bloom, "remember", "understand", "apply", "analyze", "evaluate", "create")`,
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
      `INSERT INTO ai_evaluations (id, component, metric, value, sample_size, meta, created_by)
       VALUES (:id, :component, :metric, :value, :sampleSize, :meta, :userId)`,
      {
        id,
        component,
        metric,
        value: parseFloat(value),
        sampleSize: parseInt(sampleSize, 10) || 0,
        meta: meta ? JSON.stringify(meta) : null,
        userId: req.user.id,
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
      `SELECT * FROM ai_evaluations
       WHERE created_by = :userId
       ORDER BY created_at DESC
       LIMIT 50`,
      { userId: req.user.id }
    );
    res.json({ evaluations: rows });
  } catch (err) {
    next(err);
  }
});

/** GET /api/ai-eval/confusion-matrix — explicit SME Bloom evaluation. */
router.get('/confusion-matrix', requireAuth, async (req, res, next) => {
  try {
    const rows = await loadBloomEvaluation(req.user.id);
    res.json({ ...buildConfusionMatrix(rows), qualityVersion: QUALITY_VERSION, groundTruth: 'explicit_sme' });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/ai-eval/questions/:id/ground-truth — blind instructor/SME label. */
router.put('/questions/:id/ground-truth', requireAuth, async (req, res, next) => {
  try {
    const bloom = String(req.body?.bloom || '').trim().toLowerCase();
    if (!BLOOM_LEVELS.includes(bloom)) return res.status(422).json({ error: 'Select a valid Bloom level.' });

    const [rows] = await pool.query(
      `SELECT q.id, q.sme_bloom
       FROM questions q
       JOIN subjects s ON s.id = q.subject_id
       WHERE q.id = :id
         AND q.source = "ai"
         AND q.created_by = :userId
         AND s.instructor_id = :userId
         AND q.ai_predicted_bloom IS NOT NULL
         AND JSON_EXTRACT(q.generation_meta, "$.quality.version") = :qualityVersion
       LIMIT 1`,
      { id: req.params.id, userId: req.user.id, qualityVersion: QUALITY_VERSION }
    );
    if (!rows.length) return res.status(404).json({ error: 'Eligible AI question not found.' });
    if (rows[0].sme_bloom) {
      return res.status(409).json({ error: 'This question already has a blind SME label. Ground-truth labels are locked after the AI classification is revealed.' });
    }

    const [updated] = await pool.query(
      `UPDATE questions
       SET sme_bloom = :bloom, sme_labeled_by = :userId, sme_labeled_at = NOW()
       WHERE id = :id AND created_by = :userId AND sme_bloom IS NULL`,
      { id: req.params.id, userId: req.user.id, bloom }
    );
    if (!updated.affectedRows) return res.status(409).json({ error: 'This question was labeled in another session. Reload the evaluation.' });
    logAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'ai_eval.sme_label',
      targetType: 'question',
      targetId: req.params.id,
      detail: { bloom, qualityVersion: QUALITY_VERSION },
      ip: req.ip,
    });
    res.json({ ok: true, questionId: req.params.id, bloom });
  } catch (err) {
    next(err);
  }
});

export default router;
