-- Nexam standalone MySQL schema (React + Node.js + Flutter architecture).
-- Use only for a new/empty database. Existing installations should apply
-- numbered migrations instead of importing this destructive bootstrap file.

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` varchar(36) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `first_name` varchar(100) NOT NULL DEFAULT '',
  `middle_name` varchar(100) NOT NULL DEFAULT '',
  `last_name` varchar(100) NOT NULL DEFAULT '',
  `name_ext` varchar(20) NOT NULL DEFAULT '',
  `full_name` varchar(255) NOT NULL,
  `avatar_path` varchar(255) NOT NULL DEFAULT '',
  `bell_last_seen` int(11) NOT NULL DEFAULT 0,
  `role` varchar(50) NOT NULL DEFAULT 'instructor',
  `email_verified` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `otp_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `otp_codes` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `code` varchar(10) NOT NULL,
  `used` tinyint(1) NOT NULL DEFAULT 0,
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `otp_codes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `settings` (
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `subjects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `subjects` (
  `id` varchar(36) NOT NULL,
  `instructor_id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(50) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `instructor_id` (`instructor_id`),
  CONSTRAINT `subjects_ibfk_1` FOREIGN KEY (`instructor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `materials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `materials` (
  `id` varchar(36) NOT NULL,
  `subject_id` varchar(36) NOT NULL,
  `created_by` char(36) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `type` varchar(20) NOT NULL DEFAULT 'text',
  `source_type` varchar(20) NOT NULL DEFAULT 'file',
  `content` mediumtext DEFAULT NULL,
  `url` varchar(2048) DEFAULT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `file_size` bigint(20) DEFAULT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `error` text DEFAULT NULL,
  `chunk_count` int(11) NOT NULL DEFAULT 0,
  `processed_at` timestamp NULL DEFAULT NULL,
  `is_syllabus` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_materials_subject` (`subject_id`),
  KEY `idx_materials_user` (`created_by`),
  KEY `idx_materials_status` (`status`),
  KEY `idx_materials_subject_status` (`subject_id`,`status`),
  CONSTRAINT `materials_ibfk_1` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `material_chunks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `material_chunks` (
  `id` char(36) NOT NULL,
  `material_id` char(36) NOT NULL,
  `subject_id` char(36) NOT NULL,
  `ordinal` int(11) NOT NULL DEFAULT 0,
  `text` mediumtext NOT NULL,
  `embedding` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'JSON array of floats',
  `token_count` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_chunks_material` (`material_id`),
  KEY `idx_chunks_subject` (`subject_id`),
  CONSTRAINT `material_chunks_ibfk_1` FOREIGN KEY (`material_id`) REFERENCES `materials` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tos` (
  `id` varchar(36) NOT NULL,
  `subject_id` varchar(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `total_items` int(11) NOT NULL DEFAULT 50,
  `bloom_weights` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`bloom_weights`)),
  `status` varchar(20) NOT NULL DEFAULT 'draft' COMMENT 'draft|finalized',
  `finalized_by` char(36) DEFAULT NULL,
  `finalized_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `subject_id` (`subject_id`),
  KEY `idx_tos_status` (`status`),
  CONSTRAINT `tos_ibfk_1` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tos_topics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tos_topics` (
  `id` varchar(36) NOT NULL,
  `tos_id` varchar(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `instructional_hours` int(11) NOT NULL DEFAULT 0,
  `learning_outcomes` text DEFAULT NULL,
  `item_count` int(11) NOT NULL DEFAULT 0,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `tos_id` (`tos_id`),
  CONSTRAINT `tos_topics_ibfk_1` FOREIGN KEY (`tos_id`) REFERENCES `tos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `questions` (
  `id` char(36) NOT NULL,
  `subject_id` char(36) NOT NULL,
  `tos_id` char(36) DEFAULT NULL,
  `topic` varchar(255) DEFAULT NULL,
  `bloom` varchar(20) DEFAULT NULL,
  `ai_predicted_bloom` varchar(20) DEFAULT NULL,
  `type` varchar(20) NOT NULL DEFAULT 'mcq',
  `stem` text NOT NULL,
  `options` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`options`)),
  `answer` text DEFAULT NULL,
  `explanation` text DEFAULT NULL,
  `embedding` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `similarity_flag` varchar(20) NOT NULL DEFAULT 'none' COMMENT 'none|similar|flagged',
  `similarity_score` decimal(5,4) DEFAULT NULL,
  `similarity_checked_at` timestamp NULL DEFAULT NULL,
  `similarity_error` text DEFAULT NULL,
  `generation_meta` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'JSON: prompt, chunk ids, model, tokens',
  `approved_by` char(36) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft' COMMENT 'draft|active|rejected',
  `source` varchar(20) NOT NULL DEFAULT 'ai',
  `created_by` char(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_questions_subject` (`subject_id`),
  KEY `idx_questions_status` (`status`),
  KEY `idx_questions_tos` (`tos_id`),
  KEY `idx_questions_similarity` (`similarity_flag`),
  KEY `idx_questions_source` (`source`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `question_tos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `question_tos` (
  `question_id` char(36) NOT NULL,
  `tos_id` char(36) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`question_id`,`tos_id`),
  KEY `idx_qt_tos` (`tos_id`),
  CONSTRAINT `question_tos_ibfk_1` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `question_tos_ibfk_2` FOREIGN KEY (`tos_id`) REFERENCES `tos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `similarity_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `similarity_results` (
  `id` char(36) NOT NULL,
  `question_id` char(36) NOT NULL,
  `similar_question_id` char(36) NOT NULL,
  `score` decimal(5,4) NOT NULL,
  `decided_by` char(36) DEFAULT NULL,
  `decision` varchar(20) DEFAULT NULL COMMENT 'keep|reject',
  `decided_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sim_pair` (`question_id`,`similar_question_id`),
  KEY `idx_sim_question` (`question_id`),
  KEY `idx_sim_similar` (`similar_question_id`),
  CONSTRAINT `similarity_results_ibfk_1` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `exams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `exams` (
  `id` varchar(36) NOT NULL,
  `subject_id` varchar(36) NOT NULL,
  `tos_id` char(36) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `format` varchar(20) NOT NULL DEFAULT 'print',
  `set_count` int(11) NOT NULL DEFAULT 1 COMMENT '1 or 2 (Set A / Set B)',
  `duration_minutes` int(11) DEFAULT NULL,
  `instructions` text DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_exams_subject` (`subject_id`),
  KEY `idx_exams_tos` (`tos_id`),
  CONSTRAINT `exams_ibfk_1` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `exam_questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `exam_questions` (
  `exam_id` varchar(36) NOT NULL,
  `question_id` varchar(36) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`exam_id`,`question_id`),
  KEY `question_id` (`question_id`),
  CONSTRAINT `exam_questions_ibfk_1` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `exam_questions_ibfk_2` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `exam_sets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `exam_sets` (
  `id` char(36) NOT NULL,
  `exam_id` char(36) NOT NULL,
  `set_label` varchar(10) NOT NULL DEFAULT 'A' COMMENT 'A|B',
  `pdf_path` varchar(500) DEFAULT NULL,
  `answer_key_path` varchar(500) DEFAULT NULL,
  `omr_sheet_path` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_exam_sets_exam` (`exam_id`),
  CONSTRAINT `exam_sets_ibfk_1` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `exam_set_questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `exam_set_questions` (
  `id` char(36) NOT NULL,
  `exam_set_id` char(36) NOT NULL,
  `question_id` char(36) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_esq_set` (`exam_set_id`),
  CONSTRAINT `exam_set_questions_ibfk_1` FOREIGN KEY (`exam_set_id`) REFERENCES `exam_sets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `students`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `students` (
  `id` char(36) NOT NULL,
  `instructor_id` char(36) NOT NULL,
  `subject_id` char(36) DEFAULT NULL,
  `student_number` text DEFAULT NULL,
  `student_number_hash` char(64) DEFAULT NULL,
  `full_name` text NOT NULL,
  `full_name_hash` char(64) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_students_instructor` (`instructor_id`),
  KEY `idx_students_subject` (`subject_id`),
  KEY `idx_students_number_hash` (`instructor_id`,`student_number_hash`),
  KEY `idx_students_name_hash` (`instructor_id`,`full_name_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `scan_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `scan_results` (
  `id` char(36) NOT NULL,
  `exam_id` char(36) NOT NULL,
  `exam_set_id` char(36) DEFAULT NULL,
  `student_id` char(36) DEFAULT NULL,
  `student_name` text DEFAULT NULL,
  `total_items` int(11) NOT NULL DEFAULT 0,
  `correct_count` int(11) NOT NULL DEFAULT 0,
  `score` decimal(5,2) DEFAULT NULL,
  `needs_review` tinyint(1) NOT NULL DEFAULT 0,
  `scanned_by` char(36) DEFAULT NULL,
  `scanned_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_scan_exam` (`exam_id`),
  KEY `idx_scan_student` (`student_id`),
  KEY `idx_scan_review` (`needs_review`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `scan_answers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `scan_answers` (
  `id` char(36) NOT NULL,
  `scan_result_id` char(36) NOT NULL,
  `item_number` int(11) NOT NULL,
  `marked_answer` varchar(500) DEFAULT NULL,
  `correct_answer` varchar(500) DEFAULT NULL,
  `is_correct` tinyint(1) NOT NULL DEFAULT 0,
  `ambiguous` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_sa_scan` (`scan_result_id`),
  CONSTRAINT `scan_answers_ibfk_1` FOREIGN KEY (`scan_result_id`) REFERENCES `scan_results` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `ai_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_jobs` (
  `id` char(36) NOT NULL,
  `type` varchar(40) NOT NULL COMMENT 'extract|embed|generate|similarity|syllabus_tos',
  `status` varchar(20) NOT NULL DEFAULT 'queued' COMMENT 'queued|running|done|failed',
  `priority` int(11) NOT NULL DEFAULT 0,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'JSON job params',
  `result` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'JSON job result',
  `error` text DEFAULT NULL,
  `retries` int(11) NOT NULL DEFAULT 0,
  `max_retries` int(11) NOT NULL DEFAULT 3,
  `user_id` char(36) DEFAULT NULL,
  `subject_id` char(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `started_at` timestamp NULL DEFAULT NULL,
  `finished_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ai_jobs_status` (`status`,`priority`,`created_at`),
  KEY `idx_ai_jobs_type` (`type`),
  KEY `idx_ai_jobs_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `ai_evaluations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_evaluations` (
  `id` char(36) NOT NULL,
  `component` varchar(40) NOT NULL COMMENT 'generation|similarity',
  `metric` varchar(40) NOT NULL COMMENT 'accuracy|precision|recall|f1',
  `value` decimal(6,4) NOT NULL,
  `sample_size` int(11) NOT NULL DEFAULT 0,
  `meta` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `created_by` char(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_eval_component` (`component`),
  KEY `idx_ai_eval_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

INSERT INTO `settings` (`setting_key`, `setting_value`) VALUES
  ('chunk_size_tokens', '500'),
  ('chunk_overlap_tokens', '50'),
  ('retrieval_top_k', '5'),
  ('retrieval_min_score', '0.3'),
  ('similarity_threshold', '0.85')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
