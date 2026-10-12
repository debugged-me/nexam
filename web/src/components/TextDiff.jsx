/**
 * TextDiff — word-level comparison of two question stems.
 *
 *   <TextDiff from={bankStem} to={draftStem} />
 *
 * Shared wording renders plain; words only the draft has are marked as
 * insertions, words only the bank question has as deletions. Case is
 * ignored so "The" vs "the" never reads as a difference. The diff itself
 * (and the word-overlap share) comes from lib/wordDiff.js.
 */
import { useMemo } from 'react';
import { wordDiff } from '../lib/wordDiff.js';

export default function TextDiff({ from, to, className = '' }) {
  const { parts } = useMemo(() => wordDiff(from, to), [from, to]);
  return (
    <p className={`text-diff${className ? ` ${className}` : ''}`}>
      {parts.map((p, i) => {
        if (p.added) return <ins key={i} className="text-diff-add">{p.value}</ins>;
        if (p.removed) return <del key={i} className="text-diff-del">{p.value}</del>;
        return <span key={i}>{p.value}</span>;
      })}
    </p>
  );
}
