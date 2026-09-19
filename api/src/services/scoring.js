/**
 * OMR scoring service — canonical answer forms + comparison logic.
 *
 * Canonical answer representation per question type (this is what gets
 * stored in scan_answers.marked_answer / correct_answer):
 *
 *   mcq           — single option letter, e.g. 'B' (index into options[])
 *   true_false    — 'T' or 'F'
 *   matching      — comma-joined option letters in premise order, 'B,A,D,C'
 *   identification— 'CORRECT' | 'INCORRECT' (instructor grades by hand, then
 *                   bubbles the verdict on the OMR sheet)
 *
 * The mobile scanner submits answers in this same canonical form; this module
 * also knows how to normalize legacy/variant forms (full option text,
 * "B) Paris", "1-B, 2-A", True/False words) into it.
 */

/** Strip a leading "A)" / "A." / "A -" prefix that AI output bakes into options. */
export function cleanOptionText(text) {
  if (typeof text !== 'string') return String(text ?? '');
  return text.replace(/^\s*[A-Z][).\-]\s*/i, '').trim();
}

/** Parse options (JSON string or array) into a plain string array. */
export function parseOptions(options) {
  if (!options) return [];
  if (Array.isArray(options)) return options;
  try { return JSON.parse(options); } catch { return []; }
}

/** Case-insensitive normalized comparison key for free text. */
function normText(text) {
  return String(text ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Index of the option matching the stored answer text, or -1. */
export function answerOptionIndex(options, answer) {
  const opts = parseOptions(options);
  if (!opts.length || answer == null || answer === '') return -1;

  const target = normText(answer);
  // 1. Exact match against raw or cleaned option text.
  for (let i = 0; i < opts.length; i++) {
    if (normText(opts[i]) === target || normText(cleanOptionText(opts[i])) === target) return i;
  }
  // 2. Answer given as a bare letter.
  if (/^[A-Z]$/.test(target)) {
    const idx = target.charCodeAt(0) - 65;
    return idx < opts.length ? idx : -1;
  }
  // 3. Answer given as "B) Paris" — letter prefix, compare text half too.
  const m = target.match(/^([A-Z])[).\-]\s*(.+)$/);
  if (m) {
    const idx = m[1].charCodeAt(0) - 65;
    if (idx < opts.length) {
      // Prefer the letter if its option text also matches, else trust the text.
      const optText = normText(cleanOptionText(opts[idx]));
      if (optText === normText(m[2]) || optText === '') return idx;
      for (let i = 0; i < opts.length; i++) {
        if (normText(cleanOptionText(opts[i])) === normText(m[2])) return i;
      }
      return idx;
    }
  }
  return -1;
}

/** Parse a stored matching answer like "1-B, 2-A, 3-D, 4-C" → ['B','A','D','C']. */
export function parseMatchingLetters(answer) {
  if (!answer) return null;
  const out = [];
  const re = /(\d+)\s*[-–—:.]\s*([A-Za-z])/g;
  let m;
  let consumed = 0;
  while ((m = re.exec(String(answer))) !== null) {
    out[parseInt(m[1], 10) - 1] = m[2].toUpperCase();
    consumed += m[0].length;
  }
  // Whole answer must parse as premise-letter pairs, or it's text matches.
  if (!out.length || consumed < String(answer).replace(/[\s,]/g, '').length) return null;
  return out;
}

/**
 * Canonical correct answer for a question.
 * @returns {string|null} canonical form, or null when not auto-scorable.
 */
export function expectedAnswer(question) {
  const { type, answer, options } = question;
  switch (type) {
    case 'mcq': {
      const idx = answerOptionIndex(options, answer);
      return idx >= 0 ? LETTERS[idx] : null;
    }
    case 'true_false': {
      const a = normText(answer);
      if (a === 'TRUE' || a === 'T') return 'T';
      if (a === 'FALSE' || a === 'F') return 'F';
      return null;
    }
    case 'matching': {
      const letters = parseMatchingLetters(answer);
      return letters ? letters.map((l) => l || '').join(',') : null;
    }
    case 'identification':
      // Free-text answers are instructor-graded on the sheet (CORRECT/INCORRECT).
      return null;
    default:
      return null;
  }
}

/**
 * Normalize a marked answer into canonical form.
 * @returns {string} canonical marked answer ('' when blank/unrecognizable).
 */
export function normalizeMarked(question, raw) {
  if (raw == null) return '';
  const { type, options } = question;
  const a = String(raw).trim();
  if (!a) return '';

  switch (type) {
    case 'mcq': {
      const upper = a.toUpperCase();
      if (/^[A-Z]$/.test(upper)) return upper;
      const m = upper.match(/^([A-Z])[).\-]\s*/);
      if (m) return m[1];
      const idx = answerOptionIndex(options, a);
      return idx >= 0 ? LETTERS[idx] : upper;
    }
    case 'true_false': {
      const upper = a.toUpperCase();
      if (upper === 'T' || upper === 'TRUE') return 'T';
      if (upper === 'F' || upper === 'FALSE') return 'F';
      return upper;
    }
    case 'matching': {
      // Accept 'b,a,d', 'B A D', 'B,A,D' → 'B,A,D'
      const letters = a.toUpperCase().match(/[A-Z]/g);
      return letters ? letters.join(',') : '';
    }
    case 'identification': {
      const upper = a.toUpperCase();
      if (['CORRECT', 'INCORRECT', 'WRONG'].includes(upper)) {
        return upper === 'CORRECT' ? 'CORRECT' : 'INCORRECT';
      }
      if (upper === 'T' || upper === 'TRUE') return 'CORRECT';   // legacy ✓
      if (upper === 'F' || upper === 'FALSE') return 'INCORRECT'; // legacy ✗
      return upper;
    }
    default:
      return a;
  }
}

/**
 * Score one item.
 * @returns {{marked: string, correct: string|null, isCorrect: boolean,
 *            autoScorable: boolean, displayCorrect: string}}
 *   autoScorable=false means the item needs instructor review (isCorrect=null).
 */
export function scoreItem(question, rawMarked) {
  const marked = normalizeMarked(question, rawMarked);
  const correct = expectedAnswer(question);

  if (question.type === 'identification') {
    // Instructor-graded bubbles: CORRECT / INCORRECT verdicts.
    return {
      marked,
      correct,
      isCorrect: marked === 'CORRECT' ? true : marked === 'INCORRECT' ? false : null,
      autoScorable: marked === 'CORRECT' || marked === 'INCORRECT',
      displayCorrect: String(question.answer ?? ''),
    };
  }

  if (correct === null) {
    // Unresolvable key (e.g. matching stored as text pairs) — instructor reviews.
    return {
      marked,
      correct,
      isCorrect: null,
      autoScorable: false,
      displayCorrect: String(question.answer ?? ''),
    };
  }

  return {
    marked,
    correct,
    isCorrect: marked !== '' && marked === correct,
    autoScorable: true,
    displayCorrect: correct,
  };
}

export default { parseOptions, cleanOptionText, answerOptionIndex, expectedAnswer, normalizeMarked, scoreItem };
