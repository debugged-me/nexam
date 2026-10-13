/**
 * Phase 4 — RAG question generation handler.
 *
 * This is the core of the thesis. For each (topic, bloom, count) slot from
 * the TOS, it:
 *   1. Retrieves top-k chunks from material_chunks WHERE subject_id = tos.subject_id.
 *   2. Calls the LLM to generate questions grounded ONLY in retrieved chunks.
 *   3. Stores draft questions with status='draft', source='ai', tos_id,
 *      and generation_meta (chunk ids, model, prompt hash).
 *   4. Enqueues a similarity check for each new question.
 *
 * Lesson materials ground answers; the syllabus only plans coverage. When no
 * uploaded lesson supports a cell, the slot is drafted from the model's
 * general knowledge instead — never disguised as grounded: it is labelled
 * `grounding: 'knowledge'`, fact-checked by a different provider, and needs
 * the instructor's explicit confirmation before approval.
 */
import { v4 as uuid } from 'uuid';
import pool from '../../config/db.js';
import { generate } from '../../services/aiProvider.js';
import { retrieve } from '../../services/retriever.js';
import { enqueue, updateProgress, isCancelled, markStopped } from '../../services/jobs.js';
import { publishJobEvent } from '../../services/jobEvents.js';
import { getNumber } from '../../services/settings.js';
import { buildTosMatrix } from '../../services/tosAlignment.js';
import { isValidGeneratedQuestion } from '../../services/generationValidation.js';
import { questionScopeSql } from '../../services/assessmentScope.js';
import { loadScopeChunks } from '../../services/assessmentScopeStore.js';

import {
  hash, canonicalDraft, reviewQuestion, reviewKnowledgeQuestion, makeQualityProof, instructionalBlockReason,
  independentChecks,
} from '../../services/questionQuality.js';
import { usableQuestions } from '../../services/questionGrounding.js';

/** Bloom level descriptions for the LLM prompt. */
const BLOOM_DESCRIPTIONS = {
  remember:   'recall of facts, terms, and basic concepts',
  understand: 'explain ideas or concepts',
  apply:      'use information in new situations',
  analyze:    'draw connections among ideas and differentiate between components',
  evaluate:   'justify a stand or decision',
  create:     'produce new or original work by combining ideas',
};

