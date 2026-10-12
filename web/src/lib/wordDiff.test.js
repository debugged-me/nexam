import { describe, expect, it } from 'vitest';
import { wordDiff } from './wordDiff.js';

describe('wordDiff', () => {
  it('marks words unique to each side and measures overlap', () => {
    const { parts, wordOverlap } = wordDiff('The cell membrane controls entry', 'The plasma membrane controls entry');
    expect(parts.filter((p) => p.removed).map((p) => p.value)).toEqual(['cell']);
    expect(parts.filter((p) => p.added).map((p) => p.value)).toEqual(['plasma']);
    expect(wordOverlap).toBeCloseTo(4 / 5);
  });

  it('ignores case and treats identical stems as full overlap', () => {
    const { parts, wordOverlap } = wordDiff('What is DNA?', 'what is dna?');
    expect(parts.every((p) => !p.added && !p.removed)).toBe(true);
    expect(wordOverlap).toBe(1);
  });
});
