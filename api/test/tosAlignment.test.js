import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTosMatrix, largestRemainder, slotGap, validateAlignedQuestions } from '../src/services/tosAlignment.js';

test('largest remainder produces the exact requested total', () => {
  const result = largestRemainder(7, { a: 50, b: 30, c: 20 }, ['a', 'b', 'c']);
  assert.deepEqual(result, { a: 4, b: 2, c: 1 });
});

test('TOS matrix preserves every topic and Bloom total', () => {
  const topics = [
    { title: 'One', item_count: 3 },
    { title: 'Two', item_count: 4 },
    { title: 'Three', item_count: 3 },
  ];
  const weights = { remember: 20, understand: 20, apply: 20, analyze: 20, evaluate: 10, create: 10 };
  const matrix = buildTosMatrix(topics, weights, 10);
  assert.equal(matrix.slots.reduce((sum, slot) => sum + slot.count, 0), 10);
  for (const topic of topics) {
    assert.equal(matrix.slots.filter((slot) => slot.topic === topic.title)
      .reduce((sum, slot) => sum + slot.count, 0), topic.item_count);
  }
  assert.deepEqual(matrix.bloomTargets, {
    remember: 2, understand: 2, apply: 2, analyze: 2, evaluate: 1, create: 1,
  });
});

test('alignment validator rejects incomplete and unexpected question sets', () => {
  const topics = [{ title: 'One', item_count: 2 }];
  const weights = { remember: 50, understand: 50, apply: 0, analyze: 0, evaluate: 0, create: 0 };
  assert.equal(validateAlignedQuestions([
    { topic: 'One', bloom: 'remember' },
    { topic: 'One', bloom: 'understand' },
  ], topics, weights, 2).ok, true);
  assert.equal(validateAlignedQuestions([
    { topic: 'One', bloom: 'remember' },
    { topic: 'Other', bloom: 'understand' },
  ], topics, weights, 2).ok, false);
});


test('TOS matrix rows mirror its slots per topic', () => {
  const topics = [{ title: 'One', item_count: 3 }, { title: 'Two', item_count: 4 }];
  const weights = { remember: 30, understand: 30, apply: 20, analyze: 20, evaluate: 0, create: 0 };
  const { slots, rows } = buildTosMatrix(topics, weights, 7);
  assert.equal(rows.length, 2);
  topics.forEach((topic, i) => {
    assert.equal(rows[i].reduce((sum, n) => sum + n, 0), topic.item_count);
    for (const slot of slots.filter((s) => s.topic === topic.title)) {
      assert.equal(rows[i][['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'].indexOf(slot.bloom)], slot.count);
    }
  });
});

test('slot gap counts each cell on its own — surplus never fills another cell', () => {
  const slots = [
    { topic: 'One', bloom: 'remember', count: 2 },
    { topic: 'One', bloom: 'apply', count: 3 },
    { topic: 'Two', bloom: 'remember', count: 1 },
  ];
  const have = new Map([
    ['One\u0000remember', 5], // 3 surplus
    ['One\u0000apply', 1],
    ['Off\u0000create', 4], // off-plan
  ]);
  assert.deepEqual(slotGap(slots, have), { planned: 6, covered: 3, missing: 3 });
});
