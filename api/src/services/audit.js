/**
 * audit.js — writes to `login_logs` (sign-in attempts) and `audit_logs`
 * (superadmin actions + security events). Fire-and-forget: failures are
 * logged but never block the request that triggered them.
 */
import { v4 as uuid } from 'uuid';
import pool from '../config/db.js';

/**
 * Record a login attempt.
 * @param {object} p — { userId?, email, success, reason?, ip?, userAgent? }
 */
export async function logLogin({ userId = null, email, success, reason = null, ip = null, userAgent = null }) {
  try {
    await pool.query(
      `INSERT INTO login_logs (id, user_id, email, success, reason, ip, user_agent)
       VALUES (:id, :userId, :email, :success, :reason, :ip, :ua)`,
      {
        id: uuid(),
        userId,
        email: String(email || '').slice(0, 255),
        success: success ? 1 : 0,
        reason: reason ? String(reason).slice(0, 80) : null,
        ip: ip ? String(ip).slice(0, 45) : null,
        ua: userAgent ? String(userAgent).slice(0, 255) : null,
      }
    );
  } catch (err) {
    console.warn('[audit] login_logs insert failed:', err.message);
  }
}

/**
 * Record a superadmin action or security event.
 * @param {object} p — { actorId?, actorEmail?, action, targetType?, targetId?, detail?, ip? }
 */
export async function logAudit({ actorId = null, actorEmail = null, action, targetType = null, targetId = null, detail = null, ip = null }) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (id, actor_id, actor_email, action, target_type, target_id, detail, ip)
       VALUES (:id, :actorId, :actorEmail, :action, :targetType, :targetId, :detail, :ip)`,
      {
        id: uuid(),
        actorId,
        actorEmail: actorEmail ? String(actorEmail).slice(0, 255) : null,
        action: String(action).slice(0, 80),
        targetType: targetType ? String(targetType).slice(0, 40) : null,
        targetId: targetId ? String(targetId).slice(0, 64) : null,
        detail: detail == null ? null : (typeof detail === 'string' ? detail : JSON.stringify(detail)),
        ip: ip ? String(ip).slice(0, 45) : null,
      }
    );
  } catch (err) {
    console.warn('[audit] audit_logs insert failed:', err.message);
  }
}

export default { logLogin, logAudit };
