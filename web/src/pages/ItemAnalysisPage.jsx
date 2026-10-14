import '../styles/item-analysis.css';
/**
 * ItemAnalysisPage — per-question response distributions and difficulty.
 *
 * Data comes from
 * GET /api/analytics/exam/:examId/items.
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, FileDown, FileSpreadsheet, Eye, Copy } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import EmptyStateArt from '../components/EmptyStateArt.jsx';
import { useContextMenu, useCopyText } from '../components/ContextMenu.jsx';
import api from '../lib/api.js';
import { downloadCsv, downloadXlsx } from '../lib/exports.js';
import AppShell from '../components/AppShell.jsx';
import { TableSkeleton } from '../components/Loaders.jsx';
import Modal from '../components/Modal.jsx';
import { ItemScatterChart } from '../components/AnalyticsCharts.jsx';
import { BLOOM_LABELS } from '../lib/insights.js';
import { cleanOptionText, resolveAnswerIndex } from '../lib/questionAnswers.js';

const DIFF_CLASS = { easy: 'green', medium: 'amber', hard: 'red' };
const TYPE_LABELS = { mcq: 'MCQ', true_false: 'T/F', matching: 'Match', identification: 'ID' };

/** Show a scanned/stored answer as { letter, optionText, optionIndex } —
    accepts the canonical letter and the legacy full-text shape. */
function answerDisplay(item, value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { label: '—', text: null, idx: -1 };
  if (item.type === 'true_false') {
    const isT = raw.toUpperCase().startsWith('T');
    return { label: isT ? 'T' : 'F', text: isT ? 'True' : 'False', idx: isT ? 0 : 1 };
  }
  if (item.type !== 'mcq') return { label: raw, text: null, idx: -1 };
  const opts = optionList(item);
  if (!opts.length) return { label: raw, text: null, idx: -1 };
  const idx = /^[A-Z]$/i.test(raw)
    ? raw.toUpperCase().charCodeAt(0) - 65
    : resolveAnswerIndex(opts, raw);
  return idx >= 0 && idx < opts.length
    ? { label: 'ABCDEFGHIJ'[idx], text: cleanOptionText(opts[idx]), idx }
    : { label: raw, text: null, idx: -1 };
}

/** Plain option text list — mcq options, or the fixed True/False pair. */
function optionList(item) {
  if (item.type === 'true_false') return ['True', 'False'];
  if (item.type !== 'mcq') return [];
  let opts = item.options;
  if (typeof opts === 'string') { try { opts = JSON.parse(opts); } catch { return []; } }
  return Array.isArray(opts) ? opts : [];
}

