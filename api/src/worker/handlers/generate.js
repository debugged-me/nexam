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
 * If retrieved context is empty/thin, the slot FAILS rather than letting
 * the LLM free-associate — this is the hallucination guard.
 */
import { v4 as uuid } from 'uuid';
import pool from '../../config/db.js';
import { generate } from '../../services/aiProvider.js';
import { retrieve } from '../../services/retriever.js';
import { enqueue } from '../../services/jobs.js';
import { getNumber } from '../../services/settings.js';
import { answerOptionIndex, parseMatchingLetters, parseOptions } from '../../services/scoring.js';

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
    `SELECT t.*, s.instructor_id
     FROM tos t
     JOIN subjects s ON s.id = t.subject_id
     WHERE t.id = :tosId`,
    { tosId }
  );
  const tos = tosRows[0];
  if (!tos) throw new Error(`TOS ${tosId} not found.`);
  if (tos.instructor_id !== userId) throw new Error('TOS not owned by user.');

  // ── Load topics ─────────────────────────────────────
  const [topics] = await pool.query(
    `SELECT * FROM tos_topics WHERE tos_id = :tosId ORDER BY sort_order ASC`,
    { tosId }
  );

  // ── Parse bloom weights and compute allocation ──────
  const bloomWeights = JSON.parse(tos.bloom_weights || '{}');
  const totalItems = tos.total_items || 50;
  const allocation = computeAllocation(bloomWeights, totalItems);

  // ── Generate questions per bloom level ──────────────
  // For each bloom level with count > 0, we generate across topics.
  // If topics exist, we distribute count across topics proportionally.
  // If no topics, we generate count questions for the subject generally.
  const generatedQuestions = [];
  const failedSlots = [];
  let droppedInvalid = 0;

  for (const [bloom, count] of Object.entries(allocation)) {
    if (count <= 0) continue;

    if (topics.length > 0) {
      // Distribute count across topics proportionally to item_count
      const totalTopicItems = topics.reduce((sum, t) => sum + (t.item_count || 1), 0);
      let remaining = count;

      for (let i = 0; i < topics.length && remaining > 0; i++) {
        const topic = topics[i];
        const topicCount = i === topics.length - 1
          ? remaining
          : Math.max(1, Math.round((topic.item_count || 1) / totalTopicItems * count));
        const actualCount = Math.min(topicCount, remaining);
        remaining -= actualCount;

        const result = await generateForSlot(tos, topic, bloom, actualCount);
        if (result.questions.length > 0) {
          generatedQuestions.push(...result.questions);
        }
        if (result.dropped) {
          droppedInvalid += result.dropped;
        }
        if (result.failed) {
          failedSlots.push({ topic: topic.title, bloom, count: actualCount, reason: result.reason });
        }
      }
    } else {
      // No topics — generate for the subject generally
      const result = await generateForSlot(tos, null, bloom, count);
      if (result.questions.length > 0) {
        generatedQuestions.push(...result.questions);
      }
      if (result.dropped) {
        droppedInvalid += result.dropped;
      }
      if (result.failed) {
        failedSlots.push({ topic: '(general)', bloom, count, reason: result.reason });
      }
    }
  }

  // ── Store generated questions ───────────────────────
  for (const q of generatedQuestions) {
    const questionId = uuid();
    await pool.query(
      `INSERT INTO questions
         (id, subject_id, tos_id, topic, bloom, ai_predicted_bloom, type, stem, options, answer,
          explanation, status, source, generation_meta, created_by)
       VALUES
         (:id, :subjectId, :tosId, :topic, :bloom, :aiPredictedBloom, :type, :stem, :options, :answer,
          :explanation, 'draft', 'ai', :meta, :createdBy)`,
      {
        id: questionId,
        subjectId: tos.subject_id,
        tosId: tos.id,
        topic: q.topic || null,
        bloom: q.bloom,
        aiPredictedBloom: q.bloom,
        type: q.type,
        stem: q.stem,
        options: q.options ? JSON.stringify(q.options) : null,
        answer: q.answer || null,
        explanation: q.explanation || null,
        meta: JSON.stringify(q.meta),
        createdBy: userId,
      }
    );

    // Enqueue similarity check for this new question
    await enqueue({
      type: 'similarity',
      payload: { questionId, userId },
      userId,
      subjectId: tos.subject_id,
    });
  }

  return {
    tosId,
    generated: generatedQuestions.length,
    droppedInvalid,
    failedSlots,
  };
}

