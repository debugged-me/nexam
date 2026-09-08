/**
 * AI status + job routes.
 *
 * GET /api/ai/status      — which providers are configured, worker info.
 * GET /api/ai/jobs         — recent jobs for the authenticated user.
 * GET /api/ai/jobs/:id     — single job status (for polling).
 *
 * All routes require auth (JWT). The PHP web app and Flutter app both
 * call these with the Bearer token from /api/auth/login.
 */
import { Router } from 'express';
import aiProvider from '../services/aiProvider.js';
import jobs from '../services/jobs.js';
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

export default router;
