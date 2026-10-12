/**
 * Blueprint coverage — how much of each blueprint's topic × Bloom plan is
 * already banked, counted per cell exactly as the generation worker does:
 * the instructor's own live questions (not rejected, not similarity-rejected)
 * in the blueprint's subject, linked by tos_id or question_tos.
 *
 * Every "N short" / "N of M banked" figure should come from here, so the
 * Overview, the Blueprints list and the Generate button never disagree.
 */
import pool from '../config/db.js';
import { buildTosMatrix, slotGap } from './tosAlignment.js';

const parseWeights = (w) => (typeof w === 'string' ? JSON.parse(w || '{}') : w || {});

/**
 * Map of tosId → { planned, covered, missing } for the given TOS rows
 * (each needs id, total_items, bloom_weights). A blueprint whose topics do
 * not add up to its total has no exact plan yet; it falls back to the raw
 * linked count, capped at the total.
 */
export async function blueprintCoverage(userId, tosList) {
  const result = new Map();
  if (!tosList.length) return result;
  const ids = tosList.map((t) => t.id);

  const [topicRows] = await pool.query(
    `SELECT tos_id, title, item_count FROM tos_topics
     WHERE tos_id IN (:ids) ORDER BY tos_id, sort_order ASC`,
    { ids }
  );
  const [haveRows] = await pool.query(
    `SELECT links.tos_id, q.topic, q.bloom, COUNT(DISTINCT q.id) AS n
     FROM (
       SELECT q.id AS question_id, q.tos_id AS tos_id FROM questions q
       WHERE q.created_by = :uid AND q.tos_id IN (:ids)
       UNION
       SELECT qt.question_id, qt.tos_id FROM question_tos qt WHERE qt.tos_id IN (:ids)
     ) links
     JOIN questions q ON q.id = links.question_id
     JOIN tos t ON t.id = links.tos_id
     WHERE q.created_by = :uid AND q.subject_id = t.subject_id
       AND q.status <> 'rejected'
       AND (q.similarity_flag IS NULL OR q.similarity_flag <> 'rejected')
     GROUP BY links.tos_id, q.topic, q.bloom`,
    { uid: userId, ids }
  );

  const topicsByTos = new Map();
  for (const r of topicRows) {
    if (!topicsByTos.has(r.tos_id)) topicsByTos.set(r.tos_id, []);
    topicsByTos.get(r.tos_id).push(r);
  }
  const haveByTos = new Map();
  for (const r of haveRows) {
    if (!haveByTos.has(r.tos_id)) haveByTos.set(r.tos_id, new Map());
    haveByTos.get(r.tos_id).set(`${r.topic}\u0000${r.bloom}`, Number(r.n));
  }

  for (const t of tosList) {
    const have = haveByTos.get(t.id) || new Map();
    const total = Number(t.total_items) || 0;
    try {
      const { slots } = buildTosMatrix(topicsByTos.get(t.id) || [], parseWeights(t.bloom_weights), total);
      result.set(t.id, slotGap(slots, have));
    } catch {
      let linked = 0;
      for (const n of have.values()) linked += n;
      const covered = Math.min(linked, total);
      result.set(t.id, { planned: total, covered, missing: total - covered });
    }
  }
  return result;
}
