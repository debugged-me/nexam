import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import express from 'express';
import jwt from 'jsonwebtoken';
import { scopeKey } from '../src/services/assessmentScope.js';

test('coverage API enforces ownership, confirmation, immutable finalized scopes, and current exact excerpts', async (t) => {
  let tos = { id: 'blueprint', subject_id: 'subject', title: 'Fitness', status: 'draft', total_items: 10,
    bloom_weights: JSON.stringify({ remember: 100 }), assessment_scope: JSON.stringify({ label: 'Prelim', sources: [], confirmed: false }), scope_key: null };
  let topics = [{ id: 't1', title: 'Warm-up', instructional_hours: 2, item_count: 5 }, { id: 't2', title: 'Resistance', instructional_hours: 2, item_count: 5 }];
  let chunks = [{ id: 'c1', materialId: 'lesson', text: 'Warm-up prepares the body for exercise. Resistance training builds strength.' }];
  let backup;
  let writes = 0;
  const query = async (sql, p) => {
    if (/SELECT t\.\* FROM tos t JOIN subjects/.test(sql)) return [[...(p.id === tos.id && p.uid === 'owner' ? [structuredClone(tos)] : [])]];
    if (/SELECT m.id, m.title, m.is_syllabus/.test(sql)) { assert.equal(p.uid, 'owner'); return [[{ id: 'lesson', title: 'Lesson', is_syllabus: 0 }]]; }
    if (/SELECT c.id, c.text/.test(sql)) { assert.equal(p.sid, 'subject'); assert.equal(p.uid, 'owner'); return [chunks.filter((c) => p.ids.includes(c.id))]; }
    if (/SELECT id FROM tos_topics/.test(sql)) return [topics.map(({ id }) => ({ id }))];
    if (/SELECT total_items FROM tos/.test(sql)) return [[{ total_items: tos.total_items }]];
    if (/SELECT id, instructional_hours FROM tos_topics/.test(sql)) return [topics];
    if (/SELECT id, title, instructional_hours, learning_outcomes, item_count/.test(sql)) return [topics];
    if (/DELETE FROM tos_topics/.test(sql)) { writes++; topics = topics.filter((r) => p.selected.includes(r.id)); return [{ affectedRows: 1 }]; }
    if (/UPDATE tos SET assessment_scope/.test(sql)) { writes++; tos.assessment_scope = p.scope; tos.scope_key = p.key; return [{ affectedRows: 1 }]; }
    if (/UPDATE tos_topics SET item_count/.test(sql)) { topics.find((r) => r.id === p.id).item_count = p.n; return [{ affectedRows: 1 }]; }
    if (/UPDATE tos SET status/.test(sql)) { tos.status = 'finalized'; return [{ affectedRows: 1 }]; }
    if (/SELECT \* FROM tos WHERE/.test(sql)) return [[structuredClone(tos)]];
    if (/INSERT INTO audit_logs/.test(sql)) return [{}];
    assert.fail(`Unexpected SQL: ${sql}`);
  };
  t.mock.method(mysql, 'createPool', () => ({ query, getConnection: async () => ({ query,
    beginTransaction: async () => { backup = structuredClone({ tos, topics }); },
    commit: async () => {}, rollback: async () => { if (backup) { tos = backup.tos; topics = backup.topics; } }, release() {},
  }) }));
  const { default: env } = await import('../src/config/env.js');
  const oldSecret = env.jwt.secret;
  env.jwt.secret = 'isolated-assessment-test';
  t.after(() => { env.jwt.secret = oldSecret; });
  const { default: router } = await import('../src/routes/tos.js');
  const app = express();
  app.use(express.json()); app.use('/tos', router);
  app.use((err, req, res, next) => res.status(500).json({ error: err.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/tos`;
  const token = (id) => jwt.sign({ id, role: 'instructor', email: 'owner@example.invalid' }, env.jwt.secret);
  const request = async (path, method = 'GET', body, user = 'owner') => {
    const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', ...(user ? { authorization: `Bearer ${token(user)}` } : {}) }, body: body && JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };
  const payload = { label: 'Prelim', weekStart: 1, weekEnd: 5, confirmed: true, topicIds: ['t1'], sources: [{ chunkId: 'c1', text: 'Warm-up prepares the body for exercise.' }] };
  assert.equal((await request('/blueprint/scope-materials', 'GET', undefined, 'stranger')).status, 404);
  assert.equal((await request('/blueprint/scope-materials?materialId=foreign')).status, 404);
  assert.equal((await request(`/blueprint/scope-materials?token=${token('owner')}`, 'GET', undefined, null)).status, 401);
  assert.equal((await request('/blueprint/assessment-scope', 'PUT', payload, 'stranger')).status, 404);
  assert.equal((await request('/blueprint/finalize', 'POST', {})).status, 422);
  for (const change of [
    { confirmed: false }, { weekEnd: '' }, { topicIds: ['foreign'] },
    { sources: [{ chunkId: 'foreign', text: payload.sources[0].text }] },
    { sources: [{ chunkId: 'c1', text: 'This invented sentence is not a source.' }] },
  ]) {
    const result = await request('/blueprint/assessment-scope', 'PUT', { ...payload, ...change });
    assert.equal(result.status, 422, JSON.stringify(result.body));
  }
  assert.equal(writes, 0, 'invalid requests do not mutate any records');
  const saved = await request('/blueprint/assessment-scope', 'PUT', payload);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(topics.length, 1);
  assert.equal(topics[0].item_count, 10);
  assert.equal(tos.scope_key, scopeKey(payload));
  assert.equal(JSON.parse(tos.assessment_scope).sources[0].text, payload.sources[0].text);
  chunks = [];
  assert.equal((await request('/blueprint/finalize', 'POST', {})).status, 422, 'deleted sources block finalization');
  chunks = [{ id: 'c1', text: payload.sources[0].text }];
  const finalized = await request('/blueprint/finalize', 'POST', {});
  assert.equal(finalized.status, 200, JSON.stringify(finalized.body));
  const before = writes;
  assert.equal((await request('/blueprint/assessment-scope', 'PUT', payload)).status, 409);
  assert.equal(writes, before, 'stale edit cannot change finalized coverage');
});