export default async function generateHandler(job) {
  const { tosId, userId } = job.payload;
  if (!tosId) throw new Error('tosId is required.');

  // ── Load the TOS with ownership check ────────────────
  const [tosRows] = await pool.query(
    `SELECT t.*, s.instructor_id, s.name AS subject_name
     FROM tos t
     JOIN subjects s ON s.id = t.subject_id
     WHERE t.id = :tosId`,
    { tosId }
  );
  const tos = tosRows[0];
  if (!tos) throw new Error(`TOS ${tosId} not found.`);
  if (tos.instructor_id !== userId) throw new Error('TOS not owned by user.');
  if (tos.status !== 'finalized') {
    throw new Error('TOS must be finalized by the instructor before question generation.');
  }
  const scopedChunks = await loadScopeChunks(tos, userId);

  // ── Load topics ─────────────────────────────────────
  const [topics] = await pool.query(
    `SELECT * FROM tos_topics WHERE tos_id = :tosId ORDER BY sort_order ASC`,
    { tosId }
  );

  // ── Parse the finalized topic × Bloom allocation ────
  const bloomWeights = JSON.parse(tos.bloom_weights || '{}');
  const totalItems = tos.total_items || 50;
  const { slots } = buildTosMatrix(topics, bloomWeights, totalItems);

  // ── Generate every exact matrix cell ─────────────────
  // Questions are stored the moment their slot finishes — not in one burst at
  // the end — so a failed or stopped run keeps everything it already drafted.
  // A cell already covered by live (non-rejected) questions on this TOS is
  // skipped, and a partly-covered cell only generates its deficit — a re-run
  // after a failure fills gaps instead of duplicating the whole matrix.
  let generatedCount = 0;
  const failedSlots = [];
  let skippedCells = 0;
  let adoptedCount = 0;
  let knowledgeCount = 0;
  let droppedInvalid = 0;
  let slotIndex = 0;
  let cancelled = false;

  for (const slot of slots) {
    // Cooperative stop: the cancel endpoint flips status to 'cancelled';
    // honour it at the next slot boundary rather than mid-LLM-call.
    if (await isCancelled(job.id)) { cancelled = true; break; }

    // Live progress so the UI can say what is being drafted, not just "busy".
    await updateProgress(job.id, {
      slotsDone: slotIndex,
      slotsTotal: slots.length,
      drafted: generatedCount,
      adopted: adoptedCount,
      skipped: skippedCells,
      lastSlot: { topic: slot.topic, bloom: slot.bloom },
    });
    slotIndex += 1;

    // Gap-fill: count live questions this blueprint already has for the cell.
    // Drafts count — if the instructor later rejects them, the next run
    // regenerates the cell. Rejected items never count.
    const [covRows] = await pool.query(
      `SELECT q.* FROM questions q
       WHERE q.subject_id = :subjectId AND q.created_by = :userId
         AND q.status <> 'rejected'
         AND (q.similarity_flag IS NULL OR q.similarity_flag <> 'rejected')
         AND q.topic = :topic AND q.bloom = :bloom
         AND ${questionScopeSql()}
         AND (q.tos_id = :tosId OR EXISTS (
           SELECT 1 FROM question_tos qt WHERE qt.question_id = q.id AND qt.tos_id = :tosId
         ))`,
      { subjectId: tos.subject_id, userId, topic: slot.topic, bloom: slot.bloom, tosId: tos.id }
    );
    const covered = (await usableQuestions(covRows)).length;
    let needed = slot.count - covered;
    if (needed <= 0) { skippedCells += 1; continue; }

    // Adopt before drafting: the subject bank may already hold live questions
    // for this exact cell — e.g. generated for a sibling blueprint (a whole-
    // syllabus master vs. a derived Prelim). A blueprint only needs coverage,
    // so link them via question_tos instead of spending tokens on duplicates.
    const [candidates] = await pool.query(
      `SELECT q.* FROM questions q
       WHERE q.subject_id = :subjectId AND q.created_by = :userId
         AND q.status <> 'rejected'
         AND (q.similarity_flag IS NULL OR q.similarity_flag <> 'rejected')
         AND q.topic = :topic AND q.bloom = :bloom
         AND ${questionScopeSql()}
         AND NOT (q.tos_id = :tosId OR EXISTS (
           SELECT 1 FROM question_tos qt WHERE qt.question_id = q.id AND qt.tos_id = :tosId
         ))
       ORDER BY (q.status = 'active') DESC, q.created_at ASC
       `,
      { subjectId: tos.subject_id, userId, topic: slot.topic, bloom: slot.bloom, tosId: tos.id, needed }
    );
    const adoptable = (await usableQuestions(candidates)).slice(0, needed);
    for (const row of adoptable) {
      await pool.query(
        `INSERT IGNORE INTO question_tos (question_id, tos_id) VALUES (:qid, :tosId)`,
        { qid: row.id, tosId: tos.id }
      );
    }
    adoptedCount += adoptable.length;
    needed -= adoptable.length;
    if (needed <= 0) { skippedCells += 1; continue; }

    const topic = topics.find((candidate) => candidate.title === slot.topic);
    const result = await generateForSlot(tos, topic, slot.bloom, needed, scopedChunks);
    // One retry for a transient shortfall (unparseable AI output). Review
    // refusals and missing material are deterministic; a retry buys nothing.
    if (!result.noRetry && result.questions.length < needed) {
      const more = await generateForSlot(tos, topic, slot.bloom, needed - result.questions.length, scopedChunks);
      if (more.dropped) result.dropped = (result.dropped || 0) + more.dropped;
      // Every returned draft passed all gates, even from a partial retry.
      result.questions.push(...more.questions);
      if (result.questions.length >= needed) {
        result.failed = false;
        result.reason = undefined;
      } else if (more.reason) {
        result.reason = more.reason;
      }
    }
    if (result.dropped) droppedInvalid += result.dropped;

    // Persist this slot's questions right away.
    const stored = [];
    for (const q of result.questions) {
      const questionId = uuid();
      await pool.query(
        `INSERT INTO questions
           (id, subject_id, tos_id, topic, bloom, ai_predicted_bloom, type, stem, options, answer,
            explanation, status, source, generation_meta, created_by, scope_key)
         VALUES
           (:id, :subjectId, :tosId, :topic, :bloom, :aiPredictedBloom, :type, :stem, :options, :answer,
            :explanation, 'draft', 'ai', :meta, :createdBy, :scopeKey)`,
        {
          id: questionId,
          subjectId: tos.subject_id,
          tosId: tos.id,
          topic: q.topic || null,
          bloom: q.bloom,
          aiPredictedBloom: q.meta.quality.review.actualBloom,
          type: q.type,
          stem: q.stem,
          options: q.options ? JSON.stringify(q.options) : null,
          answer: q.answer || null,
          explanation: q.explanation || null,
          meta: JSON.stringify(q.meta),
          createdBy: userId,
          scopeKey: tos.scope_key || null,
        }
      );

      // Enqueue similarity check for this new question
      await enqueue({
        type: 'similarity',
        payload: { questionId, userId },
        userId,
        subjectId: tos.subject_id,
      });
      stored.push({
        id: questionId,
        type: q.type,
        stem: q.stem,
        options: q.options || [],
        answer: q.answer || null,
        topic: q.topic || null,
        bloom: q.bloom,
        grounding: q.meta.grounding,
        evidence: q.meta?.evidence || null,
      });
    }
    generatedCount += result.questions.length;
    knowledgeCount += result.questions.filter((q) => q.meta.grounding === 'knowledge').length;
    // Live streams show the slot's drafts the moment they are stored. They
    // are review-only there — approval still runs every server-side gate.
    if (stored.length) publishJobEvent(job.id, { kind: 'drafts', items: stored });

    if (result.failed || result.questions.length !== needed) {
      failedSlots.push({
        topic: slot.topic,
        bloom: slot.bloom,
        count: needed,
        generated: result.questions.length,
        reason: result.reason || `Generated ${result.questions.length} of ${needed} required questions.`,
      });
    }
  }

  const summary = {
    tosId,
    generated: generatedCount,
    knowledgeDrafted: knowledgeCount,
    adopted: adoptedCount,
    droppedInvalid,
    skippedCells,
    failedSlots,
    ...(cancelled ? { stopped: true } : {}),
  };
  // markDone is a no-op on a cancelled row — save the partial summary ourselves.
  if (cancelled) await markStopped(job.id, summary);
  return summary;
}

