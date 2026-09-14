/**
 * AI status + job routes.
 *
 * GET  /api/ai/status              — which providers are configured, worker info.
 * GET  /api/ai/jobs                — recent jobs for the authenticated user.
 * GET  /api/ai/jobs/:id            — single job status (for polling).
 * POST /api/ai/syllabus-tos        — enqueue syllabus→TOS generation.
 * POST /api/ai/generate-questions  — enqueue RAG question generation (Phase 4).
 *
 * All routes require auth (JWT). The PHP web app and Flutter app both
 * call these with the Bearer token from /api/auth/login.
 */
import { Router } from 'express';
import aiProvider from '../services/aiProvider.js';
import jobs from '../services/jobs.js';
import pool from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/** GET /api/ai/status — provider configuration + worker handler list. */
router.get('/status', requireAuth, (_req, res) => {
  res.json({
    providers: aiProvider.status(),
    worker: {
      pollInterval: true,
      concurrency: true,
    },
  });
});

/** GET /api/ai/jobs — recent jobs for the authenticated user. */
router.get('/jobs', requireAuth, async (req, res, next) => {
  try {
    const rows = await jobs.recentByUser(req.user.id, 20);
    res.json({ jobs: rows });
  } catch (err) {
    next(err);
  }
});

/** GET /api/ai/jobs/:id — single job status (for UI polling). */
router.get('/jobs/:id', requireAuth, async (req, res, next) => {
  try {
    const job = await jobs.getById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    // Ownership check — user can only see their own jobs.
    if (job.user_id && job.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Job not found.' });
    }
    res.json({ job });
  } catch (err) {
    next(err);
  }
});

/** POST /api/ai/syllabus-tos — enqueue syllabus→TOS auto-generation. */
router.post('/syllabus-tos', requireAuth, async (req, res, next) => {
  try {
    const { materialId } = req.body;
    if (!materialId) return res.status(400).json({ error: 'materialId is required.' });

    // Ownership check — the material must belong to the user.
    const [rows] = await pool.query(
      `SELECT id, subject_id, is_syllabus, status FROM materials WHERE id = :id AND created_by = :userId`,
      { id: materialId, userId: req.user.id }
    );
    if (!rows.length) return res.status(404).json({ error: 'Material not found.' });
    const m = rows[0];
    if (!m.is_syllabus) return res.status(400).json({ error: 'This material is not marked as a syllabus.' });
    if (m.status !== 'processed') return res.status(400).json({ error: `Syllabus must be processed first (current: ${m.status}).` });

    const jobId = await jobs.enqueue({
      type: 'syllabus_tos',
      payload: { materialId, userId: req.user.id },
      userId: req.user.id,
      subjectId: m.subject_id,
    });

    res.status(202).json({ jobId, status: 'queued' });
  } catch (err) {
    next(err);
  }
});

/** POST /api/ai/generate-questions — enqueue RAG question generation (Phase 4). */
router.post('/generate-questions', requireAuth, async (req, res, next) => {
  try {
    const { tosId } = req.body;
    if (!tosId) return res.status(400).json({ error: 'tosId is required.' });

    // Ownership check — the TOS must belong to a subject owned by the user.
    const [rows] = await pool.query(
      `SELECT t.id, t.subject_id
       FROM tos t
       JOIN subjects s ON s.id = t.subject_id
       WHERE t.id = :tosId AND s.instructor_id = :userId`,
      { tosId, userId: req.user.id }
    );
    if (!rows.length) return res.status(404).json({ error: 'TOS not found or not owned by you.' });

    const jobId = await jobs.enqueue({
      type: 'generate',
      payload: { tosId, userId: req.user.id },
      userId: req.user.id,
      subjectId: rows[0].subject_id,
    });

    res.status(202).json({ jobId, status: 'queued' });
  } catch (err) {
    next(err);
  }
});

export default router;

/**
 * GET /api/ai/pipeline/:subjectId — aggregated pipeline status for the wizard.
 * Returns the state of each stage: syllabus upload → extract → embed → TOS →
 * question generation → approval → exam.
 */
