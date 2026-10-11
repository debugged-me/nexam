import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import pool from '../config/db.js';

/**
 * Paths where ?token= is honored — file-serving routes only (downloads,
 * exports, the avatar image), the only places a browser can't attach an
 * Authorization header (<a href>, <img>). Every other endpoint requires the
 * header so a URL leaked into browser history or access logs can neither
 * read other data nor mutate anything.
 */
const QUERY_TOKEN_PATHS = /\/(download|export|avatar)(\/|$)/;

function extractToken(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) return token;
  if (['GET', 'HEAD'].includes(req.method) && QUERY_TOKEN_PATHS.test(req.path)) {
    const queryToken = req.query?.token;
    return typeof queryToken === 'string' ? queryToken : null;
  }
  return null;
}

/**
 * Verifies the `Authorization: Bearer <token>` header.
 * On success, attaches `req.user = { id, role, ... }`.
 * Returns 401 JSON when missing/invalid — works for both web and mobile clients.
 */
export function requireAuth(req, res, next) {
  const finalToken = extractToken(req);
  if (!finalToken) {
    return res.status(401).json({ error: 'Missing authentication token.' });
  }

  try {
    req.user = jwt.verify(finalToken, env.jwt.secret);
    if (req.user?.role !== 'instructor') {
      return res.status(403).json({ error: 'Nexam is restricted to faculty/instructor accounts.' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Any valid session — instructor or superadmin. Used by endpoints that
 * answer "who am I" without granting access to instructor-owned data.
 */
export function requireAnyAuth(req, res, next) {
  const finalToken = extractToken(req);
  if (!finalToken) {
    return res.status(401).json({ error: 'Missing authentication token.' });
  }
  try {
    req.user = jwt.verify(finalToken, env.jwt.secret);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Superadmin gate — valid JWT plus a live DB check so a revoked or
 * demoted account loses access immediately, even with an unexpired token.
 */
export async function requireSuperadmin(req, res, next) {
  const finalToken = extractToken(req);
  if (!finalToken) {
    return res.status(401).json({ error: 'Missing authentication token.' });
  }
  try {
    const payload = jwt.verify(finalToken, env.jwt.secret);
    const [rows] = await pool.query(
      `SELECT id, email, role, status FROM users WHERE id = :id LIMIT 1`,
      { id: payload.id }
    );
    const u = rows[0];
    if (!u || u.role !== 'superadmin' || u.status !== 'active') {
      return res.status(403).json({ error: 'Superadmin access required.' });
    }
    req.user = { ...payload, id: u.id, email: u.email, role: u.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Admin-console gate — valid JWT plus a live DB check for the staff roles
 * (admin or superadmin). Individual routes layer requireSuperadmin on top
 * for anything the mid-tier admin must not touch (settings, audit trail,
 * provisioning other admins).
 */
export async function requireAdminConsole(req, res, next) {
  const finalToken = extractToken(req);
  if (!finalToken) {
    return res.status(401).json({ error: 'Missing authentication token.' });
  }
  try {
    const payload = jwt.verify(finalToken, env.jwt.secret);
    const [rows] = await pool.query(
      `SELECT id, email, role, status FROM users WHERE id = :id LIMIT 1`,
      { id: payload.id }
    );
    const u = rows[0];
    if (!u || !['admin', 'superadmin'].includes(u.role) || u.status !== 'active') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    req.user = { ...payload, id: u.id, email: u.email, role: u.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Role gate — use after requireAuth: `router.get('/admin', requireAuth, requireRole('admin'), ...)`
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    next();
  };
}

export default { requireAuth, requireAnyAuth, requireSuperadmin, requireAdminConsole, requireRole };
