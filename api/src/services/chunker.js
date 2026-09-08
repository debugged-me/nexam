/**
 * Text chunker — splits extracted text into token-aware chunks.
 *
 * Uses a simple word-count heuristic for token estimation (~1 token ≈ 0.75 words).
 * Chunks are created with a configurable overlap so context isn't lost at
 * chunk boundaries. Chunk boundaries are kept on sentence/paragraph edges
 * where possible.
 */

/** Rough word → token ratio (OpenAI/Gemini models average ~0.75 tokens/word). */
const WORDS_PER_TOKEN = 1.33; // 1 / 0.75

/**
 * Split text into overlapping chunks.
 *
 * @param {string} text — full extracted text
 * @param {object} opts — { chunkSizeTokens=500, overlapTokens=50 }
 * @returns {Array<{text:string, ordinal:number, tokenCount:number}>}
 */
export function chunk(text, opts = {}) {
  const chunkSizeTokens = opts.chunkSizeTokens || 500;
  const overlapTokens = opts.overlapTokens || 50;
  const chunkSizeWords = Math.round(chunkSizeTokens * WORDS_PER_TOKEN);
  const overlapWords = Math.round(overlapTokens * WORDS_PER_TOKEN);

  if (!text || !text.trim()) return [];

  // Split into paragraphs first, then sentences within long paragraphs.
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const sentences = [];
  for (const para of paragraphs) {
    if (para.length < 500) {
      sentences.push(para);
    } else {
      // Split long paragraphs into sentences
      const parts = para.match(/[^.!?]+[.!?]+|\S+$/g) || [para];
      for (const s of parts) {
        sentences.push(s.trim());
      }
    }
  }

  // Build chunks by accumulating sentences until we hit the target size.
  const chunks = [];
  let current = [];
  let currentWordCount = 0;
  let ordinal = 0;

  for (const sentence of sentences) {
    const wordCount = countWords(sentence);
    if (currentWordCount + wordCount > chunkSizeWords && current.length > 0) {
      // Finalize current chunk
      const chunkText = current.join(' ').trim();
      if (chunkText) {
        chunks.push({
          text: chunkText,
          ordinal: ordinal++,
          tokenCount: Math.round(currentWordCount / WORDS_PER_TOKEN),
        });
      }

      // Keep overlap: carry the last few sentences into the next chunk
      const overlap = [];
      let overlapWords = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const w = countWords(current[i]);
        if (overlapWords + w > overlapWords) break;
        overlap.unshift(current[i]);
        overlapWords += w;
      }
      current = overlap.length > 0 ? overlap : [];
      currentWordCount = overlapWords;
    }

    current.push(sentence);
    currentWordCount += wordCount;
  }

  // Don't forget the last chunk
  if (current.length > 0) {
    const chunkText = current.join(' ').trim();
    if (chunkText) {
      chunks.push({
        text: chunkText,
        ordinal: ordinal++,
        tokenCount: Math.round(currentWordCount / WORDS_PER_TOKEN),
      });
    }
  }

  return chunks;
}

/** Count words in a string (rough estimate). */
function countWords(text) {
  return (text.trim().match(/\S+/g) || []).length;
}

export default { chunk };
