<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Migration_model extends CI_Model
{
    public function __construct()
    {
        parent::__construct();
        $this->load->database();
    }

    public function init()
    {
        $this->create_admins_table();
        $this->create_events_table();
        $this->create_categories_table();
        $this->create_criteria_table();
        $this->create_candidates_table();
        $this->create_judges_table();
        $this->create_scores_table();
        $this->create_category_judges_table();
        $this->migrate_columns();
        $this->migrate_admin_role_enum();
        $this->seed_admin();
        $this->seed_tabulator();
    }

    private function table_exists($table)
    {
        return $this->db->table_exists($table);
    }

    private function add_column_if_missing($table, $column, $definition)
    {
        if (!$this->db->table_exists($table)) return;
        if ($this->db->field_exists($column, $table)) return;
        $this->db->query("ALTER TABLE `{$table}` ADD COLUMN {$definition}");
    }

    /**
     * Idempotent column additions for the multi-round pageant flow.
     * round_level: 0 = Preliminary (all candidates), 1 = Top 10 / prelim Q&A, 2 = Top 5 / final Q&A
     */
    private function migrate_columns()
    {
        $this->add_column_if_missing('categories', 'round_level', "`round_level` TINYINT(1) NOT NULL DEFAULT 0 AFTER `weight`");
        $this->add_column_if_missing('categories', 'segment_date', "`segment_date` DATE DEFAULT NULL AFTER `round_level`");
        // Admin can lock a segment so judges can no longer open or modify its scores.
        $this->add_column_if_missing('categories', 'is_locked', "`is_locked` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`");
        $this->add_column_if_missing('candidates', 'barangay', "`barangay` VARCHAR(100) DEFAULT NULL AFTER `hometown`");
        $this->add_column_if_missing('candidates', 'in_top10', "`in_top10` TINYINT(1) NOT NULL DEFAULT 0 AFTER `age`");
        $this->add_column_if_missing('candidates', 'in_top5', "`in_top5` TINYINT(1) NOT NULL DEFAULT 0 AFTER `in_top10`");
        $this->add_column_if_missing('candidates', 'final_placement', "`final_placement` INT(3) DEFAULT NULL AFTER `in_top5`");
    }

    private function create_category_judges_table()
    {
        if ($this->table_exists('category_judges')) return;
        $sql = "CREATE TABLE `category_judges` (
            `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
            `category_id` INT(11) UNSIGNED NOT NULL,
            `judge_id` VARCHAR(20) NOT NULL,
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `unique_assignment` (`category_id`,`judge_id`),
            KEY `category_id` (`category_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        $this->db->query($sql);
    }

    private function create_admins_table()
    {
        if ($this->table_exists('admins')) return;
        $sql = "CREATE TABLE `admins` (
            `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
            `username` VARCHAR(50) NOT NULL,
            `password` VARCHAR(255) NOT NULL,
            `name` VARCHAR(100) NOT NULL,
            `role` ENUM('admin','co-admin') DEFAULT 'admin',
            `is_active` TINYINT(1) DEFAULT 1,
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `username` (`username`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        $this->db->query($sql);
    }

    private function create_events_table()
    {
        if ($this->table_exists('events')) return;
        $sql = "CREATE TABLE `events` (
            `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
            `name` VARCHAR(200) NOT NULL,
            `year` VARCHAR(10) NOT NULL,
            `date` DATE DEFAULT NULL,
            `venue` VARCHAR(200) DEFAULT NULL,
            `description` TEXT DEFAULT NULL,
            `status` ENUM('upcoming','active','completed') DEFAULT 'upcoming',
            `is_active` TINYINT(1) DEFAULT 1,
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        $this->db->query($sql);
    }

    private function create_categories_table()
    {
        if ($this->table_exists('categories')) return;
        $sql = "CREATE TABLE `categories` (
            `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
            `event_id` INT(11) UNSIGNED DEFAULT NULL,
            `name` VARCHAR(100) NOT NULL,
            `weight` DECIMAL(5,2) DEFAULT 100.00,
            `description` TEXT DEFAULT NULL,
            `order_num` INT(3) DEFAULT 0,
            `is_active` TINYINT(1) DEFAULT 1,
            `is_locked` TINYINT(1) NOT NULL DEFAULT 0,
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `event_id` (`event_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        $this->db->query($sql);
    }

    private function create_criteria_table()
    {
        if ($this->table_exists('criteria')) return;
        $sql = "CREATE TABLE `criteria` (
            `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
            `category_id` INT(11) UNSIGNED NOT NULL,
            `name` VARCHAR(100) NOT NULL,
            `max_score` DECIMAL(5,2) DEFAULT 10.00,
            `description` TEXT DEFAULT NULL,
            `order_num` INT(3) DEFAULT 0,
            `is_active` TINYINT(1) DEFAULT 1,
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `category_id` (`category_id`),
            FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        $this->db->query($sql);
    }

    private function create_candidates_table()
    {
        if ($this->table_exists('candidates')) return;
        $sql = "CREATE TABLE `candidates` (
            `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
            `event_id` INT(11) UNSIGNED DEFAULT NULL,
            `candidate_number` VARCHAR(10) NOT NULL,
            `name` VARCHAR(100) NOT NULL,
            `photo` VARCHAR(255) DEFAULT NULL,
            `hometown` VARCHAR(100) DEFAULT NULL,
            `age` INT(3) DEFAULT NULL,
            `is_active` TINYINT(1) DEFAULT 1,
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `event_id` (`event_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        $this->db->query($sql);
    }

    private function create_judges_table()
    {
        if ($this->table_exists('judges')) return;
        $sql = "CREATE TABLE `judges` (
            `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
            `judge_id` VARCHAR(20) NOT NULL,
            `name` VARCHAR(100) NOT NULL,
            `email` VARCHAR(100) DEFAULT NULL,
            `password` VARCHAR(255) NOT NULL,
            `temp_password` VARCHAR(255) DEFAULT NULL,
            `is_active` TINYINT(1) DEFAULT 1,
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `judge_id` (`judge_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        $this->db->query($sql);
    }

    private function create_scores_table()
    {
        if ($this->table_exists('scores')) return;
        $sql = "CREATE TABLE `scores` (
            `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
            `event_id` INT(11) UNSIGNED NOT NULL,
            `category_id` INT(11) UNSIGNED NOT NULL,
            `criteria_id` INT(11) UNSIGNED NOT NULL,
            `candidate_id` INT(11) UNSIGNED NOT NULL,
            `judge_id` VARCHAR(20) NOT NULL,
            `score` DECIMAL(5,2) NOT NULL,
            `notes` TEXT DEFAULT NULL,
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `unique_score` (`event_id`,`category_id`,`criteria_id`,`candidate_id`,`judge_id`),
            KEY `event_id` (`event_id`),
            KEY `category_id` (`category_id`),
            KEY `candidate_id` (`candidate_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        $this->db->query($sql);
    }

    /**
     * Widen the admins.role ENUM to allow the 'tabulator' role. Idempotent:
     * only runs the ALTER when 'tabulator' isn't already part of the column type.
     *
     * The SchemaSync hook (application/hooks/SchemaSync.php) applies this same
     * change globally on every request; this local copy runs here first so the
     * ENUM is guaranteed wide before seed_tabulator() inserts in the same request.
     */
    private function migrate_admin_role_enum()
    {
        if (!$this->db->table_exists('admins')) return;
        $col = $this->db->query("SHOW COLUMNS FROM `admins` LIKE 'role'")->row();
        if ($col && stripos($col->Type, 'tabulator') === false) {
            $this->db->query("ALTER TABLE `admins` MODIFY COLUMN `role` ENUM('admin','co-admin','tabulator') NOT NULL DEFAULT 'admin'");
        }
    }

    private function seed_admin()
    {
        $exists = $this->db->where('username', 'admin')->get('admins')->row();
        if (!$exists) {
            $this->db->insert('admins', [
                'username' => 'admin',
                'password' => password_hash('compu7er', PASSWORD_DEFAULT),
                'name' => 'Administrator',
                'role' => 'admin',
                'is_active' => 1
            ]);
        }
    }

    private function seed_tabulator()
    {
        $exists = $this->db->where('username', 'tabulator')->get('admins')->row();
        if (!$exists) {
            $this->db->insert('admins', [
                'username' => 'tabulator',
                'password' => password_hash('tabulator', PASSWORD_DEFAULT),
                'name' => 'Tabulator',
                'role' => 'tabulator',
                'is_active' => 1
            ]);
        }
    }
}
