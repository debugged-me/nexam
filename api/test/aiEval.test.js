import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import express from 'express';
import jwt from 'jsonwebtoken';

test('Bloom evaluation uses explicit blind SME labels and current quality proofs', async (t) => {
  const questions = [
    {
      id: 'q1', stem: 'Which statement describes warm-up?', options: JSON.stringify(['A', 'B']),
      topic: 'Warm-up', type: 'mcq', status: 'active', ai_predicted_bloom: 'remember',
      sme_bloom: null, sme_labeled_at: null, subject_name: 'PE',
    },
    {
      id: 'q2', stem: 'Apply the stated rule to this case.', options: null,
      topic: 'Rules', type: 'identification', status: 'rejected', ai_predicted_bloom: 'understand',
      sme_bloom: 'remember', sme_labeled_at: '2026-10-17 12:00:00', subject_name: 'PE',
    },
  ];

  const query = async (sql, params = {}) => {
    if (/COUNT\(\*\) AS total_generated/.test(sql)) {
      return [[{ total_generated: 2, approved: 1, rejected_or_pending: 1, pending: 0 }]];
    }
    if (/COUNT\(\*\) AS total_questions/.test(sql)) {
      return [[{ total_questions: 2, flagged: 0, not_flagged: 2 }]];
    }
    if (/COUNT\(\*\) AS total_materials/.test(sql)) {
      return [[{ total_materials: 1, processed: 1, failed: 0, pending: 0 }]];
    }
    if (/JSON_UNQUOTE\(JSON_EXTRACT/.test(sql)) return [[]];
    if (/SELECT bloom, COUNT\(\*\) AS count/.test(sql)) return [[{ bloom: 'remember', count: 2 }]];
    if (/SELECT type, COUNT\(\*\) AS count/.test(sql)) return [[{ type: 'mcq', count: 1 }, { type: 'identification', count: 1 }]];
    if (/SELECT ai_predicted_bloom, sme_bloom AS bloom/.test(sql)) {
      assert.equal(params.qualityVersion, 2);
      return [questions.filter((q) => q.sme_bloom).map((q) => ({ ai_predicted_bloom: q.ai_predicted_bloom, bloom: q.sme_bloom }))];
    }
    if (/SELECT q\.id, q\.stem, q\.options/.test(sql)) {
      assert.equal(params.qualityVersion, 2);
      return [questions.map((q) => ({
        ...q,
        ai_predicted_bloom: q.sme_bloom ? q.ai_predicted_bloom : null,
      }))];
    }
    if (/COUNT\(\*\) AS eligible_count/.test(sql)) {
      assert.equal(params.qualityVersion, 2);
      return [[{
        eligible_count: questions.length,
        unlabeled_count: questions.filter((q) => !q.sme_bloom).length,
      }]];
    }
    if (/SELECT q\.id, q\.sme_bloom\s+FROM questions q/.test(sql)) {
      assert.equal(params.userId, 'owner');
      assert.equal(params.qualityVersion, 2);
      const question = questions.find((q) => q.id === params.id);
      return [[...(question ? [{ id: params.id, sme_bloom: question.sme_bloom }] : [])]];
    }
    if (/UPDATE questions\s+SET sme_bloom/.test(sql)) {
      const question = questions.find((q) => q.id === params.id);
      question.sme_bloom = params.bloom;
      question.sme_labeled_at = '2026-10-17 13:00:00';
      return [{ affectedRows: 1 }];
    }
    if (/INSERT INTO audit_logs/.test(sql)) return [{ affectedRows: 1 }];
    assert.fail(`Unexpected SQL: ${sql}`);
  };

  t.mock.method(mysql, 'createPool', () => ({
    query,
    getConnection: async () => ({ release() {} }),
  }));
  const { default: env } = await import('../src/config/env.js');
  const oldSecret = env.jwt.secret;
  env.jwt.secret = 'isolated-ai-eval-test';
  t.after(() => { env.jwt.secret = oldSecret; });

  const { default: router } = await import('../src/routes/ai_eval.js');
  const app = express();
  app.use(express.json());
  app.use('/ai-eval', router);
  app.use((err, req, res, next) => res.status(500).json({ error: err.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const token = jwt.sign({ id: 'owner', role: 'instructor', email: 'owner@example.invalid' }, env.jwt.secret);
  const request = async (path, method = 'GET', body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/ai-eval${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body && JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };

  const initial = await request('/summary');
  assert.equal(initial.status, 200, JSON.stringify(initial.body));
  assert.equal(initial.body.confusionMatrix.sampleSize, 1);
  assert.equal(initial.body.confusionMatrix.eligibleCount, 2);
  assert.equal(initial.body.confusionMatrix.unlabeledCount, 1);
  assert.equal(initial.body.evaluationQuestions[0].ai_predicted_bloom, null, 'prediction stays blind before labeling');
  assert.deepEqual(initial.body.evaluationQuestions[0].options, ['A', 'B']);

  const invalid = await request('/questions/q1/ground-truth', 'PUT', { bloom: 'easy' });
  assert.equal(invalid.status, 422);
  const labeled = await request('/questions/q1/ground-truth', 'PUT', { bloom: 'remember' });
  assert.equal(labeled.status, 200, JSON.stringify(labeled.body));
  const relabeled = await request('/questions/q1/ground-truth', 'PUT', { bloom: 'understand' });
  assert.equal(relabeled.status, 409, 'revealed predictions cannot influence a second label');

  const updated = await request('/summary');
  assert.equal(updated.body.confusionMatrix.sampleSize, 2);
  assert.equal(updated.body.confusionMatrix.unlabeledCount, 0);
  assert.equal(updated.body.confusionMatrix.overall.accuracy, 0.5);
  assert.equal(updated.body.confusionMatrix.macro.precision, 0.5);
  assert.equal(updated.body.confusionMatrix.macro.recall, 0.25);
  assert.equal(updated.body.evaluationQuestions[0].ai_predicted_bloom, 'remember', 'prediction appears only after the SME label');
});
