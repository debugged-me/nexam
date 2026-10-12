/**
 * ExamQuestionList — an exam's questions, grouped by blueprint topic, with
 * a coverage check against the finalized topic × Bloom matrix.
 *
 *   <ExamQuestionList questions={…} tosMatrix={…} onPreview={…} onRemove={…} onMenu={…} />
 *
 * Numbers are the exam's own order (what Set A prints), so grouping never
 * renumbers anything. Long exams open with topics collapsed — a 50-item
 * paper reads as 20 topic rows first, each one click from its questions.
 * Styles live in exam-detail.css (the only page that renders this).
 */
import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, AlertTriangle, Trash2 } from 'lucide-react';
import RichText from './RichText.jsx';

const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
const BLOOM_LABELS = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create' };
const BLOOM_SHORT = { remember: 'Rem', understand: 'Und', apply: 'App', analyze: 'Ana', evaluate: 'Eva', create: 'Cre' };
const TYPE_LABELS = { mcq: 'Multiple choice', true_false: 'True / false', matching: 'Matching', identification: 'Fill in the blank' };
const NO_TOPIC = '\u0000none';
const COLLAPSE_OVER = 20; // open every group for short exams

const cellKey = (topic, bloom) => `${topic}\u0000${bloom}`;

/** Planned vs. attached per topic × Bloom cell, plus anything off-plan. */
function useCoverage(tosMatrix, questions) {
  return useMemo(() => {
    if (!tosMatrix?.slots?.length) return null;
    const need = new Map(tosMatrix.slots.map((s) => [cellKey(s.topic, s.bloom), s.count]));
    const have = new Map();
    for (const q of questions) {
      const key = cellKey(q.topic || '', q.bloom || '');
      have.set(key, (have.get(key) || 0) + 1);
    }
    let off = 0;
    for (const key of new Set([...need.keys(), ...have.keys()])) {
      if ((need.get(key) || 0) !== (have.get(key) || 0)) off += 1;
    }
    const known = new Set(tosMatrix.topics);
    const offPlan = questions.filter((q) => !known.has(q.topic || '')).length;
    return { need, have, off, offPlan };
  }, [tosMatrix, questions]);
}