export default function ItemAnalysisPage() {
  const { examId } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState(() => api.peek(`/analytics/exam/${examId}/items`)?.items ?? null);
  const [selected, setSelected] = useState(null);
  const { menuEl, openMenu } = useContextMenu();
  const copyText = useCopyText();

  const load = useCallback(() => {
    api.get(`/analytics/exam/${examId}/items`)
      .then((d) => setItems(d.items || []))
      .catch((err) => {
        toast.error(err.message || 'Item analysis not found.');
        navigate('/analytics');
      });
  }, [examId, toast, navigate]);

  useEffect(() => { load(); }, [load]);

  // Per-set rows: Set A item 2 and Set B item 2 are different questions.
  const hasSets = (items || []).some((it) => it.set);

  const itemRows = (items || []).map((it) => {
    const key = answerDisplay(it, it.answer || it.correctAnswer);
    return [
      it.itemNumber,
      it.set || '—',
      it.stem || `Item ${it.itemNumber}`,
      key.text ? `${key.label} — ${key.text}` : key.label,
      `${it.correctRate}%`,
      it.difficulty ? it.difficulty[0].toUpperCase() + it.difficulty.slice(1) : '—',
      it.discrimination ?? '—',
      it.totalResponses,
      it.ambiguousCount,
      (it.answerDistribution || []).map((ad) => {
        const d = answerDisplay(it, ad.marked_answer);
        return `${d.label} ${d.text ? `(${d.text.slice(0, 30)}${d.text.length > 30 ? '…' : ''}) ` : ''}× ${ad.count}`;
      }).join('  '),
    ];
  });
  const ITEM_HEADERS = ['#', 'Set', 'Question', 'Correct answer', 'Correct rate', 'Difficulty', 'Discrimination (r)', 'Responses', 'Ambiguous', 'Distribution'];

  function exportCsv() {
    downloadCsv('nexam-item-analysis', ITEM_HEADERS, itemRows);
  }

  function exportXlsx() {
    downloadXlsx('nexam-item-analysis', [{ title: 'Item analysis', headers: ITEM_HEADERS, rows: itemRows }]);
  }

  return (
    <AppShell pageClass="item-analysis" activeNav="analytics" pageTitle="Item Analysis" wide>
      <div className="page-header print-skip">
        <div className="header-actions">
          {items?.length > 0 && (<>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => window.print()} title="Print the item analysis">
              <Printer size={14} /> Print
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={exportCsv} title="Download as CSV">
              <FileDown size={14} /> CSV
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={exportXlsx} title="Download as Excel">
              <FileSpreadsheet size={14} /> Excel
            </button>
          </>)}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/analytics')}>
            <ArrowLeft size={14} /> Back to Analytics
          </button>
        </div>
      </div>

      {items?.length > 0 && (
        <div className="print-doc print-only">
          <div className="print-doc-head">
            <div className="pd-org">nexam — Results &amp; insights</div>
            <div className="pd-title">Item Analysis Report</div>
            <div className="pd-meta">Generated {new Date().toLocaleString()} · {items.length} items</div>
          </div>
          <div className="report-section-title">Question performance</div>
          <table className="report-table">
            <thead>
              <tr>{ITEM_HEADERS.map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {itemRows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}
            </tbody>
          </table>
          <div className="print-doc-foot">
            <span>nexam — Results &amp; insights</span>
            <span>Item Analysis Report</span>
          </div>
        </div>
      )}

      {items === null ? (
        <TableSkeleton rows={10} />
      ) : items.length === 0 ? (
        <div className="empty-state">
          <EmptyStateArt art="chart" tone={6} />
          <h2>No item data yet</h2>
          <p>Item-level analysis appears once OMR answer sheets have been scanned for this exam.</p>
        </div>
      ) : (
        <>
        <div className="card print-skip">
          <div className="card-header">
            <div>
              <span className="card-title">Quality map</span>
              <p className="card-sub">Difficulty vs discrimination — the shaded band is the ideal difficulty corridor; points under the dashed line don't separate strong from weak students.</p>
            </div>
          </div>
          <ItemScatterChart items={items} />
        </div>
        <div className="card print-skip" data-tour="ia-table">
          <div className="card-header">
            <span className="card-title">Question Performance</span>
            <span className="text-muted meta-sm">{items.length} items</span>
          </div>
          <div className="table-wrap">
            <table className="data-table ia-table">
              <thead>
                <tr>
                  <th className="col-num ia-col-num">#</th>
                  <th>Question</th>
                  <th className="ia-col-rate">Performance</th>
                  <th className="ia-col-stat" title="Responses">Resp.</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.set || ''}-${item.itemNumber}`} className="ia-row" onClick={() => setSelected(item)}
                    onContextMenu={(e) => openMenu(e, [
                      { label: 'View details', icon: Eye, onClick: () => setSelected(item) },
                      'sep',
                      { label: 'Copy stem', icon: Copy, onClick: () => copyText(item.stem, 'Question') },
                    ])}
                    title="Open full item detail">
                    <td className="ia-numcell">
                      <span className="ia-itemnum">{item.itemNumber}</span>
                      {hasSets && <span className={`badge badge-${item.set === 'B' ? 'purple' : 'blue'}`}>{item.set || '—'}</span>}
                    </td>
                    <td>
                      <span className="ia-stem">{item.stem || `Item ${item.itemNumber}`}</span>
                      <span className="ia-tags">
                        {item.type && <span className="badge badge-gray">{TYPE_LABELS[item.type] || item.type}</span>}
                        {item.bloom && <span className="text-muted meta-sm">{BLOOM_LABELS[item.bloom] || item.bloom}</span>}
                      </span>
                    </td>
                    <td>
                      <div className="ia-perf">
                        <div className="correct-rate-bar">
                          <div className="correct-rate-fill" style={{ width: `${item.correctRate}%` }} />
                          <span className="correct-rate-text">{item.correctRate}%</span>
                        </div>
                        <span className={`badge badge-${DIFF_CLASS[item.difficulty] || 'gray'}`}>
                          {item.difficulty ? item.difficulty[0].toUpperCase() + item.difficulty.slice(1) : '—'}
                        </span>
                        {item.discrimination !== null && item.discrimination !== undefined && (
                          <span
                            className={`badge badge-${item.discrimination >= 0.3 ? 'green' : item.discrimination >= 0.15 ? 'amber' : 'red'}`}
                            title={`Discrimination r = ${item.discrimination} — how well this item separates strong from weak students (≥.3 good, <.15 weak)`}
                          >
                            r {item.discrimination.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="ia-respcell">
                      <span className="ia-resp">{item.totalResponses}</span>
                      {item.ambiguousCount > 0 && <span className="ia-amb text-muted" title={`${item.ambiguousCount} ambiguous — needs review`}>{item.ambiguousCount} amb</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Full item detail — correct answer + complete answer distribution */}
          <Modal
            open={!!selected}
            title={selected ? `Item ${selected.itemNumber}${selected.set ? ` · Set ${selected.set}` : ''}` : ''}
            subtitle={selected ? `${selected.correctCount}/${selected.totalResponses} correct · ${TYPE_LABELS[selected.type] || selected.type || ''}${selected.bloom ? ` · ${BLOOM_LABELS[selected.bloom] || selected.bloom}` : ''}` : ''}
            onClose={() => setSelected(null)}
            side
          >
            {selected && (() => {
              const key = answerDisplay(selected, selected.answer || selected.correctAnswer);
              const opts = optionList(selected);
              return (
              <div className="ia-detail">
                <p className="ia-detail-stem">{selected.stem || `Item ${selected.itemNumber}`}</p>
                {opts.length > 0 && (
                  <ul className="ia-opts">
                    {opts.map((opt, i) => (
                      <li key={i} className={i === key.idx ? 'is-key' : undefined}>
                        <i>{'ABCDEFGHIJ'[i]}</i>
                        <span>{cleanOptionText(opt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="ia-detail-answer">
                  <span className="ia-detail-label">Correct answer</span>
                  <span className="badge badge-green">{key.label}</span>
                  {key.text && <span className="ia-answer-text">{key.text}</span>}
                </div>
                <div className="ia-detail-block">
                  <span className="ia-detail-label">How students answered</span>
                  {(selected.answerDistribution || []).length === 0 ? (
                    <p className="text-muted meta-sm">No responses recorded.</p>
                  ) : (
                    <div className="ia-dist-list">
                      {selected.answerDistribution.map((ad, i) => {
                        const share = selected.totalResponses ? Math.round((ad.count / selected.totalResponses) * 100) : 0;
                        const isKey = answerDisplay(selected, ad.marked_answer).label === key.label;
                        return (
                          <div className="ia-dist-row" key={i}>
                            <span className={`ia-dist-answer ${isKey ? 'is-correct' : ''}`}>
                              {answerDisplay(selected, ad.marked_answer).label}
                            </span>
                            <span className="ia-dist-text" title={answerDisplay(selected, ad.marked_answer).text || undefined}>
                              {answerDisplay(selected, ad.marked_answer).text || ''}
                            </span>
                            <span className="ia-dist-bar">
                              <span className="ia-dist-fill" style={{ width: `${share}%` }} />
                            </span>
                            <span className="ia-dist-count">{ad.count} <span className="text-muted">({share}%)</span></span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {selected.explanation && (
                  <div className="ia-detail-block">
                    <span className="ia-detail-label">Explanation</span>
                    <p className="ia-detail-note">{selected.explanation}</p>
                  </div>
                )}
                <div className="ia-detail-stats">
                  <span>Ambiguous marks: <strong>{selected.ambiguousCount}</strong></span>
                  <span>Wrong answers: <strong>{selected.wrongCount}</strong></span>
                </div>
              </div>
              );
            })()}
          </Modal>
        </div>
        </>
      )}
      {menuEl}
    </AppShell>
  );
}
