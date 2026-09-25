-- Nexam migration 004 — enforce scope-critical workflow gates.
-- Run after 003_ai_eval_ownership.sql.

-- A syllabus-derived TOS is an initial draft. Question generation and exam
-- construction may only use a blueprint after the instructor finalizes it.
ALTER TABLE `tos`
  ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'draft' COMMENT 'draft|finalized' AFTER `bloom_weights`,
  ADD COLUMN `finalized_by` CHAR(36) NULL AFTER `status`,
  ADD COLUMN `finalized_at` TIMESTAMP NULL AFTER `finalized_by`,
  ADD INDEX `idx_tos_status` (`status`);

-- similarity_flag keeps its canonical none|flagged|rejected vocabulary.
-- These separate fields distinguish "passed" from "not checked" and make
-- approval fail closed when the vector check fails or is still queued.
ALTER TABLE `questions`
  ADD COLUMN `similarity_checked_at` TIMESTAMP NULL AFTER `similarity_score`,
  ADD COLUMN `similarity_error` TEXT NULL AFTER `similarity_checked_at`;

-- Existing blueprints already used by an exam are treated as finalized. This
-- preserves working records while new/unused blueprints remain drafts.
UPDATE `tos` t
SET t.status = 'finalized',
    t.finalized_at = COALESCE(t.updated_at, t.created_at),
    t.finalized_by = (
      SELECT s.instructor_id FROM subjects s WHERE s.id = t.subject_id LIMIT 1
    )
WHERE EXISTS (SELECT 1 FROM exams e WHERE e.tos_id = t.id);

-- A completed historical similarity job is evidence that the check ran. Jobs
-- that failed remain unchecked and therefore cannot pass the new gate.
UPDATE `questions` q
SET q.similarity_checked_at = (
      SELECT MAX(j.finished_at)
      FROM ai_jobs j
      WHERE j.type = 'similarity'
        AND j.status = 'done'
        AND JSON_UNQUOTE(JSON_EXTRACT(j.payload, '$.questionId')) = q.id
    )
WHERE EXISTS (
  SELECT 1 FROM ai_jobs j
  WHERE j.type = 'similarity'
    AND j.status = 'done'
    AND JSON_UNQUOTE(JSON_EXTRACT(j.payload, '$.questionId')) = q.id
);

