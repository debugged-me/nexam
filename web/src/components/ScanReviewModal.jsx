/**
 * ScanReviewModal — per-item view of one scanned OMR sheet with inline
 * instructor corrections.
 *
 * Data: GET /api/scans/:id returns the scan row plus every item with its
 * marked answer, key, correctness, ambiguity flag, question type, stem, and
 * options. Corrections go back through POST /api/scans/:id/review, which
 * re-scores canonically and recounts the whole sheet server-side — the
 * modal never computes a score itself.
 *
 * Correction UX follows the OMR metaphor: each row is a ledger line showing
 * the recorded mark as a bubble chip and the key beside it; clicking a row
 * opens the choice chips for that item's real option count. Identification
 * items are graded as verdicts (Correct / Incorrect), matching items accept
 * the comma-joined premise letters.
 */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, ScanLine } from 'lucide-react';
import Modal from './Modal.jsx';
import api from '../lib/api.js';
import { useToast } from './Toast.jsx';

const LETTERS = 'ABCDEFGHIJ'.split('');

function parseOptionCount(options) {
  try {
    const parsed = typeof options === 'string' ? JSON.parse(options) : options;
    return Array.isArray(parsed) && parsed.length ? Math.min(parsed.length, LETTERS.length) : 4;
  } catch {
    return 4;
  }
}

/** Choice chips for one item, or null for free-text matching edits. */
function chipsFor(answer) {
  const type = answer.question_type;
  if (type === 'true_false') return [{ v: 'T', label: 'True' }, { v: 'F', label: 'False' }];
  if (type === 'identification') return [{ v: 'CORRECT', label: 'Correct' }, { v: 'INCORRECT', label: 'Incorrect' }];
  if (type === 'matching') return null;
  return LETTERS.slice(0, parseOptionCount(answer.options)).map((v) => ({ v, label: v }));
}

const TYPE_LABELS = {
  mcq: 'MCQ', true_false: 'T/F', matching: 'Match', identification: 'Fill-in',
};

