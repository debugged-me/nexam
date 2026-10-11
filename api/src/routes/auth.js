/**
 * Auth routes — JWT-based authentication for the React web app and the
 * Flutter mobile app:
 *
 *   POST /api/auth/login      — email + password → JWT
 *   POST /api/auth/register   — create account, send OTP
 *   POST /api/auth/verify     — verify OTP code, mark email_verified
 *   POST /api/auth/resend     — resend OTP (rate-limited)
 *   POST /api/auth/forgot     — send reset OTP to email
 *   POST /api/auth/reset      — verify reset OTP + set new password
 *   GET  /api/auth/me         — current user profile (token required)
 *
 * Both clients share the same `users` and `otp_codes` tables, so an account
 * created on the web app works on mobile and vice versa.
 *
 * Rate limiting is in-memory per IP+identity (sufficient for a single-node
 * capstone deployment; for multi-node, move to Redis).
 */
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';
import env from '../config/env.js';
import pool from '../config/db.js';
import { requireAuth, requireAnyAuth } from '../middleware/auth.js';
import { sendOtpEmail } from '../services/emailService.js';
import { getCaptchaSiteKey, verifyCaptcha } from '../services/captcha.js';
import { logLogin } from '../services/audit.js';
import { encryptFileAtRest, readProtectedFile } from '../services/storageCrypto.js';

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

/** Seconds until the oldest recorded attempt in the window expires. */
function rateRetryAfter(key, windowSeconds) {
  const now = Date.now();
  const cutoff = now - windowSeconds * 1000;
  const attempts = (rateBuckets.get(key) || []).filter((t) => t >= cutoff);
  if (!attempts.length) return 0;
  return Math.ceil(windowSeconds - (now - Math.min(...attempts)) / 1000);
}

// ── Login throttle: escalating delay between failed attempts ──
// Key: `login|${email}|${ip}` → { fails, lastAt }. First 3 failures are
// unthrottled; each failure after that must wait progressively longer
// (15s → 30s → 60s → … → 900s max). Cleared on successful sign-in.
const loginStreaks = new Map();
const LOGIN_DELAYS_S = [0, 0, 0, 15, 30, 60, 120, 300, 600, 900];

function loginWaitSeconds(key) {
  const s = loginStreaks.get(key);
  if (!s) return 0;
  if (Date.now() - s.lastAt > 900_000) {
    loginStreaks.delete(key);
    return 0;
  }
  const wait = LOGIN_DELAYS_S[Math.min(s.fails, LOGIN_DELAYS_S.length - 1)];
  return Math.max(0, Math.ceil(wait - (Date.now() - s.lastAt) / 1000));
}

function loginRecord(key) {
  const s = loginStreaks.get(key);
  loginStreaks.set(key, { fails: (s?.fails || 0) + 1, lastAt: Date.now() });
}

function loginClear(key) {
  loginStreaks.delete(key);
}

// ── Helpers ───────────────────────────────────────────

/** Compose the canonical account display name from its individual parts. */
function composeFullName(first, middle, last, ext) {
  const parts = [String(first || '').trim()];
  const m = String(middle || '').trim();
  if (m) parts.push(m.charAt(0).toUpperCase() + '.');
  parts.push(String(last || '').trim());
  const e = String(ext || '').trim();
  if (e) parts.push(e);
  return parts.filter(Boolean).join(' ');
}

/**
 * 6-character OTP — 5 digits plus 1 unambiguous letter (no I/O) placed at a
 * random position, e.g. "90182Z", "K40291", "82F301".
 */
const OTP_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function generateOtpCode() {
  const chars = Array.from({ length: 6 }, () => String(Math.floor(Math.random() * 10)));
  const pos = Math.floor(Math.random() * 6);
  chars[pos] = OTP_LETTERS[Math.floor(Math.random() * OTP_LETTERS.length)];
  return chars.join('');
}

/** Generate an OTP, invalidate previous unused codes, store it. */
async function generateOtp(userId) {
  await pool.query(
    `UPDATE otp_codes SET used = 1 WHERE user_id = :userId AND used = 0`,
    { userId }
  );
  const code = generateOtpCode();
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
    { userId, code: String(code).toUpperCase() }
  );
  if (!rows.length) return false;
  await pool.query(`UPDATE otp_codes SET used = 1 WHERE id = :id`, { id: rows[0].id });
  return true;
}

// ── Routes ────────────────────────────────────────────

/**
 * GET /api/auth/captcha
 * Returns the public reCAPTCHA site key so the web client can render the
 * widget. The secret key is never exposed.
 */
router.get('/captcha', async (req, res, next) => {
  try {
    res.json({ siteKey: await getCaptchaSiteKey() });
  } catch (err) {
    next(err);
  }
});

/**
 * Enforce reCAPTCHA on requests marked client: 'web' (the React app sends
 * this marker; Flutter clients do not, so mobile auth is unaffected).
 */
