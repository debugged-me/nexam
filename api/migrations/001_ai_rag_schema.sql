-- Nexam AI/RAG schema migration
-- Run against the shared `nexam` MySQL database.
-- All tables use the same UUID + utf8mb4 conventions as the existing schema.

-- ─────────────────────────────────────────────────────────
-- 1. materials — repurpose the existing table for ingestion
-- ─────────────────────────────────────────────────────────
ALTER TABLE `materials`
  ADD COLUMN `created_by` CHAR(36) NULL AFTER `subject_id`,
  ADD COLUMN `source_type` VARCHAR(20) NOT NULL DEFAULT 'file' AFTER `type`,
  ADD COLUMN `file_path` VARCHAR(500) NULL AFTER `url`,
  ADD COLUMN `file_size` BIGINT NULL AFTER `file_path`,
  ADD COLUMN `mime_type` VARCHAR(100) NULL AFTER `file_size`,
  ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'pending' AFTER `mime_type`,
  ADD COLUMN `error` TEXT NULL AFTER `status`,
  ADD COLUMN `chunk_count` INT NOT NULL DEFAULT 0 AFTER `error`,
  ADD COLUMN `processed_at` TIMESTAMP NULL AFTER `chunk_count`,
  ADD COLUMN `is_syllabus` TINYINT(1) NOT NULL DEFAULT 0 AFTER `processed_at`,
  ADD KEY `idx_materials_user` (`created_by`),
  ADD KEY `idx_materials_status` (`status`),
  ADD KEY `idx_materials_subject_status` (`subject_id`, `status`);

