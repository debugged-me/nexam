import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import express from 'express';
import jwt from 'jsonwebtoken';

test('Ollama settings enforce roles, mask secrets, preserve blank keys, and test only saved config', async (t) => {
  const settings = new Map();
  const audits = [];
  const users = new Map([
    ['super', { id: 'super', role: 'superadmin', status: 'active', email: 'super@example.invalid' }],
    ['admin', { id: 'admin', role: 'admin', status: 'active' }],
    ['instructor', { id: 'instructor', role: 'instructor', status: 'active' }],
    ['revoked', { id: 'revoked', role: 'superadmin', status: 'rejected' }],
  ]);
  // Substitute mysql before importing routes: no connection to any real DB.
  t.mock.method(mysql, 'createPool', () => ({
    getConnection: async () => ({ release() {} }),
    query: async (sql, params) => {
      if (/SELECT id, email, role, status FROM users/.test(sql)) return [[users.get(params.id)].filter(Boolean)];
      if (/SELECT setting_value FROM settings/.test(sql)) return [settings.has(params.key) ? [{ setting_value: settings.get(params.key) }] : []];
      if (/INSERT INTO settings/.test(sql)) { settings.set(params.k, params.v); return [{}]; }
      if (/INSERT INTO audit_logs/.test(sql)) { audits.push(params); return [{}]; }
      assert.fail(`Unexpected SQL in isolated test: ${sql}`);
    },
  }));
  const { default: env } = await import('../src/config/env.js');
  const originalAi = env.ai;
  const originalSecret = env.jwt.secret;
  env.jwt.secret = 'isolated-ollama-settings-test';
  env.ai = {
    ...env.ai,
    gemini: { ...env.ai.gemini, apiKey: '' },
    groq: { ...env.ai.groq, apiKey: '' },
    ollama: { apiKey: '', model: 'gemma4:31b' },
  };
  t.after(() => { env.ai = originalAi; env.jwt.secret = originalSecret; });
  const { default: router } = await import('../src/routes/admin.js');
  const { getAiConfig, invalidateAiConfigCache } = await import('../src/services/aiConfig.js');
  const { generate, status } = await import('../src/services/aiProvider.js');
  const app = express();
  app.use(express.json());
  app.use('/api/admin', router);
  app.use((error, req, res, next) => res.status(500).json({ error: 'Unexpected test error' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  const realFetch = globalThis.fetch;
  let cloudCalls = 0;
  let cloudAuth;
  const fallbackCalls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).startsWith('https://api.groq.com/')) {
      fallbackCalls.push('groq');
      return Response.json({ error: { message: 'Rate limit reached', type: 'rate_limit_error' } }, { status: 429 });
    }
    assert.equal(url, 'https://ollama.com/api/chat', 'tests must never contact an actual provider');
    cloudCalls++;
    fallbackCalls.push('ollama');
    cloudAuth = options.headers.Authorization;
    return Response.json({
      model: JSON.parse(options.body).model,
      message: { content: JSON.stringify({ answer: 42, evidence: 'Velorium turns violet at exactly 42 degrees Celsius.' }) },
      done: true,
    });
  });
  const call = async (path, role = 'super', method = 'GET', body) => {
    const token = role ? jwt.sign({ id: role, role: users.get(role).role }, env.jwt.secret) : null;
    const result = await realFetch(base + path, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: result.status, body: await result.json() };
  };

  for (const role of [null, 'admin', 'instructor', 'revoked']) {
    for (const [path, method] of [['/settings', 'GET'], ['/settings', 'PUT'], ['/settings/ollama/test', 'POST']]) {
      const result = await call(path, role, method, method === 'GET' ? undefined : { ollama_api_key: 'must-not-save' });
      assert.ok([401, 403].includes(result.status), `${role} denied ${method} ${path}`);
    }
  }
  assert.equal(cloudCalls, 0);
  assert.equal(settings.size, 0);
  const queryToken = jwt.sign({ id: 'super', role: 'superadmin' }, env.jwt.secret);
  assert.equal((await call(`/settings/ollama/test?token=${queryToken}`, null, 'POST', {})).status, 401);

  await getAiConfig(); // Prime the cache before the save to verify invalidation.
  const saved = await call('/settings', 'super', 'PUT', { ollama_api_key: 'private-test-key-1234', ollama_model: 'gemma4:31b' });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.changed, ['ollama_api_key', 'ollama_model']);
  assert.equal((await getAiConfig()).ollama.apiKey, 'private-test-key-1234');
  const loaded = await call('/settings');
  assert.equal(loaded.body.ai.ollamaApiKeyMasked, '••••1234');
  assert.equal(loaded.body.ai.ollamaApiKeySource, 'settings');
  assert.equal(loaded.body.ai.ollamaApiKeySet, true);
  assert.doesNotMatch(JSON.stringify([saved.body, loaded.body, audits, await status()]), /private-test-key/);
  assert.deepEqual(JSON.parse(audits[0].detail).keys, ['ollama_api_key', 'ollama_model']);

  await call('/settings', 'super', 'PUT', { ollama_api_key: '  ', ollama_model: 'gpt-oss:20b' });
  assert.equal(settings.get('ollama_api_key'), 'private-test-key-1234');
  const invalid = await call('/settings', 'super', 'PUT', { ollama_api_key: 'would-overwrite', ollama_model: 'invalid model' });
  assert.equal(invalid.status, 400);
  assert.equal(settings.get('ollama_api_key'), 'private-test-key-1234');
  assert.equal((await call('/settings', 'super', 'PUT', { ollama_api_key: 'bad\nkey' })).status, 400);

  const checked = await call('/settings/ollama/test', 'super', 'POST', { ollama_api_key: 'ignore-request-key' });
  assert.equal(checked.status, 200);
  assert.equal(checked.body.model, 'gpt-oss:20b');
  assert.equal(cloudAuth, 'Bearer private-test-key-1234');
  assert.equal(cloudCalls, 1);
  assert.doesNotMatch(JSON.stringify(checked.body), /private-test-key|Velorium/);
  const generated = await generate('Source only.', 'Synthetic evidence', { maxTokens: 512 });
  assert.equal(generated.provider, 'ollama', 'actual provider wiring supports Ollama-only config');

  for (let i = 0; i < 2; i++) assert.equal((await call('/settings/ollama/test', 'super', 'POST', {})).status, 200);
  assert.equal((await call('/settings/ollama/test', 'super', 'POST', {})).status, 429);
  assert.equal(cloudCalls, 4);

  // Exercise the actual SDK wiring through generate(), not only the chain helper.
  const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai');
  t.mock.method(ChatGoogleGenerativeAI.prototype, 'invoke', async () => {
    fallbackCalls.push('gemini');
    throw Object.assign(new Error('quota exhausted'), { status: 429 });
  });
  settings.set('gemini_api_key', 'fake-gemini-key');
  settings.set('groq_api_key', 'fake-groq-key');
  invalidateAiConfigCache();
  fallbackCalls.length = 0;
  assert.equal((await generate('Source only.', 'Synthetic evidence', { maxTokens: 512 })).provider, 'ollama');
  assert.deepEqual(fallbackCalls, ['gemini', 'groq', 'ollama']);

  settings.delete('ollama_api_key');
  env.ai.ollama.apiKey = 'environment-only-5678';
  invalidateAiConfigCache();
  assert.equal((await getAiConfig()).ollama.apiKey, 'environment-only-5678');
  assert.equal((await call('/settings')).body.ai.ollamaApiKeySource, 'env');
});
