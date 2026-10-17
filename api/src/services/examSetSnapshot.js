/**
 * Immutable question content stored with a generated exam set.
 *
 * Version 0 rows predate snapshots and deliberately fall back to the live
 * question record. Version 1 rows always use the frozen columns, including
 * null values, so a later question edit cannot change a printed set.
 */
export const EXAM_SET_SNAPSHOT_VERSION = 1;

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

/** Whitelist the fields that define a delivered assessment item. */
export function snapshotQuestion(question) {
  return {
    id: question.id,
    type: question.type,
    stem: question.stem,
    options: parseJson(question.options, question.options == null ? null : []),
    answer: question.answer ?? null,
    explanation: question.explanation ?? null,
    topic: question.topic ?? null,
    bloom: question.bloom ?? null,
    source: question.source ?? null,
    generation_meta: parseJson(question.generation_meta, question.generation_meta ?? null),
    snapshot_version: EXAM_SET_SNAPSHOT_VERSION,
  };
}

/**
 * Select frozen fields for snapshot rows and live fields only for legacy rows.
 * The caller must join exam_set_questions as esq and questions as q.
 */
export function examSetQuestionSelect() {
  return `
    esq.question_id AS id,
    esq.sort_order,
    esq.snapshot_version,
    CASE WHEN esq.snapshot_version >= 1 THEN esq.question_type ELSE q.type END AS type,
    CASE WHEN esq.snapshot_version >= 1 THEN esq.question_stem ELSE q.stem END AS stem,
    CASE WHEN esq.snapshot_version >= 1 THEN esq.question_options ELSE q.options END AS options,
    CASE WHEN esq.snapshot_version >= 1 THEN esq.question_answer ELSE q.answer END AS answer,
    CASE WHEN esq.snapshot_version >= 1 THEN esq.question_explanation ELSE q.explanation END AS explanation,
    CASE WHEN esq.snapshot_version >= 1 THEN esq.question_topic ELSE q.topic END AS topic,
    CASE WHEN esq.snapshot_version >= 1 THEN esq.question_bloom ELSE q.bloom END AS bloom,
    CASE WHEN esq.snapshot_version >= 1 THEN esq.question_source ELSE q.source END AS source,
    CASE WHEN esq.snapshot_version >= 1 THEN esq.question_generation_meta ELSE q.generation_meta END AS generation_meta`;
}

/** Convert database JSON text into the same shape used by renderers/exporters. */
export function materializeSetQuestion(row) {
  return {
    ...row,
    options: parseJson(row.options, row.options == null ? null : []),
    generation_meta: parseJson(row.generation_meta, row.generation_meta ?? null),
    snapshot_version: Number(row.snapshot_version || 0),
  };
}

export function snapshotInsertValues(question) {
  const frozen = snapshotQuestion(question);
  return [
    EXAM_SET_SNAPSHOT_VERSION,
    frozen.type,
    frozen.stem,
    frozen.options == null ? null : JSON.stringify(frozen.options),
    frozen.answer,
    frozen.explanation,
    frozen.topic,
    frozen.bloom,
    frozen.source,
    frozen.generation_meta == null ? null : JSON.stringify(frozen.generation_meta),
  ];
}
