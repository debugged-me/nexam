/**
 * wordDiff — word-level diff of two stems (case-insensitive) plus the share
 * of words both versions have in common, used by TextDiff and the similarity
 * review screen.
 */
import { diffWords } from 'diff';

const countWords = (value) => value.trim().split(/\s+/).filter(Boolean).length;

/** `{ parts, wordOverlap }` — jsdiff change parts and a 0–1 overlap share. */
export function wordDiff(from, to) {
  const parts = diffWords(String(from ?? ''), String(to ?? ''), { ignoreCase: true });
  let shared = 0;
  let fromWords = 0;
  let toWords = 0;
  for (const p of parts) {
    const n = countWords(p.value);
    if (!p.added) fromWords += n;
    if (!p.removed) toWords += n;
    if (!p.added && !p.removed) shared += n;
  }
  const longest = Math.max(fromWords, toWords);
  return { parts, wordOverlap: longest ? shared / longest : 1 };
}
