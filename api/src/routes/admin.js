/**
 * Admin routes — superadmin console API. Mounted at /api/admin.
 *
 *   GET  /api/admin/users?status=pending|active|rejected|all
 *   POST /api/admin/users/:id/approve
 *   POST /api/admin/users/:id/reject
 *   GET  /api/admin/login-logs?limit&email
 *   GET  /api/admin/audit-logs?limit
 *   GET  /api/admin/settings        — recaptcha + AI credential state (masked)
 *   PUT  /api/admin/settings        — update config values into `settings`
 *
 * Every route requires a superadmin session (JWT + live DB check).
 * Secrets are returned masked only; they never leave the API readable.
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import pool from '../config/db.js';
import env from '../config/env.js';
import { requireSuperadmin, requireAdminConsole } from '../middleware/auth.js';
import { getSetting } from '../services/settings.js';
import { sendCredentialsEmail, sendResetLinkEmail } from '../services/emailService.js';
import { logAudit } from '../services/audit.js';
import { invalidateAiConfigCache } from '../services/aiConfig.js';

const router = Router();
// Both staff roles reach the console; individual routes layer
// requireSuperadmin for the areas reserved to the higher authority.
router.use(requireAdminConsole);

/** The account types a caller may see/manage: admins touch instructors only. */
function manageableRoles(user) {
  return user.role === 'superadmin' ? ['instructor', 'admin'] : ['instructor'];
}

/** Mask a secret for display: keep the last 4 chars only. */
function mask(v) {
  if (!v) return null;
  const s = String(v);
  return s.length <= 4 ? '••••' : `••••${s.slice(-4)}`;
}

function clampLimit(v, fallback = 100) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, 1), 500);
}

// ── Dashboard summary ──────────────────────────────────

/**
 * GET /stats — console overview: account counts, 24h sign-in activity,
 * the pending approval queue, and which integrations are configured.
 */
