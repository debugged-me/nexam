/**
 * DashboardPage — instructor home screen.
 *
 * Shows KPI cards (subjects, materials, questions, TOS, exams) with 30-day
 * deltas, a Bloom coverage bar, question-bank readiness, blueprint capacity,
 * a 180-day activity chart, and recent subjects + exams.
 *
 * Data comes from GET /api/dashboard.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpen, FileText, HelpCircle, ClipboardList, FileCheck,
  TrendingUp, TrendingDown, Minus, Plus,
} from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import AppShell from '../components/AppShell.jsx';
import api, { ApiError } from '../lib/api.js';
import '../styles/dashboard.css';

const BLOOM_LABELS = {
  remember: 'Remember', understand: 'Understand', apply: 'Apply',
  analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create',
};
const BLOOM_COLORS = ['var(--bloom-1)', 'var(--bloom-2)', 'var(--bloom-3)', 'var(--bloom-4)', 'var(--bloom-5)', 'var(--bloom-6)'];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard')
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          logout();
          navigate('/login');
          return;
        }
        setError(err.message || 'Could not load dashboard.');
      });
  }, [logout, navigate]);

  if (error) return <AppShell activeNav="dashboard" pageTitle="Dashboard"><p className="placeholder">{error}</p></AppShell>;
  if (!data) return <AppShell activeNav="dashboard" pageTitle="Dashboard"><p className="placeholder">Loading…</p></AppShell>;

  const totalBloom = Object.values(data.bloom).reduce((a, b) => a + b, 0);

  return (
    <AppShell activeNav="dashboard" pageTitle="Dashboard" wide>
      <div className="page-header">
        <div className="dash-greeting">
          <h1>{greeting()}, {user?.full_name?.split(' ')[0] || 'there'}.</h1>
          <p className="page-sub">Here's what's happening across your subjects.</p>
        </div>
        <div className="dash-date">
          {new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
      </div>
          {/* KPI cards */}
          <div className="kpi-grid">
            <KpiCard icon={BookOpen} label="Subjects" value={data.stats.subjects} delta={data.deltas.subjects} />
            <KpiCard icon={FileText} label="Materials" value={data.stats.materials} />
            <KpiCard icon={HelpCircle} label="Questions" value={data.stats.questions} delta={data.deltas.questions} />
            <KpiCard icon={ClipboardList} label="TOS" value={data.stats.tos} delta={data.deltas.tos} />
            <KpiCard icon={FileCheck} label="Exams" value={data.stats.exams} delta={data.deltas.exams} />
          </div>

          <div className="dash-cols">
            {/* Left: Bloom + activity */}
            <div className="dash-card">
              <h2>Bloom coverage</h2>
              {totalBloom === 0 ? (
                <p className="recent-empty">No questions yet. Generate some from your materials to see Bloom distribution.</p>
              ) : (
                <>
                  <div className="bloom-bar">
                    {Object.entries(data.bloom).map(([level, count], i) => {
                      if (count === 0) return null;
                      const pct = (count / totalBloom) * 100;
                      return (
                        <div key={level} className="bloom-seg" style={{ width: `${pct}%`, background: BLOOM_COLORS[i] }} title={`${BLOOM_LABELS[level]}: ${count}`}>
                          {pct > 8 ? count : ''}
                        </div>
                      );
                    })}
                  </div>
                  <div className="bloom-legend">
                    {Object.entries(data.bloom).map(([level, count], i) => (
                      <span key={level} className="bloom-legend-item">
                        <span className="bloom-dot" style={{ background: BLOOM_COLORS[i] }} />
                        {BLOOM_LABELS[level]} ({count})
                      </span>
                    ))}
                  </div>
                </>
              )}

              <h2 style={{ marginTop: 28 }}>Activity (last 180 days)</h2>
              <ActivityChart series={data.series} />
            </div>

            {/* Right: Bank readiness + blueprint */}
            <div className="dash-card">
              <h2>Question bank</h2>
              <div className="bank-row"><span className="label">Approved</span><span className="value">{data.bank.approved}</span></div>
              <div className="bank-row"><span className="label">Draft</span><span className="value">{data.bank.draft}</span></div>
              <div className="bank-row"><span className="label">Other</span><span className="value">{data.bank.other}</span></div>
              <div className="bank-row"><span className="label">Total</span><span className="value">{data.bank.total}</span></div>
              <div style={{ marginTop: 12 }}>
                <div className="bank-progress">
                  <div className="bank-progress-fill" style={{ width: `${data.bank.readyPct}%` }} />
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>
                  {data.bank.readyPct}% ready (approved)
                </div>
              </div>

              <h2 style={{ marginTop: 28 }}>Blueprint capacity</h2>
              <div className="bank-row"><span className="label">Planned items</span><span className="value">{data.blueprint.planned}</span></div>
              <div className="bank-row"><span className="label">On hand</span><span className="value">{data.blueprint.onHand}</span></div>
              <div style={{ marginTop: 12 }}>
                <div className="bank-progress">
                  <div className="bank-progress-fill" style={{ width: `${data.blueprint.fillPct}%`, background: 'var(--green-600)' }} />
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>
                  {data.blueprint.fillPct}% of planned items available
                </div>
              </div>
            </div>
          </div>

          {/* Recent subjects + exams */}
          <div className="dash-cols">
            <div className="dash-card">
              <h2>Recent subjects</h2>
              {data.recentSubjects.length === 0 ? (
                <p className="recent-empty">No subjects yet. <Link to="/subjects">Create your first subject →</Link></p>
              ) : (
                <ul className="recent-list">
                  {data.recentSubjects.map((s) => (
                    <li key={s.id} className="recent-item">
                      <div>
                        <div className="title">{s.code} — {s.title}</div>
                        <div className="meta">{new Date(s.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="count">{s.question_count}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="dash-card">
              <h2>Recent exams</h2>
              {data.recentExams.length === 0 ? (
                <p className="recent-empty">No exams yet.</p>
              ) : (
                <ul className="recent-list">
                  {data.recentExams.map((e) => (
                    <li key={e.id} className="recent-item">
                      <div>
                        <div className="title">{e.title}</div>
                        <div className="meta">{e.status} · {e.total_items} items · {new Date(e.created_at).toLocaleDateString()}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
    </AppShell>
  );
}

function KpiCard({ icon: Icon, label, value, delta }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {delta && (
        <div className={`kpi-delta is-${delta.dir}`}>
          {delta.dir === 'up' ? <TrendingUp size={13} /> : delta.dir === 'down' ? <TrendingDown size={13} /> : <Minus size={13} />}
          {delta.pct}% vs. prev. 30d
        </div>
      )}
    </div>
  );
}

function ActivityChart({ series }) {
  const maxQ = Math.max(1, ...series.map((d) => d.q + d.e));
  return (
    <>
      <div className="activity-chart">
        {series.map((d) => {
          const h = ((d.q + d.e) / maxQ) * 100;
          return (
            <div
              key={d.d}
              className={`activity-bar ${d.e > 0 ? 'has-exam' : ''}`}
              style={{ height: `${Math.max(h, d.q + d.e > 0 ? 4 : 0)}%` }}
              title={`${d.l}: ${d.q} questions, ${d.e} exams`}
            />
          );
        })}
      </div>
      <div className="activity-legend">
        <span className="activity-legend-item"><span className="activity-legend-dot" style={{ background: 'var(--action-100)' }} />Questions</span>
        <span className="activity-legend-item"><span className="activity-legend-dot" style={{ background: 'var(--action-600)' }} />Exams</span>
      </div>
    </>
  );
}

