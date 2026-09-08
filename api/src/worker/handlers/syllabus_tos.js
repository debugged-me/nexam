/**
 * Phase 3 — Syllabus → TOS auto-generation handler.
 *
 * Receives a job with payload { materialId, userId } and:
 *   1. Loads the syllabus material text.
 *   2. Calls LLM to extract topics, instructional hours, learning outcomes.
 *   3. Computes item weights proportionally to instructional hours.
 *   4. Computes Bloom distribution (default ramp, instructor can adjust).
 *   5. Creates a draft TOS + tos_topics rows for instructor review.
 *
 * The TOS is created as a DRAFT — the instructor reviews and edits before
 * it's used for question generation. Human-in-the-loop starts here.
 */
import { v4 as uuid } from 'uuid';
import pool from '../../config/db.js';
import { generate } from '../../services/aiProvider.js';

/** Default Bloom distribution (same as PHP Tos controller). */
const DEFAULT_BLOOM = {
  remember: 15,
  understand: 20,
  apply: 20,
  analyze: 20,
  evaluate: 15,
  create: 10,
};

export default async function syllabusTosHandler(job) {
  const { materialId, userId } = job.payload;
  if (!materialId) throw new Error('materialId is required.');

  // Load the syllabus material
  const [rows] = await pool.query(
    `SELECT * FROM materials WHERE id = :id AND is_syllabus = 1`,
    { id: materialId }
  );
  const material = rows[0];
  if (!material) throw new Error(`Syllabus material ${materialId} not found.`);
  if (material.status !== 'processed') {
    throw new Error(`Syllabus ${materialId} is not processed yet (status: ${material.status}).`);
  }
  if (!material.content || material.content.trim().length < 50) {
    throw new Error('Syllabus text is too short to parse.');
  }

  // ── LLM extraction ─────────────────────────────────
  const systemPrompt = `You are an expert educational assessment designer. Your task is to parse a course syllabus and extract structured information. You must return ONLY valid JSON matching the requested schema. Use only information present in the syllabus text. If something is not present, omit it. Never invent content.`;

  const userPrompt = `Parse the following course syllabus and extract:
1. A course title (if present)
2. A list of topics, each with:
   - topic: the topic name
   - instructional_hours: estimated hours of instruction (integer, default 3 if not specified)
   - learning_outcomes: array of learning outcome strings (empty if not specified)

Return ONLY a JSON object with this exact structure:
{
  "course_title": "string or null",
  "topics": [
    {
      "topic": "string",
      "instructional_hours": number,
      "learning_outcomes": ["string", ...]
    }
  ]
}

If the syllabus doesn't have clearly defined topics, extract them from section headings, weekly schedules, or course content descriptions. If you truly cannot identify any topics, return an empty topics array.

SYLLABUS TEXT:
---
${material.content.slice(0, 30000)}
---`;

  const result = await generate(systemPrompt, userPrompt, {
    jsonSchema: {
      properties: {
        course_title: { type: 'string' },
        topics: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              instructional_hours: { type: 'number' },
              learning_outcomes: { type: 'array', items: { type: 'string' } },
            },
            required: ['topic', 'instructional_hours'],
          },
        },
      },
      required: ['topics'],
    },
    temperature: 0.1, // Low temperature for factual extraction
  });

  let parsed;
  try {
    parsed = JSON.parse(result.text);
  } catch (err) {
    throw new Error(`LLM returned invalid JSON: ${err.message}. Raw: ${result.text.slice(0, 500)}`);
  }

  if (!parsed.topics || !Array.isArray(parsed.topics) || parsed.topics.length === 0) {
    throw new Error('No topics could be extracted from this syllabus. Try a different document or add topics manually.');
  }

  // ── Compute item weights (proportional to instructional hours) ──
  const totalHours = parsed.topics.reduce((sum, t) => sum + (t.instructional_hours || 3), 0);
  const totalItems = 50; // Default; instructor can change

  // ── Create the TOS ──────────────────────────────────
  const tosId = uuid();
  const tosTitle = parsed.course_title
    ? `${parsed.course_title} (Auto-generated)`
    : `${material.title} (Auto-generated)`;

  await pool.query(
    `INSERT INTO tos (id, subject_id, title, total_items, bloom_weights)
     VALUES (:id, :subjectId, :title, :totalItems, :bloomWeights)`,
    {
      id: tosId,
      subjectId: material.subject_id,
      title: tosTitle,
      totalItems,
      bloomWeights: JSON.stringify(DEFAULT_BLOOM),
    }
  );

  // ── Create topics with proportional item counts ─────
  let sortOrder = 1;
  let allocatedItems = 0;
  const topicRows = [];

  for (const topic of parsed.topics.slice(0, 30)) { // Cap at 30 topics
    const hours = topic.instructional_hours || 3;
    const exactItems = (hours / totalHours) * totalItems;
    const items = Math.max(1, Math.round(exactItems));
    topicRows.push({
      id: uuid(),
      tos_id: tosId,
      title: topic.topic,
      instructional_hours: hours,
      learning_outcomes: JSON.stringify(topic.learning_outcomes || []),
      item_count: items,
      sort_order: sortOrder++,
    });
    allocatedItems += items;
  }

  // Adjust last topic to make total match totalItems (largest remainder)
  if (topicRows.length > 0 && allocatedItems !== totalItems) {
    const diff = totalItems - allocatedItems;
    topicRows[topicRows.length - 1].item_count += diff;
    if (topicRows[topicRows.length - 1].item_count < 1) {
      topicRows[topicRows.length - 1].item_count = 1;
    }
  }

  // Insert topics
  for (const t of topicRows) {
    await pool.query(
      `INSERT INTO tos_topics (id, tos_id, title, instructional_hours, learning_outcomes, item_count, sort_order)
       VALUES (:id, :tosId, :title, :hours, :outcomes, :itemCount, :sortOrder)`,
      {
        id: t.id,
        tosId: t.tos_id,
        title: t.title,
        hours: t.instructional_hours,
        outcomes: t.learning_outcomes,
        itemCount: t.item_count,
        sortOrder: t.sort_order,
      }
    );
  }

  return {
    tosId,
    title: tosTitle,
    topicCount: topicRows.length,
    totalItems,
    provider: result.provider,
    model: result.model,
  };
}
