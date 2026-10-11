import '../styles/attention.css';
/**
 * AttentionPage — "Items needing attention" as its own screen.
 *
 * The Results & insights overview shows only the five weakest items; this
 * page lists every question students struggle with (correct rate, lowest
 * first), filterable by exam, and deep-links into each exam's Item Analysis
 * for the full per-question breakdown.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight,
  ListChecks, ArrowLeft, Printer,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import api from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import { PageLoader } from '../components/Loaders.jsx';
import { BLOOM_LABELS } from '../lib/insights.js';

const PAGE_SIZE = 20;

function trimwd(s, n = 90) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

const TYPE_LABELS = {
  mcq: 'MCQ', true_false: 'T/F', matching: 'Match', identification: 'ID',
};

export default function AttentionPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const examFilter = searchParams.get('exam') || '';
  const [data, setData] = useState(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    api.get(`/analytics/attention${examFilter ? `?examId=${encodeURIComponent(examFilter)}` : ''}`)
      .then(setData)
      .catch((err) => toast.error(err.message || 'Could not load items needing attention.'));
  }, [examFilter, toast]);

  const items = useMemo(() => data?.items || [], [data]);
  const exams = useMemo(() => data?.exams || [], [data]);

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = items.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const worst = items.length ? Number(items[0].correctRate) : null;

  return (
    <AppShell pageClass="attention" activeNav="attention" pageTitle="Needs attention" wide>
      <div className="page-header print-skip">
        <div>
          <span className="eyebrow">Results &amp; insights</span>
          <h1>Items needing attention</h1>
          <p className="page-sub">
            Questions students most often answer incorrectly — lowest correct rate first.
            Only items with at least 3 scanned responses appear.
          </p>
        </div>
        <div className="header-actions">
          {items.length > 0 && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => window.print()} title="Print this list as a document">
              <Printer size={14} /> Print
            </button>
          )}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/analytics')}>
            <ArrowLeft size={14} /> Results &amp; insights
          </button>
        </div>
      </div>

      {/* ── Print document ── */}
      {items.length > 0 && (
        <div className="print-doc print-only">
          <div className="print-doc-head">
            <div className="pd-org">nexam — Results &amp; insights</div>
            <div className="pd-title">Items Needing Attention</div>
            <div className="pd-meta">
              Generated {new Date().toLocaleString()} · {items.length} item{items.length === 1 ? '' : 's'}
              {examFilter && exams.find((e) => e.id === examFilter) ? ` · ${exams.find((e) => e.id === examFilter).title}` : ''}
            </div>
          </div>
          <table className="report-table">
            <thead><tr><th>Question</th><th>Type</th><th>Exam</th><th>Topic</th><th>Bloom</th><th>Resp.</th><th>Correct %</th></tr></thead>
            <tbody>
              {items.map((w, i) => (
                <tr key={i}>
                  <td>{w.stem}</td>
                  <td>{TYPE_LABELS[w.type] || w.type || '—'}</td>
                  <td>{w.exam_title}</td>
                  <td>{w.topic || '—'}</td>
                  <td>{BLOOM_LABELS[w.bloom] || w.bloom || '—'}</td>
                  <td>{w.responses}</td>
                  <td>{Number(w.correctRate).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="print-doc-foot">
            <span>nexam — Results &amp; insights</span>
            <span>Items Needing Attention</span>
          </div>
        </div>
      )}

      {!data ? <PageLoader label="Loading weak items…" /> : (
        <div className="card print-skip">
          <div className="card-header attn-header">
            <span className="card-title">
              <AlertTriangle size={15} className="card-title-icon" />
              {items.length} item{items.length === 1 ? '' : 's'} below threshold
            </span>
            <div className="attn-header-right">
              {worst !== null && (
                <span className="text-muted meta-sm">worst: {worst.toFixed(0)}% correct</span>
              )}
              <select
                className="form-control attn-filter"
                data-tour="attn-filter"
                value={examFilter}
                onChange={(e) => {
                  setPage(0);
                  setSearchParams(e.target.value ? { exam: e.target.value } : {});
                }}
                aria-label="Filter by exam"
              >
                <option value="">All exams ({exams.length})</option>
                {exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="empty-state empty-state-md">
              <AlertTriangle aria-hidden="true" />
              <p>Nothing needs attention{examFilter ? ' for this exam' : ''} — every scanned item is performing, or no OMR sheets have been scanned yet.</p>
            </div>
          ) : (
            <>
              <div className="table-wrap table-bare" data-tour="attn-table">
                <table className="data-table attn-table">
                  <caption className="sr-only">Questions with the lowest correct rates across scanned exams</caption>
                  <colgroup>
                    <col />                            {/* Question — takes the slack */}
                    <col className="attn-w-type" />
                    <col className="attn-w-exam" />
                    <col className="attn-w-topic" />
                    <col className="attn-w-bloom" />
                    <col className="attn-w-num" />
                    <col className="attn-w-num" />
                    <col className="attn-w-act" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">Question</th>
                      <th scope="col" className="attn-col-type">Type</th>
                      <th scope="col">Exam</th>
                      <th scope="col" className="attn-col-topic">Topic</th>
                      <th scope="col" className="attn-col-bloom">Bloom</th>
                      <th scope="col" className="attn-col-num">Responses</th>
                      <th scope="col" className="attn-col-num">Correct</th>
                      <th scope="col" className="attn-col-act"><span className="sr-only">Item analysis</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((w, i) => (
                      <tr key={`${w.exam_id}-${w.item_number}-${i}`} className="attn-row"
                        onClick={() => navigate(`/analytics/items/${encodeURIComponent(w.exam_id)}`)}
                        title={`Open item analysis for ${w.exam_title}`}>
                        <td>
                          <span className="attn-stem">{trimwd(w.stem)}</span>
                          <span className="attn-sub">Item {w.item_number}</span>
                        </td>
                        <td className="attn-col-type"><span className="badge badge-gray">{TYPE_LABELS[w.type] || w.type || '—'}</span></td>
                        <td><span className="attn-exam" title={w.exam_title}>{trimwd(w.exam_title, 28)}</span></td>
                        <td className="attn-col-topic"><span className="text-muted meta-sm">{w.topic || '—'}</span></td>
                        <td className="attn-col-bloom"><span className="text-muted meta-sm">{BLOOM_LABELS[w.bloom] || w.bloom || '—'}</span></td>
                        <td className="attn-col-num">{w.responses}</td>
                        <td className="attn-col-num">
                          <span className={`badge badge-${Number(w.correctRate) >= 50 ? 'amber' : 'red'}`}>
                            {Number(w.correctRate).toFixed(0)}%
                          </span>
                        </td>
                        <td className="attn-col-act">
                          <Link to={`/analytics/items/${encodeURIComponent(w.exam_id)}`}
                            className="btn btn-ghost btn-xs" onClick={(e) => e.stopPropagation()}
                            title="Open this exam's item analysis">
                            <ListChecks size={13} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pageCount > 1 && (
                <div className="attn-pager">
                  <span className="text-muted meta-sm">
                    {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, items.length)} of {items.length}
                  </span>
                  <div className="attn-pager-btns">
                    <button type="button" className="ds-page" onClick={() => setPage(0)} disabled={safePage === 0} aria-label="First page"><ChevronFirst size={15} /></button>
                    <button type="button" className="ds-page" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0} aria-label="Previous page"><ChevronLeft size={15} /></button>
                    <span className="ds-page" aria-current="page">{safePage + 1}</span>
                    <span className="ds-gap">/</span>
                    <span className="ds-page">{pageCount}</span>
                    <button type="button" className="ds-page" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1} aria-label="Next page"><ChevronRight size={15} /></button>
                    <button type="button" className="ds-page" onClick={() => setPage(pageCount - 1)} disabled={safePage >= pageCount - 1} aria-label="Last page"><ChevronLast size={15} /></button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}
