-- Nexam migration 003 — ai_evaluations ownership scoping
-- Run against the shared `nexam` MySQL database after 002_omr_scoring_fixes.sql.
--
-- The /api/ai-eval/history endpoint returned every recorded metric regardless
-- of which instructor recorded it, and /api/ai-eval/record stored no owner.
-- Add created_by so recorded metrics are scoped per-instructor like every
-- other user-specific resource. NULL rows (pre-migration data) are visible
-- only to admins — there is no admin UI for this table today.

ALTER TABLE `ai_evaluations`
  ADD COLUMN `created_by` CHAR(36) NULL AFTER `meta`,
  ADD INDEX `idx_ai_eval_created_by` (`created_by`);