/**
 * Generate questions for a single (topic, bloom, count) slot using RAG.
 */
async function generateForSlot(tos, topic, bloom, count) {
  // Build the retrieval query
  const topicText = topic ? topic.title : '';
  const outcomesText = topic && topic.learning_outcomes
    ? (typeof topic.learning_outcomes === 'string' ? JSON.parse(topic.learning_outcomes) : topic.learning_outcomes).join(' ')
    : '';
  const query = `${topicText} ${outcomesText} ${BLOOM_DESCRIPTIONS[bloom] || ''}`.trim();

  // Retrieve top-k chunks scoped to this subject (top-k is tunable via the
  // `retrieval_top_k` settings key — defaults to 5).
  const retrieved = await retrieve(query, tos.subject_id, await getNumber('retrieval_top_k', 5));

  if (retrieved.length === 0) {
    return { questions: [], failed: true, reason: 'No source material found for this topic. Upload instructional materials for this subject first.' };
  }

  // Relevance floor — HNSWLib always returns top-k even when nothing is
  // actually related to the topic. Chunks below the minimum cosine score
  // are near-certainly off-topic; feeding them to the LLM produces
  // "grounded" questions on the wrong content (a subtle hallucination).
  // Tunable via `retrieval_min_score` (default 0.3).
  const minScore = await getNumber('retrieval_min_score', 0.3);
  const chunks = retrieved.filter((c) => c.score >= minScore);

  if (chunks.length === 0) {
    const best = retrieved[0]?.score ?? 0;
    return {
      questions: [],
      failed: true,
      reason: `No sufficiently relevant material for "${topic ? topic.title : 'this subject'}" (best match score ${best.toFixed(2)} < ${minScore}). Upload materials covering this topic.`,
    };
  }

  // Build the context from relevant chunks only
  const context = chunks.map((c) => c.text).join('\n\n---\n\n');

  // Build the LLM prompt
  const systemPrompt = `You are an expert educational assessment designer. Generate objective-type exam questions using ONLY the provided context material. You must NOT use any knowledge outside the provided context. If the context does not contain enough information to create a quality question, return fewer questions rather than inventing content.`;

  const userPrompt = `Using ONLY the context below, generate ${count} ${bloom} level (Bloom's Taxonomy: ${BLOOM_DESCRIPTIONS[bloom]}) question(s)${topic ? ` about "${topic.title}"` : ''}.

Each question must be one of these types: mcq, true_false, matching, identification.
- mcq: Multiple choice with 4 options. Include options as an array and specify the correct answer.
- true_false: Statement that is either true or false. Answer is "True" or "False".
- matching: Two lists to be matched. Options is an array of items, answer is the correct matching as "1-B, 2-A, 3-D, 4-C".
- identification: A statement or question requiring a short answer. Answer is the expected response.

Return ONLY a JSON array of question objects:
[
  {
    "type": "mcq|true_false|matching|identification",
    "stem": "The question text",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "answer": "The correct answer (must match one of the options for mcq, or 'True'/'False' for true_false)",
    "explanation": "Brief explanation of why the answer is correct, grounded in the context"
  }
]

IMPORTANT RULES:
1. Use ONLY information from the context below. Do NOT use outside knowledge.
2. The answer MUST be directly supported by the context.
3. For mcq, the answer must exactly match one of the options.
4. If the context is insufficient for ${count} questions, generate fewer.
5. Make questions clear, unambiguous, and at the specified Bloom level.

CONTEXT:
---
${context}
---`;

  const result = await generate(systemPrompt, userPrompt, {
    temperature: 0.4,
    maxTokens: 4096,
  });

  // Parse the LLM response
  let questions;
  try {
    // The response might be wrapped in markdown code blocks
    let text = result.text.trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    questions = JSON.parse(text);
    if (!Array.isArray(questions)) {
      questions = [questions];
    }
  } catch (err) {
    return { questions: [], failed: true, reason: `LLM returned invalid JSON: ${err.message}` };
  }

  // Attach metadata to each question
  const meta = {
    provider: result.provider,
    model: result.model,
    chunkIds: chunks.map((c) => c.id),
    chunkScores: chunks.map((c) => ({ id: c.id, score: c.score })),
    bloom,
    topic: topic ? topic.title : null,
    promptHash: Buffer.from(userPrompt).toString('base64').slice(0, 16),
    usage: result.usage,
  };

  const validQuestions = [];
  let dropped = 0;
  for (const q of questions) {
    if (isValidGeneratedQuestion(q)) {
      validQuestions.push({ ...q, bloom, topic: topic ? topic.title : null, meta });
    } else {
      dropped++;
    }
  }

  // If the LLM produced only structurally invalid questions, the slot failed
  // even though JSON parsed — report it so the job result is honest.
  if (validQuestions.length === 0 && questions.length > 0) {
    return {
      questions: [],
      failed: true,
      reason: `LLM returned ${questions.length} question(s) but none passed validation (answers not resolvable against their own options).`,
    };
  }

  return { questions: validQuestions, dropped, failed: false };
}

