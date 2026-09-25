import { answerOptionIndex, parseMatchingLetters, parseOptions } from './scoring.js';

const ALLOWED_TYPES = new Set(['mcq', 'true_false', 'matching', 'identification']);

/** Validate generated structure, answer resolvability, and verbatim evidence. */
export function isValidGeneratedQuestion(q, context) {
  if (!q || typeof q.stem !== 'string' || q.stem.trim().length < 5) return false;
  if (!ALLOWED_TYPES.has(q.type)) return false;
  if (typeof q.evidence !== 'string' || q.evidence.trim().length < 3) return false;
  const normalizedContext = String(context).replace(/\s+/g, ' ').toLowerCase();
  const normalizedEvidence = q.evidence.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!normalizedContext.includes(normalizedEvidence)) return false;

  switch (q.type) {
    case 'mcq': {
      const opts = parseOptions(q.options).filter((o) => typeof o === 'string' && o.trim());
      if (opts.length < 3) return false;
      q.options = opts;
      return answerOptionIndex(opts, q.answer) >= 0;
    }
    case 'true_false': {
      const answer = String(q.answer ?? '').trim().toLowerCase();
      return answer === 'true' || answer === 'false' || answer === 't' || answer === 'f';
    }
    case 'matching': {
      const opts = parseOptions(q.options);
      const letters = parseMatchingLetters(q.answer);
      if (opts.length < 2 || !letters || letters.length !== opts.length) return false;
      return letters.every((letter) => letter && letter.charCodeAt(0) - 65 <= 4);
    }
    case 'identification':
      return typeof q.answer === 'string' && q.answer.trim().length > 0;
    default:
      return false;
  }
}

export default { isValidGeneratedQuestion };
