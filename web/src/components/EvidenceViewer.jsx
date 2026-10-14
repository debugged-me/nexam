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
 *
 * AI-knowledge drafts have no source passage: they were written from the
 * model's general knowledge because no uploaded lesson covered their cell,
 * and a second provider fact-checked them. A blocked draft (edited, source
 * changed, or older than the check) can re-run the AI check in place.
 */
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, BookCheck, ChevronDown, FileText, Quote, RefreshCw, ShieldCheck, ShieldX } from 'lucide-react';
import api, { ApiError } from '../lib/api.js';

const WINDOW = 260; // characters of context kept on each side of the match

const STATUS = {
  verified: { tone: 'ok', icon: ShieldCheck, label: 'Source current · AI review passed' },
  review_required: { tone: 'warn', icon: AlertTriangle, label: 'Quote located · quality review required' },
  not_found: { tone: 'bad', icon: ShieldX, label: 'Not found in source — approval is blocked' },
  stale: { tone: 'warn', icon: AlertTriangle, label: 'Source passages changed — regenerate this draft' },
  no_evidence: { tone: 'bad', icon: ShieldX, label: 'No verifiable evidence — approval is blocked' },
  knowledge: { tone: 'warn', icon: BookCheck, label: 'AI knowledge · fact-checked · confirm the answer' },
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
          {passage.score != null && ` · similarity ${passage.score.toFixed(2)}`}
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
export default function EvidenceViewer({ question, onChecked }) {
  const path = `/questions/${encodeURIComponent(question.id)}/grounding`;
  // api.peek serves a revisited draft instantly; the client cache is cleared
  // on every token change, so one instructor's passages never seed another's.
  const [state, setState] = useState(() => api.peek(path) || null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [recheck, setRecheck] = useState(null);

  useEffect(() => {
    let alive = true;
    api.get(path, { quiet: true })
      .then((data) => { if (alive) setState(data); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [path]);

  async function rerunCheck() {
    setRechecking(true);
    setRecheck(null);
    try {
      const result = await api.post(`/questions/${encodeURIComponent(question.id)}/recheck`);
      setRecheck(result);
      setState(await api.get(path, { quiet: true }));
      if (result?.passed) onChecked?.();
    } catch (err) {
      setRecheck({ passed: false, reason: err instanceof ApiError ? err.message : 'The AI check could not run.' });
    } finally {
      setRechecking(false);
    }
  }

  const evidence = question.ai_evidence || state?.evidence || '';
  const status = state ? STATUS[state.status] : null;
  const passages = state?.passages || [];
  const matched = passages.filter((p) => p.match);
  const others = passages.filter((p) => !p.match);
  const quoteLong = evidence.length > 240;
  const knowledge = Boolean(state?.knowledge);
  const review = state?.qualityReview;

  return (
    <div className="ev" data-tour="review-evidence">
      <div className="ev-head">
        <span className="ev-label">
          <Quote size={11} aria-hidden="true" /> {knowledge ? 'Answer source' : 'Cited evidence'}
          {!knowledge && question.ai_source ? ` · ${question.ai_source}` : ''}
        </span>
        {status && (
          <span className="ev-status" data-tone={status.tone}>
            <status.icon size={13} aria-hidden="true" /> {status.label}
          </span>
        )}
        {!state && !failed && <span className="ev-status is-loading">Checking source…</span>}
      </div>

      {knowledge && (
        <p className="ev-note">
          Written from AI knowledge because no uploaded lesson covers this blueprint cell — it is not quoted from your materials.
          {state.reviewedBy?.provider ? ' A second AI fact-checked it, and other models solved it without seeing the answer.' : ''}
          {' '}Check the answer against your lesson or textbook; approval asks you to confirm it.
        </p>
      )}
      {state?.reviewBlock && <p className="ev-note">{state.reviewBlock}</p>}
      {state?.verified && !knowledge && <p className="ev-note">An AI review checked answer support, topic, format and Bloom level. Confirm these yourself before approval.</p>}
      {review?.reason && state?.verified && <p className="ev-note">Reviewer: {review.reason}</p>}
      {state?.checks?.length > 0 && (() => {
        const agreed = state.checks.filter((c) => c.agreed);
        const answer = (agreed[0] || state.checks[0])?.answer;
        return (
          <p className="ev-note">
            Blind-solve check: {agreed.length} of {state.checks.length} independent AI
            {state.checks.length === 1 ? '' : 's'} answered{answer ? ` “${answer}”` : ''} without seeing the key
            {agreed.length === state.checks.length ? ' — all agreed ✓' : ` — ${state.checks.length - agreed.length} disagreed.`}
          </p>
        );
      })()}
      {state?.reviewBlock && question.status !== 'rejected' && (
        <button type="button" className="ev-linkbtn" onClick={rerunCheck} disabled={rechecking}>
          <RefreshCw size={12} aria-hidden="true" /> {rechecking ? 'Re-running the AI check…' : 'Re-run AI check'}
        </button>
      )}
      {recheck && (
        <p className="ev-note" role="status">
          {recheck.passed ? 'The AI check passed. Review the question, then approve it.' : `The AI check did not pass: ${recheck.reason}`}
        </p>
      )}
      {evidence && <blockquote className={`ev-quote${quoteOpen ? ' is-open' : ''}`}>{evidence}</blockquote>}
      {quoteLong && (
        <button type="button" className="ev-linkbtn" onClick={() => setQuoteOpen((v) => !v)} aria-expanded={quoteOpen}>
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
          {others.length > 0 && (
            <details className="ev-others" open={!matched.length}>
              <summary>{matched.length ? `${others.length} other passage${others.length === 1 ? '' : 's'} the model saw` : 'Passages the model saw'}</summary>
              {others.map((p) => <Passage key={p.id} passage={p} defaultOpen={false} />)}
            </details>
          )}
        </div>
      )}

      {question.ai_generator && <span className="ev-meta">AI-generated</span>}
    </div>
  );
}
