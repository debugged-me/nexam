-- Nexam migration 002 — OMR scoring + similarity lifecycle fixes
-- Run against the shared `nexam` MySQL database after 001_ai_rag_schema.sql.
--
-- 1. scan_answers.answer columns were VARCHAR(20) — MCQ correct answers store
--    full option text (e.g. "Photosynthesis"), which silently truncated and
--    broke every scoring comparison. Widen both columns.
-- 2. similarity_results had no unique constraint, so the
--    INSERT ... ON DUPLICATE KEY UPDATE in the similarity worker could never
--    deduplicate — every re-check inserted duplicate rows.
-- 3. A rejected question is now kept (status='rejected') instead of being
--    hard-deleted, so AI evaluation metrics have real rejection data. The
--    status whitelist lives in application code — no DDL needed, but the
--    column comment is updated to document the third state.

ALTER TABLE `scan_answers`
  MODIFY `marked_answer` VARCHAR(500) NULL,
  MODIFY `correct_answer` VARCHAR(500) NULL;

ALTER TABLE `similarity_results`
  ADD UNIQUE KEY `uq_sim_pair` (`question_id`, `similar_question_id`);

ALTER TABLE `questions`
  MODIFY `status` VARCHAR(20) NOT NULL DEFAULT 'draft' COMMENT 'draft|active|rejected';

-- 4. Minimum cosine-similarity floor for RAG retrieval. HNSWLib always
--    returns top-k chunks even when nothing is actually relevant; chunks
--    below this score are dropped, and a generation slot with no relevant
--    chunks fails instead of hallucinating "grounded" questions from
--    off-topic material.
INSERT IGNORE INTO `settings` (`setting_key`, `setting_value`)
VALUES ('retrieval_min_score', '0.3');
