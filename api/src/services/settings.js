/**
 * settings.js — read tunable values from the `settings` table.
 *
 * The PHP admin seeds keys like `chunk_size_tokens`, `retrieval_top_k`, and
 * `similarity_threshold`. Values are cached for the life of the process;
 * worker jobs call `getSetting`/`getNumber` at job start so changes take
 * effect on the next job without a restart (the worker is long-lived but
 * each job re-reads).
 */
import pool from '../config/db.js';

/** Fetch a setting value as a string, or `fallback` when unset. */
export async function getSetting(key, fallback = null) {
  const [rows] = await pool.query(
    `SELECT setting_value FROM settings WHERE setting_key = :key`,
    { key }
  );
  if (!rows.length || rows[0].setting_value === null || rows[0].setting_value === '') {
    return fallback;
  }
  return rows[0].setting_value;
}

/** Fetch a setting as a number, or `fallback` when unset/unparseable. */
export async function getNumber(key, fallback) {
  const v = await getSetting(key, null);
  const n = Number(v);
  return v === null || Number.isNaN(n) ? fallback : n;
}