-- ─────────────────────────────────────────────────────────
-- 2. material_chunks — chunked text + embeddings per subject
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `material_chunks` (
  `id` CHAR(36) NOT NULL,
  `material_id` CHAR(36) NOT NULL,
  `subject_id` CHAR(36) NOT NULL,
  `ordinal` INT NOT NULL DEFAULT 0,
  `text` MEDIUMTEXT NOT NULL,
  `embedding` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL COMMENT 'JSON array of floats',
  `token_count` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_chunks_material` (`material_id`),
  KEY `idx_chunks_subject` (`subject_id`),
  CONSTRAINT `material_chunks_ibfk_1` FOREIGN KEY (`material_id`) REFERENCES `materials` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─────────────────────────────────────────────────────────
-- 3. ai_jobs — async job queue for extraction/embedding/gen
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ai_jobs` (
  `id` CHAR(36) NOT NULL,
  `type` VARCHAR(40) NOT NULL COMMENT 'extract|embed|generate|similarity|syllabus_tos',
  `status` VARCHAR(20) NOT NULL DEFAULT 'queued' COMMENT 'queued|running|done|failed',
  `priority` INT NOT NULL DEFAULT 0,
  `payload` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL COMMENT 'JSON job params',
  `result` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL COMMENT 'JSON job result',
  `error` TEXT NULL,
  `retries` INT NOT NULL DEFAULT 0,
  `max_retries` INT NOT NULL DEFAULT 3,
  `user_id` CHAR(36) NULL,
  `subject_id` CHAR(36) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  `started_at` TIMESTAMP NULL,
  `finished_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ai_jobs_status` (`status`, `priority`, `created_at`),
  KEY `idx_ai_jobs_type` (`type`),
  KEY `idx_ai_jobs_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─────────────────────────────────────────────────────────
-- 4. questions — add embedding + similarity + provenance
-- ─────────────────────────────────────────────────────────
ALTER TABLE `questions`
  ADD COLUMN `embedding` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL AFTER `explanation`,
  ADD COLUMN `similarity_flag` VARCHAR(20) NOT NULL DEFAULT 'none' COMMENT 'none|similar|flagged' AFTER `embedding`,
  ADD COLUMN `similarity_score` DECIMAL(5,4) NULL AFTER `similarity_flag`,
  ADD COLUMN `generation_meta` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL COMMENT 'JSON: prompt, chunk ids, model, tokens' AFTER `similarity_score`,
  ADD COLUMN `ai_predicted_bloom` VARCHAR(20) NULL COMMENT 'Original AI-assigned Bloom level, for confusion matrix evaluation' AFTER `similarity_score`,
  ADD COLUMN `approved_by` CHAR(36) NULL AFTER `generation_meta`,
  ADD COLUMN `approved_at` TIMESTAMP NULL AFTER `approved_by`,
  ADD KEY `idx_questions_tos` (`tos_id`),
  ADD KEY `idx_questions_similarity` (`similarity_flag`),
  ADD KEY `idx_questions_source` (`source`);

-- ─────────────────────────────────────────────────────────
-- 5. similarity_results — pair comparisons + instructor decision
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `similarity_results` (
  `id` CHAR(36) NOT NULL,
  `question_id` CHAR(36) NOT NULL,
  `similar_question_id` CHAR(36) NOT NULL,
  `score` DECIMAL(5,4) NOT NULL,
  `decided_by` CHAR(36) NULL,
  `decision` VARCHAR(20) NULL COMMENT 'keep|reject',
  `decided_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_sim_question` (`question_id`),
  KEY `idx_sim_similar` (`similar_question_id`),
  CONSTRAINT `similarity_results_ibfk_1` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─────────────────────────────────────────────────────────
-- 6. tos_topics — add learning_outcomes (scope requires it)
-- ─────────────────────────────────────────────────────────
ALTER TABLE `tos_topics`
  ADD COLUMN `learning_outcomes` TEXT NULL AFTER `instructional_hours`,
  ADD COLUMN `item_count` INT NOT NULL DEFAULT 0 AFTER `learning_outcomes`;

-- ─────────────────────────────────────────────────────────
-- 7. question_tos — many-to-many linkage for reuse across terms
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `question_tos` (
  `question_id` CHAR(36) NOT NULL,
  `tos_id` CHAR(36) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`question_id`, `tos_id`),
  KEY `idx_qt_tos` (`tos_id`),
  CONSTRAINT `question_tos_ibfk_1` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `question_tos_ibfk_2` FOREIGN KEY (`tos_id`) REFERENCES `tos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─────────────────────────────────────────────────────────
-- 8. exam_sets — Set A / Set B per exam (scope item #7)
-- ─────────────────────────────────────────────────────────
ALTER TABLE `exams`
  ADD COLUMN `tos_id` CHAR(36) NULL AFTER `subject_id`,
  ADD COLUMN `set_count` INT NOT NULL DEFAULT 1 COMMENT '1 or 2 (Set A / Set B)' AFTER `format`,
  ADD KEY `idx_exams_tos` (`tos_id`);

CREATE TABLE IF NOT EXISTS `exam_sets` (
  `id` CHAR(36) NOT NULL,
  `exam_id` CHAR(36) NOT NULL,
  `set_label` VARCHAR(10) NOT NULL DEFAULT 'A' COMMENT 'A|B',
  `pdf_path` VARCHAR(500) NULL,
  `answer_key_path` VARCHAR(500) NULL,
  `omr_sheet_path` VARCHAR(500) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_exam_sets_exam` (`exam_id`),
  CONSTRAINT `exam_sets_ibfk_1` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `exam_set_questions` (
  `id` CHAR(36) NOT NULL,
  `exam_set_id` CHAR(36) NOT NULL,
  `question_id` CHAR(36) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_esq_set` (`exam_set_id`),
  CONSTRAINT `exam_set_questions_ibfk_1` FOREIGN KEY (`exam_set_id`) REFERENCES `exam_sets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─────────────────────────────────────────────────────────
-- 9. OMR scan results (scope items #10, #11)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `students` (
  `id` CHAR(36) NOT NULL,
  `instructor_id` CHAR(36) NOT NULL,
  `subject_id` CHAR(36) NULL,
  `student_number` VARCHAR(100) NULL,
  `full_name` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_students_instructor` (`instructor_id`),
  KEY `idx_students_subject` (`subject_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `scan_results` (
  `id` CHAR(36) NOT NULL,
  `exam_id` CHAR(36) NOT NULL,
  `exam_set_id` CHAR(36) NULL,
  `student_id` CHAR(36) NULL,
  `student_name` VARCHAR(255) NULL,
  `total_items` INT NOT NULL DEFAULT 0,
  `correct_count` INT NOT NULL DEFAULT 0,
  `score` DECIMAL(5,2) NULL,
  `needs_review` TINYINT(1) NOT NULL DEFAULT 0,
  `scanned_by` CHAR(36) NULL,
  `scanned_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_scan_exam` (`exam_id`),
  KEY `idx_scan_student` (`student_id`),
  KEY `idx_scan_review` (`needs_review`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `scan_answers` (
  `id` CHAR(36) NOT NULL,
  `scan_result_id` CHAR(36) NOT NULL,
  `item_number` INT NOT NULL,
  `marked_answer` VARCHAR(20) NULL,
  `correct_answer` VARCHAR(20) NULL,
  `is_correct` TINYINT(1) NOT NULL DEFAULT 0,
  `ambiguous` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_sa_scan` (`scan_result_id`),
  CONSTRAINT `scan_answers_ibfk_1` FOREIGN KEY (`scan_result_id`) REFERENCES `scan_results` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─────────────────────────────────────────────────────────
-- 10. ai_evaluations — metrics for Phase 13 (Accuracy/P/R/F1)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ai_evaluations` (
  `id` CHAR(36) NOT NULL,
  `component` VARCHAR(40) NOT NULL COMMENT 'generation|similarity',
  `metric` VARCHAR(40) NOT NULL COMMENT 'accuracy|precision|recall|f1',
  `value` DECIMAL(6,4) NOT NULL,
  `sample_size` INT NOT NULL DEFAULT 0,
  `meta` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_eval_component` (`component`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─────────────────────────────────────────────────────────
-- 11. settings — app-wide config (similarity threshold, etc.)
-- ─────────────────────────────────────────────────────────
-- `settings` already exists in the nexam DB (setting_key / setting_value).
-- Seed the AI-related keys idempotently.
INSERT INTO `settings` (`setting_key`, `setting_value`) VALUES
  ('similarity_threshold', '0.85'),
  ('chunk_size_tokens', '500'),
  ('chunk_overlap_tokens', '50'),
  ('retrieval_top_k', '5')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);
