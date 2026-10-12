import '../styles/analytics.css';
/**
 * AnalyticsPage — performance dashboard with exam overview, score
 * distributions, and student scores.
 *
 * Data comes from GET /api/analytics/overview. Exam-level detail is loaded
 * on demand when an exam is selected (GET /api/analytics/exam/:id).
 *
 * Uses the shared application and analytics styles.
 */
import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText, ScanLine, Users, AlertCircle,
  TrendingUp, TrendingDown, Sparkles, ListChecks, ArrowLeft,
  CheckCircle, Lightbulb, AlertTriangle, Layers,
  Printer, FileDown, FileSpreadsheet,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import EmptyStateArt from '../components/EmptyStateArt.jsx';
import api from '../lib/api.js';
import { downloadCsv, downloadXlsx } from '../lib/exports.js';
import AppShell from '../components/AppShell.jsx';
import { useGridTable, DsPager, DsPageSize } from '../components/DataTable.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Reveal from '../components/Reveal.jsx';
import { CardsSkeleton } from '../components/Loaders.jsx';
import {
  MasteryBarChart, BloomRadarChart, TrendLineChart, DistBarChart, PassDoughnut,
  VolumeBarChart,
} from '../components/AnalyticsCharts.jsx';
import { BLOOM_LABELS, BLOOM_ORDER, PASS_MARK, buildInsights } from '../lib/insights.js';
import { fmtScanned, timeAgo } from '../lib/time.js';

/** Insight icon keys → Lucide components (lib stays framework-free). */
const INSIGHT_ICONS = { alert: AlertTriangle, check: CheckCircle, layers: Layers, up: TrendingUp, down: TrendingDown, info: AlertCircle };

/** Format a score with one decimal, e.g. 87.5%. */
function fmtPct1(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return null;
  return Number(v).toFixed(1);
}

/** Format a score with no decimals, e.g. 87%. */
function fmtPct0(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return null;
  return Math.round(Number(v));
}

/** Relative scan label with the absolute date kept in a title tooltip. */
function fmtScannedRel(iso) {
  return timeAgo(iso) || fmtScanned(iso);
}

/** Truncate a string to n chars with ellipsis (mirrors mb_strimwidth). */
function trimwd(s, n = 30) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '...' : s;
}

const BINS = Array.from({ length: 10 }, (_, i) => i * 10);
const STUDENTS_PER_PAGE = 25;
// Student rows arrive in API order — the table only paginates.
const STUDENT_PAGER_COLUMNS = [{ id: 'row', enableSorting: false }];

