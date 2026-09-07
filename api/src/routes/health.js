import { Router } from 'express';

const router = Router();

/**
 * GET /api/health
 * Lightweight liveness probe — no DB hit. Use for uptime monitors / Flutter retry logic.
 */
router.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'nexam-api', time: new Date().toISOString() });
});

export default router;