router.get('/stats', async (req, res, next) => {
  try {
    const [[users]] = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(status = 'pending') AS pending,
              SUM(status = 'active') AS active,
              SUM(status = 'rejected') AS rejected,
              SUM(email_verified = 1) AS verified
       FROM users WHERE role = 'instructor'`
    );
    const [[logins]] = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(success = 1) AS success,
              SUM(success = 0) AS failed,
              COUNT(DISTINCT ip) AS unique_ips
       FROM login_logs
       WHERE created_at >= NOW() - INTERVAL 1 DAY`
    );
    const [recentLogins] = await pool.query(
      `SELECT l.email, l.success, l.reason, l.ip, l.created_at, u.full_name
       FROM login_logs l
       LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.created_at DESC
       LIMIT 8`
    );
    const [pendingUsers] = await pool.query(
      `SELECT id, email, full_name, first_name, middle_name, last_name, name_ext, role, status, created_at
       FROM users WHERE role = 'instructor' AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 6`
    );

    const siteKey = await getSetting('recaptcha_site_key', null);
    const secret = await getSetting('recaptcha_secret_key', null);
    const geminiKey = await getSetting('gemini_api_key', null);
    const groqKey = await getSetting('groq_api_key', null);

    res.json({
      users,
      logins24h: logins,
      recentLogins,
      pendingUsers,
      // Integration health is reserved for the superadmin.
      system: req.user.role === 'superadmin'
        ? {
            recaptcha: Boolean(siteKey && secret),
            gemini: Boolean(geminiKey || env.ai.gemini.apiKey),
            groq: Boolean(groqKey || env.ai.groq.apiKey),
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

// ── Users ──────────────────────────────────────────────

/**
 * GET /users — list staff-managed accounts. `status` filter defaults to
 * 'all' so the console opens on the full directory.
 */
router.get('/users', async (req, res, next) => {
  try {
    const status = String(req.query.status || 'all');
    const allowed = ['pending', 'active', 'rejected', 'all'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status filter.' });
    }
    const roles = manageableRoles(req.user);
    const where = status === 'all' ? '' : 'AND u.status = :status';
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.first_name, u.middle_name,
              u.last_name, u.name_ext, u.role,
              u.email_verified, u.status, u.created_at, u.approved_at,
              a.email AS approved_by_email
       FROM users u
       LEFT JOIN users a ON a.id = u.approved_by
       WHERE u.role IN (:roles) ${where}
       ORDER BY u.created_at DESC
       LIMIT 500`,
      { status, roles }
    );
    res.json({ users: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /users — provision an account directly (no self-registration).
 * Superadmin may create admins and instructors; admin may create
 * instructors only. Provisioned accounts are verified + active immediately.
 *
 * The password is generated server-side and emailed to the new user — it
 * is never accepted from, returned to, or shown to the caller.
 */
router.post('/users', async (req, res, next) => {
  try {
    const { first_name, last_name, email, role } = req.body || {};
    const fn = String(first_name || '').trim();
    const ln = String(last_name || '').trim();
    const em = String(email || '').trim().toLowerCase();
    const targetRole = String(role || 'instructor');

    if (!['instructor', 'admin'].includes(targetRole)) {
      return res.status(422).json({ error: 'Role must be instructor or admin.' });
    }
    if (targetRole === 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only the superadmin can create admin accounts.' });
    }
    if (!fn || !ln) return res.status(422).json({ error: 'First and last name are required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      return res.status(422).json({ error: 'A valid email address is required.' });
    }

    const [dup] = await pool.query('SELECT id FROM users WHERE email = :em LIMIT 1', { em });
    if (dup.length) return res.status(409).json({ error: 'An account with that email already exists.' });

    // Random credentials — grouped for readability, ~72 bits of entropy.
    const password = crypto.randomBytes(9).toString('base64url').slice(0, 12)
      .replace(/(.{4})(.{4})(.{4})/, '$1-$2-$3');

    const id = uuid();
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, full_name,
                          role, email_verified, status, approved_by, approved_at)
       VALUES (:id, :em, :hash, :fn, :ln, :full, :role, 1, 'active', :by, NOW())`,
      { id, em, hash, fn, ln, full: `${fn} ${ln}`, role: targetRole, by: req.user.id }
    );

    const emailed = await sendCredentialsEmail(em, `${fn} ${ln}`, password, targetRole);

    logAudit({
      actorId: req.user.id, actorEmail: req.user.email,
      action: 'user.create', targetType: 'user', targetId: id,
      detail: { role: targetRole, email: em, emailed }, ip: req.ip,
    });
    res.status(201).json({
      user: { id, email: em, full_name: `${fn} ${ln}`, role: targetRole, status: 'active' },
      emailed,
    });
  } catch (err) {
    next(err);
  }
});

/** POST /users/:id/approve — activate a pending instructor account. */
router.post('/users/:id/approve', async (req, res, next) => {
  try {
    const [result] = await pool.query(
      `UPDATE users SET status = 'active', approved_by = :by, approved_at = NOW()
       WHERE id = :id AND role IN (:roles) AND status = 'pending'`,
      { id: req.params.id, by: req.user.id, roles: manageableRoles(req.user) }
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Pending instructor account not found.' });
    }
    logAudit({
      actorId: req.user.id, actorEmail: req.user.email,
      action: 'user.approve', targetType: 'user', targetId: req.params.id, ip: req.ip,
    });
    res.json({ message: 'Account approved.' });
  } catch (err) {
    next(err);
  }
});

/** POST /users/:id/reject — reject a pending (or suspend an active) account. */
router.post('/users/:id/reject', async (req, res, next) => {
  try {
    const [result] = await pool.query(
      `UPDATE users SET status = 'rejected', approved_by = :by, approved_at = NOW()
       WHERE id = :id AND role IN (:roles) AND status IN ('pending','active')`,
      { id: req.params.id, by: req.user.id, roles: manageableRoles(req.user) }
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Instructor account not found.' });
    }
    logAudit({
      actorId: req.user.id, actorEmail: req.user.email,
      action: 'user.reject', targetType: 'user', targetId: req.params.id, ip: req.ip,
    });
    res.json({ message: 'Account rejected.' });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /users/:id — update a manageable account's name or email.
 * Admins may edit instructors only; the superadmin may also edit admins.
 * Superadmin accounts can never be edited through the console.
 */
router.put('/users/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, email, first_name, middle_name, last_name, name_ext, full_name, role
       FROM users WHERE id = :id LIMIT 1`,
      { id: req.params.id }
    );
    const target = rows[0];
    if (!target || !manageableRoles(req.user).includes(target.role)) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    const fn = String(req.body?.first_name ?? target.first_name ?? '').trim();
    const mn = String(req.body?.middle_name ?? target.middle_name ?? '').trim();
    const ln = String(req.body?.last_name ?? target.last_name ?? '').trim();
    const ext = String(req.body?.name_ext ?? target.name_ext ?? '').trim();
    const em = String(req.body?.email ?? target.email).trim().toLowerCase();

    if (!fn || !ln) return res.status(422).json({ error: 'First and last name are required.' });
    if (fn.length > 100 || mn.length > 100 || ln.length > 100) {
      return res.status(422).json({ error: 'Names must be 100 characters or fewer.' });
    }
    if (ext.length > 20) {
      return res.status(422).json({ error: 'Name extension must be 20 characters or fewer.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) || em.length > 255) {
      return res.status(422).json({ error: 'A valid email address is required.' });
    }

    const [dup] = await pool.query(
      'SELECT id FROM users WHERE email = :em AND id <> :id LIMIT 1',
      { em, id: target.id }
    );
    if (dup.length) {
      return res.status(409).json({ error: 'Another account already uses that email.' });
    }

    const full = [fn, mn, ln, ext].filter(Boolean).join(' ');
    await pool.query(
      `UPDATE users SET first_name = :fn, middle_name = :mn, last_name = :ln,
                          name_ext = :ext, full_name = :full, email = :em
       WHERE id = :id`,
      { fn, mn, ln, ext, full, em, id: target.id }
    );

    const changes = {};
    if (em !== target.email) changes.email = [target.email, em];
    if (full !== target.full_name) changes.name = [target.full_name, full];
    logAudit({
      actorId: req.user.id, actorEmail: req.user.email,
      action: 'user.update', targetType: 'user', targetId: target.id,
      detail: { changes }, ip: req.ip,
    });
    res.json({
      user: { id: target.id, email: em, first_name: fn, middle_name: mn, last_name: ln, name_ext: ext, full_name: full, role: target.role },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /users/:id/send-reset — email a single-use password-reset link to a
 * manageable account. The link carries a random 256-bit token stored only as
 * a SHA-256 hash — the caller triggers recovery but never sees or sets the
 * password themselves.
 */
router.post('/users/:id/send-reset', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, email, full_name, role FROM users WHERE id = :id LIMIT 1',
      { id: req.params.id }
    );
    const target = rows[0];
    if (!target || !manageableRoles(req.user).includes(target.role)) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    // One live link at a time — void earlier unused tokens for this account.
    await pool.query(
      `UPDATE password_reset_tokens SET used_at = NOW()
       WHERE user_id = :uid AND used_at IS NULL`,
      { uid: target.id }
    );
    await pool.query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
       VALUES (:id, :uid, :hash, DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
      { id: uuid(), uid: target.id, hash }
    );

    const link = `${env.webUrl}/reset?key=${token}`;
    const sent = await sendResetLinkEmail(target.email, target.full_name || target.email, link);
    if (!sent) {
      await pool.query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = :hash',
        { hash }
      );
      return res.status(503).json({ error: 'We could not send the reset email right now. Try again shortly.' });
    }

    logAudit({
      actorId: req.user.id, actorEmail: req.user.email,
      action: 'user.send_reset', targetType: 'user', targetId: target.id,
      detail: { email: target.email }, ip: req.ip,
    });
    res.json({ sent: true, email: target.email });
  } catch (err) {
    next(err);
  }
});

// ── Login logs ─────────────────────────────────────────

router.get('/login-logs', requireSuperadmin, async (req, res, next) => {
  try {
    const limit = clampLimit(req.query.limit);
    const email = String(req.query.email || '').trim();
    const where = email ? 'WHERE l.email = :email' : '';
    const [rows] = await pool.query(
      `SELECT l.id, l.email, l.success, l.reason, l.ip, l.user_agent, l.created_at,
              u.full_name
       FROM login_logs l
       LEFT JOIN users u ON u.id = l.user_id
       ${where}
       ORDER BY l.created_at DESC
       LIMIT :limit`,
      { email, limit }
    );
    res.json({ logs: rows });
  } catch (err) {
    next(err);
  }
});

// ── Audit trail ────────────────────────────────────────

router.get('/audit-logs', requireSuperadmin, async (req, res, next) => {
  try {
    const limit = clampLimit(req.query.limit);
    const [rows] = await pool.query(
      `SELECT id, actor_id, actor_email, action, target_type, target_id, detail, ip, created_at
       FROM audit_logs
       ORDER BY created_at DESC
       LIMIT :limit`,
      { limit }
    );
    res.json({ logs: rows });
  } catch (err) {
    next(err);
  }
});

// ── Settings (reCAPTCHA + AI credentials) ──────────────

const EDITABLE_KEYS = [
  'recaptcha_site_key',
  'recaptcha_secret_key',
  'gemini_api_key',
  'gemini_model',
  'gemini_embedding_model',
  'groq_api_key',
  'groq_model',
];

/** GET /settings — current config state. Secret values are masked. */
router.get('/settings', requireSuperadmin, async (req, res, next) => {
  try {
    const siteKey = await getSetting('recaptcha_site_key', null);
    const secret = await getSetting('recaptcha_secret_key', null);
    const geminiKey = await getSetting('gemini_api_key', null);
    const groqKey = await getSetting('groq_api_key', null);
    const geminiModel = await getSetting('gemini_model', env.ai.gemini.model);
    const geminiEmbed = await getSetting('gemini_embedding_model', env.ai.gemini.embeddingModel);
    const groqModel = await getSetting('groq_model', env.ai.groq.model);

    res.json({
      recaptcha: {
        siteKey,
        secretSet: Boolean(secret),
        secretMasked: mask(secret),
      },
      ai: {
        geminiApiKeySet: Boolean(geminiKey || env.ai.gemini.apiKey),
        geminiApiKeyMasked: mask(geminiKey || env.ai.gemini.apiKey),
        geminiApiKeySource: geminiKey ? 'settings' : (env.ai.gemini.apiKey ? 'env' : null),
        geminiModel,
        geminiEmbeddingModel: geminiEmbed,
        groqApiKeySet: Boolean(groqKey || env.ai.groq.apiKey),
        groqApiKeyMasked: mask(groqKey || env.ai.groq.apiKey),
        groqApiKeySource: groqKey ? 'settings' : (env.ai.groq.apiKey ? 'env' : null),
        groqModel,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /settings — update config values. Body keys are whitelisted; empty
 * strings are ignored so a cleared field means "keep current", never wipe.
 * Only the changed key names are written to the audit trail.
 */
router.put('/settings', requireSuperadmin, async (req, res, next) => {
  try {
    const body = req.body || {};
    const changed = [];
    for (const key of EDITABLE_KEYS) {
      const v = body[key];
      if (typeof v !== 'string' || v.trim() === '') continue;
      await pool.query(
        `INSERT INTO settings (setting_key, setting_value)
         VALUES (:k, :v)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        { k: key, v: v.trim() }
      );
      changed.push(key);
    }
    if (!changed.length) {
      return res.status(400).json({ error: 'No settings to update.' });
    }
    invalidateAiConfigCache();
    logAudit({
      actorId: req.user.id, actorEmail: req.user.email,
      action: 'settings.update', targetType: 'settings',
      detail: { keys: changed }, ip: req.ip,
    });
    res.json({ message: 'Settings updated.', changed });
  } catch (err) {
    next(err);
  }
});

export default router;
