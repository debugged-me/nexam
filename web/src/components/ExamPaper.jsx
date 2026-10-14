/**
 * ExamPaper — a real exam document rendered for print.
 *
 * Hidden on screen (.print-only), paginated by the browser's print engine.
 * Set A uses the canonical exam order; Set B follows the generated set's
 * shuffled order so the paper matches the PDF the OMR sheet references.
 *
 * `includeKey` appends a separated answer-key page (instructor copy).
 */
import { subjectLabel } from '../lib/subjectProgress.js';
import PrintDocHead from './PrintDocHead.jsx';
import PrintDocFoot from './PrintDocFoot.jsx';

const TYPE_LABELS = {
  mcq: 'Multiple Choice',
  true_false: 'True or False',
  matching: 'Matching Type',
  identification: 'Identification',
};

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function fmtDate(d = new Date()) {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function ExamPaper({ exam, questions, tos, setLabel = 'A', includeKey = false, org = 'Faculty Workspace' }) {
  const items = questions || [];

  return (
    <div className="print-only">
      <div className="print-doc exam-paper">
        {/* ── Document header ─────────────────────────── */}
        <PrintDocHead
          org={org}
          title={exam.title}
          meta={<>
            {subjectLabel(exam)}
            {exam.duration_minutes ? ` · ${exam.duration_minutes} minutes` : ''}
            {` · ${items.length} items`}
            {setLabel ? ` · Set ${setLabel}` : ''}
          </>}
        />

        {/* ── Student fill-in ─────────────────────────── */}
        <div className="pd-student">
          <span><label>Name:</label> <span className="pd-line" /></span>
          <span style={{ flex: '0 0 34%' }}><label>Section:</label> <span className="pd-line" /></span>
          <span style={{ flex: '0 0 22%' }}><label>Date:</label> <span className="pd-line" /></span>
        </div>

        {/* ── Instructions ────────────────────────────── */}
        <div className="pd-instructions">
          <strong>INSTRUCTIONS.</strong>{' '}
          {exam.instructions?.trim() ||
            `Read each item carefully. Choose the best answer and shade the corresponding letter on the provided answer sheet. No erasures. ${TYPE_LABELS[items[0]?.type] ? 'This is a ' + TYPE_LABELS[items[0].type] + ' examination.' : ''}`}
        </div>

        {/* ── Items ───────────────────────────────────── */}
        <div className="pd-items">
          {items.map((q) => (
            <ExamItem key={q.id} q={q} />
          ))}
        </div>

        <div className="pd-end">— END OF EXAMINATION —</div>
        <p style={{ textAlign: 'center', fontSize: '9pt', marginTop: '2mm' }}>
          Do not write anything below this line.
        </p>

        {/* ── Closing quote ───────────────────────────── */}
        <div className="pd-quote">
          “Believe in yourself and all that you are. Know that there is
          something inside you that is greater than any obstacle.”
          <span className="pd-quote-by">— Christian D. Larson</span>
        </div>

        <PrintDocFoot
          left={<>{exam.title} · Set {setLabel} · {items.length} items</>}
          right={<>Generated {fmtDate()}{tos?.title ? ` · Blueprint: ${tos.title}` : ''}</>}
        />
      </div>

      {/* ── Answer key (separate page, instructor copy) ── */}
      {includeKey && (
        <div className="print-doc answer-key">
          <PrintDocHead
            org={org}
            title={<>Answer Key — {exam.title}</>}
            meta={<>Set {setLabel} · {items.length} items · Instructor copy — do not distribute</>}
          />
          <div className="answer-key-grid">
            {items.map((q, i) => (
              <div className="ak" key={q.id}>
                <span>{i + 1}.</span>
                <b>{displayAnswer(q)}</b>
              </div>
            ))}
          </div>
          <PrintDocFoot
            left={<>Answer key · {exam.title} · Set {setLabel}</>}
            right={<>Generated {fmtDate()}</>}
          />
        </div>
      )}
    </div>
  );
}

/** One numbered item, formatted per objective type. */
function ExamItem({ q }) {
  const opts = Array.isArray(q.options) ? q.options : [];
  return (
    <div className="pd-item">
      <div className="pd-stem">{q.stem}</div>
      {q.type === 'mcq' && opts.length > 0 && (
        <div className={`pd-opts${opts.some((o) => String(o).length > 42) ? ' pd-opts-one' : ''}`}>
          {opts.map((o, i) => (
            <div className="pd-opt" key={i}>
              <span className="pd-opt-letter">{LETTERS[i]}.</span>
              <span>{o}</span>
            </div>
          ))}
        </div>
      )}
      {q.type === 'true_false' && (
        <div className="pd-opts">
          <div className="pd-opt"><span className="pd-opt-letter">____</span><span>True</span></div>
          <div className="pd-opt"><span className="pd-opt-letter">____</span><span>False</span></div>
        </div>
      )}
      {q.type === 'identification' && (
        <div style={{ paddingLeft: '5mm' }}>Answer: <span className="pd-blank" /></div>
      )}
      {q.type === 'matching' && opts.length > 0 && (
        <div className="pd-opts pd-opts-one">
          {opts.map((o, i) => (
            <div className="pd-opt" key={i}>
              <span className="pd-opt-letter">{LETTERS[i]}.</span>
              <span>{o}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The answer as it should appear on the key. */
function displayAnswer(q) {
  const a = String(q.answer || '').trim();
  if (!a) return '—';
  if (q.type === 'true_false') return a.toUpperCase().startsWith('T') ? 'TRUE' : 'FALSE';
  if (q.type === 'identification') return a;
  if (q.type === 'mcq') {
    // Stored as a letter ("B"), an index ("1"), or the option text — resolve to a letter.
    const opts = Array.isArray(q.options) ? q.options : [];
    const direct = /^[A-Z]$/i.test(a) ? LETTERS.indexOf(a.toUpperCase()) : -1;
    if (direct >= 0 && direct < Math.max(opts.length, 1)) return a.toUpperCase();
    const idx = opts.findIndex((o) => String(o).trim().toLowerCase() === a.toLowerCase());
    if (idx >= 0) return LETTERS[idx];
    return a.toUpperCase();
  }
  return a.toUpperCase();
}
