/**
 * Vector index reconcile sweep — keeps both provider index spaces honest.
 *
 * The shadow-mirror design means a write during a provider outage lands in
 * one index only (e.g. mirror-only while Gemini is down), and removal is
 * best-effort, so index contents can drift from the SQL truth in either
 * direction. This sweep runs on an interval inside the worker:
 *
 *   1. Read what SHOULD be indexed (canonical SQL — same filter the write
 *      path uses, not a stricter subset).
 *   2. Read what IS in each provider's index — the docstore ID set, not just
 *      a count: {A,B,C} vs {A,B,D} is drift too, even at equal size. A
 *      missing/corrupt index counts as drift — rebuild also heals poisoned
 *      dirs.
 *   3. Rebuild only the drifted space — rebuildDir is atomic with backups.
 *
 * There is no explicit provider health probe: a rebuild while the provider
 * is still down simply fails its embed, gets logged, and retries next
 * interval — the drift check itself is free, so a healthy system costs zero
 * API calls per sweep.
 */
import pool from '../config/db.js';
import {
  rebuildQuestionsIndex,
  rebuildChunksIndex,
  questionsIndexIds,
  chunksIndexIds,
} from '../services/vectorStore.js';
import { embedTextFor, INSTITUTION_QUESTION_INDEX } from '../services/questionIndex.js';

const QUESTION_INDEX_SQL = `SELECT * FROM questions
   WHERE status = 'active'
     AND type IN ('mcq','true_false','matching','identification')`;

/**
 * True when the index's ID set differs from the expected set — missing,
 * extra, or swapped members all count; a null (absent/corrupt) index drifts
 * whenever anything should exist.
 */
function setsDiffer(actualIds, expectedIds) {
  if (actualIds === null) return expectedIds.size > 0;
  if (actualIds.size !== expectedIds.size) return true;
  for (const id of expectedIds) if (!actualIds.has(id)) return true;
  return false;
}

/** Short drift summary for logs: "+2 missing / -1 extra". */
function driftNote(actualIds, expectedIds) {
  const missing = [...expectedIds].filter((id) => !actualIds?.has(id)).length;
  const extra = [...(actualIds || [])].filter((id) => !expectedIds.has(id)).length;
  return `+${missing} missing / -${extra} extra`;
}

/** Reconcile the institution question index in both provider spaces. */
async function reconcileQuestions() {
  const [questions] = await pool.query(QUESTION_INDEX_SQL);
  const expectedIds = new Set(questions.map((q) => q.id));
  for (const provider of ['gemini', 'local']) {
    const ids = await questionsIndexIds(INSTITUTION_QUESTION_INDEX, provider);
    if (!setsDiffer(ids, expectedIds)) continue;
    console.warn(`[reconcile] questions/${provider} drift (${driftNote(ids, expectedIds)}) — rebuilding`);
    const docs = questions.map((q) => ({ id: q.id, text: embedTextFor(q) }));
    const res = await rebuildQuestionsIndex(INSTITUTION_QUESTION_INDEX, docs, provider);
    const r = res[provider];
    if (r?.error) {
      console.warn(`[reconcile] questions/${provider} rebuild failed: ${r.error}`);
    } else {
      console.log(`[reconcile] questions/${provider} rebuilt — ${r?.indexed ?? 0} indexed`);
    }
  }
}

/** Reconcile every subject's material-chunk index in both provider spaces. */
async function reconcileChunks() {
  const [subjects] = await pool.query(`SELECT DISTINCT subject_id FROM material_chunks`);
  for (const { subject_id } of subjects) {
    const [chunks] = await pool.query(
      `SELECT id, material_id, ordinal, text FROM material_chunks WHERE subject_id = :sid ORDER BY ordinal`,
      { sid: subject_id }
    );
    const expectedIds = new Set(chunks.map((c) => c.id));
    for (const provider of ['gemini', 'local']) {
      const ids = await chunksIndexIds(subject_id, provider);
      if (!setsDiffer(ids, expectedIds)) continue;
      const tag = `chunks/${provider}/${subject_id.slice(0, 8)}`;
      console.warn(`[reconcile] ${tag} drift (${driftNote(ids, expectedIds)}) — rebuilding`);
      const res = await rebuildChunksIndex(
        subject_id,
        chunks.map((c) => ({ id: c.id, materialId: c.material_id, ordinal: c.ordinal, text: c.text })),
        provider
      );
      const r = res[provider];
      if (r?.error) {
        console.warn(`[reconcile] ${tag} rebuild failed: ${r.error}`);
      } else {
        console.log(`[reconcile] ${tag} rebuilt — ${r?.indexed ?? 0} indexed`);
      }
    }
  }
}

let sweeping = false;

/** One sweep pass — skipped when a previous sweep is still running. */
export async function sweep() {
  if (sweeping) return;
  sweeping = true;
  try {
    await reconcileQuestions();
    await reconcileChunks();
  } catch (err) {
    console.warn(`[reconcile] sweep failed: ${err.message}`);
  } finally {
    sweeping = false;
  }
}

export default { sweep };