function Coverage({ tosMatrix, coverage }) {
  const ok = coverage.off === 0;
  return (
    <details className="eq-coverage" data-ok={ok || undefined} open={!ok}>
      <summary>
        {ok ? <CheckCircle2 size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />}
        <span>
          <strong>{ok ? 'Matches the blueprint exactly' : `${coverage.off} blueprint cell${coverage.off === 1 ? '' : 's'} off`}</strong>
          {ok
            ? ' — every topic × Bloom cell has the planned number of items.'
            : ` — counts differ from the plan${coverage.offPlan ? `, and ${coverage.offPlan} item${coverage.offPlan === 1 ? ' is' : 's are'} outside its topics` : ''}.`}
        </span>
        <span className="eq-coverage-toggle">Grid <ChevronDown size={14} aria-hidden="true" /></span>
      </summary>
      <div className="eq-grid-scroll">
        <table className="eq-grid">
          <caption className="sr-only">Attached items per topic and Bloom level, against the blueprint plan</caption>
          <thead>
            <tr>
              <th scope="col">Topic</th>
              {BLOOM_ORDER.map((b) => <th scope="col" key={b} title={BLOOM_LABELS[b]}>{BLOOM_SHORT[b]}</th>)}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {tosMatrix.topics.map((topic) => {
              let rowHave = 0;
              let rowNeed = 0;
              return (
                <tr key={topic}>
                  <th scope="row" title={topic}>{topic}</th>
                  {BLOOM_ORDER.map((b) => {
                    const need = coverage.need.get(cellKey(topic, b)) || 0;
                    const have = coverage.have.get(cellKey(topic, b)) || 0;
                    rowHave += have;
                    rowNeed += need;
                    const state = !need && !have ? 'empty' : have === need ? 'ok' : have < need ? 'short' : 'over';
                    return (
                      <td key={b} data-state={state} title={`${BLOOM_LABELS[b]}: ${have} of ${need} planned`}>
                        {state === 'empty' ? '·' : `${have}/${need}`}
                      </td>
                    );
                  })}
                  <td className="eq-grid-total" data-state={rowHave === rowNeed ? 'ok' : 'short'}>{rowHave}/{rowNeed}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Row({ q, n, onPreview, onRemove, onMenu }) {
  const stem = String(q.stem || '').replace(/\s+/g, ' ').trim();
  const level = BLOOM_ORDER.indexOf(q.bloom) + 1;
  return (
    <li className="eq-row" onContextMenu={(e) => onMenu(e, q)}>
      <span className="eq-num">{n}</span>
      <button type="button" className="eq-stem" onClick={() => onPreview(q)} title="Preview this question">
        <RichText text={stem} />
      </button>
      <span className="eq-meta">
        <span className="eq-type">{TYPE_LABELS[q.type] || q.type}</span>
        {level > 0 && <span className="g-bloom" data-level={level}>{BLOOM_LABELS[q.bloom]}</span>}
      </span>
      <button type="button" className="eq-remove" onClick={() => onRemove(q)} aria-label={`Remove question ${n} from the exam`} title="Remove from exam">
        <Trash2 size={15} />
      </button>
    </li>
  );
}

export default function ExamQuestionList({ questions, tosMatrix, onPreview, onRemove, onMenu }) {
  const numbered = useMemo(() => questions.map((q, i) => ({ q, n: i + 1 })), [questions]);
  const hasTopics = questions.some((q) => q.topic);
  const [view, setView] = useState(hasTopics ? 'topic' : 'order');
  const [collapsed, setCollapsed] = useState(() => new Set(questions.length > COLLAPSE_OVER ? ['*'] : []));
  const coverage = useCoverage(tosMatrix, questions);

  // Topic groups follow the blueprint's topic order; anything else after.
  const groups = useMemo(() => {
    const map = new Map();
    for (const item of numbered) {
      const key = item.q.topic || NO_TOPIC;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    const order = new Map((tosMatrix?.topics || []).map((t, i) => [t, i]));
    return [...map.entries()]
      .map(([key, rows]) => ({ key, title: key === NO_TOPIC ? 'No topic' : key, rows }))
      .sort((a, b) => (order.get(a.key) ?? 1e6) - (order.get(b.key) ?? 1e6) || a.rows[0].n - b.rows[0].n);
  }, [numbered, tosMatrix]);

  // '*' means "everything collapsed except what was opened since".
  const isCollapsed = (key) => (collapsed.has('*') ? !collapsed.has(`+${key}`) : collapsed.has(key));
  const toggle = (key) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (prev.has('*')) { if (next.has(`+${key}`)) next.delete(`+${key}`); else next.add(`+${key}`); }
    else if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const anyOpen = groups.some((g) => !isCollapsed(g.key));

  return (
    <div className="eq">
      <div className="eq-toolbar">
        {hasTopics && (
          <div className="eq-view" role="group" aria-label="Arrange questions">
            <button type="button" aria-pressed={view === 'topic'} onClick={() => setView('topic')}>By topic</button>
            <button type="button" aria-pressed={view === 'order'} onClick={() => setView('order')}>In order</button>
          </div>
        )}
        {view === 'topic' && hasTopics && (
          <button type="button" className="eq-linkbtn" onClick={() => setCollapsed(anyOpen ? new Set(['*']) : new Set())}>
            {anyOpen ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </div>

      {coverage && <Coverage tosMatrix={tosMatrix} coverage={coverage} />}

      {view === 'order' || !hasTopics ? (
        <ol className="eq-list">
          {numbered.map(({ q, n }) => <Row key={q.id} q={q} n={n} onPreview={onPreview} onRemove={onRemove} onMenu={onMenu} />)}
        </ol>
      ) : groups.map((g) => {
        const closed = isCollapsed(g.key);
        const byBloom = BLOOM_ORDER.map((b) => g.rows.filter(({ q }) => q.bloom === b).length);
        return (
          <section key={g.key} className="eq-group" data-collapsed={closed || undefined}>
            <button type="button" className="eq-group-head" aria-expanded={!closed} onClick={() => toggle(g.key)}>
              <ChevronDown size={15} aria-hidden="true" className="eq-caret" />
              <span className="eq-group-title">{g.title}</span>
              <span className="eq-group-count">{g.rows.length}</span>
              <span className="eq-group-bloom" aria-label={BLOOM_ORDER.map((b, i) => `${byBloom[i]} ${BLOOM_LABELS[b]}`).join(', ')}>
                {byBloom.map((count, i) => (
                  <i key={BLOOM_ORDER[i]} data-level={i + 1} data-empty={!count || undefined} title={`${BLOOM_LABELS[BLOOM_ORDER[i]]}: ${count}`} />
                ))}
              </span>
            </button>
            {!closed && (
              <ol className="eq-list">
                {g.rows.map(({ q, n }) => <Row key={q.id} q={q} n={n} onPreview={onPreview} onRemove={onRemove} onMenu={onMenu} />)}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}
