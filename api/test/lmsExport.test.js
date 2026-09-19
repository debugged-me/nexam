/**
 * lmsExport.test.js — GIFT/XML export + round-trip tests (node --test).
 * Run: node --test test/lmsExport.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toGIFT, toCanvasXML, parseGIFT, parseCanvasXML } from '../src/services/lmsExport.js';

const MCQ = {
  type: 'mcq',
  stem: 'What is the capital of France?',
  options: ['Mumbai', 'Paris', 'London', 'Berlin'],
  answer: 'Paris',
};

test('GIFT: mcq emits all options with = marker on the correct one', () => {
  const out = toGIFT([MCQ]);
  assert.match(out, /=Paris/);
  assert.match(out, /~Mumbai/);
  assert.match(out, /~London/);
  assert.match(out, /~Berlin/);
  // the historical bug joined the wrong var and produced 'A B C D' fragments
  assert.doesNotMatch(out, /\{=A ~B ~C ~D\}/);
});

test('GIFT: letter answer resolves to option text', () => {
  const out = toGIFT([{ ...MCQ, answer: 'B' }]);
  assert.match(out, /=Paris/);
});

test('GIFT: multi-word options survive round-trip', () => {
  const q = { ...MCQ, stem: 'Largest US city?', options: ['New York', 'Los Angeles', 'Chicago'], answer: 'New York' };
  const out = toGIFT([q]);
  const parsed = parseGIFT(out);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].type, 'mcq');
  assert.equal(parsed[0].answer, 'New York');
  assert.ok(parsed[0].options.includes('Los Angeles'));
  assert.equal(parsed[0].options.length, 3);
});

test('GIFT: true_false round-trips', () => {
  const q = { type: 'true_false', stem: 'The sky is blue.', answer: 'True' };
  const out = toGIFT([q]);
  assert.match(out, /TRUE|T\}/i);
  const parsed = parseGIFT(out);
  assert.equal(parsed[0].type, 'true_false');
});

test('GIFT: matching round-trips with premise->option pairs', () => {
  const q = { type: 'matching', stem: 'Match planets', options: ['Sun', 'Mercury', 'Venus', 'Earth'], answer: '1-B, 2-A, 3-D, 4-C' };
  const out = toGIFT([q]);
  const parsed = parseGIFT(out);
  assert.equal(parsed[0].type, 'matching');
});

test('GIFT: identification is NOT misread as 1-option mcq', () => {
  const q = { type: 'identification', stem: 'First US president?', answer: 'Washington' };
  const out = toGIFT([q]);
  const parsed = parseGIFT(out);
  assert.equal(parsed[0].type, 'identification');
});

test('XML: entities escaped on export, decoded on import', () => {
  const q = { ...MCQ, stem: 'A & B <tag> "quoted"', answer: 'Paris' };
  const out = toCanvasXML([q]);
  assert.match(out, /&amp;/);
  assert.doesNotMatch(out, /<tag>/);
  const parsed = parseCanvasXML(out);
  assert.equal(parsed[0].stem, 'A & B <tag> "quoted"');
});

test('XML: mcq round-trips with answer resolved', () => {
  const parsed = parseCanvasXML(toCanvasXML([MCQ]));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].type, 'mcq');
  assert.equal(parsed[0].answer, 'Paris');
});
