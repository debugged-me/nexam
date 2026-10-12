import { describe, expect, it } from 'vitest';
import { matchingLetters, resolveAnswerIndex, trueFalseAnswer } from './questionAnswers.js';

describe('questionAnswers', () => {
  const options = ['A) Paris', 'B) Lyon', 'C) Nice'];

  it('resolves every stored MCQ answer shape to the same option', () => {
    expect(resolveAnswerIndex(options, 'B')).toBe(1);
    expect(resolveAnswerIndex(options, 'B) Lyon')).toBe(1);
    expect(resolveAnswerIndex(options, 'lyon')).toBe(1);
    expect(resolveAnswerIndex(options, 'Marseille')).toBe(-1);
  });

  it('reads matching and true/false answers in legacy and canonical forms', () => {
    expect(matchingLetters('1-B, 2-A', 2)).toEqual(['B', 'A']);
    expect(matchingLetters('B,A', 2)).toEqual(['B', 'A']);
    expect(trueFalseAnswer('t')).toBe('True');
    expect(trueFalseAnswer('False')).toBe('False');
    expect(trueFalseAnswer('maybe')).toBeNull();
  });
});
