/** Contiguous word windows preserve punctuation, URLs, tables and unfinished tails. */
const WORDS_PER_TOKEN = 0.75;

export function chunk(text, opts = {}) {
  if (!text || !String(text).trim()) return [];
  text = String(text);
  const size = Math.max(1, Math.round((Number(opts.chunkSizeTokens) || 500) * WORDS_PER_TOKEN));
  const overlap = Math.min(size - 1, Math.max(0, Math.round(Number(opts.overlapTokens ?? 50) * WORDS_PER_TOKEN) || 0));
  const words = [...text.matchAll(/\S+/g)];
  const chunks = [];
  for (let start = 0; start < words.length;) {
    const end = Math.min(words.length, start + size);
    const startOffset = words[start].index;
    const endOffset = words[end - 1].index + words[end - 1][0].length;
    chunks.push({ text: text.slice(startOffset, endOffset), ordinal: chunks.length,
      tokenCount: Math.ceil((end - start) / WORDS_PER_TOKEN), startOffset, endOffset });
    if (end === words.length) break;
    start = end - overlap;
  }
  return chunks;
}
export default { chunk };