router.get('/pipeline/:subjectId', requireAuth, async (req, res, next) => {
  try {
    const { subjectId } = req.params;

    // Ownership check
    const [subj] = await pool.query(
      `SELECT id FROM subjects WHERE id = :id AND instructor_id = :userId`,
      { id: subjectId, userId: req.user.id }
    );
    if (!subj.length) return res.status(404).json({ error: 'Subject not found.' });

    // 1. Syllabus material
    const [syllabusRows] = await pool.query(
      `SELECT id, title, status, source_type, chunk_count, is_syllabus,
              created_at, error
       FROM materials
       WHERE subject_id = :id AND is_syllabus = 1
       ORDER BY created_at DESC LIMIT 1`,
      { id: subjectId }
    );
    const syllabus = syllabusRows[0] || null;

    // 2. Recent jobs for this subject (extract, embed, syllabus_tos, generate)
    const [jobRows] = await pool.query(
      `SELECT id, type, status, error, created_at, started_at, finished_at, result
       FROM ai_jobs
       WHERE subject_id = :id
       ORDER BY created_at DESC
       LIMIT 20`,
      { id: subjectId }
    );

    // Find the latest job of each type
    const latestJob = (type) => jobRows.find((j) => j.type === type) || null;
    const extractJob = latestJob('extract');
    const embedJob = latestJob('embed');
    const tosJob = latestJob('syllabus_tos');
    const generateJob = latestJob('generate');

    // 3. TOS created from this subject
    const [tosRows] = await pool.query(
      `SELECT id, title, total_items, created_at
       FROM tos WHERE subject_id = :id
       ORDER BY created_at DESC LIMIT 1`,
      { id: subjectId }
    );
    const tos = tosRows[0] || null;

    // 4. Questions for this subject
    const [qStats] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft,
         SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
         SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
       FROM questions WHERE subject_id = :id`,
      { id: subjectId }
    );
    const questionStats = qStats[0] || { total: 0, draft: 0, approved: 0, rejected: 0 };

    // 5. Exams for this subject
    const [examRows] = await pool.query(
      `SELECT id, title, status, created_at
       FROM exams WHERE subject_id = :id
       ORDER BY created_at DESC LIMIT 1`,
      { id: subjectId }
    );
    const exam = examRows[0] || null;

    // Determine the current stage
    let stage = 'upload'; // default
    if (syllabus && syllabus.status === 'pending') stage = 'extracting';
    else if (syllabus && syllabus.status === 'processing') stage = 'extracting';
    else if (syllabus && syllabus.status === 'failed') stage = 'extract_failed';
    else if (syllabus && syllabus.status === 'processed') {
      if (embedJob && embedJob.status === 'running') stage = 'embedding';
      else if (embedJob && embedJob.status === 'queued') stage = 'embedding';
      else if (embedJob && embedJob.status === 'failed') stage = 'embed_failed';
      else if (tosJob && tosJob.status === 'queued') stage = 'tos_generating';
      else if (tosJob && tosJob.status === 'running') stage = 'tos_generating';
      else if (tosJob && tosJob.status === 'failed') stage = 'tos_failed';
      else if (tos) {
        if (generateJob && generateJob.status === 'queued') stage = 'question_generating';
        else if (generateJob && generateJob.status === 'running') stage = 'question_generating';
        else if (generateJob && generateJob.status === 'failed') stage = 'generate_failed';
        else if (generateJob && generateJob.status === 'done') {
          if (Number(questionStats.draft) > 0) stage = 'review';
          else if (Number(questionStats.approved) > 0) stage = 'exam_ready';
          else stage = 'review';
        } else stage = 'review';
      } else stage = 'processed';
    }

    res.json({
      subjectId,
      stage,
      syllabus,
      jobs: { extract: extractJob, embed: embedJob, tos: tosJob, generate: generateJob },
      tos,
      questions: {
        total: Number(questionStats.total),
        draft: Number(questionStats.draft),
        approved: Number(questionStats.approved),
        rejected: Number(questionStats.rejected),
      },
      exam,
    });
  } catch (err) {
    next(err);
  }
});
