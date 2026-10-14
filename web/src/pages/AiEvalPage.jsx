import '../styles/ai-eval.css';
/**
 * AiEvalPage — AI component evaluation metrics.
 *
 * Data comes from
 * GET /api/ai-eval/summary (generation, similarity, extraction, provider
 * usage, distributions, and the Bloom confusion matrix).
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Sparkles, CheckCircle, CopyCheck, FileSearch,
  Target, Crosshair, Search, GitMerge, Download,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import EmptyStateArt from '../components/EmptyStateArt.jsx';
import api from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import ExportDialog, { ExportSections } from '../components/ExportDialog.jsx';
import KpiCard from '../components/KpiCard.jsx';
import PrintDocHead from '../components/PrintDocHead.jsx';
import PrintDocFoot from '../components/PrintDocFoot.jsx';
import { CountsBarChart, ShareDoughnut } from '../components/AnalyticsCharts.jsx';
import { PageLoader } from '../components/Loaders.jsx';
import { downloadCsv, downloadXlsx } from '../lib/exports.js';
import { barsPng } from '../lib/reportCharts.js';

const BLOOM_LEVEL = { remember: 1, understand: 2, apply: 3, analyze: 4, evaluate: 5, create: 6 };
const TYPE_LABELS = { mcq: 'Multiple choice', true_false: 'True / false', matching: 'Matching type', identification: 'Fill in the blank' };

// Two views under the scorecard; ?tab=bloom deep-links the second.
const TABS = [
  { id: 'generation', label: 'Generation & extraction' },
  { id: 'bloom', label: 'Bloom review agreement' },
];

function pct(v, digits = 1) {
  return ((Number(v) || 0) * 100).toFixed(digits);
}

export default function AiEvalPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(() => api.peek('/ai-eval/summary') ?? null);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'bloom' ? 'bloom' : 'generation';
  const tabRefs = useRef({});
  const selectTab = (id, focus = false) => {
    setSearchParams(id === 'bloom' ? { tab: 'bloom' } : {}, { replace: true });
    if (focus) tabRefs.current[id]?.focus();
  };
  // WAI-ARIA tabs: arrows move between tabs, Home/End jump to the ends.
  const onTabKey = (e) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    selectTab(TABS[(next + TABS.length) % TABS.length].id, true);
  };

  const load = useCallback(() => {
    api.get('/ai-eval/summary')
      .then(setData)
      .catch((err) => toast.error(err.message || 'Could not load AI evaluation metrics.'));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // ── Export sheet state (printScope overrides the doc for one print run,
  // then resets via afterprint — same pattern as /scans + /analytics) ──
  const [exportOpen, setExportOpen] = useState(false);
  const [expSc, setExpSc] = useState(null);            // section ids
  const [printScope, setPrintScope] = useState(null);  // { sections, pending }

  useEffect(() => {
    if (!printScope?.pending) return undefined;
    const after = () => setPrintScope(null);
    window.addEventListener('afterprint', after);
    const t = setTimeout(() => window.print(), 60);
    return () => { window.removeEventListener('afterprint', after); clearTimeout(t); };
  }, [printScope]);

  if (!data) {
    return (
      <AppShell pageClass="ai-eval" activeNav="analytics" pageTitle="AI Evaluation" wide>
        <PageLoader label="Loading evaluation metrics…" />
      </AppShell>
    );
  }

  const gen = data.generation || {};
  const sim = data.similarity || {};
  const ext = data.extraction || {};
  const bloomDist = data.bloomDistribution || [];
  const typeDist = data.typeDistribution || [];
  const providers = data.providers || [];
  const cm = data.confusionMatrix || {};
  const classes = cm.classes || [];

  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '—');
  const bloomRows = bloomDist.map((b) => ({ name: cap(b.bloom), n: b.count, var: `--bloom-${BLOOM_LEVEL[b.bloom] || 3}` }));
  const typeRows = typeDist.map((t, i) => ({ name: TYPE_LABELS[t.type] || t.type, n: t.count, var: `--gc-${(i % 8) + 1}` }));
  const providerRows = providers.map((pr) => ({
    name: `${pr.provider || 'unknown'}${pr.model ? ` · ${pr.model}` : ''}`,
    n: pr.count,
  }));
  const outcomeSlices = [
    { label: 'Approved', value: gen.approved || 0, var: '--green-600' },
    { label: 'Rejected', value: gen.rejected || 0, var: '--red-600' },
    { label: 'Pending review', value: gen.pending || 0, var: '--amber-600' },
  ];
  const genTotal = (gen.approved || 0) + (gen.rejected || 0) + (gen.pending || 0);

  // ── Report exports — sections span both tabs; the export sheet toggles
  // which ship in the document/workbook, same pattern as the analytics
  // reports. ──
  const kpiRows = [
    ['Review acceptance', `${pct(gen.reviewAcceptanceRate)}%`],
    ['Approval rate', `${pct(gen.approvalRate)}%`],
    ['Similarity flag rate', `${pct(sim.flagRate)}%`],
    ['Processing success', `${pct(ext.processingSuccessRate)}%`],
    ...(cm.sampleSize > 0 ? [
      ['Bloom agreement', `${pct(cm.overall?.accuracy)}%`],
      ['Bloom precision', `${pct(cm.overall?.precision)}%`],
      ['Bloom recall', `${pct(cm.overall?.recall)}%`],
      ['Bloom F1-score', `${pct(cm.overall?.f1)}%`],
    ] : []),
  ];
  const genRows = [
    ['Total generated', gen.totalGenerated || 0],
    ['Approved', gen.approved || 0],
    ['Rejected', gen.rejected || 0],
    ['Pending review', gen.pending || 0],
    ['Review acceptance', `${pct(gen.reviewAcceptanceRate, 2)}%`],
    ['Approval rate', `${pct(gen.approvalRate, 2)}%`],
  ];
  const matRows = [
    ['Total materials', ext.totalMaterials || 0],
    ['Processed', ext.processed || 0],
    ['Failed', ext.failed || 0],
    ['Pending', ext.pending || 0],
    ['Processing success', `${pct(ext.processingSuccessRate, 2)}%`],
  ];
  const outcomeRows = outcomeSlices.map((s) => [s.label, s.value]);
  const provRows = providerRows.map((r) => [r.name, r.n]);
  const typeExpRows = typeRows.map((r) => [r.name, r.n]);
  const bloomExpRows = bloomRows.map((r) => [r.name, r.n]);
  const cmRows = classes.map((predicted) => [
    predicted[0].toUpperCase() + predicted.slice(1),
    ...classes.map((actual) => cm.matrix?.[predicted]?.[actual] ?? 0),
  ]);
  const perClassRows = (cm.perClass || []).map((pc) => [
    pc.bloom[0].toUpperCase() + pc.bloom.slice(1), pc.tp, pc.fp, pc.fn, pc.tn,
    `${pct(pc.accuracy, 2)}%`, `${pct(pc.precision, 2)}%`, `${pct(pc.recall, 2)}%`, `${pct(pc.f1, 2)}%`,
  ]);

  const REPORT_SECTIONS = [
    { id: 'kpis', label: 'Headline metrics', rows: kpiRows.length },
    { id: 'generation', label: 'Question generation', rows: genRows.length },
    { id: 'materials', label: 'Material processing', rows: matRows.length },
    { id: 'outcome', label: 'Generation outcome', rows: outcomeRows.length },
    { id: 'providers', label: 'AI provider usage', rows: provRows.length },
    { id: 'types', label: 'Question type distribution', rows: typeExpRows.length },
    { id: 'bloomdist', label: 'Bloom level distribution', rows: bloomExpRows.length },
    { id: 'confusion', label: 'Confusion matrix', rows: cm.sampleSize > 0 ? cmRows.length + 1 : 0 },
    { id: 'perclass', label: 'Per-class metrics', rows: perClassRows.length },
  ];
  const secs = new Set(printScope?.sections ?? REPORT_SECTIONS.map((d) => d.id));
  const expCount = REPORT_SECTIONS.filter((d) => !expSc || expSc.includes(d.id)).reduce((n, d) => n + d.rows, 0);

  const evalMeta = {
    title: 'AI evaluation report',
    pairs: [['Generated', new Date().toLocaleString()]],
  };

  function exportCsv(secSet) {
    const has = (id) => secSet.has(id);
    const blocks = [
      has('kpis') && [['Headline metrics', 'Metric', 'Value'], ...kpiRows.map(([m, v]) => ['', m, v])],
      has('generation') && [['Question generation', 'Metric', 'Value'], ...genRows.map(([m, v]) => ['', m, v])],
      has('materials') && [['Material processing', 'Metric', 'Value'], ...matRows.map(([m, v]) => ['', m, v])],
      has('outcome') && [['Generation outcome', 'Outcome', 'Count'], ...outcomeRows.map((r) => ['', ...r])],
      has('providers') && [['AI provider usage', 'Provider · model', 'Calls'], ...provRows.map((r) => ['', ...r])],
      has('types') && [['Question type distribution', 'Type', 'Count'], ...typeExpRows.map((r) => ['', ...r])],
      has('bloomdist') && [['Bloom level distribution', 'Level', 'Count'], ...bloomExpRows.map((r) => ['', ...r])],
      has('confusion') && cm.sampleSize > 0 && [
        ['Confusion matrix', 'AI predicted \\ Instructor confirmed', ...classes.map((c) => c[0].toUpperCase() + c.slice(1))],
        ...cmRows.map((r) => ['', ...r]),
      ],
      has('perclass') && perClassRows.length > 0 && [
        ['Per-class metrics', 'Bloom level', 'TP', 'FP', 'FN', 'TN', 'Agreement', 'Precision', 'Recall', 'F1'],
        ...perClassRows.map((r) => ['', ...r]),
      ],
    ].filter(Boolean);
    const lines = blocks.flatMap((b, i) => (i ? [[], ...b] : b));
    const maxCols = Math.max(...lines.map((l) => l.length));
    downloadCsv('nexam-ai-eval-report', Array(maxCols).fill(''), lines.map((l) => [...l, ...Array(maxCols - l.length).fill('')]), evalMeta);
  }

  async function exportXlsx(secSet) {
    const has = (id) => secSet.has(id);
    const charts = [
      has('outcome') && genTotal > 0 && {
        title: 'Generation outcome',
        image: barsPng({ labels: outcomeRows.map((r) => r[0]), values: outcomeRows.map((r) => r[1]), pct: false, banded: true }),
      },
      has('types') && typeExpRows.length && {
        title: 'Question type distribution',
        image: barsPng({ labels: typeExpRows.map((r) => r[0]), values: typeExpRows.map((r) => r[1]), pct: false, banded: true }),
      },
      has('bloomdist') && bloomExpRows.length && {
        title: 'Bloom level distribution',
        image: barsPng({ labels: bloomExpRows.map((r) => r[0]), values: bloomExpRows.map((r) => r[1]), pct: false, banded: true }),
      },
      has('providers') && provRows.length && {
        title: 'AI provider usage',
        image: barsPng({ horizontal: true, labels: provRows.map((r) => r[0]), values: provRows.map((r) => r[1]), pct: false, banded: true }),
      },
    ].filter(Boolean);
    const kpis = kpiRows.map(([m, v], i) => ({ label: m, value: v, tone: ['blue', 'green', 'amber', 'rose'][i % 4] }));
    downloadXlsx('nexam-ai-eval-report', {
      title: 'AI evaluation',
      subtitle: 'Generation, extraction, and Bloom review metrics',
      meta: evalMeta.pairs,
      overview: { kpis, charts },
      sheets: [
      has('kpis') && { title: 'Headline metrics', headers: ['Metric', 'Value'], rows: kpiRows },
      has('generation') && { title: 'Question generation', headers: ['Metric', 'Value'], rows: genRows },
      has('materials') && { title: 'Material processing', headers: ['Metric', 'Value'], rows: matRows },
      has('outcome') && { title: 'Generation outcome', headers: ['Outcome', 'Count'], rows: outcomeRows },
      has('providers') && { title: 'Provider usage', headers: ['Provider · model', 'Calls'], rows: provRows },
      has('types') && { title: 'Type distribution', headers: ['Type', 'Count'], rows: typeExpRows },
      has('bloomdist') && { title: 'Bloom distribution', headers: ['Level', 'Count'], rows: bloomExpRows },
      has('confusion') && cm.sampleSize > 0 && {
        title: 'Confusion matrix',
        headers: ['Predicted \\ Confirmed', ...classes.map((c) => c[0].toUpperCase() + c.slice(1))],
        rows: cmRows,
      },
      has('perclass') && perClassRows.length > 0 && {
        title: 'Per-class metrics',
        headers: ['Bloom level', 'TP', 'FP', 'FN', 'TN', 'Agreement', 'Precision', 'Recall', 'F1'],
        rows: perClassRows,
      },
      ].filter(Boolean),
    });
  }

  return (
    <AppShell pageClass="ai-eval" activeNav="analytics" pageTitle="AI Evaluation" wide>
      <div className="page-header print-skip">
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => { setExpSc(REPORT_SECTIONS.map((d) => d.id)); setExportOpen(true); }}
            title="Print or export this report"
          >
            <Download size={14} /> Export
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/analytics')}>
            <ArrowLeft size={14} /> Back to Analytics
          </button>
        </div>
      </div>

      <div className="dash-kpis mb-3 print-skip" data-tour="aieval-stats">
        <KpiCard i={0} icon={Sparkles} tint={3} value={Number(pct(gen.reviewAcceptanceRate))} decimals={1} suffix="%"
          label="Review Acceptance"
          hint={<><b>{gen.approved || 0}</b> approved of {(gen.approved || 0) + (gen.rejected || 0)} decided</>} />
        <KpiCard i={1} icon={CheckCircle} tint={2} value={Number(pct(gen.approvalRate))} decimals={1} suffix="%"
          label="Approval Rate" hint={`${gen.pending || 0} still pending review`} />
        <KpiCard i={2} icon={CopyCheck} tint={4} value={Number(pct(sim.flagRate))} decimals={1} suffix="%"
          label="Similarity Flag Rate" hint={`of ${gen.totalGenerated || 0} generated drafts`} />
        <KpiCard i={3} icon={FileSearch} tint={1} value={Number(pct(ext.processingSuccessRate))} decimals={1} suffix="%"
          label="Processing Success" hint={`${ext.processed || 0} of ${ext.totalMaterials || 0} materials processed`} />
      </div>

      <p className="text-muted mb-2 print-skip">Processing success measures completed uploads. It does not measure whether every source fact was extracted correctly.</p>
      <div className="ae-tabs print-skip" role="tablist" aria-label="Evaluation views">
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => { tabRefs.current[t.id] = el; }}
            type="button"
            role="tab"
            id={`ae-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`ae-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className="ae-tab"
            onClick={() => selectTab(t.id)}
            onKeyDown={onTabKey}
            // The guided tour's confusion-matrix step lands on this tab while
            // the matrix itself is out of view.
            data-tour={t.id === 'bloom' && tab !== 'bloom' ? 'aieval-matrix' : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'generation' && (
      <div role="tabpanel" id="ae-panel-generation" aria-labelledby="ae-tab-generation" className="ae-panel print-skip">
      <div className="detail-grid-2 mb-3" data-tour="aieval-cards">
        <div className="card">
          <div className="card-header"><span className="card-title">Question Generation</span></div>
          <div className="card-body">
            <table className="data-table">
              <tbody>
                <tr><td>Total Generated</td><td className="text-right">{gen.totalGenerated || 0}</td></tr>
                <tr><td>Approved</td><td className="text-right"><span className="badge badge-green">{gen.approved || 0}</span></td></tr>
                <tr><td>Rejected</td><td className="text-right"><span className="badge badge-amber">{gen.rejected || 0}</span></td></tr>
                <tr><td>Pending Review</td><td className="text-right">{gen.pending || 0}</td></tr>
                <tr><td><strong>Review acceptance</strong></td><td className="text-right"><strong>{pct(gen.reviewAcceptanceRate, 2)}%</strong></td></tr>
                <tr><td><strong>Approval Rate</strong></td><td className="text-right"><strong>{pct(gen.approvalRate, 2)}%</strong></td></tr>
              </tbody>
            </table>
            <p className="text-muted meta-sm mt-2">Review acceptance = approved / (approved + rejected). This measures instructor decisions, not factual accuracy.</p>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Material Processing</span></div>
          <div className="card-body">
            <table className="data-table">
              <tbody>
                <tr><td>Total Materials</td><td className="text-right">{ext.totalMaterials || 0}</td></tr>
                <tr><td>Processed</td><td className="text-right"><span className="badge badge-green">{ext.processed || 0}</span></td></tr>
                <tr><td>Failed</td><td className="text-right"><span className="badge badge-red">{ext.failed || 0}</span></td></tr>
                <tr><td>Pending</td><td className="text-right">{ext.pending || 0}</td></tr>
                <tr><td><strong>Processing success</strong></td><td className="text-right"><strong>{pct(ext.processingSuccessRate, 2)}%</strong></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="detail-grid-2 mb-3">
        <div className="card">
          <div className="card-header"><span className="card-title">Generation Outcome</span></div>
          <div className="card-body">
            {genTotal === 0 ? (
              <div className="empty-state empty-state-md"><EmptyStateArt size={88} art="spark" tone={1} /><p>No AI generations yet.</p></div>
            ) : (
              <ShareDoughnut
                slices={outcomeSlices}
                centerText={`${pct(gen.approvalRate)}%`}
                centerSub="approval rate"
                label="Generation outcome — share of drafts approved, rejected, and pending"
              />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">AI Provider Usage</span></div>
          <div className="card-body">
            {providerRows.length === 0 ? (
              <div className="empty-state empty-state-md"><EmptyStateArt size={88} art="spark" tone={1} /><p>No generation calls recorded yet.</p></div>
            ) : (
              <CountsBarChart rows={providerRows} />
            )}
          </div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header"><span className="card-title">Question Type Distribution</span></div>
        {typeRows.length === 0 ? (
          <div className="empty-state empty-state-md"><EmptyStateArt size={88} art="spark" tone={1} /><p>No AI-generated questions yet.</p></div>
        ) : (
          <div className="card-body">
            <CountsBarChart rows={typeRows} />
          </div>
        )}
      </div>
      </div>
      )}

      {tab === 'bloom' && (
      <div role="tabpanel" id="ae-panel-bloom" aria-labelledby="ae-tab-bloom" className="ae-panel print-skip">
      <div className="card mb-3">
        <div className="card-header"><span className="card-title">Bloom Level Distribution (AI-generated)</span></div>
        {bloomRows.length === 0 ? (
          <div className="empty-state empty-state-md"><EmptyStateArt size={88} art="spark" tone={1} /><p>No AI-generated questions yet.</p></div>
        ) : (
          <div className="card-body">
            <CountsBarChart rows={bloomRows} />
          </div>
        )}
      </div>

      <div className="card mb-3" data-tour="aieval-matrix">
        <div className="card-header">
          <span className="card-title">Bloom's Taxonomy Classification — Confusion Matrix</span>
          {cm.sampleSize > 0 && <span className="text-muted meta-sm">Sample size: {cm.sampleSize} reviewed questions</span>}
        </div>
        <div className="card-body">
          {cm.sampleSize > 0 ? (
            <>
              <div className="dash-kpis mb-3">
                <KpiCard i={0} icon={Target} tint={3} value={Number(pct(cm.overall?.accuracy))} decimals={1} suffix="%" label="Agreement" />
                <KpiCard i={1} icon={Crosshair} tint={2} value={Number(pct(cm.overall?.precision))} decimals={1} suffix="%" label="Precision" />
                <KpiCard i={2} icon={Search} tint={4} value={Number(pct(cm.overall?.recall))} decimals={1} suffix="%" label="Recall" />
                <KpiCard i={3} icon={GitMerge} tint={1} value={Number(pct(cm.overall?.f1))} decimals={1} suffix="%" label="F1-Score" />
              </div>

              <p className="text-muted meta-sm mb-2">
                Compares independent AI review labels with instructor-approved labels. Only accepted questions with the new review are included; this selected sample is not an unbiased accuracy evaluation.
                Diagonal cells show agreement; off-diagonal cells show disagreement.
              </p>

              {classes.length > 0 && (
                <div className="table-wrap">
                  <table className="data-table confusion-matrix-table">
                    <thead>
                      <tr>
                        <th rowSpan="2" className="cm-axis-label">AI Predicted ↓</th>
                        <th colSpan={classes.length}>Instructor Confirmed →</th>
                      </tr>
                      <tr>
                        {classes.map((cls) => <th key={cls} className="cm-col-header">{cls[0].toUpperCase() + cls.slice(1)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {classes.map((predicted) => (
                        <tr key={predicted}>
                          <td className="cm-row-header">{predicted[0].toUpperCase() + predicted.slice(1)}</td>
                          {classes.map((actual) => {
                            const cell = cm.matrix?.[predicted]?.[actual] ?? 0;
                            const cls = `cm-cell${predicted === actual ? ' cm-diagonal' : ''}${cell === 0 ? ' cm-zero' : ''}`;
                            return <td key={actual} className={cls}>{cell > 0 ? cell : '·'}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(cm.perClass || []).length > 0 && (
                <>
                  <h3 className="mt-3 mb-1">Per-Class Metrics</h3>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Bloom Level</th><th>TP</th><th>FP</th><th>FN</th><th>TN</th>
                          <th>Agreement</th><th>Precision</th><th>Recall</th><th>F1-Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cm.perClass.map((pc) => (
                          <tr key={pc.bloom}>
                            <td><span className="g-bloom" data-level={BLOOM_LEVEL[pc.bloom] || 0}>{pc.bloom[0].toUpperCase() + pc.bloom.slice(1)}</span></td>
                            <td className="text-right">{pc.tp}</td>
                            <td className="text-right">{pc.fp}</td>
                            <td className="text-right">{pc.fn}</td>
                            <td className="text-right">{pc.tn}</td>
                            <td className="text-right">{pct(pc.accuracy, 2)}%</td>
                            <td className="text-right">{pct(pc.precision, 2)}%</td>
                            <td className="text-right">{pct(pc.recall, 2)}%</td>
                            <td className="text-right"><strong>{pct(pc.f1, 2)}%</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="empty-state empty-state-md">
              <EmptyStateArt size={88} art="spark" tone={1} />
              <p>No reviewed AI questions yet. The confusion matrix will appear once instructors review and approve or reject AI-generated questions, confirming or correcting the AI's Bloom level assignment.</p>
            </div>
          )}
        </div>
      </div>
      </div>
      )}
      {/* ── Print document — sections follow the export sheet's scope ── */}
      <div className="print-doc print-only">
        <PrintDocHead
          org={<>nexam — Results &amp; insights</>}
          title="AI Evaluation Report"
          meta={<>{evalMeta.pairs.map(([k, v]) => `${k}: ${v}`).join('  ·  ')}</>}
        />

        {secs.has('kpis') && (
          <>
            <div className="report-section-title">Headline metrics</div>
            <table className="report-table">
              <tbody>{kpiRows.map(([m, v]) => <tr key={m}><th>{m}</th><td>{v}</td></tr>)}</tbody>
            </table>
          </>
        )}

        {secs.has('generation') && (
          <>
            <div className="report-section-title">Question generation</div>
            <table className="report-table">
              <tbody>{genRows.map(([m, v]) => <tr key={m}><th>{m}</th><td>{v}</td></tr>)}</tbody>
            </table>
            <p className="report-note">Review acceptance measures instructor decisions, not factual accuracy.</p>
          </>
        )}

        {secs.has('materials') && (
          <>
            <div className="report-section-title">Material processing</div>
            <table className="report-table">
              <tbody>{matRows.map(([m, v]) => <tr key={m}><th>{m}</th><td>{v}</td></tr>)}</tbody>
            </table>
            <p className="report-note">Processing success measures completed uploads; it does not measure whether every source fact was extracted correctly.</p>
          </>
        )}

        {secs.has('outcome') && outcomeRows.length > 0 && (
          <>
            <div className="report-section-title">Generation outcome</div>
            <table className="report-table">
              <thead><tr><th>Outcome</th><th>Count</th></tr></thead>
              <tbody>{outcomeRows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </>
        )}

        {secs.has('providers') && provRows.length > 0 && (
          <>
            <div className="report-section-title">AI provider usage</div>
            <table className="report-table">
              <thead><tr><th>Provider · model</th><th>Calls</th></tr></thead>
              <tbody>{provRows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </>
        )}

        {secs.has('types') && typeExpRows.length > 0 && (
          <>
            <div className="report-section-title">Question type distribution</div>
            <table className="report-table">
              <thead><tr><th>Type</th><th>Count</th></tr></thead>
              <tbody>{typeExpRows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </>
        )}

        {secs.has('bloomdist') && bloomExpRows.length > 0 && (
          <>
            <div className="report-section-title">Bloom level distribution</div>
            <table className="report-table">
              <thead><tr><th>Level</th><th>Count</th></tr></thead>
              <tbody>{bloomExpRows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </>
        )}

        {secs.has('confusion') && cm.sampleSize > 0 && (
          <>
            <div className="report-section-title">Bloom confusion matrix</div>
            <table className="report-table">
              <thead>
                <tr><th>AI predicted \ Instructor confirmed</th>{classes.map((c) => <th key={c}>{c[0].toUpperCase() + c.slice(1)}</th>)}</tr>
              </thead>
              <tbody>
                {cmRows.map((r, i) => (
                  <tr key={i}><th>{r[0]}</th>{r.slice(1).map((c, j) => <td key={j}>{c > 0 ? c : '·'}</td>)}</tr>
                ))}
              </tbody>
            </table>
            <p className="report-note">
              Sample size: {cm.sampleSize} reviewed questions. Diagonal cells show agreement; off-diagonal cells show disagreement.
              Only accepted questions with the new review are included — this selected sample is not an unbiased accuracy evaluation.
            </p>
          </>
        )}

        {secs.has('perclass') && perClassRows.length > 0 && (
          <>
            <div className="report-section-title">Per-class metrics</div>
            <table className="report-table">
              <thead><tr><th>Bloom level</th><th>TP</th><th>FP</th><th>FN</th><th>TN</th><th>Agreement</th><th>Precision</th><th>Recall</th><th>F1</th></tr></thead>
              <tbody>{perClassRows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </>
        )}

        <PrintDocFoot
          left={<>nexam — Results &amp; insights</>}
          right="AI Evaluation Report"
        />
      </div>

      {exportOpen && expSc && (
        <ExportDialog
          title="Print or export report"
          subtitle="AI evaluation metrics — pick the sections to include"
          count={expCount}
          noun="row"
          hint="Sections cover both tabs — generation/extraction and Bloom agreement. Unticked sections drop out of the document entirely."
          onClose={() => setExportOpen(false)}
          onRun={(fmt) => {
            setExportOpen(false);
            if (fmt === 'print') setPrintScope({ sections: expSc, pending: true });
            else if (fmt === 'xlsx') exportXlsx(new Set(expSc));
            else exportCsv(new Set(expSc));
          }}
        >
          <ExportSections defs={REPORT_SECTIONS} value={expSc} onChange={setExpSc} />
        </ExportDialog>
      )}
    </AppShell>
  );
}
