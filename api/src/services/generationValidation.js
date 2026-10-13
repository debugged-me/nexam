import { answerOptionIndex, parseMatchingLetters, parseOptions } from './scoring.js';

const ALLOWED_TYPES = new Set(['mcq', 'true_false', 'matching', 'identification']);

/**
 * Validate generated structure, answer resolvability, and verbatim evidence.
 * Knowledge-mode drafts (no uploaded source covers the cell) carry no
 * evidence span; they need an explanation the fact-check can verify instead.
 */
export function isValidGeneratedQuestion(q, context, { requireEvidence = true } = {}) {
  if (!q || typeof q.stem !== 'string' || q.stem.trim().length < 5) return false;
  if (!ALLOWED_TYPES.has(q.type)) return false;
  if (requireEvidence) {
    if (typeof q.evidence !== 'string' || q.evidence.trim().length < 20) return false;
    const contexts = (Array.isArray(context) ? context : [context]).map((c) => String(c).replace(/\s+/g, ' '));
    const normalizedEvidence = q.evidence.replace(/\s+/g, ' ').trim();
    if (!contexts.some((c) => c.includes(normalizedEvidence))) return false;
  } else if (typeof q.explanation !== 'string' || q.explanation.trim().length < 15) {
    return false;
  }

  switch (q.type) {
    case 'mcq': {
      const opts = parseOptions(q.options).filter((o) => typeof o === 'string' && o.trim());
      if (opts.length < 3 || new Set(opts.map((o) => o.replace(/^[A-Z][).]\s*/, '').trim().toLowerCase())).size !== opts.length) return false;
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
      return letters.every((letter) => letter && letter.charCodeAt(0) >= 65 && letter.charCodeAt(0) - 65 < opts.length);
    }
    case 'identification':
      return typeof q.answer === 'string' && q.answer.trim().length > 0
        && q.answer.trim().split(/\s+/).length <= 12
        && !/^(?:justify|explain|discuss|design|evaluate|propose|write|create)\b/i.test(q.stem.trim());
    default:
      return false;
  }
}

export default { isValidGeneratedQuestion };
