/**
 * Auth routes — JWT-based authentication for the React web app and the
 * Flutter mobile app. Mirrors the PHP app's auth flow exactly:
 *
 *   POST /api/auth/login      — email + password → JWT
 *   POST /api/auth/register   — create account, send OTP
 *   POST /api/auth/verify     — verify OTP code, mark email_verified
 *   POST /api/auth/resend     — resend OTP (rate-limited)
 *   POST /api/auth/forgot     — send reset OTP to email
 *   POST /api/auth/reset      — verify reset OTP + set new password
 *   GET  /api/auth/me         — current user profile (token required)
 *
 * All endpoints share the same `users` + `otp_codes` tables as the PHP app,
 * so an account created on the web app works on the mobile app and vice versa.
 *
 * Rate limiting is in-memory per IP+identity (sufficient for a single-node
 * capstone deployment; for multi-node, move to Redis).
 */
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import env from '../config/env.js';
import pool from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendOtpEmail } from '../services/emailService.js';

const router = Router();

// ── In-memory rate limiter ─────────────────────────────
// Key: `${action}|${identity}|${ip}` → array of timestamps
const rateBuckets = new Map();

function rateKey(action, identity, ip) {
  return `${action}|${String(identity || '').toLowerCase().trim()}|${ip}`;
}

function rateExceeded(key, maxAttempts, windowSeconds) {
  const now = Date.now();
  const cutoff = now - windowSeconds * 1000;
  const attempts = (rateBuckets.get(key) || []).filter((t) => t >= cutoff);
  rateBuckets.set(key, attempts);
  return attempts.length >= maxAttempts;
}

function rateRecord(key, windowSeconds) {
  const now = Date.now();
  const cutoff = now - windowSeconds * 1000;
  const attempts = (rateBuckets.get(key) || []).filter((t) => t >= cutoff);
  attempts.push(now);
  rateBuckets.set(key, attempts);
}

function rateClear(key) {
  rateBuckets.delete(key);
}

// ── Helpers ───────────────────────────────────────────

/** Compose a display name from parts (mirrors PHP User_model::compose_full_name). */
function composeFullName(first, middle, last, ext) {
  const parts = [String(first || '').trim()];
  const m = String(middle || '').trim();
  if (m) parts.push(m.charAt(0).toUpperCase() + '.');
  parts.push(String(last || '').trim());
  const e = String(ext || '').trim();
  if (e) parts.push(e);
  return parts.filter(Boolean).join(' ');
}

/** Generate a 6-digit OTP, invalidate previous unused codes, store it. */
async function generateOtp(userId) {
  await pool.query(
    `UPDATE otp_codes SET used = 1 WHERE user_id = :userId AND used = 0`,
    { userId }
  );
  const code = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  const id = uuid();
  await pool.query(
    `INSERT INTO otp_codes (id, user_id, code, used, expires_at)
     VALUES (:id, :userId, :code, 0, DATE_ADD(NOW(), INTERVAL 15 MINUTE))`,
    { id, userId, code }
  );
  return code;
}

