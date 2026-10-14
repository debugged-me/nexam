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
  AlertTriangle, ListChecks, ArrowLeft, Copy,
  FileText, Target, ScanLine, Download,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import EmptyStateArt from '../components/EmptyStateArt.jsx';
import ExportDialog from '../components/ExportDialog.jsx';
import PrintDocHead from '../components/PrintDocHead.jsx';
import PrintDocFoot from '../components/PrintDocFoot.jsx';
import { useContextMenu, useCopyText } from '../components/ContextMenu.jsx';
import { useGridTable, DsPager, DsPageSize } from '../components/DataTable.jsx';
import KpiCard from '../components/KpiCard.jsx';
import api from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import { TableSkeleton } from '../components/Loaders.jsx';
import { animateRows } from '../lib/animRows.js';
import { downloadCsv, downloadXlsx } from '../lib/exports.js';
import { BLOOM_LABELS, BLOOM_ORDER } from '../lib/insights.js';

const PAGE_SIZE = 20;
// Rows arrive pre-sorted (lowest correct first) — the table only paginates.
const PAGER_COLUMNS = [{ id: 'row', enableSorting: false }];

function trimwd(s, n = 90) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

const TYPE_LABELS = {
  mcq: 'MCQ', true_false: 'T/F', matching: 'Match', identification: 'ID',
};

/** Per-option pick split for choice items — shows which distractor pulled
    students. Letters aggregate the scan picks (`sa.marked_answer`). */
function pickDist(w) {
  if (!w.picks || (w.type !== 'mcq' && w.type !== 'true_false')) return null;
  const counts = {};
  for (const raw of String(w.picks).split(',')) {
    const k = String(raw || '').trim().toUpperCase().slice(0, 1);
    if (k) counts[k] = (counts[k] || 0) + 1;
  }
  const letters = Object.keys(counts).sort();
  if (!letters.length) return null;
  return { letters, counts, total: letters.reduce((n, l) => n + counts[l], 0) };
}