async function requireWebCaptcha(req, res) {
  if (req.body?.client !== 'web') return true;
  if (await verifyCaptcha(req.body.captchaToken, req.ip)) return true;
  res.status(400).json({ error: 'reCAPTCHA verification failed. Please try again.' });
  return false;
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Throttled: failures after the 3rd must wait an escalating delay.
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
    const wait = loginWaitSeconds(key);
    if (wait > 0) {
      res.set('Retry-After', String(wait));
      return res.status(429).json({
        error: `Too many failed attempts. Please wait ${wait} seconds and try again.`,
        retryAfter: wait,
      });
    }

    const [rows] = await pool.query(
      `SELECT id, full_name, email, password_hash, role, email_verified, status, avatar_path, avatar_v FROM users WHERE email = :email LIMIT 1`,
      { email }
    );
    const user = rows[0];
    const ua = req.get('user-agent');

    // Use a constant-time-ish compare even when the user doesn't exist to
    // avoid timing-based user enumeration.
    const dummyHash = '$2a$10$CwTycUXing8kqJm6k5X5YOJ9uSgJ9uSgJ9uSgJ9uSgJ9uSgJ9uSgJ9uSgJ';
    const ok = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, dummyHash);

    if (!user || !ok) {
      loginRecord(key);
      logLogin({ userId: user?.id || null, email, success: false, reason: 'bad_credentials', ip, userAgent: ua });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.email_verified && user.role !== 'superadmin') {
      logLogin({ userId: user.id, email, success: false, reason: 'email_unverified', ip, userAgent: ua });
      return res.status(403).json({
        error: 'Please verify your email before logging in.',
        needsVerification: true,
        email: user.email,
      });
    }

    if (user.status === 'pending') {
      logLogin({ userId: user.id, email, success: false, reason: 'pending_approval', ip, userAgent: ua });
      return res.status(403).json({
        error: 'Your account is awaiting approval by the administrator.',
        pendingApproval: true,
      });
    }

    if (user.status === 'rejected') {
      logLogin({ userId: user.id, email, success: false, reason: 'rejected', ip, userAgent: ua });
      return res.status(403).json({ error: 'This account was not approved. Contact your administrator.' });
    }

    if (user.role !== 'instructor' && user.role !== 'superadmin') {
      logLogin({ userId: user.id, email, success: false, reason: 'role_denied', ip, userAgent: ua });
      return res.status(403).json({ error: 'Nexam is restricted to faculty/instructor accounts.' });
    }

    loginClear(key);
    logLogin({ userId: user.id, email, success: true, ip, userAgent: ua });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      env.jwt.secret,
      { expiresIn: env.jwt.expiresIn }
    );

    res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        has_avatar: !!user.avatar_path,
        avatar_v: user.avatar_v,
      },
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
    if (!(await requireWebCaptcha(req, res))) return;

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
         (id, email, password_hash, first_name, middle_name, last_name, name_ext, full_name, role, email_verified, status)
       VALUES
         (:id, :email, :password_hash, :first_name, :middle_name, :last_name, :name_ext, :full_name, 'instructor', 0, 'pending')`,
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
    if (!/^[0-9A-Z]{6}$/i.test(String(code))) {
      return res.status(400).json({ error: 'The code must be 6 characters.' });
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

    res.json({ message: 'Email verified! You can sign in once your account is approved.' });
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
 * POST /api/auth/send-verification
 * Body: { email }
 * For accounts that registered but never verified (login → needsVerification).
 * Sends a fresh verification code — not a reset code — and returns a
 * verifyToken so the client can complete /verify. Generic response otherwise.
 * Shares the 2-minute per-email+IP cooldown used by /forgot.
 */
router.post('/send-verification', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email)) || String(email).length > 255) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const ip = req.ip;
    const cdKey = rateKey('send_verify_cd', email, ip);
    if (rateExceeded(cdKey, 1, 120)) {
      const retryAfter = rateRetryAfter(cdKey, 120);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: `Please wait ${retryAfter} seconds before requesting another code.`,
        retryAfter,
      });
    }
    rateRecord(cdKey, 120);

    const generic = 'If that account exists and is unverified, a verification code has been sent.';
    const [rows] = await pool.query(
      `SELECT id, full_name, email, email_verified FROM users WHERE email = :email LIMIT 1`,
      { email }
    );
    const user = rows[0];
    if (!user || user.email_verified) {
      return res.json({ message: generic });
    }

    const otp = await generateOtp(user.id);
    const sent = await sendOtpEmail(user.email, user.full_name, otp, false);

    const verifyToken = jwt.sign(
      { sub: 'verify', uid: user.id, email: user.email },
      env.jwt.secret,
      { expiresIn: '30m' }
    );

    res.json({
      message: sent ? 'A verification code has been sent to your email.' : generic,
      verifyToken,
      email: user.email,
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

    // Per-request cooldown: one reset request every 2 minutes per email+IP,
    // regardless of whether the account exists (keeps timing uniform).
    const cdKey = rateKey('forgot_cd', email, ip);
    if (rateExceeded(cdKey, 1, 120)) {
      const retryAfter = rateRetryAfter(cdKey, 120);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: `Please wait ${retryAfter} seconds before requesting another reset code.`,
        retryAfter,
      });
    }
    rateRecord(cdKey, 120);

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
    if (!/^[0-9A-Z]{6}$/i.test(String(code))) {
      return res.status(400).json({ error: 'The code must be 6 characters.' });
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
router.get('/me', requireAnyAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, middle_name, last_name, name_ext, full_name, email, role, email_verified, status, avatar_path, avatar_v, created_at,
        (avatar_path IS NOT NULL) AS has_avatar FROM users WHERE id = :id LIMIT 1`,
      { id: req.user.id }
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/auth/me — update profile (name fields). */
router.put('/me', requireAnyAuth, async (req, res, next) => {
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
      `SELECT id, first_name, middle_name, last_name, name_ext, full_name, email, role, email_verified, avatar_v,
        (avatar_path IS NOT NULL) AS has_avatar, created_at FROM users WHERE id = :id`,
      { id: req.user.id }
    );
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

/** POST /api/auth/change-password — change password (requires current password). */
router.post('/change-password', requireAnyAuth, async (req, res, next) => {
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

// ── Profile photo ──────────────────────────────────────
// Stored in upload/avatars (outside static routes) and encrypted at rest via
// storageCrypto, same contract as uploaded course materials.
const AVATAR_DIR = path.resolve(process.cwd(), 'upload/avatars');
const AVATAR_MIME_EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};
const AVATAR_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (AVATAR_MIME_EXT[file.mimetype]) return cb(null, true);
    const err = new Error('Unsupported image type. Use PNG, JPG, WebP, or GIF.');
    err.status = 415;
    cb(err);
  },
});

