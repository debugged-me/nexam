import test from 'node:test';
import assert from 'node:assert/strict';
import { generateOllamaCloud, testOllamaCloudConnection } from '../src/services/ollamaCloud.js';
import { isValidGeneratedQuestion } from '../src/services/generationValidation.js';

const config = { apiKey: 'test-secret-key', model: 'gemma4:31b' };
const evidence = 'Velorium turns violet at exactly 42 degrees Celsius.';
const answer = { answer: 42, evidence };
const response = (content, extra = {}) => Response.json({ model: config.model, message: { content }, done: true, ...extra });

test('cloud calls use the fixed HTTPS endpoint, bearer auth, token budget, and JSON prompt', async (t) => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent = { url, ...options, body: JSON.parse(options.body) };
    return response('```json\n{"answer":42}\n```', { prompt_eval_count: 12, eval_count: 8 });
  });
  const result = await generateOllamaCloud(config, 'Source only.', evidence, {
    jsonSchema: { type: 'object' }, temperature: 0, maxTokens: 128,
  });
  assert.equal(sent.url, 'https://ollama.com/api/chat');
  assert.equal(sent.headers.Authorization, 'Bearer test-secret-key');
  assert.equal(sent.redirect, 'error');
  assert.ok(sent.signal instanceof AbortSignal);
  assert.equal(sent.body.stream, false);
  assert.deepEqual(sent.body.options, { temperature: 0, num_predict: 128 });
  assert.equal(sent.body.format, undefined, 'cloud schema enforcement is unsupported');
  assert.match(sent.body.messages[0].content, /"type":"object"/);
  assert.equal(sent.body.messages[1].content, evidence);
  assert.deepEqual(result, {
    text: '{"answer":42}', provider: 'ollama', model: config.model,
    usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20 },
  });
  assert.doesNotMatch(JSON.stringify(result), /test-secret-key/);
});

test('missing credentials/model fail before any request', async (t) => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('no network call expected'));
  await assert.rejects(generateOllamaCloud({ model: 'x' }, '', ''), /Save an Ollama/);
  await assert.rejects(generateOllamaCloud({ apiKey: 'x', model: ' ' }, '', ''), /Choose an Ollama/);
});

test('quota retry headers survive without leaking the upstream body', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('test-secret-key private-source', {
    status: 429, headers: { 'retry-after': '45' },
  }));
  await assert.rejects(generateOllamaCloud(config, '', ''), (error) => {
    assert.equal(error.status, 429);
    assert.match(error.message, /Try again in 45s/);
    assert.doesNotMatch(error.message, /test-secret-key|private-source/);
    return true;
  });
});

test('auth, allowance, model, and service errors are safe and actionable', async (t) => {
  for (const [status, expected] of [[401, /API key/], [402, /free allowance/], [403, /free allowance/], [404, /model was not found/], [503, /HTTP 503/]]) {
    t.mock.method(globalThis, 'fetch', async () => new Response('test-secret-key private-source', { status }));
    await assert.rejects(generateOllamaCloud(config, '', ''), (error) => {
      assert.equal(error.status, status);
      assert.match(error.message, expected);
      assert.doesNotMatch(error.message, /test-secret-key|private-source/);
      return true;
    });
  }
});

test('timeouts and network errors do not leak transport errors', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('private-source', 'TimeoutError'); });
  await assert.rejects(generateOllamaCloud(config, '', ''), { status: 504, message: 'Ollama Cloud timed out. Please try again shortly.' });
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('test-secret-key'); });
  await assert.rejects(generateOllamaCloud(config, '', ''), { status: 503, message: 'Ollama Cloud could not be reached. Please try again shortly.' });
});

test('empty, truncated, and malformed responses fail closed; thinking is never an answer', async (t) => {
  for (const body of [
    { message: { thinking: 'private thinking' }, done: true },
    { message: { content: ' ' }, done: true },
    { message: { content: '{}' }, done: false },
    { message: { content: '{}' }, done: true, done_reason: 'length' },
    { error: 'private-source' },
  ]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body));
    await assert.rejects(generateOllamaCloud(config, '', ''), (error) => error.status === 502 && !/private/.test(error.message));
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('not JSON'));
  await assert.rejects(generateOllamaCloud(config, '', ''), /invalid response/);
});

test('requests serialize and a failed call does not poison the queue', async (t) => {
  let active = 0;
  let peak = 0;
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    active++;
    peak = Math.max(peak, active);
    const nth = ++calls;
    await new Promise((resolve) => setImmediate(resolve));
    active--;
    return nth === 1 ? new Response('', { status: 503 }) : response('{}');
  });
  const results = await Promise.allSettled([generateOllamaCloud(config, '', ''), generateOllamaCloud(config, '', '')]);
  assert.equal(peak, 1);
  assert.deepEqual(results.map((r) => r.status), ['rejected', 'fulfilled']);
});

test('connection test checks actual JSON and exact evidence, without returning the generated text', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => response(JSON.stringify(answer)));
  assert.deepEqual(await testOllamaCloudConnection(config), { provider: 'ollama', model: config.model });
  for (const text of ['not JSON', '{"answer":41}', JSON.stringify({ ...answer, evidence: 'invented' })]) {
    t.mock.method(globalThis, 'fetch', async () => response(text));
    await assert.rejects(testOllamaCloudConnection(config), /JSON\/evidence check/);
  }
});

test('connection test reports busy immediately instead of waiting past the browser timeout', async (t) => {
  let release;
  t.mock.method(globalThis, 'fetch', () => new Promise((resolve) => { release = resolve; }));
  const generating = generateOllamaCloud(config, '', evidence);
  await assert.rejects(testOllamaCloudConnection(config), { status: 429, message: 'Ollama Cloud is busy generating. Test the connection after the current jobs finish.' });
  release(response('{}'));
  await generating;
  t.mock.method(globalThis, 'fetch', async () => response(JSON.stringify(answer)));
  assert.equal((await testOllamaCloudConnection(config)).provider, 'ollama');
});

test('Ollama drafts still go through the question evidence gate', async (t) => {
  const question = { type: 'true_false', stem: 'Velorium turns violet at 42 degrees Celsius.', answer: 'True', evidence };
  t.mock.method(globalThis, 'fetch', async () => response(JSON.stringify([question])));
  const result = await generateOllamaCloud(config, '', evidence);
  const draft = JSON.parse(result.text)[0];
  assert.equal(isValidGeneratedQuestion(draft, evidence), true);
  assert.equal(isValidGeneratedQuestion({ ...draft, evidence: 'Unsupported source claim.' }, evidence), false);
});
