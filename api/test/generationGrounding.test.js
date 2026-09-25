import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidGeneratedQuestion } from '../src/services/generationValidation.js';

const context = 'Velorium has a density of 7.31 grams per cubic centimeter. It turns violet at 42 degrees Celsius.';

test('accepts a structurally valid question with verbatim source evidence', () => {
  assert.equal(isValidGeneratedQuestion({
    type: 'mcq',
    stem: 'What is the density of Velorium?',
    options: ['4.20 g/cm3', '7.31 g/cm3', '9.10 g/cm3'],
    answer: '7.31 g/cm3',
    evidence: 'Velorium has a density of 7.31 grams per cubic centimeter.',
  }, context), true);
});

test('rejects a plausible answer whose claimed evidence is absent from the source', () => {
  assert.equal(isValidGeneratedQuestion({
    type: 'true_false',
    stem: 'Velorium was discovered in 1984.',
    answer: 'True',
    evidence: 'Velorium was discovered in 1984.',
  }, context), false);
});

test('rejects a key that does not resolve to an MCQ option', () => {
  assert.equal(isValidGeneratedQuestion({
    type: 'mcq',
    stem: 'At what temperature does Velorium turn violet?',
    options: ['10 C', '20 C', '30 C'],
    answer: '42 C',
    evidence: 'It turns violet at 42 degrees Celsius.',
  }, context), false);
});
