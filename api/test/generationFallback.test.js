import test from 'node:test';
import assert from 'node:assert/strict';
import { isRetryableAiError, runGenerationFallback } from '../src/services/generationFallback.js';

function failing(status, message = 'Provider unavailable') {
  return Object.assign(new Error(message), { status });
}

test('Gemini quota then Groq quota reaches Ollama exactly once and preserves provenance', async () => {
  const calls = [];
  const result = { text: '[{"stem":"Question"}]', provider: 'ollama', model: 'test-model', usage: null };
  const providers = ['gemini', 'groq', 'ollama'].map((name) => ({
    name, configured: true,
    generate: async () => {
      calls.push(name);
      if (name !== 'ollama') throw failing(429);
      return result;
    },
  }));
  assert.equal(await runGenerationFallback(providers), result);
  assert.deepEqual(calls, ['gemini', 'groq', 'ollama']);
});

test('success stops the chain; unset providers are never called', async () => {
  const result = { provider: 'groq' };
  assert.equal(await runGenerationFallback([
    { name: 'gemini', configured: false, generate: () => assert.fail('unset') },
    { name: 'groq', configured: true, generate: async () => result },
    { name: 'ollama', configured: true, generate: () => assert.fail('unnecessary quota use') },
  ]), result);
});

test('credential and request errors are surfaced instead of hidden by fallback', async () => {
  for (const status of [400, 401, 403, 404]) {
    const error = failing(status);
    await assert.rejects(runGenerationFallback([
      { name: 'gemini', configured: true, generate: async () => { throw error; } },
      { name: 'ollama', configured: true, generate: () => assert.fail('must not hide configuration errors') },
    ]), (actual) => actual === error);
  }
});

test('exhaustion retains the last provider retry details when later providers are absent', async () => {
  const error = failing(429, '429 {"error":{"message":"Try again in 42s."}}');
  await assert.rejects(runGenerationFallback([
    { name: 'gemini', configured: true, generate: async () => { throw error; } },
    { name: 'ollama', configured: false },
  ]), (actual) => actual === error);
  await assert.rejects(runGenerationFallback([]), /No AI generation provider/);
});

test('network and service failures are eligible; unrelated errors are not', () => {
  for (const status of [408, 429, 500, 502, 503, 504, 529]) assert.equal(isRetryableAiError({ status }), true);
  for (const error of [
    { message: 'fetch failed' }, { cause: { code: 'ECONNRESET' } },
    { message: 'RESOURCE_EXHAUSTED' }, { message: 'request timed out' },
  ]) assert.equal(isRetryableAiError(error), true);
  assert.equal(isRetryableAiError(new Error('invalid schema')), false);
});

test('availability logs do not print provider error bodies', async (t) => {
  const messages = [];
  t.mock.method(console, 'warn', (message) => messages.push(message));
  await assert.rejects(runGenerationFallback([
    { name: 'gemini', configured: true, generate: async () => { throw failing(429, 'secret-token private-evidence'); } },
  ]));
  assert.equal(messages.length, 1);
  assert.doesNotMatch(messages[0], /secret-token|private-evidence/);
});