/** Normalizes multer/fileFilter errors into clean 4xx responses. */
function avatarMiddleware(req, res, next) {
  avatarUpload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.name === 'MulterError') {
      err.status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      err.message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller.' : 'Invalid upload.';
    }
    next(err);
  });
}

async function removeAvatarFile(avatarPath) {
  if (!avatarPath) return;
  try { await fs.unlink(avatarPath); } catch { /* already gone */ }
}

/** Sniff the actual file signature — `file.mimetype` comes from the request
 *  and is trivially forged, so the stored extension must come from the bytes. */
const SIG_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function sniffImageExt(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf.subarray(0, 8).equals(SIG_PNG)) return '.png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  const head6 = buf.subarray(0, 6).toString('latin1');
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return '.gif';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return '.webp';
  return null;
}

/** POST /api/auth/avatar — upload/replace the caller's profile photo. */
router.post('/avatar', requireAnyAuth, avatarMiddleware, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
    const ext = sniffImageExt(req.file.buffer);
    if (!ext) return res.status(415).json({ error: 'File is not a valid PNG, JPG, WebP, or GIF image.' });
    await fs.mkdir(AVATAR_DIR, { recursive: true });
    const filePath = path.join(AVATAR_DIR, `${req.user.id}${ext}`);
    await fs.writeFile(filePath, req.file.buffer, { mode: 0o600 });
    await encryptFileAtRest(filePath);

    const [rows] = await pool.query(`SELECT avatar_path FROM users WHERE id = :id`, { id: req.user.id });
    if (rows[0]?.avatar_path && rows[0].avatar_path !== filePath) await removeAvatarFile(rows[0].avatar_path);

    const avatarV = Math.floor(Date.now() / 1000);
    await pool.query(`UPDATE users SET avatar_path = :p, avatar_v = :v WHERE id = :id`,
      { p: filePath, v: avatarV, id: req.user.id });
    res.json({ message: 'Profile photo updated.', has_avatar: true, avatar_v: avatarV });
  } catch (err) {
    next(err);
  }
});

/** GET /api/auth/avatar — stream the caller's own profile photo. */
router.get('/avatar', requireAnyAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT avatar_path FROM users WHERE id = :id`, { id: req.user.id });
    const avatarPath = rows[0]?.avatar_path;
    if (!avatarPath) return res.status(404).json({ error: 'No profile photo.' });
    const buf = await readProtectedFile(avatarPath);
    res.set('Cache-Control', 'private, max-age=300');
    // Defense in depth: served with an explicit image type only — nosniff
    // blocks MIME-sniffing to HTML, and the CSP makes the response inert even
    // if it were ever navigated to as a document.
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Security-Policy', "default-src 'none'");
    res.type(AVATAR_TYPES[path.extname(avatarPath).toLowerCase()] || 'application/octet-stream');
    res.send(buf);
  } catch (err) {
    if (err?.code === 'ENOENT') return res.status(404).json({ error: 'No profile photo.' });
    next(err);
  }
});

/** DELETE /api/auth/avatar — remove the caller's profile photo. */
router.delete('/avatar', requireAnyAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT avatar_path FROM users WHERE id = :id`, { id: req.user.id });
    await removeAvatarFile(rows[0]?.avatar_path);
    await pool.query(`UPDATE users SET avatar_path = NULL, avatar_v = 0 WHERE id = :id`, { id: req.user.id });
    res.json({ message: 'Profile photo removed.', has_avatar: false, avatar_v: 0 });
  } catch (err) {
    next(err);
  }
});

export default router;
