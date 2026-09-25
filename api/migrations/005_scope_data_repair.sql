-- Nexam migration 005 — quarantine legacy records that violate the approved
-- objective-only / reviewed-question scope. Run after 004.
--
-- Recovery: the backup tables retain every detached relationship and the
-- previous question status/audit fields.

CREATE TABLE IF NOT EXISTS `scope_alignment_question_backup` AS
SELECT q.id, q.type, q.status, q.similarity_flag, q.approved_by, q.approved_at,
       q.updated_at, CURRENT_TIMESTAMP AS backed_up_at
FROM questions q
WHERE 1 = 0;

INSERT INTO `scope_alignment_question_backup`
SELECT q.id, q.type, q.status, q.similarity_flag, q.approved_by, q.approved_at,
       q.updated_at, CURRENT_TIMESTAMP
FROM questions q
WHERE q.type NOT IN ('mcq', 'true_false', 'matching', 'identification')
   OR (q.status = 'active' AND (
       q.similarity_checked_at IS NULL OR q.similarity_error IS NOT NULL
       OR q.similarity_flag <> 'none'
       OR (q.source = 'ai' AND (
         q.approved_by IS NULL OR q.approved_at IS NULL
         OR JSON_UNQUOTE(JSON_EXTRACT(q.generation_meta, '$.evidence')) IS NULL
       ))
   ));

CREATE TABLE IF NOT EXISTS `scope_alignment_exam_questions_backup` AS
SELECT eq.exam_id, eq.question_id, eq.sort_order, CURRENT_TIMESTAMP AS backed_up_at
FROM exam_questions eq
WHERE 1 = 0;

INSERT INTO `scope_alignment_exam_questions_backup`
SELECT eq.exam_id, eq.question_id, eq.sort_order, CURRENT_TIMESTAMP
FROM exam_questions eq
JOIN questions q ON q.id = eq.question_id
WHERE q.status <> 'active'
   OR q.type NOT IN ('mcq', 'true_false', 'matching', 'identification')
   OR q.similarity_checked_at IS NULL OR q.similarity_error IS NOT NULL
   OR q.similarity_flag <> 'none'
   OR (q.source = 'ai' AND (
     q.approved_by IS NULL OR q.approved_at IS NULL
     OR JSON_UNQUOTE(JSON_EXTRACT(q.generation_meta, '$.evidence')) IS NULL
   ));

CREATE TABLE IF NOT EXISTS `scope_alignment_exam_sets_backup` AS
SELECT es.*, CURRENT_TIMESTAMP AS backed_up_at
FROM exam_sets es
WHERE 1 = 0;

INSERT INTO `scope_alignment_exam_sets_backup`
SELECT es.*, CURRENT_TIMESTAMP
FROM exam_sets es
WHERE EXISTS (
  SELECT 1 FROM exam_set_questions esq
  JOIN questions q ON q.id = esq.question_id
  WHERE esq.exam_set_id = es.id
    AND (q.status <> 'active'
      OR q.type NOT IN ('mcq', 'true_false', 'matching', 'identification')
      OR q.similarity_checked_at IS NULL OR q.similarity_error IS NOT NULL
      OR q.similarity_flag <> 'none'
      OR (q.source = 'ai' AND (
        q.approved_by IS NULL OR q.approved_at IS NULL
        OR JSON_UNQUOTE(JSON_EXTRACT(q.generation_meta, '$.evidence')) IS NULL
      )))
);

CREATE TABLE IF NOT EXISTS `scope_alignment_exam_set_questions_backup` AS
SELECT esq.id, esq.exam_set_id, esq.question_id, esq.sort_order,
       CURRENT_TIMESTAMP AS backed_up_at
FROM exam_set_questions esq
WHERE 1 = 0;

INSERT INTO `scope_alignment_exam_set_questions_backup`
SELECT esq.id, esq.exam_set_id, esq.question_id, esq.sort_order, CURRENT_TIMESTAMP
FROM exam_set_questions esq
WHERE esq.exam_set_id IN (SELECT id FROM scope_alignment_exam_sets_backup);

-- Unsupported legacy formats remain available for audit but cannot circulate.
UPDATE questions
SET status = 'rejected', similarity_flag = 'rejected', updated_at = NOW()
WHERE type NOT IN ('mcq', 'true_false', 'matching', 'identification');

-- We cannot invent a historical instructor decision or similarity result.
-- Active questions without both return to the review queue instead.
UPDATE questions
SET status = 'draft', approved_by = NULL, approved_at = NULL, updated_at = NOW()
WHERE status = 'active' AND (
  similarity_checked_at IS NULL OR similarity_error IS NOT NULL
  OR similarity_flag <> 'none'
  OR (source = 'ai' AND (
    approved_by IS NULL OR approved_at IS NULL
    OR JSON_UNQUOTE(JSON_EXTRACT(generation_meta, '$.evidence')) IS NULL
  ))
);

DELETE eq FROM exam_questions eq
JOIN questions q ON q.id = eq.question_id
WHERE q.status <> 'active'
   OR q.type NOT IN ('mcq', 'true_false', 'matching', 'identification')
   OR q.similarity_checked_at IS NULL OR q.similarity_error IS NOT NULL
   OR q.similarity_flag <> 'none'
   OR (q.source = 'ai' AND (
     q.approved_by IS NULL OR q.approved_at IS NULL
     OR JSON_UNQUOTE(JSON_EXTRACT(q.generation_meta, '$.evidence')) IS NULL
   ));

DELETE esq FROM exam_set_questions esq
WHERE esq.exam_set_id IN (SELECT id FROM scope_alignment_exam_sets_backup);

-- Existing generated files may no longer match their sanitized set mapping.
-- Drop the database publication records for every affected set; files stay on
-- disk for recovery and cannot be downloaded through the authenticated route.
DELETE es FROM exam_sets es
WHERE es.id IN (SELECT id FROM scope_alignment_exam_sets_backup);
