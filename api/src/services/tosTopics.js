/**
 * tosTopics — shared helpers for blueprint topic rows.
 * Kept in services/ so route handlers and AI job workers can both use them
 * without a routes↔worker circular import.
 */
import pool from '../config/db.js';

/**
 * Recalculate tos_topics.item_count from instructional_hours —
 * item allocation is proportional to hours (largest remainder so the
 * counts sum exactly to tos.total_items). Runs after any topic
 * add/update/delete or total_items change.
 */
export async function recalcTopicItemCounts(tosId) {
  const [tosRows] = await pool.query(
    `SELECT total_items FROM tos WHERE id = :id`, { id: tosId }
  );
  if (!tosRows.length) return;
  const totalItems = Number(tosRows[0].total_items) || 0;

  const [topics] = await pool.query(
    `SELECT id, instructional_hours FROM tos_topics WHERE tos_id = :id ORDER BY sort_order ASC`,
    { id: tosId }
  );
  if (!topics.length) return;

  // Clamp at 0 so a stray negative hour can never produce a negative item_count.
  const hoursOf = (t) => Math.max(0, Number(t.instructional_hours) || 0);
  const totalHours = topics.reduce((s, t) => s + hoursOf(t), 0);
  const counts = {};
  const remainders = [];
  let allocated = 0;

  for (const t of topics) {
    // No hours recorded yet (every topic defaults to 0) — an even split beats a divide-by-zero NaN.
    const share = totalHours > 0 ? hoursOf(t) / totalHours : 1 / topics.length;
    const exact = share * totalItems;
    const whole = Math.floor(exact);
    counts[t.id] = whole;
    remainders.push({ id: t.id, remainder: exact - whole });
    allocated += whole;
  }
  remainders.sort((a, b) => b.remainder - a.remainder);
  for (const { id } of remainders) {
    if (allocated >= totalItems) break;
    counts[id]++;
    allocated++;
  }

  for (const t of topics) {
    await pool.query(
      `UPDATE tos_topics SET item_count = :n WHERE id = :id`,
      { n: counts[t.id], id: t.id }
    );
  }
}
