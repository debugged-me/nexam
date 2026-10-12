/**
 * questionAnswers — read a stored answer the way scoring.js does, for any
 * screen that shows which option is correct (Review Queue, question
 * previews). Stored answers come in several historical shapes; these
 * helpers accept all of them and never rewrite the stored value.
 */

/** Normalise free text for tolerant answer matching (mirrors scoring.js). */
export function normText(s) {
  return String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Strip a leading option label so 'B) Paris' compares equal to 'Paris'. */
export function cleanOptionText(opt) {
  return String(opt ?? '').replace(/^\s*[A-Za-z]\s*[).:-]\s*/, '').trim();
}

/**
 * Index of the option the stored answer points at, or -1.
 * Accepts the canonical bare letter ('B'), the legacy 'B) Paris' shape, and
 * the option text itself — the same three forms scoring.js tolerates.
 */
export function resolveAnswerIndex(options, answer) {
  if (!Array.isArray(options) || options.length === 0 || !answer) return -1;
  const raw = String(answer).trim();

  if (/^[A-Za-z]$/.test(raw)) {
    const idx = raw.toUpperCase().charCodeAt(0) - 65;
    return idx >= 0 && idx < options.length ? idx : -1;
  }

  const labelled = raw.match(/^([A-Za-z])\s*[).:-]\s*(.+)$/);
  if (labelled) {
    const byText = options.findIndex((o) => normText(cleanOptionText(o)) === normText(labelled[2]));
    if (byText >= 0) return byText;
    const idx = labelled[1].toUpperCase().charCodeAt(0) - 65;
    if (idx >= 0 && idx < options.length) return idx;
  }

  return options.findIndex((o) => normText(cleanOptionText(o)) === normText(raw));
}

/**
 * Response letter assigned to each matching premise.
 * Reads the stored '1-B, 2-A, 3-D' shape first, then the canonical
 * comma-joined 'B,A,D,C' form used on the OMR wire.
 */
export function matchingLetters(answer, count) {
  const out = new Array(count).fill(null);
  const re = /(\d+)\s*[-–—:.]\s*([A-Za-z])/g;
  let m;
  while ((m = re.exec(String(answer ?? ''))) !== null) {
    const i = parseInt(m[1], 10) - 1;
    if (i >= 0 && i < count) out[i] = m[2].toUpperCase();
  }
  if (out.every((v) => v === null)) {
    String(answer ?? '').split(',').forEach((piece, i) => {
      const letter = piece.trim().toUpperCase();
      if (i < count && /^[A-Z]$/.test(letter)) out[i] = letter;
    });
  }
  return out;
}

/** True / False / null for whichever legacy shape the answer was stored in. */
export function trueFalseAnswer(answer) {
  const v = String(answer ?? '').trim().toUpperCase();
  if (v === 'T' || v === 'TRUE') return 'True';
  if (v === 'F' || v === 'FALSE') return 'False';
  return null;
}
