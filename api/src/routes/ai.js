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
