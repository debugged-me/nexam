/**
 * DashboardPage — instructor home screen.
 * Mirrors application/views/dashboard/index.php from the PHP app.
 *
 * Data comes from GET /api/dashboard.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, HelpCircle, Table, FileText, Plus, FilePlus2,
  ArrowUpRight, TrendingUp, TrendingDown, Check,
  Upload, Sparkles,
} from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import AppShell from '../components/AppShell.jsx';
import api, { ApiError } from '../lib/api.js';
import '../styles/dashboard.css';

const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
const BLOOM_LABELS = {
  remember: 'Remember', understand: 'Understand', apply: 'Apply',
  analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard')
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          logout();
          return;
        }
        setError(err.message || 'Could not load dashboard.');
      });
  }, [logout]);

  if (error) return <AppShell activeNav="dashboard" pageTitle="Dashboard"><div className="page-content page-content--dashboard"><p className="text-muted">{error}</p></div></AppShell>;
  if (!data) return <AppShell activeNav="dashboard" pageTitle="Dashboard"><div className="page-content page-content--dashboard"><p className="text-muted">Loading…</p></div></AppShell>;

  const firstName = (user?.full_name || 'there').split(' ')[0];
  const stats = data.stats;
  const deltas = data.deltas;
  const bloom = data.bloom;
  const bloomUnclassified = data.bloomUnclassified || 0;
  const bloomCovered = data.bloomCovered || 0;
  const bloomTotal = Object.values(bloom).reduce((a, b) => a + b, 0) + bloomUnclassified;
  const bloomMax = Math.max(...Object.values(bloom), bloomUnclassified, 1);
  const bank = data.bank;
  const blueprint = data.blueprint;

  const kpis = [
    { key: 'subjects', label: 'Subjects', value: stats.subjects, icon: BookOpen, variant: 'info', url: '/subjects' },
    { key: 'questions', label: 'Questions', value: stats.questions, icon: HelpCircle, variant: 'success', url: '/questions' },
    { key: 'tos', label: 'Blueprints (TOS)', value: stats.tos, icon: Table, variant: 'warning', url: '/tos' },
    { key: 'exams', label: 'Exams', value: stats.exams, icon: FileText, variant: 'purple', url: '/exams' },
  ];

  // Getting Started checklist
  const showOnboarding = stats.exams === 0;
  const stepDone = {
    1: stats.subjects > 0,
    2: stats.materials > 0,
    3: stats.tos > 0,
    4: stats.questions > 0,
    5: stats.exams > 0,
  };
  const doneCount = Object.values(stepDone).filter(Boolean).length;

  const onboardingSteps = [
    { n: 1, title: 'Create a Subject', desc: 'Add the course you teach — it groups everything else.', url: '/subjects' },
    { n: 2, title: 'Upload a Syllabus', desc: 'Check "This is a syllabus" when uploading — the AI extracts topics and hours from it.', url: '/materials' },
    { n: 3, title: 'Generate a Blueprint (TOS)', desc: 'Click "Generate TOS" on a processed syllabus to auto-create a Table of Specification.', url: '/materials' },
    { n: 4, title: 'Generate Questions', desc: 'From a blueprint, click "Generate Questions" — AI drafts questions from your materials for review.', url: '/tos' },
    { n: 5, title: 'Build an Exam', desc: 'Create an exam from your approved question bank — generate PDFs, OMR sheets, and exports.', url: '/exams' },
  ];

  return (
    <AppShell activeNav="dashboard" pageTitle="Dashboard">
      <div className="page-content page-content--dashboard">

        <div className="page-header">
          <div>
            <h1>{greeting()}, {firstName}</h1>
            <p className="page-sub">
              {stats.questions === 0
                ? 'Start by adding a subject, then build out your question bank.'
                : `${Number(deltas.questions.current).toLocaleString()} question${deltas.questions.current == 1 ? '' : 's'} and ${Number(deltas.exams.current).toLocaleString()} exam${deltas.exams.current == 1 ? '' : 's'} created in the last 30 days.`}
            </p>
          </div>
          <div className="page-header-actions">
            <Link to="/questions" className="btn btn-outline"><Plus size={16} /> New Question</Link>
            <Link to="/exams" className="btn btn-primary"><FilePlus2 size={16} /> New Exam</Link>
          </div>
        </div>

        {showOnboarding && (
          <div className="card getting-started-card">
            <div className="card-header">
              <div>
                <span className="card-title">Getting Started</span>
                <div className="card-sub">{doneCount} of 5 steps complete — follow the path from upload to exam</div>
              </div>
              <span className="getting-started-progress">{doneCount}/5</span>
            </div>
            <div className="card-body">
              <div className="onboarding-steps">
                {onboardingSteps.map((step) => (
                  <Link key={step.n} to={step.url} className={`onboarding-step${stepDone[step.n] ? ' is-done' : ''}`}>
                    <span className="onboarding-num">{stepDone[step.n] ? <Check size={14} /> : step.n}</span>
                    <span className="onboarding-body">
                      <strong>{step.title}</strong>
                      <small>{step.desc}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* KPI cards */}
        <div className="kpi-grid">
          {kpis.map((kpi) => {
            const d = deltas[kpi.key];
            return (
              <Link key={kpi.key} to={kpi.url} className={`kpi-card kpi-card--${kpi.variant}`}>
                <div className="kpi-top">
                  <span className={`kpi-icon kpi-icon--${kpi.variant}`}><kpi.icon size={18} /></span>
                  <span className="kpi-open"><ArrowUpRight size={15} /></span>
                </div>
                <div className="kpi-num">{Number(kpi.value).toLocaleString()}</div>
                <div className="kpi-label">{kpi.label}</div>
                <div className="kpi-foot">
                  {d.dir === 'flat' ? (
                    <span className="delta flat">No change</span>
                  ) : (
                    <span className={`delta ${d.dir}`}>
                      {d.dir === 'down' ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                      {d.pct}%
                    </span>
                  )}
                  <span>vs. previous 30 days</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Activity + readiness */}
        <div className="dash-grid">
          <div className="card">
            <div className="card-header">
              <div>
                <span className="card-title">Content Activity</span>
                <div className="card-sub">Questions and exams you created over time</div>
              </div>
            </div>
            <div className="chart-summary">
              <span className="cs-value">{data.series.slice(-30).reduce((a, d) => a + d.q + d.e, 0)}</span>
              <span className="cs-note">items created</span>
            </div>
            <div className="chart-plot">
              <ActivityChart series={data.series.slice(-30)} />
            </div>
            <div className="card-footer">
              <div className="chart-legend">
                <span className="legend-item"><span className="legend-swatch"></span> Questions</span>
                <span className="legend-item"><span className="legend-swatch purple"></span> Exams</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <span className="card-title">Bank Readiness</span>
                <div className="card-sub">Share of questions active and ready for use</div>
              </div>
            </div>
            <div className="gauge-wrap">
              <div className="gauge" data-value={bank.readyPct}>
                <svg viewBox="0 0 200 120" role="img" aria-label={`${bank.readyPct} percent of questions active`}>
                  <path d="M18 108 A82 82 0 0 1 182 108" fill="none" stroke="#F1F5F9" strokeWidth="14" strokeLinecap="round" />
                  <path d="M18 108 A82 82 0 0 1 182 108" fill="none" stroke="#059669" strokeWidth="14" strokeLinecap="round"
                    strokeDasharray="258" strokeDashoffset={258 - (258 * bank.readyPct / 100)} />
                </svg>
                <div className="gauge-center">
                  <div className="gauge-value">{bank.readyPct}%</div>
                  <div className="gauge-caption">{Number(bank.approved).toLocaleString()} of {Number(bank.total).toLocaleString()} active</div>
                </div>
              </div>
              <div className="gauge-legend">
                <span className="gl"><i className="green"></i> Active <b>{Number(bank.approved).toLocaleString()}</b></span>
                <span className="gl"><i className="amber"></i> Draft <b>{Number(bank.draft).toLocaleString()}</b></span>
                {bank.other > 0 && <span className="gl"><i className="slate"></i> Other <b>{Number(bank.other).toLocaleString()}</b></span>}
              </div>
            </div>
            <div className="card-footer">
              <span className="text-muted gauge-foot-note">
                {Number(blueprint.planned) > 0
                  ? `Blueprints (TOS) call for ${Number(blueprint.planned).toLocaleString()} items — bank covers ${blueprint.fillPct}%`
                  : 'No blueprint targets set yet'}
              </span>
            </div>
          </div>
        </div>

        {/* Coverage + recent activity */}
        <div className="dash-grid-3">
          <div className="card">
            <div className="card-header">
              <div>
                <span className="card-title">Bloom Coverage</span>
                <div className="card-sub">{bloomCovered} of 6 levels represented</div>
              </div>
            </div>
            {bloomTotal === 0 ? (
              <div className="dash-empty">
                <div className="empty-icon"><Table size={24} /></div>
                <h4>Nothing classified yet</h4>
                <p>Tag questions with a Bloom level to see coverage here.</p>
                <Link to="/questions" className="btn btn-primary btn-sm"><Plus size={16} /> New Question</Link>
              </div>
            ) : (
              <div className="bloom-pyramid">
                {BLOOM_LEVELS.map((level, i) => {
                  const count = bloom[level] || 0;
                  const fillPct = bloomMax > 0 ? (count / bloomMax) * 100 : 0;
                  const pctOfTotal = bloomTotal > 0 ? Math.round(count / bloomTotal * 100) : 0;
                  const isEmpty = count === 0;
                  return (
                    <div key={level} className={`bloom-tier t${i + 1}${isEmpty ? ' empty' : ''}`}>
                      <span className="bloom-tier-label">{BLOOM_LABELS[level]}</span>
                      <div className="bloom-tier-track">
                        <div className="bloom-tier-bar" style={{ width: `${Math.max(fillPct, 6)}%` }}>
                          {Number(count).toLocaleString()}
                        </div>
                      </div>
                      <span className="bloom-tier-pct">{pctOfTotal}%</span>
                    </div>
                  );
                })}
                {bloomUnclassified > 0 && (
                  <div className="bloom-unclassified">
                    <span className="bloom-tier-label">Unclassified</span>
                    <div className="bloom-tier-track">
                      <div className="bloom-tier-bar" style={{ width: `${Math.max((bloomUnclassified / bloomMax) * 100, 6)}%` }}>
                        {Number(bloomUnclassified).toLocaleString()}
                      </div>
                    </div>
                    <span className="bloom-tier-pct">{bloomTotal > 0 ? Math.round(bloomUnclassified / bloomTotal * 100) : 0}%</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Subjects</span>
              <Link to="/subjects" className="btn btn-outline btn-sm">View All</Link>
            </div>
            {data.recentSubjects.length === 0 ? (
              <div className="dash-empty">
                <div className="empty-icon"><BookOpen size={24} /></div>
                <h4>No subjects yet</h4>
                <p>Subjects group your questions, blueprints and exams.</p>
                <Link to="/subjects" className="btn btn-primary btn-sm"><Plus size={16} /> New Subject</Link>
              </div>
            ) : (
              <div className="recent-list">
                {data.recentSubjects.map((s) => (
                  <Link key={s.id} to={`/subjects`} className="recent-row">
                    <span className="recent-tile">{(s.title || s.code || '??').toUpperCase().slice(0, 2)}</span>
                    <span className="recent-body">
                      <span className="recent-title">{s.title}</span>
                      <span className="recent-meta">
                        {s.code && <span className="chip-code">{s.code}</span>}
                        <span>{s.question_count} question{s.question_count === 1 ? '' : 's'}</span>
                      </span>
                    </span>
                    <span className="recent-go"><ArrowUpRight size={16} /></span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Exams</span>
              <Link to="/exams" className="btn btn-outline btn-sm">View All</Link>
            </div>
            {data.recentExams.length === 0 ? (
              <div className="dash-empty">
                <div className="empty-icon"><FileText size={24} /></div>
                <h4>No exams generated yet</h4>
                <p>Build a blueprint (TOS), generate questions, then create an exam from your bank.</p>
                <Link to="/exams" className="btn btn-primary btn-sm"><FilePlus2 size={16} /> New Exam</Link>
              </div>
            ) : (
              <div className="recent-list">
                {data.recentExams.map((e) => (
                  <Link key={e.id} to={`/exams/${e.id}`} className="recent-row">
                    <span className="recent-tile icon"><FileText size={16} /></span>
                    <span className="recent-body">
                      <span className="recent-title">{e.title}</span>
                      <span className="recent-meta">
                        <span>{e.total_items} item{e.total_items === 1 ? '' : 's'}</span>
                        <span className="sep">·</span>
                        <span>{new Date(e.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </span>
                    </span>
                    <span className={`badge badge-${e.status === 'published' ? 'green' : 'amber'}`}>{e.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </AppShell>
  );
}

function ActivityChart({ series }) {
  const maxQ = Math.max(1, ...series.map((d) => d.q + d.e));
  return (
    <div className="chart-bars">
      {series.map((d) => {
        const totalH = ((d.q + d.e) / maxQ) * 100;
        const qH = (d.q / maxQ) * 100;
        const eH = (d.e / maxQ) * 100;
        return (
          <div
            key={d.d}
            className="chart-bar"
            style={{ height: `${Math.max(totalH, d.q + d.e > 0 ? 4 : 0)}%` }}
            title={`${d.l}: ${d.q} questions, ${d.e} exams`}
          />
        );
      })}
    </div>
  );
}
