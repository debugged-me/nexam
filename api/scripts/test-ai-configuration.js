import { embed, generate, status } from '../src/services/aiProvider.js';

const marker = 'Velorium turns violet at exactly 42 degrees Celsius.';
const report = { configured: status(), embedding: null, generation: null };

try {
  const embedded = await embed(marker);
  report.embedding = {
    ok: Array.isArray(embedded.embedding) && embedded.embedding.length > 0,
    provider: embedded.provider,
    model: embedded.model,
    dimensions: embedded.embedding.length,
    finite: embedded.embedding.every(Number.isFinite),
  };

  const generated = await generate(
    'Answer only from the supplied evidence. If the evidence does not answer the question, use null. Return JSON only.',
    `EVIDENCE: ${marker}\nQUESTION: At what temperature does Velorium turn violet?`,
    {
      jsonSchema: {
        type: 'object',
        properties: { answer: { type: ['number', 'null'] }, unit: { type: ['string', 'null'] } },
        required: ['answer', 'unit'],
      },
      temperature: 0,
      maxTokens: 128,
    }
  );
  const parsed = JSON.parse(generated.text);
  report.generation = {
    ok: Number(parsed.answer) === 42 && /c|celsius/i.test(String(parsed.unit)),
    provider: generated.provider,
    model: generated.model,
    groundedAnswer: parsed,
  };
} catch (error) {
  report.error = error.message;
}

console.log(JSON.stringify(report, null, 2));
if (!report.embedding?.ok || !report.embedding?.finite || !report.generation?.ok) process.exitCode = 1;
