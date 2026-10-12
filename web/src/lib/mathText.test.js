import { describe, expect, it } from 'vitest';
import { splitMath } from './mathText.js';

const kinds = (text) => splitMath(text).map((s) => (s.math ? `${s.display ? 'D' : 'M'}:${s.value}` : s.value));

describe('splitMath', () => {
  it('leaves text without delimiters untouched', () => {
    expect(splitMath('What is mitosis?')).toEqual([{ math: false, value: 'What is mitosis?' }]);
  });

  it('finds inline and display math', () => {
    expect(kinds('Solve $x^2 = 4$ now')).toEqual(['Solve ', 'M:x^2 = 4', ' now']);
    expect(kinds('Area: $$\\pi r^2$$')).toEqual(['Area: ', 'D:\\pi r^2']);
    expect(kinds('Let \\(a+b\\) and \\[c\\]')).toEqual(['Let ', 'M:a+b', ' and ', 'D:c']);
  });

  it('keeps prices and escaped dollars as plain text', () => {
    expect(kinds('It costs $5 and $10 today')).toEqual(['It costs $5 and $10 today']);
    expect(kinds('Pay \\$3 for $x$')).toEqual(['Pay $3 for ', 'M:x']);
    expect(kinds('A lone $ sign')).toEqual(['A lone $ sign']);
  });
});