// What each level asks of the learner, for the one guided retry after a
// reviewer classified a draft at a different level.
const BLOOM_TASKS = {
  remember: 'recall a specific fact or term',
  understand: 'explain or interpret what an idea means, not repeat its definition',
  apply: 'use a principle or procedure to resolve a new, concrete situation',
  analyze: 'break a situation into parts and reason about the relationships, causes or differences between them',
  evaluate: 'judge which option best satisfies stated criteria, where the criteria decide the answer',
};
const bloomFeedback = (bloom, misses) => `An independent reviewer classified a previous draft for this cell as "${misses[0]}", not "${bloom}". `
  + `Write questions whose answer requires the learner to ${BLOOM_TASKS[bloom]}. Do not dress up recall with a scenario.`;

const CREATE_REFUSAL = 'Creating requires original work and cannot be measured by the supported objective question formats. Review this blueprint allocation; it was not silently reassigned.';

const TYPE_RULES = `Each question must be one of these types: mcq, true_false, matching, identification.
- mcq: Multiple choice with 4 options. Include options as an array and specify the correct answer.
- true_false: Statement that is either true or false. Answer is "True" or "False".
- matching: Two lists to be matched. Options is an array of items, answer is the correct matching as "1-B, 2-A, 3-D, 4-C".
- identification: A statement or question requiring a short answer. Answer is the expected response.`;

const topicOutcomes = (topic) => {
  const raw = topic?.learning_outcomes;
  const list = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : raw;
  return Array.isArray(list) ? list.filter((o) => typeof o === 'string' && o.trim()) : [];
};

