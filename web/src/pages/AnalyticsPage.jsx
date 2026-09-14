/**
 * AnalyticsPage — performance dashboard with exam overview, score
 * distributions, item analysis, and recent scans.
 *
 * Data comes from GET /api/analytics/overview. Exam-level detail is loaded
 * on demand when an exam is selected.
 */
import { useEffect, useState, useCallback } from 'react';
import { BarChart3, Users, FileCheck, AlertTriangle, TrendingUp } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import api from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import '../styles/analytics.css';

export default function AnalyticsPage() {
  const toast = useToast();
  const [overview, setOverview] = useState(null);
  const [examDetail, setExamDetail] = useState(null);
  const [itemAnalysis, setItemAnalysis] = useState(null);
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
    setItemAnalysis(null);
    try {
      const [detail, items] = await Promise.all([
        api.get(`/analytics/exam/${examId}`),
        api.get(`/analytics/exam/${examId}/items`),
      ]);
      setExamDetail(detail);
      setItemAnalysis(items);
    } catch (err) {
      toast.error(err.message || 'Could not load exam analytics.');
    }
  }

  if (!overview) return <AppShell activeNav="analytics" pageTitle="Analytics" wide><p className="placeholder">Loading…</p></AppShell>;
  const o = overview.overview;

  return (
    <AppShell activeNav="analytics" pageTitle="Analytics" wide>
      <div className="page-header">
            <h1>Analytics</h1>
          </div>
          {/* Overview KPIs */}
          <div className="analytics-grid">
            <div className="stat-card">
              <div className="stat-label">Total Exams</div>
              <div className="stat-value">{o.total_exams || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Scans</div>
              <div className="stat-value">{o.total_scans || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Students</div>
              <div className="stat-value">{o.total_students || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Needs Review</div>
              <div className="stat-value" style={{ color: o.needs_review > 0 ? 'var(--amber-600)' : 'var(--ink)' }}>
                {o.needs_review || 0}
              </div>
            </div>
          </div>

          <div className="analytics-cols">
            {/* Exam averages */}
            <div className="analytics-card">
              <h2>Exam averages</h2>
              {overview.examAverages.length === 0 ? (
                <p className="recent-empty">No scan data yet.</p>
              ) : (
                <table className="avg-table">
                  <thead><tr><th>Exam</th><th>Scans</th><th>Avg</th><th>Min</th><th>Max</th></tr></thead>
                  <tbody>
                    {overview.examAverages.map((e) => (
                      <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => selectExam(e.id)}>
                        <td>{e.title}</td>
                        <td>{e.scan_count}</td>
                        <td className="score">{e.avg_score ? `${Math.round(e.avg_score)}%` : '—'}</td>
                        <td>{e.min_score ? `${Math.round(e.min_score)}%` : '—'}</td>
                        <td>{e.max_score ? `${Math.round(e.max_score)}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Recent scans */}
            <div className="analytics-card">
              <h2>Recent scans</h2>
              {overview.recentScans.length === 0 ? (
                <p className="recent-empty">No scans yet.</p>
              ) : (
                <ul className="scan-list">
                  {overview.recentScans.map((s) => (
                    <li key={s.id} className="scan-item">
                      <div>
                        <div className="scan-name">{s.student_name || 'Unknown'}</div>
                        <div className="scan-meta">{s.exam_title} · {new Date(s.scanned_at).toLocaleDateString()}</div>
                      </div>
                      <span className={`scan-score ${s.score >= 75 ? 'pass' : 'fail'}`}>
                        {Math.round(s.score)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Exam detail (when selected) */}
          {selectedExam && examDetail && (
            <div className="analytics-cols">
              <div className="analytics-card">
                <h2>{examDetail.exam.title} — Score distribution</h2>
                {examDetail.distribution.length === 0 ? (
                  <p className="recent-empty">No scan data for this exam.</p>
                ) : (
                  <>
                    <div className="histogram">
                      {Array.from({ length: 10 }, (_, i) => {
                        const bin = i * 10;
                        const found = examDetail.distribution.find((d) => d.bin_start === bin);
                        const count = found?.count || 0;
                        const maxCount = Math.max(...examDetail.distribution.map((d) => d.count), 1);
                        const h = (count / maxCount) * 100;
                        return (
                          <div key={bin} className={`histogram-bar ${bin >= 70 ? 'passing' : ''}`}
                            style={{ height: `${Math.max(h, count > 0 ? 4 : 0)}%` }}
                            title={`${bin}-${bin + 9}: ${count} students`} />
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      {Array.from({ length: 10 }, (_, i) => (
                        <div key={i} className="histogram-label" style={{ flex: 1 }}>{i * 10}</div>
                      ))}
                    </div>
                    <div style={{ marginTop: 16, fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>
                      Avg: <strong>{examDetail.stats.avg_score ? Math.round(examDetail.stats.avg_score) : 0}%</strong>
                      {' · '}Passing: <strong>{examDetail.stats.passing_count || 0}</strong>
                      {' · '}Failing: <strong>{examDetail.stats.failing_count || 0}</strong>
                    </div>
                  </>
                )}
              </div>

              <div className="analytics-card">
                <h2>Item analysis</h2>
                {!itemAnalysis || itemAnalysis.items.length === 0 ? (
                  <p className="recent-empty">No item-level data.</p>
                ) : (
                  itemAnalysis.items.map((item) => (
                    <div key={item.itemNumber} className="item-row">
                      <span className="item-num">{item.itemNumber}</span>
                      <div className="item-bar">
                        <div className="item-bar-correct" style={{ width: `${item.correctRate}%` }} />
                      </div>
                      <span className="item-pct">{item.correctRate}%</span>
                      <span className={`difficulty-badge ${item.difficulty}`}>{item.difficulty}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
    </AppShell>
  );
}