const ALLOWED_TYPES = new Set(['mcq', 'true_false', 'matching', 'identification']);

/**
 * Validate a generated question's structure AND answer resolvability.
 *
 * An answer that cannot be resolved against the question's own options is
 * the classic LLM failure mode (hallucinated key). Storing it silently makes
 * every student score 0 on that item — drop it instead.
 */
function isValidGeneratedQuestion(q) {
  if (!q || typeof q.stem !== 'string' || q.stem.trim().length < 5) return false;
  if (!ALLOWED_TYPES.has(q.type)) return false;

  switch (q.type) {
    case 'mcq': {
      const opts = parseOptions(q.options).filter((o) => typeof o === 'string' && o.trim());
      if (opts.length < 3) return false;
      q.options = opts; // normalize: strip empty options
      return answerOptionIndex(opts, q.answer) >= 0;
    }
    case 'true_false': {
      const a = String(q.answer ?? '').trim().toLowerCase();
      return a === 'true' || a === 'false' || a === 't' || a === 'f';
    }
    case 'matching': {
      // options[] are the premises (left column); the answer is "1-B, 2-A…"
      // with letters indexing the implicit A–E match column on the OMR sheet.
      const opts = parseOptions(q.options);
      const letters = parseMatchingLetters(q.answer);
      if (opts.length < 2 || !letters || letters.length !== opts.length) return false;
      for (let i = 0; i < letters.length; i++) {
        if (!letters[i]) return false; // every premise must have a match
        if (letters[i].charCodeAt(0) - 65 > 4) return false; // A–E only
      }
      return true;
    }
    case 'identification':
      return typeof q.answer === 'string' && q.answer.trim().length > 0;
    default:
      return false;
  }
}

/** Convert percentage weights into item counts using largest remainders. */
function computeAllocation(weights, total) {
  const allocation = {};
  const remainders = [];
  let allocated = 0;

  for (const [bloom, pct] of Object.entries(weights)) {
    const exact = (parseFloat(pct) / 100) * total;
    const whole = Math.floor(exact);
    allocation[bloom] = whole;
    remainders.push({ bloom, remainder: exact - whole });
    allocated += whole;
  }

  remainders.sort((a, b) => b.remainder - a.remainder);
  for (const { bloom } of remainders) {
    if (allocated >= total) break;
    allocation[bloom]++;
    allocated++;
  }

  return allocation;
}
