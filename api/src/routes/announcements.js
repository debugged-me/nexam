/**
 * Announcements route — staff-authored notices shown to signed-in users.
 *
 *   GET /api/announcements — active announcements only, newest first.
 */
import { Router } from 'express';
import pool from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, body, created_at
       FROM announcements
       WHERE is_active = 1
       ORDER BY created_at DESC
       LIMIT 10`
    );
    res.json({ announcements: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
