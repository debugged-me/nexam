import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTosMatrix, largestRemainder, validateAlignedQuestions } from '../src/services/tosAlignment.js';

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

