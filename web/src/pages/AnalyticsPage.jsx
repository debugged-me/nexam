/**
 * AnalyticsPage — performance dashboard with exam overview, score
 * distributions, and student scores.
 *
 * Data comes from GET /api/analytics/overview. Exam-level detail is loaded
 * on demand when an exam is selected (GET /api/analytics/exam/:id).
 *
 * Mirrors the PHP CodeIgniter views (analytics/index.php + analytics/exam.php)
 * using the same class names so the ported app.css + analytics.css apply.
 */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, ScanLine, Users, AlertCircle, BarChart3,
  TrendingUp, TrendingDown, Sparkles, ListChecks, ArrowLeft,
  CheckCircle,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import api from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import '../styles/analytics.css';

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

/** Format a scanned_at timestamp like the PHP "M j, g:i A". */
function fmtScanned(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hr = d.getHours() % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${months[d.getMonth()]} ${d.getDate()}, ${hr}:${min} ${ampm}`;
}

/** Truncate a string to n chars with ellipsis (mirrors mb_strimwidth). */
function trimwd(s, n = 30) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '...' : s;
}

export default function AnalyticsPage() {
  const toast = useToast();
  const [overview, setOverview] = useState(null);
  const [examDetail, setExamDetail] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);

  const load = useCallback(() => {
    api.get('/analytics/overview')
      .then(setOverview)
      .catch((err) => toast.error(err.message || 'Could not load analytics.'));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function selectExam(examId) {
    setSelectedExam(examId);
    setExamDetail(null);
    try {
      const detail = await api.get(`/analytics/exam/${examId}`);
      setExamDetail(detail);
    } catch (err) {
      toast.error(err.message || 'Could not load exam analytics.');
    }
  }

  function backToOverview() {
    setSelectedExam(null);
    setExamDetail(null);
  }

  // ── Loading ──────────────────────────────────────────
  if (!overview) {
    return (
      <AppShell activeNav="analytics" pageTitle="Analytics" wide>
        <p className="placeholder">Loading…</p>
      </AppShell>
    );
  }

  // ── Exam detail view ─────────────────────────────────
  if (selectedExam) {
    return (
      <AppShell activeNav="analytics" pageTitle="Analytics" wide>
        <ExamDetail
          examId={selectedExam}
          detail={examDetail}
          onBack={backToOverview}
        />
      </AppShell>
    );
  }

  // ── Index view ───────────────────────────────────────
  const o = overview.overview || {};
  const examAverages = overview.examAverages || [];
  const recentScans = overview.recentScans || [];

  return (
    <AppShell activeNav="analytics" pageTitle="Results & insights" wide>
      <div className="page-header">
        <div>
          <h1>Analytics</h1>
          <p className="page-sub">Performance insights from scanned OMR answer sheets.</p>
        </div>
        <div className="header-actions">
          <Link to="/analytics/ai-eval" className="btn btn-outline btn-sm" title="View AI accuracy, precision, recall, and Bloom-level classification metrics">
            <Sparkles size={16} /> AI Evaluation Metrics
          </Link>
        </div>
      </div>

      <div className="stats-grid mb-3">
        <div className="stat-card">
          <div className="stat-icon blue"><FileText size={18} /></div>
          <div className="stat-info"><div className="stat-value">{parseInt(o.total_exams || 0, 10)}</div><div className="stat-label">Exams</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><ScanLine size={18} /></div>
          <div className="stat-info"><div className="stat-value">{parseInt(o.total_scans || 0, 10)}</div><div className="stat-label">Scanned Sheets</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><Users size={18} /></div>
          <div className="stat-info"><div className="stat-value">{parseInt(o.total_students || 0, 10)}</div><div className="stat-label">Students</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><AlertCircle size={18} /></div>
          <div className="stat-info"><div className="stat-value">{parseInt(o.needs_review || 0, 10)}</div><div className="stat-label">Need Review</div></div>
        </div>
      </div>

      <div className="detail-grid-2 mb-3">
        {/* Exam Averages */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Exam Averages</span>
          </div>
          {examAverages.length === 0 ? (
            <div className="empty-state empty-state-md"><BarChart3 aria-hidden="true" /><p>No scan data yet.</p></div>
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
                          <button type="button" className="cell-title" onClick={() => selectExam(ea.id)}>
                            {ea.title}
                          </button>
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
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Scans</span>
          </div>
          {recentScans.length === 0 ? (
            <div className="empty-state empty-state-md"><ScanLine aria-hidden="true" /><p>No scans yet. Use the mobile app to scan OMR sheets.</p></div>
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
                        <td className="cell-primary">{rs.student_name || 'Unknown'}</td>
                        <td className="text-muted">{trimwd(rs.exam_title, 30)}</td>
                        <td>
                          <span className={`badge badge-${score >= 75 ? 'green' : 'amber'}`}>
                            {score.toFixed(1)}%
                          </span>
                        </td>
                        <td className="text-muted meta-sm">{fmtScanned(rs.scanned_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

/**
 * ExamDetail — the exam-level analytics view (score distribution + student scores).
 * Mirrors application/views/analytics/exam.php.
 */
function ExamDetail({ examId, detail, onBack }) {
  if (!detail) {
    return <p className="placeholder">Loading exam analytics…</p>;
  }

  const { exam, stats, distribution, students } = detail;
  const s = stats || {};
  const dist = distribution || [];
  const studs = students || [];

  // Build the 10-bin distribution map (0-9, 10-19, ... 90-99)
  const distMap = {};
  for (const d of dist) distMap[parseInt(d.bin_start, 10)] = parseInt(d.count, 10);
  const maxCount = Math.max(1, dist.length ? Math.max(...dist.map((d) => Number(d.count))) : 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{exam?.title || 'Exam Analytics'}</h1>
          <p className="page-sub">Class performance and score distribution.</p>
        </div>
        <div className="header-actions">
          <Link to={`/analytics/items/${encodeURIComponent(examId)}`} className="btn btn-outline btn-sm">
            <ListChecks size={16} /> Item Analysis
          </Link>
          <button type="button" className="btn btn-outline btn-sm" onClick={onBack}>
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </div>

      <div className="stats-grid mb-3">
        <div className="stat-card">
          <div className="stat-icon blue"><Users size={18} /></div>
          <div className="stat-info"><div className="stat-value">{parseInt(s.total_scans || 0, 10)}</div><div className="stat-label">Students</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><TrendingUp size={18} /></div>
          <div className="stat-info"><div className="stat-value">{fmtPct1(s.avg_score ?? 0)}%</div><div className="stat-label">Class Average</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><TrendingDown size={18} /></div>
          <div className="stat-info"><div className="stat-value">{fmtPct0(s.min_score ?? 0)}%</div><div className="stat-label">Lowest</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><TrendingUp size={18} /></div>
          <div className="stat-info"><div className="stat-value">{fmtPct0(s.max_score ?? 0)}%</div><div className="stat-label">Highest</div></div>
        </div>
      </div>

      {/* Score Distribution */}
      <div className="card mb-3">
        <div className="card-header"><span className="card-title">Score Distribution</span></div>
        <div className="card-body">
          <div className="score-distribution">
            {Array.from({ length: 10 }, (_, i) => {
              const binStart = i * 10;
              const count = distMap[binStart] || 0;
              const heightPct = (count / maxCount) * 100;
              return (
                <div className="dist-bar" key={binStart}>
                  <div className="dist-bar-count">{count}</div>
                  <div className="dist-bar-track">
                    <div className="dist-bar-fill" style={{ height: `${heightPct}%` }} />
                  </div>
                  <div className="dist-bar-label">{binStart}-{binStart + 9}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Student Scores */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Student Scores</span>
          <span className="text-muted meta-sm">{studs.length} students</span>
        </div>
        {studs.length === 0 ? (
          <div className="empty-state empty-state-md"><ScanLine aria-hidden="true" /><p>No scans for this exam yet.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Student</th><th>Set</th><th>Score</th><th>Correct</th><th>Status</th><th>Scanned</th></tr>
              </thead>
              <tbody>
                {studs.map((st, i) => {
                  const score = Number(st.score || 0);
                  return (
                    <tr key={st.scan_id || i}>
                      <td className="text-muted">{i + 1}</td>
                      <td className="cell-primary">{st.student_name || 'Unknown'}</td>
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
                      <td className="text-muted meta-sm">{fmtScanned(st.scanned_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