/** LLM output as an array of draft objects, or null when it is not JSON. */
function parseDrafts(text) {
  try {
    let raw = String(text || '').trim();
    if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(raw);
    return (Array.isArray(parsed) ? parsed : [parsed]).filter((q) => q && typeof q === 'object' && !Array.isArray(q));
  } catch {
    return null;
  }
}

/**
 * Generate questions for a single (topic, bloom, count) slot.
 *
 * Grounded first: lesson materials retrieved for the cell — never the
 * syllabus, which plans coverage but does not contain answers. Any shortfall
 * is drafted from the model's general knowledge, guided by the syllabus topic
 * and outcomes, fact-checked by a different provider, labelled as such, and
 * approvable only after the instructor confirms the answer
 * (knowledge_fallback_enabled = 0 turns this off).
 */
async function generateForSlot(tos, topic, bloom, count, scopedChunks) {
  if (bloom === 'create') return { questions: [], failed: true, noRetry: true, reason: CREATE_REFUSAL };
  const outcomes = topicOutcomes(topic);
  const query = `${topic ? topic.title : ''} ${outcomes.join(' ')} ${BLOOM_DESCRIPTIONS[bloom] || ''}`.trim();

  // Relevance floor — HNSWLib always returns top-k even when nothing is
  // actually related to the topic; off-topic chunks would yield "grounded"
  // questions on the wrong content. Tunable via `retrieval_min_score`.
  const retrieved = await retrieve(query, tos.subject_id, await getNumber('retrieval_top_k', 5), scopedChunks, { lessonsOnly: true });
  const minScore = await getNumber('retrieval_min_score', 0.3);
  const chunks = retrieved.filter((c) => c.score >= minScore);
  const label = topic ? topic.title : 'this topic';

  const reasons = [];
  let questions = [];
  let dropped = 0;
  let transient = false;
  let last = null; // the most recent attempt and how to repeat it
  const take = (attempt) => {
    questions = questions.concat(attempt.questions);
    dropped += attempt.dropped;
    reasons.push(...attempt.reasons);
    transient = transient || attempt.transient;
  };
  if (chunks.length) {
    const grounded = await groundedDrafts(tos, topic, bloom, count, chunks);
    take(grounded);
    last = { attempt: grounded, rerun: (feedback) => groundedDrafts(tos, topic, bloom, count - questions.length, chunks, feedback) };
  } else {
    reasons.push(retrieved.length
      ? `No uploaded lesson material is relevant enough to "${label}" (best match ${retrieved[0].score.toFixed(2)} < ${minScore}).`
      : `No uploaded lesson material covers "${label}"; a syllabus plans coverage but does not contain answers.`);
  }

  if (questions.length < count && (await getNumber('knowledge_fallback_enabled', 1)) !== 0) {
    const knowledge = await knowledgeDrafts(tos, topic, bloom, count - questions.length, outcomes);
    take(knowledge);
    last = { attempt: knowledge, rerun: (feedback) => knowledgeDrafts(tos, topic, bloom, count - questions.length, outcomes, feedback) };
  }

  // One guided retry when drafts only missed the cognitive level: tell the
  // writer what the reviewer saw. The Bloom match itself is never relaxed.
  if (questions.length < count && last?.attempt.bloomMisses.length) {
    take(await last.rerun(bloomFeedback(bloom, last.attempt.bloomMisses)));
  }

  if (questions.length < count) {
    return {
      questions, dropped, failed: true, noRetry: !transient,
      reason: [...new Set(reasons)].join(' ') || 'No draft passed the answer, format and Bloom review for this cell.',
    };
  }
  return { questions, dropped, failed: false };
}