export default function ScanReviewModal({ scanId, examTitle, onClose, onSaved }) {
  return (
    <Modal
      open={!!scanId}
      side
      icon={ScanLine}
      title="Scanned sheet"
      onClose={onClose}
    >
      {/* key={scanId} remounts per sheet — edits and the loaded detail can
          never bleed from one student's sheet into the next. */}
      {scanId && (
        <SheetBody
          key={scanId}
          scanId={scanId}
          examTitle={examTitle}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
}

function SheetBody({ scanId, examTitle, onClose, onSaved }) {
  const toast = useToast();
  const [detail, setDetail] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [edits, setEdits] = useState({});        // itemNumber → new mark
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get(`/scans/${scanId}`)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((err) => { if (!cancelled) setLoadError(err.message || 'Could not load this scan.'); });
    return () => { cancelled = true; };
  }, [scanId]);

  const scan = detail?.scan;
  const answers = useMemo(() => detail?.answers || [], [detail]);
  const flagged = answers.filter((a) => a.ambiguous).length;
  const editCount = Object.keys(edits).length;

  /** Record a correction. Identification verdicts go through the isCorrect
   *  channel (the server stores the canonical CORRECT/INCORRECT mark). */
  const pick = (answer, value) => {
    setEdits((prev) => ({ ...prev, [answer.item_number]: value }));
    setEditingItem(null);
  };

  async function save() {
    if (!editCount || saving) return;
    setSaving(true);
    try {
      const correctedAnswers = Object.entries(edits).map(([item, value]) => {
        const itemNumber = Number(item);
        const row = answers.find((a) => a.item_number === itemNumber);
        if (row?.question_type === 'identification') {
          return { itemNumber, isCorrect: value === 'CORRECT' };
        }
        return { itemNumber, markedAnswer: value };
      });
      const res = await api.post(`/scans/${scanId}/review`, { correctedAnswers });
      toast.success(`Saved — ${res.correctCount}/${res.totalItems} correct (${Number(res.score).toFixed(1)}%)${res.needsReview ? ', still needs review' : ''}.`);
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err.message || 'Could not save corrections.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="scan-sheet-head">
        {scan ? (
          <>
            <strong>{scan.student_name || 'Unknown student'}</strong>
            <span className="text-muted meta-sm">
              {examTitle || scan.exam_title || 'Exam'} · Set {scan.set_label || '—'} · {fmtStamp(scan.scanned_at)}
            </span>
            <span className={`badge badge-${Number(scan.score) >= 75 ? 'green' : 'amber'}`}>
              {Number(scan.score || 0).toFixed(1)}% · {scan.correct_count}/{scan.total_items}
            </span>
            {scan.needs_review ? (
              <span className="g-state is-draft"><AlertTriangle size={13} /> Needs review</span>
            ) : null}
          </>
        ) : <span className="text-muted meta-sm">Reading sheet…</span>}
      </div>

      {loadError && <div className="empty-state empty-state-md"><p>{loadError}</p></div>}
      {detail && (
        <div className="scan-items">
          {answers.map((a) => {
            const edited = edits[a.item_number] !== undefined;
            const mark = edited ? edits[a.item_number] : a.marked_answer;
            const chips = chipsFor(a);
            const status = edited ? 'edited'
              : a.ambiguous ? 'flagged'
              : a.is_correct ? 'correct' : 'wrong';
            return (
              <div className={`scan-item is-${status}${editingItem === a.item_number ? ' is-editing' : ''}`} key={a.item_number}>
                <button
                  type="button"
                  className="scan-item-row"
                  onClick={() => setEditingItem(editingItem === a.item_number ? null : a.item_number)}
                  aria-expanded={editingItem === a.item_number}
                >
                  <span className="scan-item-top">
                    <span className="scan-item-no">{a.item_number}</span>
                    <span className="scan-item-stem">{a.stem || TYPE_LABELS[a.question_type] || 'Item'}</span>
                  </span>
                  <span className="scan-item-meta">
                    <span className={`scan-mark scan-mark--${status}`} title="Recorded mark">
                      {mark ? String(mark) : <CircleDashed size={13} aria-label="blank" />}
                    </span>
                    <span className="scan-key" title="Answer key">{a.correct_answer || '—'}</span>
                    <span className={`scan-state scan-state--${status}`}>
                      {status === 'edited' ? 'Edited'
                        : status === 'flagged' ? <><AlertTriangle size={12} /> Check</>
                        : status === 'correct' ? <CheckCircle2 size={12} />
                        : '✗'}
                    </span>
                  </span>
                </button>
                {editingItem === a.item_number && (
                  <div className="scan-item-editor">
                    {chips ? (
                      chips.map((c) => (
                        <button
                          type="button"
                          key={c.v}
                          className={`scan-chip${String(mark) === c.v ? ' is-on' : ''}`}
                          onClick={() => pick(a, c.v)}
                        >
                          {c.label}
                        </button>
                      ))
                    ) : (
                      <label className="scan-match-field">
                        <span className="meta-sm text-muted">Premise letters, e.g. B,A,D</span>
                        <input
                          className="input"
                          defaultValue={String(mark || '')}
                          placeholder="B,A,D"
                          onKeyDown={(e) => { if (e.key === 'Enter') pick(a, e.currentTarget.value.trim().toUpperCase()); }}
                          onBlur={(e) => { const v = e.target.value.trim().toUpperCase(); if (v && v !== a.marked_answer) pick(a, v); else setEditingItem(null); }}
                          autoFocus
                        />
                      </label>
                    )}
                    {chips && mark != null && String(mark) !== '' && (
                      <button type="button" className="scan-chip scan-chip--clear" onClick={() => pick(a, '')}>Clear</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {detail && (
        <div className="scan-sheet-foot">
          <span className="text-muted meta-sm">
            {flagged > 0 ? `${flagged} item${flagged === 1 ? '' : 's'} flagged for review` : 'All items resolved'}
            {editCount > 0 && ` · ${editCount} correction${editCount === 1 ? '' : 's'} pending`}
          </span>
          <button type="button" className="btn" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!editCount || saving}>
            {saving && <span className="btn-spinner" />}
            Save corrections
          </button>
        </div>
      )}
    </>
  );
}

function fmtStamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d) ? '' : d.toLocaleString();
}
