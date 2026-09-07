import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import env from '../config/env.js';
import pool from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Authenticates against the same `users` table the CodeIgniter app uses.
 * Returns a JWT that both the PHP web app and the Flutter mobile app can carry
 * in the `Authorization: Bearer <token>` header.
 *
 * NOTE: This is a scaffold — adjust the users-table columns to match the actual schema.
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const [rows] = await pool.query(
      'SELECT id, full_name, email, password_hash, role, email_verified FROM users WHERE email = :email LIMIT 1',
      { email }
    );

    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
    if (!user.email_verified) return res.status(403).json({ error: 'Please verify your email first.' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials.' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      env.jwt.secret,
      { expiresIn: env.jwt.expiresIn }
    );

    res.json({
      token,
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile (token required).
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, full_name, email, role, email_verified, created_at FROM users WHERE id = :id LIMIT 1',
      { id: req.user.id }
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
