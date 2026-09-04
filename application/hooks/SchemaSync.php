<?php
defined('BASEPATH') or exit('No direct script access allowed');

/**
 * SchemaSync — applies idempotent schema deltas automatically so a fresh
 * production deploy never needs a manual `ALTER TABLE`.
 *
 * Applied versions are recorded in a `schema_migrations` ledger table (the DB is
 * always writable by the app, unlike the filesystem on locked-down hosts). On
 * each request the hook checks the ledger; if the current VERSION is already
 * recorded it returns immediately, otherwise it ensures every column in
 * column_changes() exists and records the version.
 *
 * To ship a new schema change: add a row to column_changes() and bump VERSION.
 */
class SchemaSync
{
    /** Bump this whenever you add a new change to column_changes()/type_changes(). */
    const VERSION = '3';

    public function migrate()
    {
        $CI = &get_instance();
        $CI->load->database();
        $db = $CI->db;
        if (!is_object($db)) {
            return;
        }

        // Ledger of applied schema versions. CREATE ... IF NOT EXISTS is portable
        // across MySQL/MariaDB and is a cheap no-op once the table exists.
        $db->query(
            "CREATE TABLE IF NOT EXISTS `schema_migrations` (
                `version` VARCHAR(20) NOT NULL,
                `applied_at` DATETIME NOT NULL,
                PRIMARY KEY (`version`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $done = $db->query(
            "SELECT 1 FROM `schema_migrations` WHERE `version` = ? LIMIT 1",
            [self::VERSION]
        )->row();
        if ($done) {
            return; // this version already applied
        }

        foreach ($this->column_changes() as $change) {
            $this->ensure_column($db, $change[0], $change[1], $change[2]);
        }

        foreach ($this->type_changes() as $change) {
            $this->ensure_column_type($db, $change[0], $change[1], $change[2], $change[3]);
        }

        $db->query(
            "INSERT IGNORE INTO `schema_migrations` (`version`, `applied_at`) VALUES (?, ?)",
            [self::VERSION, date('Y-m-d H:i:s')]
        );
    }

    /**
     * Each row: [table, column, full definition used after ADD COLUMN].
     * The definition only runs when the column is absent, so it's safe to leave
     * old entries here permanently.
     */
    private function column_changes()
    {
        return [
            ['judges', 'identifier', "`identifier` VARCHAR(50) DEFAULT NULL AFTER `judge_id`"],
            ['candidates', 'barangay', "`barangay` VARCHAR(100) DEFAULT NULL AFTER `hometown`"],
        ];
    }

    /**
     * Columns whose TYPE needs changing (e.g. widening an ENUM to add a value).
     * Each row: [table, column, marker that must appear in COLUMN_TYPE, full
     * MODIFY definition]. The MODIFY only runs when the marker is absent, so old
     * entries are safe to keep here permanently.
     */
    private function type_changes()
    {
        return [
            // Allow the 'tabulator' staff role on the admins table.
            ['admins', 'role', 'tabulator', "ENUM('admin','co-admin','tabulator') NOT NULL DEFAULT 'admin'"],
        ];
    }

    private function ensure_column_type($db, $table, $column, $marker, $definition)
    {
        $row = $db->query(
            "SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
             LIMIT 1",
            [$table, $column]
        )->row();

        if (!$row) {
            return; // table/column not present yet — nothing to widen
        }
        if (stripos($row->t, $marker) !== false) {
            return; // type already includes the change
        }

        // Silence DB errors for the DDL so a concurrent first request can't take
        // the page down — the type check above already guards the normal path.
        $prev = $db->db_debug;
        $db->db_debug = FALSE;
        $db->query("ALTER TABLE `{$table}` MODIFY COLUMN `{$column}` {$definition}");
        $db->db_debug = $prev;
    }

    private function ensure_column($db, $table, $column, $definition)
    {
        $exists = $db->query(
            "SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
             LIMIT 1",
            [$table, $column]
        )->row();

        if ($exists) {
            return;
        }

        // Silence DB errors for the DDL so a concurrent first request (or a
        // missing table) can't take the page down — the existence check above
        // already guards the normal path.
        $prev = $db->db_debug;
        $db->db_debug = FALSE;
        $db->query("ALTER TABLE `{$table}` ADD COLUMN {$definition}");
        $db->db_debug = $prev;
    }
}