/** Drafts whose answers are proven by an exact passage of a retrieved lesson. */
async function groundedDrafts(tos, topic, bloom, count, chunks, feedback = '') {
  // Build the context from relevant chunks only
  const context = chunks.map((c) => c.text).join('\n\n---\n\n');

  const systemPrompt = `You are an expert educational assessment designer. Generate objective-type exam questions using ONLY the provided context material. You must NOT use any knowledge outside the provided context. If the context does not contain enough information to create a quality question, return fewer questions rather than inventing content.`;

  const userPrompt = `Using ONLY the context below, generate ${count} ${bloom} level (Bloom's Taxonomy: ${BLOOM_DESCRIPTIONS[bloom]}) question(s)${topic ? ` about "${topic.title}"` : ''}.

${TYPE_RULES}

Return ONLY a JSON array of question objects:
[
  {
    "type": "mcq|true_false|matching|identification",
    "stem": "The question text",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "answer": "The correct answer (must match one of the options for mcq, or 'True'/'False' for true_false)",
    "explanation": "Brief explanation of why the answer is correct, grounded in the context",
    "evidence": "A short, exact quotation copied verbatim from the context that supports the answer"
  }
]

IMPORTANT RULES:
1. Use ONLY information from the context below. Do NOT use outside knowledge.
2. The answer MUST be directly supported by the context.
3. For mcq, the answer must exactly match one of the options.
4. If the context is insufficient for ${count} questions, generate fewer.
5. Make questions clear, unambiguous, and at the specified Bloom level.
6. Never test the syllabus schedule, course policies, learning-outcome labels, teaching activities or assessment tasks. A topic heading is not enough evidence for a factual answer. Return [] if substantive lesson content is missing.
7. Identification requires a short term, never an essay or justification. Matching needs numbered premises in the stem and lettered choices in options.
8. Every question needs an evidence field copied exactly from the context. Do not paraphrase evidence.
${feedback ? `9. ${feedback}\n` : ''}
CONTEXT:
---
${context}
---`;

  const result = await generate(systemPrompt, userPrompt, { temperature: 0.4, maxTokens: 4096, timeoutMs: 120000 });
  const drafts = parseDrafts(result.text);
  if (!drafts) return { questions: [], dropped: 0, transient: true, bloomMisses: [], reasons: ['The AI returned invalid JSON for the lesson-grounded draft.'] };

  const meta = {
    provider: result.keyIndex ? `${result.provider}#${result.keyIndex}` : result.provider,
    model: result.model,
    grounding: 'grounded',
    chunkIds: chunks.map((c) => c.id),
    chunkScores: chunks.map((c) => ({ id: c.id, score: c.score })),
    bloom,
    topic: topic ? topic.title : null,
    promptHash: hash(systemPrompt + userPrompt),
    usage: result.usage,
    scopeKey: tos.scope_key || null,
  };

  const questions = [];
  const reasons = [];
  const bloomMisses = [];
  let dropped = 0;
  for (const draft of drafts.slice(0, count)) {
    draft.bloom = bloom;
    draft.topic = topic ? topic.title : null;
    if (!isValidGeneratedQuestion(draft, chunks.map((c) => c.text))) {
      dropped++; reasons.push('The question format, answer mapping or exact evidence span is invalid.'); continue;
    }
    const q = canonicalDraft(draft);
    const contentBlock = instructionalBlockReason(q, chunks);
    if (contentBlock) { dropped++; reasons.push(contentBlock); continue; }
    try {
      const writer = { provider: result.provider, model: result.model };
      const reviewed = await reviewQuestion(q, context, generate, { avoidProvider: writer.provider, excludeModels: [`${writer.provider}:${writer.model}`] });
      if (reviewed.review.actualBloom !== bloom) {
        bloomMisses.push(reviewed.review.actualBloom || 'unknown');
        throw new Error(`Bloom mismatch: requested ${bloom}, reviewer classified ${reviewed.review.actualBloom || 'unknown'}. ${reviewed.review.reason || ''}`);
      }
      // Blind solve: another model answers from the source without the key.
      const checks = await independentChecks(q, { mode: 'grounded', context, writer }, generate);
      const quality = makeQualityProof(q, chunks, reviewed.review, reviewed.provider, { writer, checks });
      questions.push({ ...q, meta: { ...meta, evidence: q.evidence, quality, reviewPromptHash: reviewed.promptHash } });
    } catch (err) { dropped++; reasons.push(err.message); }
  }
  if (!drafts.length) reasons.push(`The uploaded lessons do not contain enough substantive evidence for "${topic ? topic.title : 'this topic'}" at the ${bloom} level.`);
  return { questions, dropped, reasons, bloomMisses, transient: false };
}

