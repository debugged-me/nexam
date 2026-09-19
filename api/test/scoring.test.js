/**
 * scoring.test.js — canonical answer contract tests (node --test).
 * Run: node --test test/scoring.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseOptions, cleanOptionText, answerOptionIndex,
  parseMatchingLetters, expectedAnswer, normalizeMarked, scoreItem,
} from '../src/services/scoring.js';

const MCQ = {
  type: 'mcq',
  options: ['Mumbai', 'Paris', 'London', 'Berlin'],
  answer: 'Paris',
};

test('mcq: letter correct from full option text answer', () => {
  assert.equal(expectedAnswer(MCQ), 'B');
});

test('mcq: letter answer stored as letter resolves', () => {
  assert.equal(expectedAnswer({ ...MCQ, answer: 'B' }), 'B');
});

test('mcq: "B) Paris" prefixed answer resolves', () => {
  assert.equal(expectedAnswer({ ...MCQ, answer: 'B) Paris' }), 'B');
});

test('mcq: options baked with letter prefixes still match', () => {
  const q = { type: 'mcq', options: ['A) Mumbai', 'B) Paris', 'C) London', 'D) Berlin'], answer: 'Paris' };
  assert.equal(expectedAnswer(q), 'B');
});

test('mcq: marked answer normalizes from all legacy forms', () => {
  assert.equal(normalizeMarked(MCQ, 'B'), 'B');
  assert.equal(normalizeMarked(MCQ, 'b'), 'B');
  assert.equal(normalizeMarked(MCQ, 'B) Paris'), 'B');
  assert.equal(normalizeMarked(MCQ, 'Paris'), 'B');
});

test('mcq: scoring marks correct/incorrect', () => {
  assert.equal(scoreItem(MCQ, 'B').isCorrect, true);
  assert.equal(scoreItem(MCQ, 'A').isCorrect, false);
  assert.equal(scoreItem(MCQ, '').isCorrect, false);
});

test('true_false: T/F canonical', () => {
  assert.equal(expectedAnswer({ type: 'true_false', answer: 'True' }), 'T');
  assert.equal(expectedAnswer({ type: 'true_false', answer: 'FALSE' }), 'F');
  assert.equal(normalizeMarked({ type: 'true_false' }, 'True'), 'T');
  assert.equal(normalizeMarked({ type: 'true_false' }, 'F'), 'F');
  assert.equal(scoreItem({ type: 'true_false', answer: 'True' }, 'T').isCorrect, true);
});

test('matching: premise-letter pairs canonicalize', () => {
  const q = { type: 'matching', options: ['Sun', 'Mercury', 'Venus', 'Earth'], answer: '1-B, 2-A, 3-D, 4-C' };
  assert.deepEqual(parseMatchingLetters(q.answer), ['B', 'A', 'D', 'C']);
  assert.equal(expectedAnswer(q), 'B,A,D,C');
});

test('matching: marked letters normalize', () => {
  const q = { type: 'matching', options: [], answer: '1-B, 2-A' };
  assert.equal(normalizeMarked(q, 'b,a'), 'B,A');
  assert.equal(normalizeMarked(q, 'B A'), 'B,A');
  assert.equal(scoreItem(q, 'B,A').isCorrect, true);
  assert.equal(scoreItem(q, 'A,B').isCorrect, false);
});

test('matching: unparseable text answer is not auto-scorable', () => {
  const q = { type: 'matching', options: [], answer: 'Sun to star, Earth to planet' };
  assert.equal(expectedAnswer(q), null);
  const s = scoreItem(q, 'B,A');
  assert.equal(s.autoScorable, false);
  assert.equal(s.isCorrect, null);
});

test('identification: instructor verdict bubbles', () => {
  const q = { type: 'identification', answer: 'Washington' };
  assert.equal(expectedAnswer(q), null);
  assert.equal(normalizeMarked(q, 'CORRECT'), 'CORRECT');
  assert.equal(normalizeMarked(q, 'INCORRECT'), 'INCORRECT');
  assert.equal(normalizeMarked(q, 'WRONG'), 'INCORRECT');
  assert.equal(scoreItem(q, 'CORRECT').isCorrect, true);
  assert.equal(scoreItem(q, 'INCORRECT').isCorrect, false);
  const s = scoreItem(q, '');
  assert.equal(s.isCorrect, null);
  assert.equal(s.autoScorable, false);
});

test('helpers: parseOptions + cleanOptionText', () => {
  assert.deepEqual(parseOptions('["a","b"]'), ['a', 'b']);
  assert.deepEqual(parseOptions(['a']), ['a']);
  assert.deepEqual(parseOptions('not json'), []);
  assert.equal(cleanOptionText('A) Paris'), 'Paris');
  assert.equal(cleanOptionText('B. London'), 'London');
  assert.equal(cleanOptionText('plain'), 'plain');
});
