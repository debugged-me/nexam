import pool from '../config/db.js';
import { readJson } from './assessmentScope.js';
import { generate } from './aiProvider.js';
import { isValidGeneratedQuestion } from './generationValidation.js';
import { parseOptions } from './scoring.js';
import {
  qualityBlockReason, instructionalBlockReason, makeQualityProof, reviewQuestion, reviewKnowledgeQuestion, groundingMode,
  independentChecks, writerOf, strictMaterialGroundingBlockReason,
} from './questionQuality.js';

const chunkIdsOf = (question) => {
  const ids = readJson(question.generation_meta, {})?.chunkIds;
  return Array.isArray(ids) ? [...new Set(ids.filter((id) => typeof id === 'string'))] : [];
};
const ownerKey = (q) => `${q.subject_id}\u0000${q.created_by}`;

/**
 * Cited chunks for many questions in one query per (subject, owner) — only
 * current, processed material the question's owner uploaded to that subject.
 */
async function citedChunks(questions, { withSyllabusFlag = false } = {}) {
  const groups = new Map();
  for (const q of questions) {
    if (q.source !== 'ai') continue;
    const ids = chunkIdsOf(q);
    if (!ids.length) continue;
    const key = ownerKey(q);
    if (!groups.has(key)) groups.set(key, { sid: q.subject_id, uid: q.created_by, ids: new Set() });
    for (const id of ids) groups.get(key).ids.add(id);
  }
  const found = new Map();
  for (const [key, g] of groups) {
    const [rows] = await pool.query(
      `SELECT c.id, c.text${withSyllabusFlag ? ', m.is_syllabus' : ''} FROM material_chunks c
       JOIN materials m ON m.id = c.material_id
       JOIN subjects s ON s.id = c.subject_id
       WHERE c.id IN (:ids) AND c.subject_id = :sid AND m.status = 'processed'
         AND s.instructor_id = :uid AND m.created_by = :uid`,
      { ids: [...g.ids], sid: g.sid, uid: g.uid }
    );
    found.set(key, new Map(rows.map((r) => [r.id, r])));
  }
  return (q) => {
    const byId = found.get(ownerKey(q));
    return byId ? chunkIdsOf(q).map((id) => byId.get(id)).filter(Boolean) : [];
  };
}

/** Shared fail-closed gate for approval, reuse, assembly and export. */
export async function groundingBlockReason(question) {
  const strictBlock = strictMaterialGroundingBlockReason(question);
  if (strictBlock) return strictBlock;
  const lookup = await citedChunks([question]);
  return qualityBlockReason(question, lookup(question));
}

export async function usableQuestions(questions) {
  const lookup = await citedChunks(questions);
  return questions.filter((q) => !strictMaterialGroundingBlockReason(q) && !qualityBlockReason(q, lookup(q)));
}

/**
 * Re-run the independent AI check on a stored AI question — after an
 * instructor edit, a source change, or for a legacy draft that predates the
 * check. A passing review replaces the proof; a failing one changes nothing.
 * Returns { passed, reason?, review? }.
 */
export async function recheckQuestion(question) {
  const strictBlock = strictMaterialGroundingBlockReason(question);
  if (strictBlock) return { passed: false, reason: strictBlock };
  const meta = readJson(question.generation_meta, {}) || {};
  const mode = groundingMode(question);
  const draft = { ...question, options: parseOptions(question.options) };
  const writer = writerOf(meta);
  const exclude = { avoidProvider: writer.provider || null, excludeModels: writer.model ? [`${writer.provider}:${writer.model}`] : [] };
  let reviewed;
  let chunks = [];
  let context = '';

  if (mode === 'knowledge') {
    if (!isValidGeneratedQuestion({ ...draft }, null, { requireEvidence: false })) {
      return { passed: false, reason: 'The question format, answer mapping or explanation is invalid. Fix it before re-checking.' };
    }
    const contentBlock = instructionalBlockReason(question, []);
    if (contentBlock) return { passed: false, reason: contentBlock };
    const [[subject]] = await pool.query(`SELECT name FROM subjects WHERE id = :id`, { id: question.subject_id });
    reviewed = await reviewKnowledgeQuestion(draft,
      { course: subject?.name, topic: question.topic, outcomes: Array.isArray(meta.outcomes) ? meta.outcomes : [] },
      generate, exclude);
    if (reviewed.review.answerCorrect !== true) {
      return { passed: false, reason: `The fact-check could not confirm the answer. ${reviewed.review.reason || ''}`.trim(), review: reviewed.review };
    }
  } else {
    const ids = chunkIdsOf(question);
    chunks = (await citedChunks([question], { withSyllabusFlag: true }))(question);
    const evidence = typeof meta.evidence === 'string' ? meta.evidence : '';
    if (!ids.length || chunks.length !== ids.length || !evidence) {
      return { passed: false, reason: 'Its cited source passages are missing or changed. Regenerate this question from current materials.' };
    }
    if (chunks.every((c) => Number(c.is_syllabus))) {
      return { passed: false, reason: 'This question cites only the syllabus, which plans coverage but does not contain answers. Regenerate it.' };
    }
    if (!isValidGeneratedQuestion({ ...draft, evidence }, chunks.map((c) => c.text))) {
      return { passed: false, reason: 'The question format, answer mapping or exact evidence span is invalid.' };
    }
    const contentBlock = instructionalBlockReason({ ...question, evidence }, chunks);
    if (contentBlock) return { passed: false, reason: contentBlock };
    context = chunks.map((c) => c.text).join('\n\n---\n\n');
    reviewed = await reviewQuestion({ ...draft, evidence }, context, generate, exclude);
  }

  const { review } = reviewed;
  if (review.actualBloom !== question.bloom) {
    return { passed: false, reason: `Bloom mismatch: labelled ${question.bloom}, reviewer classified ${review.actualBloom || 'unknown'}. ${review.reason || ''}`.trim(), review };
  }
  let checks;
  try {
    checks = await independentChecks(draft, { mode, context, writer }, generate);
  } catch (err) {
    return { passed: false, reason: err.message, review };
  }
  let quality;
  try {
    quality = makeQualityProof({ ...question, evidence: meta.evidence }, chunks, review, reviewed.provider, { mode, writer, checks });
  } catch {
    return { passed: false, reason: review.reason || 'The independent review did not accept this question.', review };
  }
  // A re-check replaces any earlier confirmation: the content it covered may have changed.
  const next = { ...meta, grounding: mode, quality, reviewPromptHash: reviewed.promptHash, recheckedAt: quality.reviewedAt };
  delete next.instructorConfirmation;
  await pool.query(
    `UPDATE questions SET generation_meta = :meta, ai_predicted_bloom = :bloom, updated_at = NOW() WHERE id = :id`,
    { meta: JSON.stringify(next), bloom: review.actualBloom, id: question.id }
  );
  return { passed: true, review };
}
