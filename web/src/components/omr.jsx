/**
 * omr.jsx — the answer sheet as Nexam's visual signature.
 *
 * Three micro-marks built from the same element — the shaded OMR bubble:
 *
 *   <Bubbles />     one row of option bubbles, one marked
 *   <TypeGlyph />   a 24×10 glyph for each question type (bank row meta)
 *   <OmrStrip />    a clipped mini answer-sheet fragment for empty corners
 *
 * Everything is ink-quiet — the motif carries identity, not color. All
 * marks are decorative (aria-hidden) and drawn as inline SVG so they stay
 * crisp at any size and inherit tokens for dark mode.
 */

/** One row of answer bubbles; `marked` (0-based) is the filled one. */
export function Bubbles({ count = 4, marked = 1, r = 2, gap = 5.6, className = '' }) {
  const w = count * (r * 2) + (count - 1) * gap;
  const h = r * 2;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`omr-bubbles ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      {Array.from({ length: count }, (_, i) => (
        <circle
          key={i}
          cx={r + i * (r * 2 + gap)}
          cy={r}
          r={r - 0.55}
          className={i === marked ? 'omr-fill' : 'omr-open'}
        />
      ))}
    </svg>
  );
}

const TYPE_MARKS = {
  mcq: { count: 4, marked: 1 },
  true_false: { count: 2, marked: 0 },
  matching: 'matching',
  identification: 'blank',
};

/** Per-question-type glyph — a small mark that reads "this is an exam app". */
export function TypeGlyph({ type, className = '' }) {
  const mark = TYPE_MARKS[type];
  if (!mark) return null;
  if (mark === 'matching') {
    // Two premise bubbles linked to two response bubbles — a pairing.
    return (
      <svg viewBox="0 0 24 10" className={`omr-type ${className}`} aria-hidden="true" focusable="false">
        <circle cx="2.4" cy="2.6" r="1.9" className="omr-open" />
        <circle cx="2.4" cy="7.4" r="1.9" className="omr-open" />
        <circle cx="21.6" cy="2.6" r="1.9" className="omr-fill" />
        <circle cx="21.6" cy="7.4" r="1.9" className="omr-open" />
        <path d="M5.4 2.6 C 11 2.6, 13 7.4, 18.6 7.4" className="omr-link" />
      </svg>
    );
  }
  if (mark === 'blank') {
    // A blank to fill: two ruled lines, one answered.
    return (
      <svg viewBox="0 0 24 10" className={`omr-type ${className}`} aria-hidden="true" focusable="false">
        <path d="M1 3h22M1 7.4h10" className="omr-link" />
        <rect x="13.4" y="5.6" width="6" height="3.4" rx="1.7" className="omr-fill omr-fill--soft" />
      </svg>
    );
  }
  return <Bubbles className={`omr-type ${className}`} {...mark} />;
}

/**
 * A mini answer-sheet fragment — header bar, numbered rows, bubble columns,
 * one marked per row. Rendered partially clipped (rotation + negative
 * offsets) so it reads as a real sheet under the workspace, not an icon.
 */
export function OmrSheet({ rows = 6, cols = 4, className = '' }) {
  return (
    <div className={`omr-sheet ${className}`} aria-hidden="true">
      <span className="omr-sheet-head" />
      {Array.from({ length: rows }, (_, r) => (
        <span className="omr-sheet-row" key={r}>
          <i>{String(r + 1).padStart(2, '0')}</i>
          <Bubbles count={cols} marked={(r * 2 + 1) % cols} />
        </span>
      ))}
    </div>
  );
}