/** Narrative insight card — icon-tagged findings derived from the data. */
function InsightsCard({ insights, tour }) {
  if (!insights.length) return null;
  return (
    <div className="card mb-3" data-tour={tour}>
      <div className="card-header">
        <span className="card-title"><Lightbulb size={15} className="card-title-icon" /> Key insights</span>
      </div>
      <div className="insight-list">
        {insights.map((ins, i) => {
          const Icon = INSIGHT_ICONS[ins.icon] || AlertCircle;
          return (
            <div className="insight-row" key={i}>
              <span className={`insight-icon tone-${ins.tone}`}><Icon size={14} /></span>
              <p className="insight-text">{ins.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Horizontal mastery chart — one animated bar per topic. */
function MasteryCard({ title, rows, tour }) {
  return (
    <div className="card" data-tour={tour}>
      <div className="card-header">
        <span className="card-title">{title}</span>
        <span className="text-muted meta-sm">{rows.length} {rows.length === 1 ? 'group' : 'groups'} · % correct</span>
      </div>
      <div className="chart-scroll">
        <MasteryBarChart rows={rows} />
      </div>
    </div>
  );
}

/** Bloom radar card — the cognitive shape of the class. */
function BloomRadarCard({ blooms, tour }) {
  return (
    <div className="card" data-tour={tour}>
      <div className="card-header">
        <span className="card-title">By cognitive level</span>
        <span className="text-muted meta-sm">% correct per Bloom level</span>
      </div>
      <div className="card-body">
        <BloomRadarChart rows={blooms} order={BLOOM_ORDER} labels={BLOOM_LABELS} />
      </div>
    </div>
  );
}

/** Daily score trend — animated line, oldest → newest. */
function TrendCard({ trend, tour }) {
  return (
    <div className="card" data-tour={tour}>
      <div className="card-header">
        <span className="card-title">Score trend</span>
        <span className="text-muted meta-sm">class avg per scan day</span>
      </div>
      <div className="card-body">
        <TrendLineChart trend={trend} />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(() => api.peek('/analytics/overview') ?? null);

  const load = useCallback(() => {
    api.get('/analytics/overview')
      .then(setOverview)
      .catch((err) => toast.error(err.message || 'Could not load analytics.'));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // ── Loading ──────────────────────────────────────────
  if (!overview) {
    return (
      <AppShell pageClass="analytics" activeNav="analytics" pageTitle="Analytics" wide>
        <CardsSkeleton tiles={5} />
      </AppShell>
    );
  }

  // ── Index view ───────────────────────────────────────
  const o = overview.overview || {};
  const examAverages = overview.examAverages || [];
  const recentScans = overview.recentScans || [];
  const themes = overview.themes || [];
  const blooms = overview.bloomLevels || [];
  const trend = (overview.scoreTrend || []).slice().reverse(); // oldest → newest
  const weakItems = overview.weakItems || [];
  const themeRows = themes.map((t) => ({ ...t, name: t.topic }));
  const insights = buildInsights({
    themes, bloomLevels: blooms, trend,
    pendingReviews: o.needs_review,
  });

  // ── Report exports (print / CSV / Excel) ──
  const bloomRows = blooms.map((b) => ({ ...b, label: BLOOM_LABELS[b.bloom] || b.bloom }));
  const summaryRows = [
    ['Exams', parseInt(o.total_exams || 0, 10)],
    ['Scanned sheets', parseInt(o.total_scans || 0, 10)],
    ['Students', parseInt(o.total_students || 0, 10)],
    ['Sheets needing review', parseInt(o.needs_review || 0, 10)],
  ];
  const examAvgRows = examAverages.map((ea) => [
    ea.title, ea.subject || '—', parseInt(ea.scan_count || 0, 10),
    ea.avg_score !== null ? `${Number(ea.avg_score).toFixed(1)}%` : '—',
    ea.min_score !== null ? `${Math.round(Number(ea.min_score))}%` : '—',
    ea.max_score !== null ? `${Math.round(Number(ea.max_score))}%` : '—',
  ]);
  const themeExportRows = themes.map((t) => [t.topic, parseInt(t.items || 0, 10), parseInt(t.responses || 0, 10), `${t.correctRate}%`]);
  const bloomExportRows = bloomRows.map((b) => [b.label, parseInt(b.items || 0, 10), parseInt(b.responses || 0, 10), `${b.correctRate}%`]);
  const trendExportRows = trend.map((t) => [t.day, parseInt(t.scans || 0, 10), `${Number(t.avg_score || 0).toFixed(1)}%`]);
  const weakExportRows = weakItems.map((w) => [w.stem, w.exam_title, parseInt(w.responses || 0, 10), `${w.correctRate}%`]);
  const scanExportRows = recentScans.map((rs) => [rs.student_name || 'Unknown', rs.exam_title, `${Number(rs.score || 0).toFixed(1)}%`, fmtScanned(rs.scanned_at)]);

  function exportCsv() {
    const lines = [
      ['nexam — Results & insights report'],
      ['Generated', new Date().toLocaleString()],
      [],
      ['Summary', 'Metric', 'Value'],
      ...summaryRows.map(([m, v]) => ['', m, v]),
      [],
      ['Exam averages', 'Exam', 'Subject', 'Scans', 'Average', 'Lowest', 'Highest'],
      ...examAvgRows.map((r) => ['', ...r]),
      [],
      ['Mastery by topic', 'Topic', 'Items', 'Responses', 'Correct %'],
      ...themeExportRows.map((r) => ['', ...r]),
      [],
      ['By cognitive level', 'Level', 'Items', 'Responses', 'Correct %'],
      ...bloomExportRows.map((r) => ['', ...r]),
      [],
      ['Score trend', 'Date', 'Scans', 'Average %'],
      ...trendExportRows.map((r) => ['', ...r]),
      [],
      ['Items needing attention', 'Question', 'Exam', 'Responses', 'Correct %'],
      ...weakExportRows.map((r) => ['', ...r]),
      [],
      ['Recent scans', 'Student', 'Exam', 'Score', 'Scanned'],
      ...scanExportRows.map((r) => ['', ...r]),
    ];
    const maxCols = Math.max(...lines.map((l) => l.length));
    downloadCsv('nexam-analytics-report', Array(maxCols).fill(''), lines.map((l) => [...l, ...Array(maxCols - l.length).fill('')]));
  }

  function exportXlsx() {
    downloadXlsx('nexam-analytics-report', [
      { title: 'Summary', headers: ['Metric', 'Value'], rows: summaryRows },
      { title: 'Exam averages', headers: ['Exam', 'Subject', 'Scans', 'Average', 'Lowest', 'Highest'], rows: examAvgRows },
      { title: 'Mastery by topic', headers: ['Topic', 'Items', 'Responses', 'Correct %'], rows: themeExportRows },
      { title: 'Cognitive level', headers: ['Level', 'Items', 'Responses', 'Correct %'], rows: bloomExportRows },
      { title: 'Score trend', headers: ['Date', 'Scans', 'Average %'], rows: trendExportRows },
      { title: 'Needs attention', headers: ['Question', 'Exam', 'Responses', 'Correct %'], rows: weakExportRows },
      { title: 'Recent scans', headers: ['Student', 'Exam', 'Score', 'Scanned'], rows: scanExportRows },
    ]);
  }

  return (
    <AppShell pageClass="analytics" activeNav="analytics" pageTitle="Results & insights" wide>
      <div className="page-header print-skip">
        <div>
          <span className="eyebrow">Results &amp; insights</span>
          <h1>Analytics</h1>
          <p className="page-sub">Performance insights from scanned OMR answer sheets.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => window.print()} title="Print this analytics report">
            <Printer size={16} /> Print
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={exportCsv} title="Download all sections as CSV">
            <FileDown size={16} /> CSV
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={exportXlsx} title="Download a multi-sheet Excel workbook">
            <FileSpreadsheet size={16} /> Excel
          </button>
          <Link to="/analytics/ai-eval" className="btn btn-outline btn-sm" data-tour="analytics-ai" title="View AI accuracy, precision, recall, and Bloom-level classification metrics">
            <Sparkles size={16} /> AI Evaluation Metrics
          </Link>
        </div>
      </div>

      {/* ── Print document: a real report, not flattened app cards ── */}
      <div className="print-doc print-only">
        <div className="print-doc-head">
          <div className="pd-org">nexam — Results &amp; insights</div>
          <div className="pd-title">Class Performance Report</div>
          <div className="pd-meta">Generated {new Date().toLocaleString()} · {parseInt(o.total_scans || 0, 10)} scanned sheets across {parseInt(o.total_exams || 0, 10)} exams</div>
        </div>

        <div className="report-section-title">Summary</div>
        <table className="report-table">
          <tbody>
            {summaryRows.map(([m, v]) => <tr key={m}><th>{m}</th><td>{v}</td></tr>)}
          </tbody>
        </table>

        {insights.length > 0 && (
          <>
            <div className="report-section-title">Key insights</div>
            <ul className="report-list">
              {insights.map((ins, i) => <li key={i}>{ins.text}</li>)}
            </ul>
          </>
        )}

        {examAvgRows.length > 0 && (
          <>
            <div className="report-section-title">Exam averages</div>
            <table className="report-table">
              <thead><tr><th>Exam</th><th>Subject</th><th>Scans</th><th>Average</th><th>Lowest</th><th>Highest</th></tr></thead>
              <tbody>{examAvgRows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </>
        )}

        {themeExportRows.length > 0 && (
          <>
            <div className="report-section-title">Mastery by topic</div>
            <table className="report-table">
              <thead><tr><th>Topic</th><th>Items</th><th>Responses</th><th>Correct %</th></tr></thead>
              <tbody>{themeExportRows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </>
        )}

        {bloomExportRows.length > 0 && (
          <>
            <div className="report-section-title">Performance by cognitive level</div>
            <table className="report-table">
              <thead><tr><th>Level</th><th>Items</th><th>Responses</th><th>Correct %</th></tr></thead>
              <tbody>{bloomExportRows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </>
        )}

        {trendExportRows.length > 0 && (
          <>
            <div className="report-section-title">Score trend</div>
            <table className="report-table">
              <thead><tr><th>Date</th><th>Scans</th><th>Average %</th></tr></thead>
              <tbody>{trendExportRows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </>
        )}

        {weakExportRows.length > 0 && (
          <>
            <div className="report-section-title">Items needing attention</div>
            <table className="report-table">
              <thead><tr><th>Question</th><th>Exam</th><th>Responses</th><th>Correct %</th></tr></thead>
              <tbody>{weakExportRows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </>
        )}

        {scanExportRows.length > 0 && (
          <>
            <div className="report-section-title">Recent scans</div>
            <table className="report-table">
              <thead><tr><th>Student</th><th>Exam</th><th>Score</th><th>Scanned</th></tr></thead>
              <tbody>{scanExportRows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </>
        )}

        <div className="print-doc-foot">
          <span>nexam — Results &amp; insights</span>
          <span>Class Performance Report</span>
        </div>
      </div>

      {/* ── Interactive UI (hidden on paper) ── */}
      <div className="dash-kpis mb-3 print-skip" data-tour="analytics-stats">
        <KpiCard i={0} icon={FileText} tint={2} value={parseInt(o.total_exams || 0, 10)} label="Exams" />
        <KpiCard i={1} icon={ScanLine} tint={3} value={parseInt(o.total_scans || 0, 10)}
          label="Scanned Sheets"
          hint={`across ${parseInt(o.total_exams || 0, 10)} ${parseInt(o.total_exams || 0, 10) === 1 ? 'exam' : 'exams'}`}
          spark={trend.map((t) => parseInt(t.scans || 0, 10))}
          sparkColor="var(--gc-3)" />
        <KpiCard i={2} icon={Users} tint={1} value={parseInt(o.total_students || 0, 10)} label="Students" />
        <KpiCard i={3} icon={AlertCircle} tint={4} value={parseInt(o.needs_review || 0, 10)}
          label="Need Review"
          hint={parseInt(o.total_scans || 0, 10) > 0 ? `${Math.round((parseInt(o.needs_review || 0, 10) / parseInt(o.total_scans, 10)) * 100)}% of scans flagged` : 'no scans yet'} />
        {trend.length > 0 && (() => {
          const latest = trend[trend.length - 1];
          const prev = trend.length > 1 ? trend[trend.length - 2] : null;
          const avg = Number(latest.avg_score || 0);
          const diff = prev ? avg - Number(prev.avg_score || 0) : null;
          return (
            <KpiCard i={4} icon={TrendingUp} tint={6} value={avg} decimals={1} suffix="%"
              label="Class Average"
              hint={latest.day ? `latest scan day ${new Date(latest.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : undefined}
              delta={diff !== null && Math.abs(diff) >= 0.05 ? {
                cls: diff >= 0 ? 'is-up' : 'is-down',
                icon: diff >= 0 ? 'up' : 'down',
                text: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} pts`,
                title: 'vs the previous scan day',
              } : undefined}
              spark={trend.map((t) => Number(t.avg_score || 0))}
              sparkColor="var(--gc-6)"
              cumulative={false} />
          );
        })()}
      </div>

      <Reveal className="print-skip"><InsightsCard insights={insights} tour="analytics-insights" /></Reveal>

      {(themeRows.length > 0 || blooms.length > 0) && (
        <Reveal className="detail-grid-2 mb-3 print-skip" delay={0.05}>
          {themeRows.length > 0 && (
            <MasteryCard title="Mastery by topic" rows={themeRows} tour="analytics-topics" />
          )}
          {blooms.length > 0 && (
            <BloomRadarCard blooms={blooms} tour="analytics-bloom" />
          )}
        </Reveal>
      )}

      {trend.length > 0 && (
        <Reveal className="detail-grid-2 mb-3 print-skip">
          <TrendCard trend={trend} tour="analytics-trend" />
          <div className="card" data-tour="analytics-volume">
            <div className="card-header">
              <span className="card-title">Scan volume</span>
              <span className="text-muted meta-sm">sheets per day</span>
            </div>
            <div className="card-body">
              <VolumeBarChart trend={trend} />
            </div>
          </div>
        </Reveal>
      )}

      <Reveal className="detail-grid-2 mb-3 print-skip" delay={0.05}>
        {/* Exam Averages */}
        <div className="card" data-tour="analytics-averages">
          <div className="card-header">
            <span className="card-title">Exam Averages</span>
          </div>
          {examAverages.length === 0 ? (
            <div className="empty-state empty-state-md"><EmptyStateArt size={88} art="scan" /><p>No scan data yet.</p></div>
          ) : (
            <div className="table-wrap table-bare">
              <table className="data-table">
                <thead>
                  <tr><th>Exam</th><th>Scans</th><th>Average</th><th>Range</th></tr>
                </thead>
                <tbody>
                  {examAverages.map((ea) => {
                    if (!ea.avg_score && !ea.scan_count) return null;
                    const avg = ea.avg_score !== null ? Number(ea.avg_score) : null;
                    return (
                      <tr key={ea.id}>
                        <td>
                          <button type="button" className="cell-title" onClick={() => navigate(`/analytics/exam/${encodeURIComponent(ea.id)}`)}>
                            {ea.title}
                          </button>
                          {ea.subject && <div className="text-muted meta-sm">{ea.subject}</div>}
                        </td>
                        <td className="text-muted">{parseInt(ea.scan_count || 0, 10)}</td>
                        <td>
                          {avg !== null ? (
                            <span className={`badge badge-${avg >= 75 ? 'green' : 'amber'}`}>
                              {avg.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="text-muted meta-sm">
                          {ea.min_score !== null
                            ? `${Math.round(Number(ea.min_score))}–${Math.round(Number(ea.max_score))}%`
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Scans */}
        <div className="card" data-tour="analytics-scans">
          <div className="card-header">
            <span className="card-title">Recent Scans</span>
          </div>
          {recentScans.length === 0 ? (
            <div className="empty-state empty-state-md"><EmptyStateArt size={88} art="scan" /><p>No scans yet. Use the mobile app to scan OMR sheets.</p></div>
          ) : (
            <div className="table-wrap table-bare">
              <table className="data-table">
                <thead>
                  <tr><th>Student</th><th>Exam</th><th>Score</th><th>Scanned</th></tr>
                </thead>
                <tbody>
                  {recentScans.map((rs) => {
                    const score = Number(rs.score || 0);
                    return (
                      <tr key={rs.id}>
                        <td><strong>{rs.student_name || 'Unknown'}</strong></td>
                        <td className="text-muted">{trimwd(rs.exam_title, 30)}</td>
                        <td>
                          <span className={`badge badge-${score >= 75 ? 'green' : 'amber'}`}>
                            {score.toFixed(1)}%
                          </span>
                        </td>
                        <td className="text-muted meta-sm" title={fmtScanned(rs.scanned_at)}>{fmtScannedRel(rs.scanned_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Reveal>
    </AppShell>
  );
}

/**
 * ExamDetail — the exam-level analytics view (score distribution + student scores).
 * Exam-level result summary.
 */
export function ExamDetail({ examId, detail, onBack }) {
  const grid = useGridTable({ data: detail?.students || [], columns: STUDENT_PAGER_COLUMNS, pageSize: STUDENTS_PER_PAGE });
  if (!detail) {
    return <CardsSkeleton tiles={4} />;
  }

  const { exam, stats, distribution, students, setComparison, themes, bloomLevels } = detail;
  const s = stats || {};
  const dist = distribution || [];
  const studs = students || [];
  const { pageRows: pageStuds } = grid;
  const themeRows = (themes || []).map((t) => ({ ...t, name: t.topic }));
  const blooms = bloomLevels || [];
  const insights = buildInsights({
    themes, bloomLevels, stats: s,
    setComparison: setComparison || [],
    pendingReviews: s.needs_review_count,
  });

  // Build the 10-bin distribution map (0-9, 10-19, ... 90-99)
  const distMap = {};
  for (const d of dist) distMap[parseInt(d.bin_start, 10)] = parseInt(d.count, 10);

  // ── Report exports (print / CSV / Excel) ──
  const examTitle = exam?.title || 'Exam';
  const summaryRows = [
    ['Students scanned', parseInt(s.total_scans || 0, 10)],
    ['Class average', `${fmtPct1(s.avg_score ?? 0)}%`],
    ['Lowest score', `${fmtPct0(s.min_score ?? 0)}%`],
    ['Highest score', `${fmtPct0(s.max_score ?? 0)}%`],
    [`Passed (≥${PASS_MARK}%)`, `${parseInt(s.passing_count || 0, 10)} of ${parseInt(s.total_scans || 0, 10)}`],
    ['Sheets needing review', parseInt(s.needs_review_count || 0, 10)],
  ];
  const studentRows = studs.map((st, i) => [
    i + 1, st.student_name || 'Unknown', st.set_label || '—',
    `${Number(st.score || 0).toFixed(1)}%`,
    `${parseInt(st.correct_count || 0, 10)} / ${parseInt(st.total_items || 0, 10)}`,
    st.needs_review ? 'Needs review' : 'Reviewed',
    fmtScanned(st.scanned_at),
  ]);
  const themeExportRows = (themes || []).map((t) => [t.topic, parseInt(t.items || 0, 10), parseInt(t.responses || 0, 10), `${t.correctRate}%`]);
  const bloomExportRows = blooms.map((b) => [BLOOM_LABELS[b.bloom] || b.bloom, parseInt(b.items || 0, 10), parseInt(b.responses || 0, 10), `${b.correctRate}%`]);
  const setRows = (setComparison || []).map((sc) => [sc.set_label, parseInt(sc.scans || 0, 10), `${Number(sc.avg_score || 0).toFixed(1)}%`]);
  const distRows = BINS.map((b) => [`${b}–${b + 9}%`, parseInt(distMap[b] || 0, 10)]);

  function exportCsv() {
    const lines = [
      [`nexam — ${examTitle} — analytics report`],
      ['Generated', new Date().toLocaleString()],
      [],
      ['Summary', 'Metric', 'Value'],
      ...summaryRows.map(([m, v]) => ['', m, v]),
      [],
      ['Student scores', '#', 'Student', 'Set', 'Score', 'Correct', 'Status', 'Scanned'],
      ...studentRows.map((r) => ['', ...r]),
      [],
      ['Mastery by topic', 'Topic', 'Items', 'Responses', 'Correct %'],
      ...themeExportRows.map((r) => ['', ...r]),
      [],
      ['By cognitive level', 'Level', 'Items', 'Responses', 'Correct %'],
      ...bloomExportRows.map((r) => ['', ...r]),
      [],
      ['Set comparison', 'Set', 'Scans', 'Average %'],
      ...setRows.map((r) => ['', ...r]),
      [],
      ['Score distribution', 'Range', 'Students'],
      ...distRows.map((r) => ['', ...r]),
    ];
    const maxCols = Math.max(...lines.map((l) => l.length));
    downloadCsv(`nexam-${examTitle.replace(/\W+/g, '-').toLowerCase()}-report`, Array(maxCols).fill(''), lines.map((l) => [...l, ...Array(maxCols - l.length).fill('')]));
  }

  function exportXlsx() {
    downloadXlsx(`nexam-${examTitle.replace(/\W+/g, '-').toLowerCase()}-report`, [
      { title: 'Summary', headers: ['Metric', 'Value'], rows: summaryRows },
      { title: 'Student scores', headers: ['#', 'Student', 'Set', 'Score', 'Correct', 'Status', 'Scanned'], rows: studentRows },
      { title: 'Mastery by topic', headers: ['Topic', 'Items', 'Responses', 'Correct %'], rows: themeExportRows },
      { title: 'Cognitive level', headers: ['Level', 'Items', 'Responses', 'Correct %'], rows: bloomExportRows },
      { title: 'Set comparison', headers: ['Set', 'Scans', 'Average %'], rows: setRows },
      { title: 'Distribution', headers: ['Range', 'Students'], rows: distRows },
    ]);
  }

  return (
    <>
      <div className="page-header print-skip">
        <div>
          <span className="eyebrow">Results &amp; insights</span>
          <h1>{exam?.title || 'Exam Analytics'}</h1>
          <p className="page-sub">Class performance and score distribution.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => window.print()} title="Print this exam report">
            <Printer size={16} /> Print
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={exportCsv} title="Download all sections as CSV">
            <FileDown size={16} /> CSV
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={exportXlsx} title="Download a multi-sheet Excel workbook">
            <FileSpreadsheet size={16} /> Excel
          </button>
          <Link to={`/analytics/items/${encodeURIComponent(examId)}`} className="btn btn-outline btn-sm">
            <ListChecks size={16} /> Item Analysis
          </Link>
          <button type="button" className="btn btn-outline btn-sm" onClick={onBack}>
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </div>

      {/* ── Print document: a real report, not flattened app cards ── */}
      <div className="print-doc print-only">
        <div className="print-doc-head">
          <div className="pd-org">nexam — Results &amp; insights</div>
          <div className="pd-title">{examTitle} — Exam Report</div>
          <div className="pd-meta">Generated {new Date().toLocaleString()} · {parseInt(s.total_scans || 0, 10)} students · class average {fmtPct1(s.avg_score ?? 0)}%</div>
        </div>

        <div className="report-section-title">Summary</div>
        <table className="report-table">
          <tbody>
            {summaryRows.map(([m, v]) => <tr key={m}><th>{m}</th><td>{v}</td></tr>)}
          </tbody>
        </table>

        {insights.length > 0 && (
          <>
            <div className="report-section-title">Key insights</div>
            <ul className="report-list">
              {insights.map((ins, i) => <li key={i}>{ins.text}</li>)}
            </ul>
          </>
        )}

        {themeExportRows.length > 0 && (
          <>
            <div className="report-section-title">Mastery by topic</div>
            <table className="report-table">
              <thead><tr><th>Topic</th><th>Items</th><th>Responses</th><th>Correct %</th></tr></thead>
              <tbody>{themeExportRows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </>
        )}

        {bloomExportRows.length > 0 && (
          <>
            <div className="report-section-title">Performance by cognitive level</div>
            <table className="report-table">
              <thead><tr><th>Level</th><th>Items</th><th>Responses</th><th>Correct %</th></tr></thead>
              <tbody>{bloomExportRows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </>
        )}

        {setRows.length > 0 && (
          <>
            <div className="report-section-title">Set comparison</div>
            <table className="report-table">
              <thead><tr><th>Set</th><th>Scans</th><th>Average %</th></tr></thead>
              <tbody>{setRows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </>
        )}

        <div className="report-section-title">Score distribution</div>
        <table className="report-table">
          <thead><tr><th>Range</th><th>Students</th></tr></thead>
          <tbody>{distRows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table>

        {studentRows.length > 0 && (
          <>
            <div className="report-section-title">Student scores</div>
            <table className="report-table">
              <thead><tr><th>#</th><th>Student</th><th>Set</th><th>Score</th><th>Correct</th><th>Status</th><th>Scanned</th></tr></thead>
              <tbody>{studentRows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </>
        )}

        <div className="print-doc-foot">
          <span>nexam — Results &amp; insights</span>
          <span>{examTitle}</span>
        </div>
      </div>

      {/* ── Interactive UI (hidden on paper) ── */}
      <div className="dash-kpis mb-3 print-skip" data-tour="exam-stats">
        <KpiCard i={0} icon={Users} tint={1} value={parseInt(s.total_scans || 0, 10)} label="Students" />
        <KpiCard i={1} icon={TrendingUp} tint={3} value={Number(s.avg_score ?? 0)} decimals={1} suffix="%"
          label="Class Average"
          delta={s.avg_score != null ? {
            cls: Number(s.avg_score) >= PASS_MARK ? 'is-up' : 'is-down',
            icon: Number(s.avg_score) >= PASS_MARK ? 'up' : 'down',
            text: `${Number(s.avg_score) >= PASS_MARK ? '+' : ''}${(Number(s.avg_score) - PASS_MARK).toFixed(1)} pts`,
            title: `vs the ${PASS_MARK}% passing mark`,
          } : undefined}
          spark={studs.length > 1 ? studs.map((st) => Number(st.score || 0)) : undefined}
          sparkColor="var(--gc-3)"
          cumulative={false} />
        <KpiCard i={2} icon={TrendingDown} tint={5} value={Number(s.min_score ?? 0)} suffix="%" label="Lowest" />
        <KpiCard i={3} icon={TrendingUp} tint={6} value={Number(s.max_score ?? 0)} suffix="%" label="Highest" />
        <KpiCard i={4} icon={CheckCircle} tint={2}
          raw={<>{parseInt(s.passing_count || 0, 10)}<span style={{ opacity: .45, fontWeight: 500 }}>/{parseInt(s.total_scans || 0, 10)}</span></>}
          label={`Passed (≥${PASS_MARK}%)`}
          hint={parseInt(s.total_scans || 0, 10) > 0 ? `${Math.round((parseInt(s.passing_count || 0, 10) / parseInt(s.total_scans, 10)) * 100)}% pass rate` : undefined} />
      </div>

      <div className="print-skip"><InsightsCard insights={insights} tour="analytics-insights" /></div>

      {(themeRows.length > 0 || blooms.length > 0) && (
        <div className="detail-grid-2 mb-3 print-skip">
          {themeRows.length > 0 && <MasteryCard title="Mastery by topic" rows={themeRows} tour="analytics-topics" />}
          {blooms.length > 0 && <BloomRadarCard blooms={blooms} tour="analytics-bloom" />}
        </div>
      )}

      <div className="detail-grid-2 mb-3 print-skip">
        {/* Score Distribution */}
        <div className="card">
          <div className="card-header"><span className="card-title">Score Distribution</span></div>
          <div className="card-body">
            <DistBarChart distMap={distMap} bins={BINS} />
          </div>
        </div>

        {/* Pass rate */}
        <div className="card">
          <div className="card-header"><span className="card-title">Pass rate</span></div>
          <div className="card-body">
            <PassDoughnut
              passing={parseInt(s.passing_count || 0, 10)}
              failing={parseInt(s.failing_count || 0, 10)}
            />
          </div>
        </div>
      </div>

      {/* Student Scores */}
      <div className="card print-skip" data-tour="exam-students">
        <div className="card-header">
          <span className="card-title">Student Scores</span>
          <span className="text-muted meta-sm">{studs.length} students</span>
        </div>
        {studs.length === 0 ? (
          <div className="empty-state empty-state-md"><EmptyStateArt size={88} art="scan" /><p>No scans for this exam yet.</p></div>
        ) : (
          <div className="table-wrap no-print">
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Student</th><th>Set</th><th>Score</th><th>Correct</th><th>Status</th><th>Scanned</th></tr>
              </thead>
              <tbody>
                {pageStuds.map((st, i) => {
                  const score = Number(st.score || 0);
                  return (
                    <tr key={st.scan_id || i}>
                      <td className="text-muted">{grid.start + i}</td>
                      <td><strong>{st.student_name || 'Unknown'}</strong></td>
                      <td><span className="badge badge-gray">{st.set_label || '—'}</span></td>
                      <td>
                        <span className={`badge badge-${score >= 75 ? 'green' : 'amber'}`}>
                          {score.toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-muted">{parseInt(st.correct_count || 0, 10)} / {parseInt(st.total_items || 0, 10)}</td>
                      <td>
                        {st.needs_review ? (
                          <span className="g-state is-draft"><AlertCircle size={14} /> Needs Review</span>
                        ) : (
                          <span className="g-state is-live"><CheckCircle size={14} /> Reviewed</span>
                        )}
                      </td>
                      <td className="text-muted meta-sm" title={fmtScanned(st.scanned_at)}>{fmtScannedRel(st.scanned_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {studs.length > STUDENTS_PER_PAGE && (
          <div className="dataset-foot no-print">
            <div className="ds-foot-lead">
              <span className="text-muted meta-sm">
                {grid.start}–{grid.end} of {studs.length} students
              </span>
              <DsPageSize grid={grid} options={[25, 50, 100]} />
            </div>
            {grid.pageCount > 1 && <DsPager grid={grid} />}
          </div>
        )}
      </div>
    </>
  );
}
