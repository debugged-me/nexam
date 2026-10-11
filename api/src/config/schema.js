/**
 * schema.js — idempotent schema ensure, run once at boot before the server
 * accepts traffic. Every statement is guarded (CREATE TABLE IF NOT EXISTS /
 * ADD COLUMN/KEY/CONSTRAINT IF NOT EXISTS) so it is safe to run repeatedly
 * on production: existing tables, columns, indexes, and constraints are left
 * untouched; nothing is dropped or rewritten. The CREATEs cover a fresh
 * install; the ALTERs converge older/partial databases to the current shape.
 * Keep this list append-only — migrations/00X_*.sql files remain the
 * human-readable record of when each change was introduced.
 */
import pool from './db.js';

const DDL = [
  // users
  `CREATE TABLE IF NOT EXISTS users (
  id varchar(36) NOT NULL,
  email varchar(255) NOT NULL,
  password_hash varchar(255) NOT NULL,
  first_name varchar(100) NOT NULL DEFAULT '',
  middle_name varchar(100) NOT NULL DEFAULT '',
  last_name varchar(100) NOT NULL DEFAULT '',
  name_ext varchar(20) NOT NULL DEFAULT '',
  full_name varchar(255) NOT NULL,
  avatar_path varchar(255) DEFAULT NULL,
  bell_last_seen int(11) NOT NULL DEFAULT 0,
  role varchar(50) NOT NULL DEFAULT 'instructor',
  email_verified tinyint(1) NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'active',
  approved_by varchar(36) DEFAULT NULL,
  approved_at datetime DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  avatar_v int(10) unsigned NOT NULL DEFAULT 0,
  theme varchar(10) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS id VARCHAR(36) NOT NULL`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) NOT NULL`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NOT NULL DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100) NOT NULL DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NOT NULL DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS name_ext VARCHAR(20) NOT NULL DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255) NOT NULL`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_path VARCHAR(255) NULL DEFAULT NULL`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS bell_last_seen INT(11) NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'instructor'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TINYINT(1) NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by VARCHAR(36) NULL DEFAULT NULL`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at DATETIME NULL DEFAULT NULL`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT current_timestamp()`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_v INT(10) UNSIGNED NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS theme VARCHAR(10) NULL DEFAULT NULL`,
  `ALTER TABLE users ADD UNIQUE KEY IF NOT EXISTS email (email)`,

  // subjects
  `CREATE TABLE IF NOT EXISTS subjects (
  id varchar(36) NOT NULL,
  instructor_id varchar(36) NOT NULL,
  name varchar(255) NOT NULL,
  code varchar(50) DEFAULT NULL,
  description text DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY instructor_id (instructor_id),
  CONSTRAINT subjects_ibfk_1 FOREIGN KEY (instructor_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE subjects ADD COLUMN IF NOT EXISTS id VARCHAR(36) NOT NULL`,
  `ALTER TABLE subjects ADD COLUMN IF NOT EXISTS instructor_id VARCHAR(36) NOT NULL`,
  `ALTER TABLE subjects ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL`,
  `ALTER TABLE subjects ADD COLUMN IF NOT EXISTS code VARCHAR(50) NULL DEFAULT NULL`,
  `ALTER TABLE subjects ADD COLUMN IF NOT EXISTS description TEXT NULL DEFAULT NULL`,
  `ALTER TABLE subjects ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT current_timestamp()`,
  `ALTER TABLE subjects ADD INDEX IF NOT EXISTS instructor_id (instructor_id)`,
  `ALTER TABLE subjects ADD FOREIGN KEY IF NOT EXISTS subjects_ibfk_1 (instructor_id) REFERENCES users (id) ON DELETE CASCADE`,

  // materials
  `CREATE TABLE IF NOT EXISTS materials (
  id varchar(36) NOT NULL,
  subject_id varchar(36) NOT NULL,
  created_by char(36) DEFAULT NULL,
  title varchar(255) NOT NULL,
  type varchar(20) NOT NULL DEFAULT 'text',
  source_type varchar(20) NOT NULL DEFAULT 'file',
  content mediumtext DEFAULT NULL,
  url varchar(2048) DEFAULT NULL,
  file_path varchar(500) DEFAULT NULL,
  file_size bigint(20) DEFAULT NULL,
  mime_type varchar(100) DEFAULT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  error text DEFAULT NULL,
  chunk_count int(11) NOT NULL DEFAULT 0,
  processed_at timestamp NULL DEFAULT NULL,
  is_syllabus tinyint(1) NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY idx_materials_subject (subject_id),
  KEY idx_materials_user (created_by),
  KEY idx_materials_status (status),
  KEY idx_materials_subject_status (subject_id,status),
  CONSTRAINT materials_ibfk_1 FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE materials ADD COLUMN IF NOT EXISTS id VARCHAR(36) NOT NULL`,
  `ALTER TABLE materials ADD COLUMN IF NOT EXISTS subject_id VARCHAR(36) NOT NULL`,
  `ALTER TABLE materials ADD COLUMN IF NOT EXISTS created_by CHAR(36) NULL DEFAULT NULL`,
  `ALTER TABLE materials ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL`,
  `ALTER TABLE materials ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'text'`,
  `ALTER TABLE materials ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'file'`,
  `ALTER TABLE materials ADD COLUMN IF NOT EXISTS content MEDIUMTEXT NULL DEFAULT NULL`,
  `ALTER TABLE materials ADD COLUMN IF NOT EXISTS url VARCHAR(2048) NULL DEFAULT NULL`,
  `ALTER TABLE materials ADD COLUMN IF NOT EXISTS file_path VARCHAR(500) NULL DEFAULT NULL`,
  `ALTER TABLE materials ADD COLUMN IF NOT EXISTS file_size BIGINT(20) NULL DEFAULT NULL`,
  `ALTER TABLE materials ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) NULL DEFAULT NULL`,
  `ALTER TABLE materials ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending'`,
  `ALTER TABLE materials ADD COLUMN IF NOT EXISTS error TEXT NULL DEFAULT NULL`,
  `ALTER TABLE materials ADD COLUMN IF NOT EXISTS chunk_count INT(11) NOT NULL DEFAULT 0`,
  `ALTER TABLE materials ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP NULL DEFAULT NULL`,
  `ALTER TABLE materials ADD COLUMN IF NOT EXISTS is_syllabus TINYINT(1) NOT NULL DEFAULT 0`,
  `ALTER TABLE materials ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT current_timestamp()`,
  `ALTER TABLE materials ADD INDEX IF NOT EXISTS idx_materials_subject (subject_id)`,
  `ALTER TABLE materials ADD INDEX IF NOT EXISTS idx_materials_user (created_by)`,
  `ALTER TABLE materials ADD INDEX IF NOT EXISTS idx_materials_status (status)`,
  `ALTER TABLE materials ADD INDEX IF NOT EXISTS idx_materials_subject_status (subject_id,status)`,
  `ALTER TABLE materials ADD FOREIGN KEY IF NOT EXISTS materials_ibfk_1 (subject_id) REFERENCES subjects (id) ON DELETE CASCADE`,

  // material_chunks
  `CREATE TABLE IF NOT EXISTS material_chunks (
  id char(36) NOT NULL,
  material_id char(36) NOT NULL,
  subject_id char(36) NOT NULL,
  ordinal int(11) NOT NULL DEFAULT 0,
  text mediumtext NOT NULL,
  embedding longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'JSON array of floats',
  token_count int(11) NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY idx_chunks_material (material_id),
  KEY idx_chunks_subject (subject_id),
  CONSTRAINT material_chunks_ibfk_1 FOREIGN KEY (material_id) REFERENCES materials (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE material_chunks ADD COLUMN IF NOT EXISTS id CHAR(36) NOT NULL`,
  `ALTER TABLE material_chunks ADD COLUMN IF NOT EXISTS material_id CHAR(36) NOT NULL`,
  `ALTER TABLE material_chunks ADD COLUMN IF NOT EXISTS subject_id CHAR(36) NOT NULL`,
  `ALTER TABLE material_chunks ADD COLUMN IF NOT EXISTS ordinal INT(11) NOT NULL DEFAULT 0`,
  `ALTER TABLE material_chunks ADD COLUMN IF NOT EXISTS text MEDIUMTEXT NOT NULL`,
  `ALTER TABLE material_chunks ADD COLUMN IF NOT EXISTS embedding LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL COMMENT 'JSON array of floats'`,
  `ALTER TABLE material_chunks ADD COLUMN IF NOT EXISTS token_count INT(11) NOT NULL DEFAULT 0`,
  `ALTER TABLE material_chunks ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT current_timestamp()`,
  `ALTER TABLE material_chunks ADD INDEX IF NOT EXISTS idx_chunks_material (material_id)`,
  `ALTER TABLE material_chunks ADD INDEX IF NOT EXISTS idx_chunks_subject (subject_id)`,
  `ALTER TABLE material_chunks ADD FOREIGN KEY IF NOT EXISTS material_chunks_ibfk_1 (material_id) REFERENCES materials (id) ON DELETE CASCADE`,

  // tos
  `CREATE TABLE IF NOT EXISTS tos (
  id varchar(36) NOT NULL,
  subject_id varchar(36) NOT NULL,
  title varchar(255) NOT NULL,
  total_items int(11) NOT NULL DEFAULT 50,
  bloom_weights longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(bloom_weights)),
  status varchar(20) NOT NULL DEFAULT 'draft' COMMENT 'draft|finalized',
  finalized_by char(36) DEFAULT NULL,
  finalized_at timestamp NULL DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (id),
  KEY subject_id (subject_id),
  KEY idx_tos_status (status),
  CONSTRAINT tos_ibfk_1 FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE tos ADD COLUMN IF NOT EXISTS id VARCHAR(36) NOT NULL`,
  `ALTER TABLE tos ADD COLUMN IF NOT EXISTS subject_id VARCHAR(36) NOT NULL`,
  `ALTER TABLE tos ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL`,
  `ALTER TABLE tos ADD COLUMN IF NOT EXISTS total_items INT(11) NOT NULL DEFAULT 50`,
  `ALTER TABLE tos ADD COLUMN IF NOT EXISTS bloom_weights LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL`,
  `ALTER TABLE tos ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft' COMMENT 'draft|finalized'`,
  `ALTER TABLE tos ADD COLUMN IF NOT EXISTS finalized_by CHAR(36) NULL DEFAULT NULL`,
  `ALTER TABLE tos ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP NULL DEFAULT NULL`,
  `ALTER TABLE tos ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT current_timestamp()`,
  `ALTER TABLE tos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE tos ADD INDEX IF NOT EXISTS subject_id (subject_id)`,
  `ALTER TABLE tos ADD INDEX IF NOT EXISTS idx_tos_status (status)`,
  `ALTER TABLE tos ADD FOREIGN KEY IF NOT EXISTS tos_ibfk_1 (subject_id) REFERENCES subjects (id) ON DELETE CASCADE`,

  // tos_topics
  `CREATE TABLE IF NOT EXISTS tos_topics (
  id varchar(36) NOT NULL,
  tos_id varchar(36) NOT NULL,
  title varchar(255) NOT NULL,
  instructional_hours int(11) NOT NULL DEFAULT 0,
  learning_outcomes text DEFAULT NULL,
  item_count int(11) NOT NULL DEFAULT 0,
  sort_order int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY tos_id (tos_id),
  CONSTRAINT tos_topics_ibfk_1 FOREIGN KEY (tos_id) REFERENCES tos (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE tos_topics ADD COLUMN IF NOT EXISTS id VARCHAR(36) NOT NULL`,
  `ALTER TABLE tos_topics ADD COLUMN IF NOT EXISTS tos_id VARCHAR(36) NOT NULL`,
  `ALTER TABLE tos_topics ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL`,
  `ALTER TABLE tos_topics ADD COLUMN IF NOT EXISTS instructional_hours INT(11) NOT NULL DEFAULT 0`,
  `ALTER TABLE tos_topics ADD COLUMN IF NOT EXISTS learning_outcomes TEXT NULL DEFAULT NULL`,
  `ALTER TABLE tos_topics ADD COLUMN IF NOT EXISTS item_count INT(11) NOT NULL DEFAULT 0`,
  `ALTER TABLE tos_topics ADD COLUMN IF NOT EXISTS sort_order INT(11) NOT NULL DEFAULT 0`,
  `ALTER TABLE tos_topics ADD INDEX IF NOT EXISTS tos_id (tos_id)`,
  `ALTER TABLE tos_topics ADD FOREIGN KEY IF NOT EXISTS tos_topics_ibfk_1 (tos_id) REFERENCES tos (id) ON DELETE CASCADE`,

  // questions
  `CREATE TABLE IF NOT EXISTS questions (
  id char(36) NOT NULL,
  subject_id char(36) NOT NULL,
  tos_id char(36) DEFAULT NULL,
  topic varchar(255) DEFAULT NULL,
  bloom varchar(20) DEFAULT NULL,
  ai_predicted_bloom varchar(20) DEFAULT NULL,
  type varchar(20) NOT NULL DEFAULT 'mcq',
  stem text NOT NULL,
  options longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(options)),
  answer text DEFAULT NULL,
  explanation text DEFAULT NULL,
  embedding longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  similarity_flag varchar(20) NOT NULL DEFAULT 'none' COMMENT 'none|similar|flagged',
  similarity_score decimal(5,4) DEFAULT NULL,
  similarity_checked_at timestamp NULL DEFAULT NULL,
  similarity_error text DEFAULT NULL,
  generation_meta longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'JSON: prompt, chunk ids, model, tokens',
  approved_by char(36) DEFAULT NULL,
  approved_at timestamp NULL DEFAULT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft' COMMENT 'draft|active|rejected',
  source varchar(20) NOT NULL DEFAULT 'ai',
  created_by char(36) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (id),
  KEY idx_questions_subject (subject_id),
  KEY idx_questions_status (status),
  KEY idx_questions_tos (tos_id),
  KEY idx_questions_similarity (similarity_flag),
  KEY idx_questions_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS id CHAR(36) NOT NULL`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS subject_id CHAR(36) NOT NULL`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS tos_id CHAR(36) NULL DEFAULT NULL`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS topic VARCHAR(255) NULL DEFAULT NULL`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS bloom VARCHAR(20) NULL DEFAULT NULL`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS ai_predicted_bloom VARCHAR(20) NULL DEFAULT NULL`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'mcq'`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS stem TEXT NOT NULL`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS options LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS answer TEXT NULL DEFAULT NULL`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation TEXT NULL DEFAULT NULL`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS embedding LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS similarity_flag VARCHAR(20) NOT NULL DEFAULT 'none' COMMENT 'none|similar|flagged'`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS similarity_score DECIMAL(5,4) NULL DEFAULT NULL`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS similarity_checked_at TIMESTAMP NULL DEFAULT NULL`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS similarity_error TEXT NULL DEFAULT NULL`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS generation_meta LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL COMMENT 'JSON: prompt, chunk ids, model, tokens'`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS approved_by CHAR(36) NULL DEFAULT NULL`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL DEFAULT NULL`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft' COMMENT 'draft|active|rejected'`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'ai'`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS created_by CHAR(36) NULL DEFAULT NULL`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT current_timestamp()`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE questions ADD INDEX IF NOT EXISTS idx_questions_subject (subject_id)`,
  `ALTER TABLE questions ADD INDEX IF NOT EXISTS idx_questions_status (status)`,
  `ALTER TABLE questions ADD INDEX IF NOT EXISTS idx_questions_tos (tos_id)`,
  `ALTER TABLE questions ADD INDEX IF NOT EXISTS idx_questions_similarity (similarity_flag)`,
  `ALTER TABLE questions ADD INDEX IF NOT EXISTS idx_questions_source (source)`,

  // question_tos
  `CREATE TABLE IF NOT EXISTS question_tos (
  question_id char(36) NOT NULL,
  tos_id char(36) NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (question_id,tos_id),
  KEY idx_qt_tos (tos_id),
  CONSTRAINT question_tos_ibfk_1 FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE,
  CONSTRAINT question_tos_ibfk_2 FOREIGN KEY (tos_id) REFERENCES tos (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE question_tos ADD COLUMN IF NOT EXISTS question_id CHAR(36) NOT NULL`,
  `ALTER TABLE question_tos ADD COLUMN IF NOT EXISTS tos_id CHAR(36) NOT NULL`,
  `ALTER TABLE question_tos ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT current_timestamp()`,
  `ALTER TABLE question_tos ADD INDEX IF NOT EXISTS idx_qt_tos (tos_id)`,
  `ALTER TABLE question_tos ADD FOREIGN KEY IF NOT EXISTS question_tos_ibfk_1 (question_id) REFERENCES questions (id) ON DELETE CASCADE`,
  `ALTER TABLE question_tos ADD FOREIGN KEY IF NOT EXISTS question_tos_ibfk_2 (tos_id) REFERENCES tos (id) ON DELETE CASCADE`,

  // exams
  `CREATE TABLE IF NOT EXISTS exams (
  id varchar(36) NOT NULL,
  subject_id varchar(36) NOT NULL,
  tos_id char(36) DEFAULT NULL,
  title varchar(255) NOT NULL,
  format varchar(20) NOT NULL DEFAULT 'print',
  set_count int(11) NOT NULL DEFAULT 1 COMMENT '1 or 2 (Set A / Set B)',
  duration_minutes int(11) DEFAULT NULL,
  instructions text DEFAULT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft',
  created_by varchar(36) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (id),
  KEY idx_exams_subject (subject_id),
  KEY idx_exams_tos (tos_id),
  CONSTRAINT exams_ibfk_1 FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE exams ADD COLUMN IF NOT EXISTS id VARCHAR(36) NOT NULL`,
  `ALTER TABLE exams ADD COLUMN IF NOT EXISTS subject_id VARCHAR(36) NOT NULL`,
  `ALTER TABLE exams ADD COLUMN IF NOT EXISTS tos_id CHAR(36) NULL DEFAULT NULL`,
  `ALTER TABLE exams ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL`,
  `ALTER TABLE exams ADD COLUMN IF NOT EXISTS format VARCHAR(20) NOT NULL DEFAULT 'print'`,
  `ALTER TABLE exams ADD COLUMN IF NOT EXISTS set_count INT(11) NOT NULL DEFAULT 1 COMMENT '1 or 2 (Set A / Set B)'`,
  `ALTER TABLE exams ADD COLUMN IF NOT EXISTS duration_minutes INT(11) NULL DEFAULT NULL`,
  `ALTER TABLE exams ADD COLUMN IF NOT EXISTS instructions TEXT NULL DEFAULT NULL`,
  `ALTER TABLE exams ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft'`,
  `ALTER TABLE exams ADD COLUMN IF NOT EXISTS created_by VARCHAR(36) NULL DEFAULT NULL`,
  `ALTER TABLE exams ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT current_timestamp()`,
  `ALTER TABLE exams ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE exams ADD INDEX IF NOT EXISTS idx_exams_subject (subject_id)`,
  `ALTER TABLE exams ADD INDEX IF NOT EXISTS idx_exams_tos (tos_id)`,
  `ALTER TABLE exams ADD FOREIGN KEY IF NOT EXISTS exams_ibfk_1 (subject_id) REFERENCES subjects (id) ON DELETE CASCADE`,

  // exam_questions
  `CREATE TABLE IF NOT EXISTS exam_questions (
  exam_id varchar(36) NOT NULL,
  question_id varchar(36) NOT NULL,
  sort_order int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (exam_id,question_id),
  KEY question_id (question_id),
  CONSTRAINT exam_questions_ibfk_1 FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE,
  CONSTRAINT exam_questions_ibfk_2 FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS exam_id VARCHAR(36) NOT NULL`,
  `ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS question_id VARCHAR(36) NOT NULL`,
  `ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS sort_order INT(11) NOT NULL DEFAULT 0`,
  `ALTER TABLE exam_questions ADD INDEX IF NOT EXISTS question_id (question_id)`,
  `ALTER TABLE exam_questions ADD FOREIGN KEY IF NOT EXISTS exam_questions_ibfk_1 (exam_id) REFERENCES exams (id) ON DELETE CASCADE`,
  `ALTER TABLE exam_questions ADD FOREIGN KEY IF NOT EXISTS exam_questions_ibfk_2 (question_id) REFERENCES questions (id) ON DELETE CASCADE`,

  // exam_sets
  `CREATE TABLE IF NOT EXISTS exam_sets (
  id char(36) NOT NULL,
  exam_id char(36) NOT NULL,
  set_label varchar(10) NOT NULL DEFAULT 'A' COMMENT 'A|B',
  pdf_path varchar(500) DEFAULT NULL,
  answer_key_path varchar(500) DEFAULT NULL,
  omr_sheet_path varchar(500) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY idx_exam_sets_exam (exam_id),
  CONSTRAINT exam_sets_ibfk_1 FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE exam_sets ADD COLUMN IF NOT EXISTS id CHAR(36) NOT NULL`,
  `ALTER TABLE exam_sets ADD COLUMN IF NOT EXISTS exam_id CHAR(36) NOT NULL`,
  `ALTER TABLE exam_sets ADD COLUMN IF NOT EXISTS set_label VARCHAR(10) NOT NULL DEFAULT 'A' COMMENT 'A|B'`,
  `ALTER TABLE exam_sets ADD COLUMN IF NOT EXISTS pdf_path VARCHAR(500) NULL DEFAULT NULL`,
  `ALTER TABLE exam_sets ADD COLUMN IF NOT EXISTS answer_key_path VARCHAR(500) NULL DEFAULT NULL`,
  `ALTER TABLE exam_sets ADD COLUMN IF NOT EXISTS omr_sheet_path VARCHAR(500) NULL DEFAULT NULL`,
  `ALTER TABLE exam_sets ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT current_timestamp()`,
  `ALTER TABLE exam_sets ADD INDEX IF NOT EXISTS idx_exam_sets_exam (exam_id)`,
  `ALTER TABLE exam_sets ADD FOREIGN KEY IF NOT EXISTS exam_sets_ibfk_1 (exam_id) REFERENCES exams (id) ON DELETE CASCADE`,

  // exam_set_questions
  `CREATE TABLE IF NOT EXISTS exam_set_questions (
  id char(36) NOT NULL,
  exam_set_id char(36) NOT NULL,
  question_id char(36) NOT NULL,
  sort_order int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_esq_set (exam_set_id),
  CONSTRAINT exam_set_questions_ibfk_1 FOREIGN KEY (exam_set_id) REFERENCES exam_sets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE exam_set_questions ADD COLUMN IF NOT EXISTS id CHAR(36) NOT NULL`,
  `ALTER TABLE exam_set_questions ADD COLUMN IF NOT EXISTS exam_set_id CHAR(36) NOT NULL`,
  `ALTER TABLE exam_set_questions ADD COLUMN IF NOT EXISTS question_id CHAR(36) NOT NULL`,
  `ALTER TABLE exam_set_questions ADD COLUMN IF NOT EXISTS sort_order INT(11) NOT NULL DEFAULT 0`,
  `ALTER TABLE exam_set_questions ADD INDEX IF NOT EXISTS idx_esq_set (exam_set_id)`,
  `ALTER TABLE exam_set_questions ADD FOREIGN KEY IF NOT EXISTS exam_set_questions_ibfk_1 (exam_set_id) REFERENCES exam_sets (id) ON DELETE CASCADE`,

  // students
  `CREATE TABLE IF NOT EXISTS students (
  id char(36) NOT NULL,
  instructor_id char(36) NOT NULL,
  subject_id char(36) DEFAULT NULL,
  student_number text DEFAULT NULL,
  student_number_hash char(64) DEFAULT NULL,
  full_name text NOT NULL,
  full_name_hash char(64) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY idx_students_instructor (instructor_id),
  KEY idx_students_subject (subject_id),
  KEY idx_students_number_hash (instructor_id,student_number_hash),
  KEY idx_students_name_hash (instructor_id,full_name_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE students ADD COLUMN IF NOT EXISTS id CHAR(36) NOT NULL`,
  `ALTER TABLE students ADD COLUMN IF NOT EXISTS instructor_id CHAR(36) NOT NULL`,
  `ALTER TABLE students ADD COLUMN IF NOT EXISTS subject_id CHAR(36) NULL DEFAULT NULL`,
  `ALTER TABLE students ADD COLUMN IF NOT EXISTS student_number TEXT NULL DEFAULT NULL`,
  `ALTER TABLE students ADD COLUMN IF NOT EXISTS student_number_hash CHAR(64) NULL DEFAULT NULL`,
  `ALTER TABLE students ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL`,
  `ALTER TABLE students ADD COLUMN IF NOT EXISTS full_name_hash CHAR(64) NULL DEFAULT NULL`,
  `ALTER TABLE students ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT current_timestamp()`,
  `ALTER TABLE students ADD INDEX IF NOT EXISTS idx_students_instructor (instructor_id)`,
  `ALTER TABLE students ADD INDEX IF NOT EXISTS idx_students_subject (subject_id)`,
  `ALTER TABLE students ADD INDEX IF NOT EXISTS idx_students_number_hash (instructor_id,student_number_hash)`,
  `ALTER TABLE students ADD INDEX IF NOT EXISTS idx_students_name_hash (instructor_id,full_name_hash)`,

  // scan_results
  `CREATE TABLE IF NOT EXISTS scan_results (
  id char(36) NOT NULL,
  exam_id char(36) NOT NULL,
  exam_set_id char(36) DEFAULT NULL,
  student_id char(36) DEFAULT NULL,
  student_name text DEFAULT NULL,
  total_items int(11) NOT NULL DEFAULT 0,
  correct_count int(11) NOT NULL DEFAULT 0,
  score decimal(5,2) DEFAULT NULL,
  needs_review tinyint(1) NOT NULL DEFAULT 0,
  scanned_by char(36) DEFAULT NULL,
  scanned_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY idx_scan_exam (exam_id),
  KEY idx_scan_student (student_id),
  KEY idx_scan_review (needs_review)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS id CHAR(36) NOT NULL`,
  `ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS exam_id CHAR(36) NOT NULL`,
  `ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS exam_set_id CHAR(36) NULL DEFAULT NULL`,
  `ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS student_id CHAR(36) NULL DEFAULT NULL`,
  `ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS student_name TEXT NULL DEFAULT NULL`,
  `ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS total_items INT(11) NOT NULL DEFAULT 0`,
  `ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS correct_count INT(11) NOT NULL DEFAULT 0`,
  `ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS score DECIMAL(5,2) NULL DEFAULT NULL`,
  `ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS needs_review TINYINT(1) NOT NULL DEFAULT 0`,
  `ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS scanned_by CHAR(36) NULL DEFAULT NULL`,
  `ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMP NOT NULL DEFAULT current_timestamp()`,
  `ALTER TABLE scan_results ADD INDEX IF NOT EXISTS idx_scan_exam (exam_id)`,
  `ALTER TABLE scan_results ADD INDEX IF NOT EXISTS idx_scan_student (student_id)`,
  `ALTER TABLE scan_results ADD INDEX IF NOT EXISTS idx_scan_review (needs_review)`,

  // scan_answers
  `CREATE TABLE IF NOT EXISTS scan_answers (
  id char(36) NOT NULL,
  scan_result_id char(36) NOT NULL,
  item_number int(11) NOT NULL,
  marked_answer varchar(500) DEFAULT NULL,
  correct_answer varchar(500) DEFAULT NULL,
  is_correct tinyint(1) NOT NULL DEFAULT 0,
  ambiguous tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_sa_scan (scan_result_id),
  CONSTRAINT scan_answers_ibfk_1 FOREIGN KEY (scan_result_id) REFERENCES scan_results (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE scan_answers ADD COLUMN IF NOT EXISTS id CHAR(36) NOT NULL`,
  `ALTER TABLE scan_answers ADD COLUMN IF NOT EXISTS scan_result_id CHAR(36) NOT NULL`,
  `ALTER TABLE scan_answers ADD COLUMN IF NOT EXISTS item_number INT(11) NOT NULL`,
  `ALTER TABLE scan_answers ADD COLUMN IF NOT EXISTS marked_answer VARCHAR(500) NULL DEFAULT NULL`,
  `ALTER TABLE scan_answers ADD COLUMN IF NOT EXISTS correct_answer VARCHAR(500) NULL DEFAULT NULL`,
  `ALTER TABLE scan_answers ADD COLUMN IF NOT EXISTS is_correct TINYINT(1) NOT NULL DEFAULT 0`,
  `ALTER TABLE scan_answers ADD COLUMN IF NOT EXISTS ambiguous TINYINT(1) NOT NULL DEFAULT 0`,
  `ALTER TABLE scan_answers ADD INDEX IF NOT EXISTS idx_sa_scan (scan_result_id)`,
  `ALTER TABLE scan_answers ADD FOREIGN KEY IF NOT EXISTS scan_answers_ibfk_1 (scan_result_id) REFERENCES scan_results (id) ON DELETE CASCADE`,

  // similarity_results
  `CREATE TABLE IF NOT EXISTS similarity_results (
  id char(36) NOT NULL,
  question_id char(36) NOT NULL,
  similar_question_id char(36) NOT NULL,
  score decimal(5,4) NOT NULL,
  decided_by char(36) DEFAULT NULL,
  decision varchar(20) DEFAULT NULL COMMENT 'keep|reject',
  decided_at timestamp NULL DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY uq_sim_pair (question_id,similar_question_id),
  KEY idx_sim_question (question_id),
  KEY idx_sim_similar (similar_question_id),
  CONSTRAINT similarity_results_ibfk_1 FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE similarity_results ADD COLUMN IF NOT EXISTS id CHAR(36) NOT NULL`,
  `ALTER TABLE similarity_results ADD COLUMN IF NOT EXISTS question_id CHAR(36) NOT NULL`,
  `ALTER TABLE similarity_results ADD COLUMN IF NOT EXISTS similar_question_id CHAR(36) NOT NULL`,
  `ALTER TABLE similarity_results ADD COLUMN IF NOT EXISTS score DECIMAL(5,4) NOT NULL`,
  `ALTER TABLE similarity_results ADD COLUMN IF NOT EXISTS decided_by CHAR(36) NULL DEFAULT NULL`,
  `ALTER TABLE similarity_results ADD COLUMN IF NOT EXISTS decision VARCHAR(20) NULL DEFAULT NULL COMMENT 'keep|reject'`,
  `ALTER TABLE similarity_results ADD COLUMN IF NOT EXISTS decided_at TIMESTAMP NULL DEFAULT NULL`,
  `ALTER TABLE similarity_results ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT current_timestamp()`,
  `ALTER TABLE similarity_results ADD UNIQUE KEY IF NOT EXISTS uq_sim_pair (question_id,similar_question_id)`,
  `ALTER TABLE similarity_results ADD INDEX IF NOT EXISTS idx_sim_question (question_id)`,
  `ALTER TABLE similarity_results ADD INDEX IF NOT EXISTS idx_sim_similar (similar_question_id)`,
  `ALTER TABLE similarity_results ADD FOREIGN KEY IF NOT EXISTS similarity_results_ibfk_1 (question_id) REFERENCES questions (id) ON DELETE CASCADE`,

  // ai_jobs
  `CREATE TABLE IF NOT EXISTS ai_jobs (
  id char(36) NOT NULL,
  type varchar(40) NOT NULL COMMENT 'extract|embed|generate|similarity|syllabus_tos',
  status varchar(20) NOT NULL DEFAULT 'queued' COMMENT 'queued|running|done|failed',
  priority int(11) NOT NULL DEFAULT 0,
  payload longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'JSON job params',
  result longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'JSON job result',
  error text DEFAULT NULL,
  retries int(11) NOT NULL DEFAULT 0,
  max_retries int(11) NOT NULL DEFAULT 3,
  user_id char(36) DEFAULT NULL,
  subject_id char(36) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  started_at timestamp NULL DEFAULT NULL,
  finished_at timestamp NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_ai_jobs_status (status,priority,created_at),
  KEY idx_ai_jobs_type (type),
  KEY idx_ai_jobs_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS id CHAR(36) NOT NULL`,
  `ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS type VARCHAR(40) NOT NULL COMMENT 'extract|embed|generate|similarity|syllabus_tos'`,
  `ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'queued' COMMENT 'queued|running|done|failed'`,
  `ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS priority INT(11) NOT NULL DEFAULT 0`,
  `ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS payload LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL COMMENT 'JSON job params'`,
  `ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS result LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL COMMENT 'JSON job result'`,
  `ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS error TEXT NULL DEFAULT NULL`,
  `ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS retries INT(11) NOT NULL DEFAULT 0`,
  `ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS max_retries INT(11) NOT NULL DEFAULT 3`,
  `ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS user_id CHAR(36) NULL DEFAULT NULL`,
  `ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS subject_id CHAR(36) NULL DEFAULT NULL`,
  `ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT current_timestamp()`,
  `ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMP NULL DEFAULT NULL`,
  `ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP NULL DEFAULT NULL`,
  `ALTER TABLE ai_jobs ADD INDEX IF NOT EXISTS idx_ai_jobs_status (status,priority,created_at)`,
  `ALTER TABLE ai_jobs ADD INDEX IF NOT EXISTS idx_ai_jobs_type (type)`,
  `ALTER TABLE ai_jobs ADD INDEX IF NOT EXISTS idx_ai_jobs_user (user_id)`,

  // ai_evaluations
  `CREATE TABLE IF NOT EXISTS ai_evaluations (
  id char(36) NOT NULL,
  component varchar(40) NOT NULL COMMENT 'generation|similarity',
  metric varchar(40) NOT NULL COMMENT 'accuracy|precision|recall|f1',
  value decimal(6,4) NOT NULL,
  sample_size int(11) NOT NULL DEFAULT 0,
  meta longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  created_by char(36) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY idx_eval_component (component),
  KEY idx_ai_eval_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE ai_evaluations ADD COLUMN IF NOT EXISTS id CHAR(36) NOT NULL`,
  `ALTER TABLE ai_evaluations ADD COLUMN IF NOT EXISTS component VARCHAR(40) NOT NULL COMMENT 'generation|similarity'`,
  `ALTER TABLE ai_evaluations ADD COLUMN IF NOT EXISTS metric VARCHAR(40) NOT NULL COMMENT 'accuracy|precision|recall|f1'`,
  `ALTER TABLE ai_evaluations ADD COLUMN IF NOT EXISTS value DECIMAL(6,4) NOT NULL`,
  `ALTER TABLE ai_evaluations ADD COLUMN IF NOT EXISTS sample_size INT(11) NOT NULL DEFAULT 0`,
  `ALTER TABLE ai_evaluations ADD COLUMN IF NOT EXISTS meta LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL`,
  `ALTER TABLE ai_evaluations ADD COLUMN IF NOT EXISTS created_by CHAR(36) NULL DEFAULT NULL`,
  `ALTER TABLE ai_evaluations ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT current_timestamp()`,
  `ALTER TABLE ai_evaluations ADD INDEX IF NOT EXISTS idx_eval_component (component)`,
  `ALTER TABLE ai_evaluations ADD INDEX IF NOT EXISTS idx_ai_eval_created_by (created_by)`,

  // settings
  `CREATE TABLE IF NOT EXISTS settings (
  setting_key varchar(100) NOT NULL,
  setting_value text DEFAULT NULL,
  updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS setting_key VARCHAR(100) NOT NULL`,
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS setting_value TEXT NULL DEFAULT NULL`,
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE CURRENT_TIMESTAMP`,

  // otp_codes
  `CREATE TABLE IF NOT EXISTS otp_codes (
  id varchar(36) NOT NULL,
  user_id varchar(36) NOT NULL,
  code varchar(10) NOT NULL,
  used tinyint(1) NOT NULL DEFAULT 0,
  expires_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT otp_codes_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS id VARCHAR(36) NOT NULL`,
  `ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS user_id VARCHAR(36) NOT NULL`,
  `ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS code VARCHAR(10) NOT NULL`,
  `ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS used TINYINT(1) NOT NULL DEFAULT 0`,
  `ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT current_timestamp()`,
  `ALTER TABLE otp_codes ADD INDEX IF NOT EXISTS user_id (user_id)`,
  `ALTER TABLE otp_codes ADD FOREIGN KEY IF NOT EXISTS otp_codes_ibfk_1 (user_id) REFERENCES users (id) ON DELETE CASCADE`,

  // login_logs
  `CREATE TABLE IF NOT EXISTS login_logs (
  id varchar(36) NOT NULL,
  user_id varchar(36) DEFAULT NULL,
  email varchar(255) NOT NULL,
  success tinyint(1) NOT NULL DEFAULT 0,
  reason varchar(80) DEFAULT NULL,
  ip varchar(45) DEFAULT NULL,
  user_agent varchar(255) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY idx_login_logs_email (email),
  KEY idx_login_logs_user (user_id),
  KEY idx_login_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS id VARCHAR(36) NOT NULL`,
  `ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS user_id VARCHAR(36) NULL DEFAULT NULL`,
  `ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS email VARCHAR(255) NOT NULL`,
  `ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS success TINYINT(1) NOT NULL DEFAULT 0`,
  `ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS reason VARCHAR(80) NULL DEFAULT NULL`,
  `ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS ip VARCHAR(45) NULL DEFAULT NULL`,
  `ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS user_agent VARCHAR(255) NULL DEFAULT NULL`,
  `ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT current_timestamp()`,
  `ALTER TABLE login_logs ADD INDEX IF NOT EXISTS idx_login_logs_email (email)`,
  `ALTER TABLE login_logs ADD INDEX IF NOT EXISTS idx_login_logs_user (user_id)`,
  `ALTER TABLE login_logs ADD INDEX IF NOT EXISTS idx_login_logs_created (created_at)`,

  // audit_logs
  `CREATE TABLE IF NOT EXISTS audit_logs (
  id varchar(36) NOT NULL,
  actor_id varchar(36) DEFAULT NULL,
  actor_email varchar(255) DEFAULT NULL,
  action varchar(80) NOT NULL,
  target_type varchar(40) DEFAULT NULL,
  target_id varchar(64) DEFAULT NULL,
  detail text DEFAULT NULL,
  ip varchar(45) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY idx_audit_actor (actor_id),
  KEY idx_audit_action (action),
  KEY idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS id VARCHAR(36) NOT NULL`,
  `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_id VARCHAR(36) NULL DEFAULT NULL`,
  `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_email VARCHAR(255) NULL DEFAULT NULL`,
  `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action VARCHAR(80) NOT NULL`,
  `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_type VARCHAR(40) NULL DEFAULT NULL`,
  `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_id VARCHAR(64) NULL DEFAULT NULL`,
  `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS detail TEXT NULL DEFAULT NULL`,
  `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip VARCHAR(45) NULL DEFAULT NULL`,
  `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT current_timestamp()`,
  `ALTER TABLE audit_logs ADD INDEX IF NOT EXISTS idx_audit_actor (actor_id)`,
  `ALTER TABLE audit_logs ADD INDEX IF NOT EXISTS idx_audit_action (action)`,
  `ALTER TABLE audit_logs ADD INDEX IF NOT EXISTS idx_audit_created (created_at)`,

  // Single-use password-reset links emailed by staff. Only the SHA-256 of
  // the token is stored — a database read can never produce a working link.
  `CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id varchar(36) NOT NULL,
  user_id varchar(36) NOT NULL,
  token_hash char(64) NOT NULL,
  expires_at datetime NOT NULL,
  used_at datetime DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY uq_prt_hash (token_hash),
  KEY idx_prt_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS id VARCHAR(36) NOT NULL`,
  `ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS user_id VARCHAR(36) NOT NULL`,
  `ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS token_hash CHAR(64) NOT NULL`,
  `ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS expires_at DATETIME NOT NULL`,
  `ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS used_at DATETIME NULL DEFAULT NULL`,
  `ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT current_timestamp()`,
  `ALTER TABLE password_reset_tokens ADD UNIQUE KEY IF NOT EXISTS uq_prt_hash (token_hash)`,
  `ALTER TABLE password_reset_tokens ADD INDEX IF NOT EXISTS idx_prt_user (user_id)`,
];

/**
 * Column type corrections from migrations (MODIFY can't be IF-NOT-EXISTS-
 * guarded for type drift), keyed table.column → expected COLUMN_TYPE.
 * ensureSchema only runs these when information_schema shows a mismatch,
 * so steady-state boots issue no ALTERs at all.
 */
const COLUMN_TYPES = {
  'scan_answers.marked_answer': 'varchar(500)',
  'scan_answers.correct_answer': 'varchar(500)',
  'questions.status': 'varchar(20)',
  'students.student_number': 'text',
  'students.full_name': 'text',
  'scan_results.student_name': 'text',
  'users.avatar_path': 'varchar(255)',
};

export async function ensureSchema() {
  try {
    for (const stmt of DDL) {
      try {
        await pool.query(stmt);
      } catch (e) {
        // Log and continue — one bad statement shouldn't block the rest.
        // eslint-disable-next-line no-console
        console.error('[schema] Statement failed:', e.message);
      }
    }
    // Type convergence: MODIFY only columns whose type actually differs —
    // guarded by information_schema so steady-state boots do no ALTER work.
    for (const [key, want] of Object.entries(COLUMN_TYPES)) {
      const [table, column] = key.split('.');
      const [rows] = await pool.query(
        `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c`,
        { t: table, c: column }
      );
      if (rows[0] && rows[0].COLUMN_TYPE.toLowerCase() !== want.toLowerCase()) {
        await pool.query(`ALTER TABLE ${table} MODIFY COLUMN ${column} ${want}`);
        // eslint-disable-next-line no-console
        console.log('[schema] Corrected column type:', key);
      }
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
