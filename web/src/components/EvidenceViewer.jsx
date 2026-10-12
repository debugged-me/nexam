/**
 * EvidenceViewer — the cited evidence of an AI draft, checked against and
 * shown inside the source passages the model was given.
 *
 *   <EvidenceViewer question={draft} />
 *
 * Loads GET /questions/:id/grounding, which reports whether the exact span
 * still occurs in its cited passages (the same check approval runs) and
 * returns those passages from the instructor's own materials. The quote gets
 * a status badge up front; "Show in source" reveals the passage with the
 * span highlighted, windowed around the match until expanded.
 */
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, FileText, Quote, ShieldCheck, ShieldX } from 'lucide-react';
import api from '../lib/api.js';

const WINDOW = 260; // characters of context kept on each side of the match

const STATUS = {
  verified: { tone: 'ok', icon: ShieldCheck, label: 'Found in source' },
  not_found: { tone: 'bad', icon: ShieldX, label: 'Not found in source — approval is blocked' },
  stale: { tone: 'warn', icon: AlertTriangle, label: 'Source passages changed — regenerate this draft' },
  no_evidence: { tone: 'bad', icon: ShieldX, label: 'No verifiable evidence — approval is blocked' },
};


function Passage({ passage, defaultOpen }) {
  const [full, setFull] = useState(false);
  const markRef = useRef(null);
  const { text, match } = passage;

  useEffect(() => {
    if (defaultOpen) markRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [defaultOpen]);

  let before = '';
  let hit = '';
  let after = text;
  if (match) {
    before = text.slice(0, match.start);
    hit = text.slice(match.start, match.end);
    after = text.slice(match.end);
  }
  const clipBefore = !full && before.length > WINDOW;
  const clipAfter = !full && after.length > WINDOW;
  const clipped = clipBefore || clipAfter || (!match && !full && text.length > WINDOW * 2);

  return (
    <div className={`ev-passage${match ? ' has-match' : ''}`}>
      <div className="ev-passage-head">
        <FileText size={13} aria-hidden="true" />
        <span className="ev-passage-title">{passage.title}</span>
        <span className="ev-passage-meta">
          Passage {passage.passage}
          {passage.score != null && ` · ${Math.round(passage.score * 100)}% relevant`}
        </span>
      </div>
      <p className="ev-passage-text">
        {match ? (
          <>
            {clipBefore ? `…${before.slice(-WINDOW)}` : before}
            <mark ref={markRef}>{hit}</mark>
            {clipAfter ? `${after.slice(0, WINDOW)}…` : after}
          </>
        ) : (!full && text.length > WINDOW * 2 ? `${text.slice(0, WINDOW * 2)}…` : text)}
      </p>
      {(clipped || full) && (
        <button type="button" className="ev-linkbtn" onClick={() => setFull((v) => !v)}>
          {full ? 'Show less' : 'Show full passage'}
        </button>
      )}
    </div>
  );
}

/** Render with `key={question.id}` so each draft starts from fresh state. */
export default function EvidenceViewer({ question }) {
  const path = `/questions/${encodeURIComponent(question.id)}/grounding`;
  // api.peek serves a revisited draft instantly; the client cache is cleared
  // on every token change, so one instructor's passages never seed another's.
  const [state, setState] = useState(() => api.peek(path) || null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get(path, { quiet: true })
      .then((data) => { if (alive) setState(data); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [path]);

  const evidence = question.ai_evidence || state?.evidence || '';
  const status = state ? STATUS[state.status] : null;
  const passages = state?.passages || [];
  const matched = passages.filter((p) => p.match);
  const others = passages.filter((p) => !p.match);
  const quoteLong = evidence.length > 240;

  return (
    <div className="rv-evidence ev" data-tour="review-evidence">
      <div className="ev-head">
        <span className="rv-label">
          <Quote size={11} aria-hidden="true" /> Cited evidence
          {question.ai_source ? ` · ${question.ai_source}` : ''}
        </span>
        {status && (
          <span className="ev-status" data-tone={status.tone}>
            <status.icon size={13} aria-hidden="true" /> {status.label}
          </span>
        )}
        {!state && !failed && <span className="ev-status is-loading">Checking source…</span>}
      </div>

      {evidence && <blockquote className={quoteOpen ? 'is-open' : undefined}>{evidence}</blockquote>}
      {quoteLong && (
        <button type="button" className="rv-linkbtn rv-evidence-toggle" onClick={() => setQuoteOpen((v) => !v)} aria-expanded={quoteOpen}>
          {quoteOpen ? 'Show less' : 'Show full evidence'}
        </button>
      )}

      {passages.length > 0 && (
        <button type="button" className="ev-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <ChevronDown size={14} aria-hidden="true" className={open ? 'is-open' : undefined} />
          {open ? 'Hide source passages' : `Show in source (${passages.length} passage${passages.length === 1 ? '' : 's'})`}
        </button>
      )}

      {open && (
        <div className="ev-sources">
          {matched.map((p, i) => <Passage key={p.id} passage={p} defaultOpen={i === 0} />)}
          {!matched.length && state?.status === 'verified' && (
            <p className="ev-note">The quote runs across two neighbouring passages, so no single passage holds all of it.</p>
          )}
          {others.length > 0 && (
            <details className="ev-others" open={!matched.length}>
              <summary>{matched.length ? `${others.length} other passage${others.length === 1 ? '' : 's'} the model saw` : 'Passages the model saw'}</summary>
              {others.map((p) => <Passage key={p.id} passage={p} defaultOpen={false} />)}
            </details>
          )}
        </div>
      )}

      {question.ai_generator && <span className="rv-evidence-meta">Generated by {question.ai_generator}</span>}
    </div>
  );
}
