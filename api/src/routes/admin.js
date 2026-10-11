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
import pool from '../config/db.js';
import env from '../config/env.js';
import { requireSuperadmin } from '../middleware/auth.js';
import { getSetting } from '../services/settings.js';
import { logAudit } from '../services/audit.js';
import { invalidateAiConfigCache } from '../services/aiConfig.js';

const router = Router();
router.use(requireSuperadmin);

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
      `SELECT id, email, full_name, created_at
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
      system: {
        recaptcha: Boolean(siteKey && secret),
        gemini: Boolean(geminiKey || env.ai.gemini.apiKey),
        groq: Boolean(groqKey || env.ai.groq.apiKey),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── Users ──────────────────────────────────────────────

/**
 * GET /users — list instructor accounts. `status` filter defaults to
 * 'pending' so the console opens on the work queue.
 */
router.get('/users', async (req, res, next) => {
  try {
    const status = String(req.query.status || 'pending');
    const allowed = ['pending', 'active', 'rejected', 'all'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status filter.' });
    }
    const where = status === 'all' ? '' : 'AND u.status = :status';
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.first_name, u.last_name, u.role,
              u.email_verified, u.status, u.created_at, u.approved_at,
              a.email AS approved_by_email
       FROM users u
       LEFT JOIN users a ON a.id = u.approved_by
       WHERE u.role = 'instructor' ${where}
       ORDER BY u.created_at DESC
       LIMIT 500`,
      { status }
    );
    res.json({ users: rows });
  } catch (err) {
    next(err);
  }
});

/** POST /users/:id/approve — activate a pending instructor account. */
router.post('/users/:id/approve', async (req, res, next) => {
  try {
    const [result] = await pool.query(
      `UPDATE users SET status = 'active', approved_by = :by, approved_at = NOW()
       WHERE id = :id AND role = 'instructor' AND status = 'pending'`,
      { id: req.params.id, by: req.user.id }
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
       WHERE id = :id AND role = 'instructor' AND status IN ('pending','active')`,
      { id: req.params.id, by: req.user.id }
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

// ── Login logs ─────────────────────────────────────────

router.get('/login-logs', async (req, res, next) => {
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

router.get('/audit-logs', async (req, res, next) => {
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
router.get('/settings', async (req, res, next) => {
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
router.put('/settings', async (req, res, next) => {
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
