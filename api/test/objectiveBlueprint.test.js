import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOOM_LEVELS,
  DEFAULT_OBJECTIVE_BLOOM,
  objectiveCreateBlockReason,
} from '../src/services/objectiveBlueprint.js';

test('objective blueprint defaults total 100% without allocating Create items', () => {
  const total = BLOOM_LEVELS.reduce(
    (sum, level) => sum + Number(DEFAULT_OBJECTIVE_BLOOM[level] || 0),
    0
  );

  assert.equal(total, 100);
  assert.equal(DEFAULT_OBJECTIVE_BLOOM.create, 0);
  assert.equal(objectiveCreateBlockReason(DEFAULT_OBJECTIVE_BLOOM), null);
});

test('objective blueprint rejects a positive Create allocation', () => {
  assert.match(objectiveCreateBlockReason({ create: 1 }), /Create must be 0%/);
});
