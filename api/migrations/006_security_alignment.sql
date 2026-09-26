-- Full-manuscript security alignment.
-- Student identifiers are stored as AES-GCM ciphertext by the application;
-- keyed hashes support equality lookup without decrypting every row.

ALTER TABLE `students`
  MODIFY COLUMN `student_number` TEXT NULL,
  MODIFY COLUMN `full_name` TEXT NOT NULL,
  ADD COLUMN `student_number_hash` CHAR(64) NULL AFTER `student_number`,
  ADD COLUMN `full_name_hash` CHAR(64) NULL AFTER `full_name`,
  ADD KEY `idx_students_number_hash` (`instructor_id`, `student_number_hash`),
  ADD KEY `idx_students_name_hash` (`instructor_id`, `full_name_hash`);

ALTER TABLE `scan_results`
  MODIFY COLUMN `student_name` TEXT NULL;