/** Drafts written from general knowledge when no uploaded lesson covers the cell. */
async function knowledgeDrafts(tos, topic, bloom, count, outcomes, feedback = '') {
  const course = tos.subject_name || tos.title;
  const systemPrompt = `You are an expert educational assessment designer writing objective exam questions for a college course. No lesson material was uploaded for this topic, so write from well-established knowledge that standard introductory textbooks in the field agree on. Avoid contested claims, recent statistics, exact figures or dates you are not certain of, and terms specific to one textbook or institution. Never ask about the syllabus, schedule, course policies, outcome labels, teaching activities or assessment tasks. If you are not certain an answer is correct, write fewer questions.`;

  const userPrompt = `Course: ${course}
Topic: "${topic ? topic.title : 'General'}"
Learning outcomes for this topic (from the syllabus): ${outcomes.length ? outcomes.join('; ') : 'none stated'}

Write ${count} ${bloom} level (Bloom's Taxonomy: ${BLOOM_DESCRIPTIONS[bloom]}) question(s) that assess the subject matter of this topic.

${TYPE_RULES}
Identification answers are a short term of a few words, never a sentence or justification. True/false statements must be clearly true or clearly false.
${feedback}

Return ONLY a JSON array of question objects:
[
  {
    "type": "mcq|true_false|matching|identification",
    "stem": "The question text",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "answer": "The correct answer (must match one of the options for mcq, or 'True'/'False' for true_false)",
    "explanation": "One or two factual sentences explaining why the answer is correct"
  }
]`;

  const result = await generate(systemPrompt, userPrompt, { temperature: 0.4, maxTokens: 4096, timeoutMs: 120000 });
  const drafts = parseDrafts(result.text);
  if (!drafts) return { questions: [], dropped: 0, transient: true, bloomMisses: [], reasons: ['The AI returned invalid JSON for the knowledge-based draft.'] };

  const meta = {
    provider: result.keyIndex ? `${result.provider}#${result.keyIndex}` : result.provider,
    model: result.model,
    grounding: 'knowledge',
    chunkIds: [],
    bloom,
    topic: topic ? topic.title : null,
    outcomes,
    promptHash: hash(systemPrompt + userPrompt),
    usage: result.usage,
    scopeKey: tos.scope_key || null,
  };

  const questions = [];
  const reasons = [];
  const bloomMisses = [];
  let dropped = 0;
  for (const draft of drafts.slice(0, count)) {
    delete draft.evidence; // Nothing uploaded was quoted; never present model text as a source.
    draft.bloom = bloom;
    draft.topic = topic ? topic.title : null;
    if (!isValidGeneratedQuestion(draft, null, { requireEvidence: false })) {
      dropped++; reasons.push('The knowledge-based draft had an invalid format, answer mapping or explanation.'); continue;
    }
    const q = canonicalDraft(draft);
    const contentBlock = instructionalBlockReason(q, []);
    if (contentBlock) { dropped++; reasons.push(contentBlock); continue; }
    try {
      const writer = { provider: result.provider, model: result.model };
      const reviewed = await reviewKnowledgeQuestion(q, { course, topic: q.topic, outcomes }, generate, { avoidProvider: writer.provider, excludeModels: [`${writer.provider}:${writer.model}`] });
      if (reviewed.review.actualBloom !== bloom) {
        bloomMisses.push(reviewed.review.actualBloom || 'unknown');
        throw new Error(`Bloom mismatch: requested ${bloom}, reviewer classified ${reviewed.review.actualBloom || 'unknown'}. ${reviewed.review.reason || ''}`);
      }
      if (reviewed.review.answerCorrect !== true) throw new Error(`The fact-check could not confirm the answer. ${reviewed.review.reason || ''}`);
      // Two models other than the writer must reach the key without seeing it.
      const checks = await independentChecks(q, { mode: 'knowledge', writer }, generate);
      const quality = makeQualityProof(q, [], reviewed.review, reviewed.provider, { mode: 'knowledge', writer, checks });
      questions.push({ ...q, meta: { ...meta, quality, reviewPromptHash: reviewed.promptHash } });
    } catch (err) { dropped++; reasons.push(err.message); }
  }
  return { questions, dropped, reasons, bloomMisses, transient: false };
}
