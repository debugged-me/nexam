-- 007_superadmin.sql — superadmin role support.
--
-- Adds account approval state to users (existing rows stay 'active'), a
-- login_logs table recording every sign-in attempt with IP + user agent,
-- and an audit_logs table for superadmin actions and security events.

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `status` VARCHAR(20) NOT NULL DEFAULT 'active' AFTER `email_verified`,
  ADD COLUMN IF NOT EXISTS `approved_by` VARCHAR(36) NULL AFTER `status`,
  ADD COLUMN IF NOT EXISTS `approved_at` DATETIME NULL AFTER `approved_by`;

CREATE TABLE IF NOT EXISTS `login_logs` (
  `id` VARCHAR(36) PRIMARY KEY,
  `user_id` VARCHAR(36) NULL,
  `email` VARCHAR(255) NOT NULL,
  `success` TINYINT(1) NOT NULL DEFAULT 0,
  `reason` VARCHAR(80) NULL,
  `ip` VARCHAR(45) NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_login_logs_email` (`email`),
  INDEX `idx_login_logs_user` (`user_id`),
  INDEX `idx_login_logs_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(36) PRIMARY KEY,
  `actor_id` VARCHAR(36) NULL,
  `actor_email` VARCHAR(255) NULL,
  `action` VARCHAR(80) NOT NULL,
  `target_type` VARCHAR(40) NULL,
  `target_id` VARCHAR(64) NULL,
  `detail` TEXT NULL,
  `ip` VARCHAR(45) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_actor` (`actor_id`),
  INDEX `idx_audit_action` (`action`),
  INDEX `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
