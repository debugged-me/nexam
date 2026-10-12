import test from 'node:test';
import assert from 'node:assert/strict';
import { similarityGate } from '../src/services/questionApproval.js';

const clean = {
  status: 'draft',
  similarity_flag: 'none',
  similarity_score: 0.12,
  similarity_checked_at: new Date(),
  similarity_error: null,
};

const failed = {
  ...clean,
  similarity_checked_at: null,
  similarity_error: 'embedQuery: provider unreachable',
};

test('clean draft passes the gate', () => {
  assert.equal(similarityGate(clean), null);
});

test('pending check blocks, and the bypass does NOT lift it', () => {
  const pending = { ...clean, similarity_checked_at: null };
  assert.match(similarityGate(pending), /still pending/);
  assert.match(similarityGate(pending, { ignoreSimilarityFailure: true }), /still pending/);
});

test('flagged duplicate blocks, and the bypass does NOT lift it', () => {
  const flagged = { ...clean, similarity_flag: 'flagged' };
  assert.match(similarityGate(flagged), /similarity match/);
  assert.match(similarityGate(flagged, { ignoreSimilarityFailure: true }), /similarity match/);
});

test('provider failure blocks by default', () => {
  assert.match(similarityGate(failed), /Similarity check failed: embedQuery/);
});

test('bypass lifts a provider failure — checked_at NULL is failure residue, not pending', () => {
  assert.equal(similarityGate(failed, { ignoreSimilarityFailure: true }), null);
});

test('bypassed failure with a stale flag still blocks on the flag', () => {
  assert.match(
    similarityGate({ ...failed, similarity_flag: 'flagged' }, { ignoreSimilarityFailure: true }),
    /similarity match/
  );
});

test('rejected stays rejected under the bypass', () => {
  const rejected = { ...failed, similarity_flag: 'rejected', status: 'rejected' };
  assert.match(similarityGate(rejected, { ignoreSimilarityFailure: true }), /cannot be approved/);
});
