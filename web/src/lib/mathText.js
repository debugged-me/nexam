/**
 * mathText — splits question text into plain and LaTeX math segments for
 * RichText. Delimiters: \( … \) and $ … $ inline, \[ … \] and $$ … $$
 * display. A single $ follows Pandoc's rule — the opening $ must touch a
 * non-space, the closing $ must follow a non-space and not precede a digit —
 * so "$5 and $10" stays plain text. \$ is a literal dollar sign.
 */
const MAX_MATH_LENGTH = 600;
const SPACE = /\s/;
const DIGIT = /\d/;

/** Split text into `{ math, display, value }` segments. */
export function splitMath(input) {
  const s = String(input ?? '');
  if (!s.includes('$') && !s.includes('\\(') && !s.includes('\\[')) return [{ math: false, value: s }];

  const out = [];
  let buf = '';
  const flush = () => { if (buf) { out.push({ math: false, value: buf }); buf = ''; } };
  const takeMath = (value, display) => {
    if (!value.trim() || value.length > MAX_MATH_LENGTH) return false;
    flush();
    out.push({ math: true, display, value });
    return true;
  };

  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    const next = s[i + 1];
    if (ch === '\\' && next === '$') { buf += '$'; i += 2; continue; }
    if (ch === '\\' && (next === '(' || next === '[')) {
      const close = next === '(' ? '\\)' : '\\]';
      const end = s.indexOf(close, i + 2);
      if (end > i + 2 && takeMath(s.slice(i + 2, end), next === '[')) { i = end + 2; continue; }
    }
    if (ch === '$' && next === '$') {
      const end = s.indexOf('$$', i + 2);
      if (end > i + 2 && takeMath(s.slice(i + 2, end), true)) { i = end + 2; continue; }
    } else if (ch === '$' && next && !SPACE.test(next)) {
      let j = s.indexOf('$', i + 1);
      while (j !== -1 && (s[j - 1] === '\\' || SPACE.test(s[j - 1]) || DIGIT.test(s[j + 1] || ''))) {
        j = s.indexOf('$', j + 1);
      }
      if (j > i + 1 && takeMath(s.slice(i + 1, j), false)) { i = j + 1; continue; }
    }
    buf += ch;
    i += 1;
  }
  flush();
  return out;
}