/** Verify an OTP code (unused, not expired). Marks it used on success. */
async function verifyOtp(userId, code) {
  const [rows] = await pool.query(
    `SELECT id FROM otp_codes
     WHERE user_id = :userId AND code = :code AND used = 0
       AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    { userId, code }
  );
  if (!rows.length) return false;
  await pool.query(`UPDATE otp_codes SET used = 1 WHERE id = :id`, { id: rows[0].id });
  return true;
}

// ── Routes ────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    if (String(password).length > 128) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    const ip = req.ip;
    const key = rateKey('login', email, ip);
    if (rateExceeded(key, 5, 900)) {
      return res.status(429).json({ error: 'Too many failed sign-in attempts. Please wait 15 minutes and try again.' });
    }

    const [rows] = await pool.query(
      `SELECT id, full_name, email, password_hash, role, email_verified FROM users WHERE email = :email LIMIT 1`,
      { email }
    );
    const user = rows[0];

    // Use a constant-time-ish compare even when the user doesn't exist to
    // avoid timing-based user enumeration.
    const dummyHash = '$2a$10$CwTycUXing8kqJm6k5X5YOJ9uSgJ9uSgJ9uSgJ9uSgJ9uSgJ9uSgJ9uSgJ';
    const ok = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, dummyHash);

    if (!user || !ok) {
      rateRecord(key, 900);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Please verify your email before logging in.',
        needsVerification: true,
        email: user.email,
      });
    }

    rateClear(key);

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
 * POST /api/auth/register
 * Body: { first_name, middle_name?, last_name, name_ext?, email, password }
 */
router.post('/register', async (req, res, next) => {
  try {
    const {
      first_name, middle_name, last_name, name_ext,
      email, password,
    } = req.body || {};

    // Validate
    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ error: 'First name, last name, email, and password are required.' });
    }
    if (String(first_name).length > 100 || String(last_name).length > 100) {
      return res.status(400).json({ error: 'Name fields must be 100 characters or fewer.' });
    }
    if (String(middle_name || '').length > 100 || String(name_ext || '').length > 20) {
      return res.status(400).json({ error: 'Name fields are too long.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email)) || String(email).length > 255) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }
    if (String(password).length < 8 || String(password).length > 128) {
      return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    }

    const ip = req.ip;
    const key = rateKey('register', email, ip);
    if (rateExceeded(key, 3, 3600)) {
      return res.status(429).json({ error: 'Too many registration attempts. Please try again later.' });
    }
    rateRecord(key, 3600);

    // Check for existing account
    const [existing] = await pool.query(
      `SELECT id FROM users WHERE email = :email LIMIT 1`,
      { email }
    );
    if (existing.length) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    // Create the user
    const id = uuid();
    const full_name = composeFullName(first_name, middle_name, last_name, name_ext);
    const password_hash = await bcrypt.hash(password, 12);

    await pool.query(
      `INSERT INTO users
         (id, email, password_hash, first_name, middle_name, last_name, name_ext, full_name, role, email_verified)
       VALUES
         (:id, :email, :password_hash, :first_name, :middle_name, :last_name, :name_ext, :full_name, 'instructor', 0)`,
      {
        id, email, password_hash,
        first_name: String(first_name).trim(),
        middle_name: String(middle_name || '').trim(),
        last_name: String(last_name).trim(),
        name_ext: String(name_ext || '').trim(),
        full_name,
      }
    );

    // Generate + send OTP
    const otp = await generateOtp(id);
    const sent = await sendOtpEmail(email, full_name, otp, false);

    // Return a verification token (signed JWT, short-lived) so the client
    // can call /verify without a session. The token carries the user id + email.
    const verifyToken = jwt.sign(
      { sub: 'verify', uid: id, email },
      env.jwt.secret,
      { expiresIn: '30m' }
    );

    res.status(201).json({
      message: sent
        ? 'Account created! Check your email for the verification code.'
        : 'Account created, but we could not send the verification email. Use "Resend code".',
      verifyToken,
      email,
      emailSent: sent,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/verify
 * Body: { verifyToken, code }
 * Verifies the OTP code and marks the user's email as verified.
 */
router.post('/verify', async (req, res, next) => {
  try {
    const { verifyToken, code } = req.body || {};
    if (!verifyToken || !code) {
      return res.status(400).json({ error: 'Verification token and code are required.' });
    }
    if (!/^\d{6}$/.test(String(code))) {
      return res.status(400).json({ error: 'The code must be 6 digits.' });
    }

    let payload;
    try {
      payload = jwt.verify(verifyToken, env.jwt.secret);
    } catch {
      return res.status(401).json({ error: 'Your verification session has expired. Please register or log in again.' });
    }
    if (payload.sub !== 'verify' || !payload.uid) {
      return res.status(401).json({ error: 'Invalid verification token.' });
    }

    const ip = req.ip;
    const key = rateKey('verify_code', payload.uid, ip);
    if (rateExceeded(key, 5, 900)) {
      return res.status(429).json({ error: 'Too many invalid code attempts. Please wait 15 minutes and try again.' });
    }

    const valid = await verifyOtp(payload.uid, String(code));
    if (!valid) {
      rateRecord(key, 900);
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }
    rateClear(key);

    await pool.query(
      `UPDATE users SET email_verified = 1 WHERE id = :id`,
      { id: payload.uid }
    );

    res.json({ message: 'Email verified! You can now log in.' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/resend
 * Body: { verifyToken }
 * Resends the OTP code (rate-limited to 1 per 60s).
 */
router.post('/resend', async (req, res, next) => {
  try {
    const { verifyToken } = req.body || {};
    if (!verifyToken) {
      return res.status(400).json({ error: 'Verification token is required.' });
    }

    let payload;
    try {
      payload = jwt.verify(verifyToken, env.jwt.secret);
    } catch {
      return res.status(401).json({ error: 'Your verification session has expired. Please register or log in again.' });
    }
    if (payload.sub !== 'verify' || !payload.uid) {
      return res.status(401).json({ error: 'Invalid verification token.' });
    }

    const ip = req.ip;
    const key = rateKey('verify_resend', payload.email, ip);
    if (rateExceeded(key, 1, 60)) {
      return res.status(429).json({ error: 'Please wait 60 seconds before requesting another code.' });
    }
    rateRecord(key, 60);

    const [rows] = await pool.query(
      `SELECT full_name, email FROM users WHERE id = :id LIMIT 1`,
      { id: payload.uid }
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    const otp = await generateOtp(payload.uid);
    const sent = await sendOtpEmail(rows[0].email, rows[0].full_name, otp, false);

    res.json({
      message: sent
        ? 'A new verification code has been sent.'
        : 'We could not send the email right now. Please try again shortly.',
      emailSent: sent,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/forgot
 * Body: { email }
 * Always returns the same message to prevent email enumeration.
 */
router.post('/forgot', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email)) || String(email).length > 255) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const ip = req.ip;
    const key = rateKey('forgot', email, ip);
    if (rateExceeded(key, 3, 3600)) {
      return res.status(429).json({ error: 'Too many reset requests. Please try again later.' });
    }
    rateRecord(key, 3600);

    const [rows] = await pool.query(
      `SELECT id, full_name, email FROM users WHERE email = :email LIMIT 1`,
      { email }
    );

    // Always return the same message to prevent enumeration.
    const genericMessage = 'If an account exists for that email, a reset code has been sent.';

    if (!rows.length) {
      return res.json({ message: genericMessage });
    }

    const user = rows[0];
    const otp = await generateOtp(user.id);
    const sent = await sendOtpEmail(user.email, user.full_name, otp, true);

    if (!sent) {
      return res.status(503).json({ error: 'We could not send the email right now. Please try again shortly.' });
    }

    // Issue a reset token (short-lived JWT) so the client can call /reset
    // without a session.
    const resetToken = jwt.sign(
      { sub: 'reset', uid: user.id, email: user.email },
      env.jwt.secret,
      { expiresIn: '30m' }
    );

    res.json({ message: genericMessage, resetToken, email: user.email });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/reset
 * Body: { resetToken, code, password }
 */
router.post('/reset', async (req, res, next) => {
  try {
    const { resetToken, code, password } = req.body || {};
    if (!resetToken || !code || !password) {
      return res.status(400).json({ error: 'Reset token, code, and new password are required.' });
    }
    if (!/^\d{6}$/.test(String(code))) {
      return res.status(400).json({ error: 'The code must be 6 digits.' });
    }
    if (String(password).length < 8 || String(password).length > 128) {
      return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    }

    let payload;
    try {
      payload = jwt.verify(resetToken, env.jwt.secret);
    } catch {
      return res.status(401).json({ error: 'Your reset session has expired. Please request a new code.' });
    }
    if (payload.sub !== 'reset' || !payload.uid) {
      return res.status(401).json({ error: 'Invalid reset token.' });
    }

    const ip = req.ip;
    const key = rateKey('reset_code', payload.uid, ip);
    if (rateExceeded(key, 5, 900)) {
      return res.status(429).json({ error: 'Too many invalid code attempts. Please wait 15 minutes and try again.' });
    }

    const valid = await verifyOtp(payload.uid, String(code));
    if (!valid) {
      rateRecord(key, 900);
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }
    rateClear(key);

    const password_hash = await bcrypt.hash(password, 12);
    await pool.query(
      `UPDATE users SET password_hash = :hash WHERE id = :id`,
      { hash: password_hash, id: payload.uid }
    );

    res.json({ message: 'Password reset successfully! You can now log in.' });
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
      `SELECT id, first_name, middle_name, last_name, name_ext, full_name, email, role, email_verified, created_at FROM users WHERE id = :id LIMIT 1`,
      { id: req.user.id }
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/auth/me — update profile (name fields). */
router.put('/me', requireAuth, async (req, res, next) => {
  try {
    const { first_name, middle_name, last_name, name_ext } = req.body || {};
    const fn = String(first_name || '').trim();
    const ln = String(last_name || '').trim();
    if (!fn || !ln) return res.status(422).json({ error: 'First and last name are required.' });

    const parts = [fn, String(middle_name || '').trim(), ln, String(name_ext || '').trim()].filter(Boolean);
    const fullName = parts.join(' ');

    await pool.query(
      `UPDATE users SET first_name = :fn, middle_name = :mn, last_name = :ln, name_ext = :ext, full_name = :full WHERE id = :id`,
      { fn, mn: String(middle_name || '').trim(), ln, ext: String(name_ext || '').trim(), full: fullName, id: req.user.id }
    );

    const [rows] = await pool.query(
      `SELECT id, first_name, middle_name, last_name, name_ext, full_name, email, role, email_verified, created_at FROM users WHERE id = :id`,
      { id: req.user.id }
    );
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

/** POST /api/auth/change-password — change password (requires current password). */
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new passwords are required.' });
    }
    if (String(new_password).length < 8) {
      return res.status(422).json({ error: 'New password must be at least 8 characters.' });
    }

    const [rows] = await pool.query(
      `SELECT password_hash FROM users WHERE id = :id`, { id: req.user.id }
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found.' });

    const valid = await bcrypt.compare(String(current_password), rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });

    const hash = await bcrypt.hash(String(new_password), 10);
    await pool.query(`UPDATE users SET password_hash = :hash WHERE id = :id`, { hash, id: req.user.id });
    res.json({ message: 'Password changed.' });
  } catch (err) {
    next(err);
  }
});

export default router;
