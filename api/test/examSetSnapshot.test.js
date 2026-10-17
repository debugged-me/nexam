import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXAM_SET_SNAPSHOT_VERSION,
  examSetQuestionSelect,
  materializeSetQuestion,
  snapshotInsertValues,
  snapshotQuestion,
} from '../src/services/examSetSnapshot.js';

test('snapshotQuestion freezes only delivered assessment fields', () => {
  const live = {
    id: 'q-1',
    type: 'mcq',
    stem: 'Capital of France?',
    options: JSON.stringify(['Paris', 'London']),
    answer: 'A',
    explanation: 'Paris is the capital.',
    topic: 'Europe',
    bloom: 'remember',
    source: 'ai',
    generation_meta: JSON.stringify({ quality: { version: 2 } }),
    embedding: 'must-not-be-copied',
  };

  const frozen = snapshotQuestion(live);
  live.stem = 'Changed later';

  assert.equal(frozen.snapshot_version, EXAM_SET_SNAPSHOT_VERSION);
  assert.equal(frozen.stem, 'Capital of France?');
  assert.deepEqual(frozen.options, ['Paris', 'London']);
  assert.deepEqual(frozen.generation_meta, { quality: { version: 2 } });
  assert.equal('embedding' in frozen, false);
});

test('snapshot insert values and selected rows preserve nulls and JSON', () => {
  const values = snapshotInsertValues({
    id: 'q-2', type: 'identification', stem: 'Name it', options: null,
    answer: 'CORRECT', explanation: null, topic: null, bloom: 'apply', source: 'manual',
    generation_meta: null,
  });
  assert.equal(values[0], EXAM_SET_SNAPSHOT_VERSION);
  assert.equal(values[3], null);

  const row = materializeSetQuestion({
    id: 'q-2', snapshot_version: 1, options: '["A","B"]', generation_meta: '{"writer":"x"}',
  });
  assert.deepEqual(row.options, ['A', 'B']);
  assert.deepEqual(row.generation_meta, { writer: 'x' });
  assert.match(examSetQuestionSelect(), /CASE WHEN esq\.snapshot_version >= 1 THEN esq\.question_answer ELSE q\.answer END AS answer/);
});
