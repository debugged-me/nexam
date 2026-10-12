/**
 * Question index lifecycle helper — keeps the institution-wide approved
 * question vector index in sync with status transitions.
 *
 * Index contract: the index holds ACTIVE questions only. Drafts are checked
 * against it (similarity job) but never indexed; rejected/deleted questions
 * are removed. All failures are swallowed + logged — the index is a
 * routing aid, never a reason for a CRUD request to fail.
 */
import pool from '../config/db.js';
import { addQuestion, addQuestions, removeQuestion } from './vectorStore.js';

export const INSTITUTION_QUESTION_INDEX = '_institution';

/** Build the canonical embed text for a question row. */
export function embedTextFor(question) {
  let text = question.stem || '';
  if (question.type === 'mcq' && question.options) {
    try {
      const opts = Array.isArray(question.options) ? question.options : JSON.parse(question.options);
      if (Array.isArray(opts)) text += ' ' + opts.join(' ');
    } catch { /* ignore parse errors */ }
  }
  if (question.answer) text += ' ' + question.answer;
  return text;
}

/**
 * Index a question if it is active (approved). Safe to call on every
 * approval — HNSWLib tolerates duplicates and similarity searches always
 * exclude the query question itself.
 */
export async function indexQuestionIfActive(question) {
  try {
    if (!question || question.status !== 'active') return false;
    await addQuestion(INSTITUTION_QUESTION_INDEX, question.id, embedTextFor(question));
    return true;
  } catch (err) {
    console.warn(`[questionIndex] index failed for ${question?.id}: ${err.message}`);
    return false;
  }
}

/**
 * Index many questions in one pass (bulk approve / reindex) — one index
 * load + save + batched embedding calls instead of a full round-trip per
 * row. Same contract as indexQuestionIfActive: failures are swallowed.
 */
export async function indexQuestionsIfActive(questions) {
  try {
    const items = (questions || [])
      .filter((q) => q && q.status === 'active')
      .map((q) => ({ id: q.id, text: embedTextFor(q) }));
    if (!items.length) return 0;
    await addQuestions(INSTITUTION_QUESTION_INDEX, items);
    return items.length;
  } catch (err) {
    console.warn(`[questionIndex] bulk index failed: ${err.message}`);
    return 0;
  }
}

/**
 * Remove a question from the index (delete/reject paths). Best-effort —
 * stale vectors can't produce matches because similarity candidates are
 * SQL-filtered to active questions.
 */
export async function removeQuestionFromIndex(_subjectId, questionId) {
  try {
    await removeQuestion(INSTITUTION_QUESTION_INDEX, questionId);
  } catch (err) {
    console.warn(`[questionIndex] remove failed for ${questionId}: ${err.message}`);
  }
}

/**
 * Rebuild convenience: index every active question owned by a user for one
 * subject (e.g. after the on-disk index was wiped).
 */
export async function reindexInstitution() {
  const [rows] = await pool.query(
    `SELECT * FROM questions
     WHERE status = 'active'
       AND type IN ('mcq','true_false','matching','identification')`
  );
  return indexQuestionsIfActive(rows);
}

export default { embedTextFor, indexQuestionIfActive, indexQuestionsIfActive, removeQuestionFromIndex, reindexInstitution };
