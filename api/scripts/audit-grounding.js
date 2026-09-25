import pool from '../src/config/db.js';
import { generate } from '../src/services/aiProvider.js';

const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = Math.min(Math.max(Number(limitArg?.split('=')[1]) || 10, 1), 50);

function parseJson(value, fallback = null) {
  if (value && typeof value === 'object') return value;
  const text = String(value || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  try { return JSON.parse(text); } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(text.slice(start, end + 1)); } catch { /* invalid */ }
    }
    return fallback;
  }
}

const [allAi] = await pool.query(
  `SELECT id, generation_meta FROM questions WHERE source = 'ai' ORDER BY created_at DESC`
);
let withProvenance = 0;
let completeProvenance = 0;
const candidates = [];

for (const question of allAi) {
  const meta = parseJson(question.generation_meta, {});
  const ids = Array.isArray(meta?.chunkIds) ? meta.chunkIds.filter(Boolean) : [];
  if (!ids.length) continue;
  withProvenance++;
  const [found] = await pool.query(`SELECT id FROM material_chunks WHERE id IN (:ids)`, { ids });
  if (found.length === new Set(ids).size) completeProvenance++;
  if (candidates.length < limit) candidates.push({ id: question.id, chunkIds: ids });
}

const judged = [];
for (const candidate of candidates) {
  const [[question], [chunks]] = await Promise.all([
    pool.query(`SELECT id, type, stem, options, answer, explanation FROM questions WHERE id = :id`, { id: candidate.id }),
    pool.query(`SELECT id, text FROM material_chunks WHERE id IN (:ids) ORDER BY ordinal ASC`, { ids: candidate.chunkIds }),
  ]);
  if (!question.length || !chunks.length) continue;
  const q = question[0];
  const context = chunks.map((chunk) => chunk.text).join('\n\n---\n\n').slice(0, 24000);
  const result = await generate(
    'You are a strict grounding auditor. Judge only whether the supplied answer is fully supported by the source excerpts. Do not use outside knowledge. Return JSON only.',
    `SOURCE EXCERPTS:\n${context}\n\nQUESTION: ${q.stem}\nOPTIONS: ${q.options || 'none'}\nANSWER: ${q.answer || ''}\nEXPLANATION: ${q.explanation || ''}`,
    {
      jsonSchema: {
        type: 'object',
        properties: {
          supported: { type: 'boolean' },
          unsupportedClaims: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
        },
        required: ['supported', 'unsupportedClaims', 'reason'],
      },
      temperature: 0,
      maxTokens: 350,
    }
  );
  const parsedVerdict = parseJson(result.text, null);
  const verdict = Array.isArray(parsedVerdict)
    ? parsedVerdict[0]
    : (parsedVerdict?.result && typeof parsedVerdict.result === 'object' ? parsedVerdict.result : parsedVerdict);
  const supported = verdict?.supported === true || verdict?.supported === 'true';
  judged.push({
    id: q.id,
    supported,
    validVerdict: Boolean(verdict && Object.hasOwn(verdict, 'supported')),
    unsupportedClaims: Array.isArray(verdict?.unsupportedClaims) ? verdict.unsupportedClaims.length : null,
    reason: String(verdict?.reason || (verdict ? 'Auditor did not provide a reason.' : 'Auditor returned invalid JSON.')).slice(0, 240),
    rawPreview: verdict ? undefined : String(result.text || '').slice(0, 160),
    provider: result.provider,
    model: result.model,
  });
}

const report = {
  aiQuestions: allAi.length,
  provenance: { withChunkIds: withProvenance, withAllChunksPresent: completeProvenance },
  sample: {
    requested: limit,
    judged: judged.length,
    supported: judged.filter((row) => row.supported).length,
    unsupported: judged.filter((row) => !row.supported).length,
    verdicts: judged,
  },
  note: 'This is an evidence audit, not a mathematical guarantee that no hallucination exists.',
};
console.log(JSON.stringify(report, null, 2));
await pool.end();
if (judged.some((row) => !row.supported)) process.exitCode = 2;