export default function AttentionPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { menuEl, openMenu } = useContextMenu();
  const copyText = useCopyText();
  const [searchParams, setSearchParams] = useSearchParams();
  const examFilter = searchParams.get('exam') || '';
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/analytics/attention${examFilter ? `?examId=${encodeURIComponent(examFilter)}` : ''}`)
      .then(setData)
      .catch((err) => toast.error(err.message || 'Could not load items needing attention.'));
  }, [examFilter, toast]);

  const items = useMemo(() => data?.items || [], [data]);
  const exams = useMemo(() => data?.exams || [], [data]);

  // ── Export sheet — scope is exam / Bloom / type. When the page is
  // exam-filtered the loaded items cover only that exam, so the sheet
  // fetches the unscoped list once and every scope option gets real rows.
  const [exportOpen, setExportOpen] = useState(false);
  const [expSc, setExpSc] = useState(null);            // { examId, bloom, type }
  const [expAll, setExpAll] = useState(null);          // unscoped items
  const [printScope, setPrintScope] = useState(null);  // { rows, examId, bloom, type, pending }

  const expPool = expAll ?? items;
  const scopedItems = (sc) => expPool.filter((w) =>
    (!sc.examId || w.exam_id === sc.examId)
    && (!sc.bloom || w.bloom === sc.bloom)
    && (!sc.type || w.type === sc.type));

  const openExport = async () => {
    setExpSc({ examId: examFilter, bloom: '', type: '' });
    setExportOpen(true);
    if (examFilter && !expAll) {
      try {
        const d = await api.get('/analytics/attention');
        setExpAll(d.items || []);
      } catch { /* pool stays the loaded subset */ }
    }
  };

  useEffect(() => {
    if (!printScope?.pending) return undefined;
    const after = () => setPrintScope(null);
    window.addEventListener('afterprint', after);
    const t = setTimeout(() => window.print(), 60);
    return () => { window.removeEventListener('afterprint', after); clearTimeout(t); };
  }, [printScope]);

  const grid = useGridTable({ data: items, columns: PAGER_COLUMNS, pageSize: PAGE_SIZE, storageKey: 'attention', resetKey: examFilter });
  const { pageRows: pageItems } = grid;

  const worst = items.length ? Number(items[0].correctRate) : null;

  // ── Export / print plumbing — print doc renders the scoped rows; a
  // uniform Exam/Bloom/Type collapses into the meta line instead of
  // repeating per row, the same collapse the scans doc does. ──
  const ATT_HEADERS = ['Question', 'Type', 'Exam', 'Topic', 'Bloom', 'Resp.', 'Correct %'];
  const printItems = printScope?.rows ?? items;
  const scopedTitle = (sc) => sc?.examId ? exams.find((e) => e.id === sc.examId)?.title : null;
  const printExam = scopedTitle(printScope)
    || (examFilter ? exams.find((e) => e.id === examFilter)?.title : null)
    || (new Set(printItems.map((w) => w.exam_title)).size === 1 && printItems.length ? printItems[0].exam_title : null);
  const printBloom = printScope?.bloom
    ? (BLOOM_LABELS[printScope.bloom] || printScope.bloom)
    : (new Set(printItems.map((w) => w.bloom).filter(Boolean)).size === 1 ? (BLOOM_LABELS[printItems[0]?.bloom] || printItems[0]?.bloom) : null);
  const printType = printScope?.type
    ? (TYPE_LABELS[printScope.type] || printScope.type)
    : (new Set(printItems.map((w) => w.type).filter(Boolean)).size === 1 ? (TYPE_LABELS[printItems[0]?.type] || printItems[0]?.type) : null);
  const dropCols = [printType && 1, printExam && 2, printBloom && 4].filter((i) => i !== false);
  const printHeaders = ATT_HEADERS.filter((_, i) => !dropCols.includes(i));
  const attRow = (w) => [
    w.stem, TYPE_LABELS[w.type] || w.type || '—', w.exam_title, w.topic || '—',
    BLOOM_LABELS[w.bloom] || w.bloom || '—', w.responses, `${Number(w.correctRate).toFixed(0)}%`,
  ];
  const printCells = printItems.map((w) => attRow(w).filter((_, i) => !dropCols.includes(i)));

  function scopePairs(sc, count) {
    return [
      ['Generated', new Date().toLocaleString()],
      ['Items', String(count)],
      ...(sc.examId ? [['Exam', scopedTitle(sc) || '']] : []),
      ...(sc.bloom ? [['Bloom', BLOOM_LABELS[sc.bloom] || sc.bloom]] : []),
      ...(sc.type ? [['Type', TYPE_LABELS[sc.type] || sc.type]] : []),
    ];
  }

  function exportCsvFile(sc) {
    const rows = scopedItems(sc).map(attRow);
    downloadCsv('nexam-attention', ATT_HEADERS, rows, { title: 'Items needing attention', pairs: scopePairs(sc, rows.length) });
  }

  async function exportXlsxFile(sc) {
    const rows = scopedItems(sc).map(attRow);
    try {
      await downloadXlsx('nexam-attention', {
        title: 'Items needing attention',
        subtitle: 'Lowest correct rate first — items with 3+ scanned responses',
        meta: scopePairs(sc, rows.length),
        sheets: [{ title: 'Needs attention', headers: ATT_HEADERS, rows }],
      });
    } catch {
      toast.error('Could not build the Excel file.');
    }
  }

  // KPI rollup — how wide the problem spreads and how deep it runs.
  const attn = useMemo(() => {
    const affected = new Set(items.map((w) => w.exam_id)).size;
    const responses = items.reduce((n, w) => n + (Number(w.responses) || 0), 0);
    const weighted = items.reduce((n, w) => n + (Number(w.correctRate) || 0) * (Number(w.responses) || 0), 0);
    return {
      affected,
      responses,
      avgCorrect: responses ? weighted / responses : null,
    };
  }, [items]);

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
          {data && (
            <button type="button" className="btn btn-outline btn-sm" onClick={openExport} title="Print or export this list">
              <Download size={14} /> Export
            </button>
          )}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/analytics')}>
            <ArrowLeft size={14} /> Results &amp; insights
          </button>
        </div>
      </div>

      {/* ── Print document ── */}
      {(items.length > 0 || printScope) && (
        <div className="print-doc print-only">
          <PrintDocHead
            org={<>nexam — Results &amp; insights</>}
            title={printExam ? `${printExam} — Items Needing Attention` : 'Items Needing Attention'}
            meta={<>
              Generated {new Date().toLocaleString()} · {printItems.length} item{printItems.length === 1 ? '' : 's'}
              {printBloom ? ` · Bloom: ${printBloom}` : ''}
              {printType ? ` · Type: ${printType}` : ''}
            </>}
          />
          <table className="report-table">
            <thead><tr>{printHeaders.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody ref={animateRows}>
              {printCells.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
          <PrintDocFoot
            left={<>nexam — Results &amp; insights</>}
            right="Items Needing Attention"
          />
        </div>
      )}

      {!data ? <TableSkeleton /> : (
        <>
        {items.length > 0 && (
          <div className="dash-kpis mb-3 print-skip" data-tour="attn-stats">
            <KpiCard i={0} icon={AlertTriangle} tint={5} value={items.length}
              label="Items below threshold" hint="lowest correct first · 3+ responses" />
            <KpiCard i={1} icon={FileText} tint={2} value={attn.affected}
              label="Exams affected" hint={`of ${exams.length} scanned`} />
            <KpiCard i={2} icon={Target} tint={4} value={attn.avgCorrect ?? 0} decimals={1} suffix="%"
              label="Avg correct rate" hint={worst !== null ? `worst item ${worst.toFixed(0)}%` : undefined} />
            <KpiCard i={3} icon={ScanLine} tint={3} value={attn.responses}
              label="Responses analyzed" />
          </div>
        )}
        <div className="card print-skip">
          <div className="card-header attn-header">
            <span className="card-title">
              <AlertTriangle size={15} className="card-title-icon" />
              {items.length ? `${items.length} item${items.length === 1 ? '' : 's'} below threshold` : 'No items below threshold'}
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
              <EmptyStateArt size={88} art="flag" tone={4} />
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
                  <tbody ref={animateRows}>
                    {pageItems.map((w, i) => (
                      <tr key={`${w.exam_id}-${w.item_number}-${i}`} className="attn-row"
                        onClick={() => navigate(`/analytics/items/${encodeURIComponent(w.exam_id)}`)}
                        onContextMenu={(e) => openMenu(e, [
                          { label: 'Open item analysis', icon: ListChecks, onClick: () => navigate(`/analytics/items/${encodeURIComponent(w.exam_id)}`) },
                          'sep',
                          { label: 'Copy question', icon: Copy, onClick: () => copyText(w.stem, 'Question') },
                        ])}
                        title={`Open item analysis for ${w.exam_title}`}>
                        <td>
                          <span className="attn-stem">{trimwd(w.stem)}</span>
                          <span className="attn-sub">Item {w.item_number}</span>
                          {(() => { const d = pickDist(w); return d && (
                            <span className="attn-dist" role="img"
                              aria-label={`Picks: ${d.letters.map((l) => `${l} ${d.counts[l]}`).join(', ')}`}>
                              {d.letters.map((l) => (
                                <i key={l} data-key={l === String(w.key_answer || '').trim().toUpperCase() || undefined}
                                  style={{ flexGrow: d.counts[l] }}
                                  title={`${l}: ${d.counts[l]} of ${d.total}`}>{l}</i>
                              ))}
                            </span>
                          ); })()}
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

              {items.length > PAGE_SIZE && (
                <div className="attn-pager">
                  <div className="ds-foot-lead">
                    <span className="text-muted meta-sm">
                      {grid.start}–{grid.end} of {items.length}
                    </span>
                    <DsPageSize grid={grid} options={[20, 50, 100]} />
                  </div>
                  {grid.pageCount > 1 && <DsPager grid={grid} />}
                </div>
              )}
            </>
          )}
        </div>
        </>
      )}
      {exportOpen && expSc && (
        <ExportDialog
          title="Print or export"
          subtitle="Items needing attention — pick the slice to include"
          count={scopedItems(expSc).length}
          noun="item"
          hint="One exam on paper? Its name moves to the document title and the column drops out — same for a single Bloom level or type."
          onClose={() => setExportOpen(false)}
          onRun={(fmt) => {
            setExportOpen(false);
            if (fmt === 'print') setPrintScope({ ...expSc, rows: scopedItems(expSc), pending: true });
            else if (fmt === 'xlsx') exportXlsxFile(expSc);
            else exportCsvFile(expSc);
          }}
        >
          <div className="form-group">
            <label className="form-label" htmlFor="exp-exam">Exam</label>
            <select id="exp-exam" className="form-control form-select" value={expSc.examId}
              onChange={(e) => setExpSc({ ...expSc, examId: e.target.value })}>
              <option value="">All exams</option>
              {exams.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="exp-bloom">Bloom level</label>
            <select id="exp-bloom" className="form-control form-select" value={expSc.bloom}
              onChange={(e) => setExpSc({ ...expSc, bloom: e.target.value })}>
              <option value="">All levels</option>
              {[...new Set(expPool.map((w) => w.bloom).filter(Boolean))]
                .sort((a, b) => (BLOOM_ORDER || []).indexOf(a) - (BLOOM_ORDER || []).indexOf(b))
                .map((b) => <option key={b} value={b}>{BLOOM_LABELS[b] || b}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="exp-type">Question type</label>
            <select id="exp-type" className="form-control form-select" value={expSc.type}
              onChange={(e) => setExpSc({ ...expSc, type: e.target.value })}>
              <option value="">All types</option>
              {[...new Set(expPool.map((w) => w.type).filter(Boolean))]
                .map((t) => <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>)}
            </select>
          </div>
        </ExportDialog>
      )}
      {menuEl}
    </AppShell>
  );
}
