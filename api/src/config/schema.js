/**
 * schema.js — idempotent schema ensure, run once at boot before the server
 * accepts traffic. Every statement is guarded (CREATE TABLE IF NOT EXISTS /
 * ADD COLUMN IF NOT EXISTS) so it is safe to run repeatedly on production:
 * existing tables and columns are left untouched, nothing is dropped or
 * rewritten. Keep this list append-only — migrations/00X_*.sql files remain
 * the human-readable record of when each change was introduced.
 */
import pool from './db.js';

const DDL = [
  // 007_superadmin — account approval state on users
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active' AFTER email_verified`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by VARCHAR(36) NULL AFTER status`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at DATETIME NULL AFTER approved_by`,

  // 007_superadmin — sign-in attempts (email, ip, user agent, outcome)
  `CREATE TABLE IF NOT EXISTS login_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NULL,
    email VARCHAR(255) NOT NULL,
    success TINYINT(1) NOT NULL DEFAULT 0,
    reason VARCHAR(80) NULL,
    ip VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_login_logs_email (email),
    INDEX idx_login_logs_user (user_id),
    INDEX idx_login_logs_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 008_avatar — profile photo (encrypted file path + version for cache-bust)
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_path VARCHAR(255) NULL`,
  `ALTER TABLE users MODIFY COLUMN avatar_path VARCHAR(255) NULL`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_v INT UNSIGNED NOT NULL DEFAULT 0`,

  // 007_superadmin — superadmin actions and security events
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    actor_id VARCHAR(36) NULL,
    actor_email VARCHAR(255) NULL,
    action VARCHAR(80) NOT NULL,
    target_type VARCHAR(40) NULL,
    target_id VARCHAR(64) NULL,
    detail TEXT NULL,
    ip VARCHAR(45) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_actor (actor_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

export async function ensureSchema() {
  try {
    for (const stmt of DDL) {
      await pool.query(stmt);
    }
    // eslint-disable-next-line no-console
    console.log('[schema] Database schema verified.');
  } catch (err) {
    // Non-fatal: the affected feature surfaces its own error on first use,
    // and a deploy without ALTER/CREATE rights should not block boot.
    // eslint-disable-next-line no-console
    console.error('[schema] Ensure failed (check DB privileges):', err.message);
  }
}

export default { ensureSchema };
