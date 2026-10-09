/** Instructor home: recent exams, question review, and subject shortcuts. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BookOpen, Check, ChevronRight, FileText,
  ListChecks, Plus, Sparkles, Upload,
} from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext.jsx';
import AppShell from '../components/AppShell.jsx';
import { PageLoader } from '../components/Loaders.jsx';
import { StatusPill, StatusSummary, statusOf, groupColor } from '../components/Board.jsx';
import api, { ApiError } from '../lib/api.js';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function count(value) {
  return Math.max(0, Number(value) || 0);
}

function formatDate(value) {
  if (!value) return 'No date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'No date' : date.toLocaleDateString('en', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}



export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(() => api.peek('/dashboard') ?? null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/dashboard')
      .then((result) => { if (active) setData(result); })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) {
          logout();
          return;
        }
        setError(err.message || 'Could not load your workspace.');
      });
    return () => { active = false; };
  }, [logout]);

  if (error) {
    return <AppShell activeNav="dashboard" pageTitle="Home"><div className="dash-message" role="alert">{error}</div></AppShell>;
  }
  if (!data) {
    return <AppShell activeNav="dashboard" pageTitle="Home" wide><PageLoader label="Loading your workspace…" /></AppShell>;
  }

  const stats = data.stats || {};
  const bank = data.bank || {};
  const firstName = (user?.full_name || 'there').trim().split(/\s+/)[0];
  const approved = count(bank.approved);
  const drafts = count(bank.draft);
  const rejected = count(bank.rejected);
  const total = count(bank.total);
  const readyPct = total ? Math.min(100, Math.round((approved / total) * 100)) : 0;
  const recentExams = (data.recentExams || []).slice(0, 5);
  const recentSubjects = (data.recentSubjects || []).slice(0, 4);
  const plural = (n, one, many) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

  // The product pipeline as a checklist — the first incomplete step is what
  // to do next, so nobody has to guess where to start or what "select".
  const guideSteps = [
    { label: 'Create a subject', hint: 'A workspace for each course you teach', to: '/subjects?new=1', done: count(stats.subjects) > 0 },
    { label: 'Upload materials', hint: 'Syllabus or references the AI reads from', to: '/materials?upload=1', done: count(stats.materials) > 0 },
    { label: 'Create a blueprint', hint: 'The topic × Bloom plan your exam follows', to: '/tos', done: count(stats.tos) > 0 },
    { label: 'Generate questions', hint: 'AI drafts built from your materials', to: '/wizard', done: count(stats.questions) > 0 },
    { label: 'Review & approve', hint: 'Approve drafts so they can enter exams', to: '/questions/review', done: approved > 0 || (total > 0 && drafts === 0) },
    { label: 'Build your exam', hint: 'Assemble sets, print papers and OMR sheets', to: '/exams/new', done: count(stats.exams) > 0 },
  ];
  const guideDone = guideSteps.every((s) => s.done);
  const nextStep = guideSteps.find((s) => !s.done);

  return (
    <AppShell activeNav="dashboard" pageTitle="Home" wide>
      <div className="dash-home">
        <header className="dash-heading">
          <div>
            <span className="eyebrow">{greeting()}, {firstName}</span>
            <h1>Workspace</h1>
            <p className="dash-meta">
              <Link to="/exams">{plural(count(stats.exams), 'exam', 'exams')}</Link>
              <span aria-hidden="true"> · </span>
              <Link to="/questions">{plural(total, 'question', 'questions')}</Link>
              <span aria-hidden="true"> · </span>
              <Link to="/subjects">{plural(count(stats.subjects), 'subject', 'subjects')}</Link>
              <span aria-hidden="true"> · </span>
              <Link to="/tos">{plural(count(stats.tos), 'blueprint', 'blueprints')}</Link>
            </p>
          </div>
          <div className="dash-actions">
            <Link to="/questions?new=1" className="btn btn-outline"><Plus size={15} aria-hidden="true" /> Question</Link>
            <Link to="/materials?upload=1" className="btn btn-outline"><Upload size={15} aria-hidden="true" /> Material</Link>
            <Link to="/wizard" className="btn btn-brand"><Sparkles size={15} aria-hidden="true" /> Build an exam</Link>
          </div>
        </header>

        {/* Guided path — only while the pipeline isn't fully set up yet. */}
        {!guideDone && (
          <section className="dash-panel dash-guide" aria-labelledby="dash-guide-title">
            <header className="dash-panel-head">
              <div>
                <h2 id="dash-guide-title">How nexam works</h2>
                <p>Follow these steps in order — materials in, exam out.</p>
              </div>
            </header>
            <ol className="dash-steps">
              {guideSteps.map((step, i) => {
                const isNext = step === nextStep;
                return (
                  <li key={step.label}>
                    <Link
                      to={step.to}
                      className={`dash-step ${step.done ? 'is-done' : ''} ${isNext ? 'is-next' : ''}`}
                    >
                      <span className="dash-step-num" aria-hidden="true">
                        {step.done ? <Check size={13} /> : i + 1}
                      </span>
                      <span className="dash-step-main">
                        <strong>{step.label}</strong>
                        <small>{step.hint}</small>
                      </span>
                      {isNext
                        ? <span className="dash-step-cta">Do this next <ArrowRight size={13} aria-hidden="true" /></span>
                        : <ChevronRight size={15} className="dash-step-arrow" aria-hidden="true" />}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* The job-to-be-done, first: drafts move through review into the approved bank. */}
        <section className="dash-pipeline" aria-label="Question pipeline">
          <ol className="dash-pipe">
            <li className="dash-pipe-stage is-draft">
              <Link to="/questions?status=draft">
                <span className="dash-pipe-num">{drafts.toLocaleString()}</span>
                <span className="dash-pipe-label">Drafts</span>
                <span className="dash-pipe-sub">awaiting review</span>
              </Link>
            </li>
            <li className="dash-pipe-arrow" aria-hidden="true"><ArrowRight size={16} /></li>
            <li className="dash-pipe-stage is-active">
              <Link to="/questions?status=active">
                <span className="dash-pipe-num">{approved.toLocaleString()}</span>
                <span className="dash-pipe-label">Active</span>
                <span className="dash-pipe-sub">{readyPct}% of bank ready</span>
              </Link>
            </li>
            <li className="dash-pipe-arrow" aria-hidden="true"><ArrowRight size={16} /></li>
            <li className="dash-pipe-stage is-rejected">
              <Link to="/questions?status=rejected">
                <span className="dash-pipe-num">{rejected.toLocaleString()}</span>
                <span className="dash-pipe-label">Rejected</span>
                <span className="dash-pipe-sub">kept for audit</span>
              </Link>
            </li>
          </ol>
          {drafts > 0
            ? <Link to="/questions/review" className="btn btn-brand dash-pipe-cta"><ListChecks size={16} aria-hidden="true" /> Review {plural(drafts, 'draft', 'drafts')} <ArrowRight size={15} aria-hidden="true" /></Link>
            : <Link to="/wizard" className="btn btn-outline dash-pipe-cta"><Sparkles size={16} aria-hidden="true" /> Generate questions <ArrowRight size={15} aria-hidden="true" /></Link>}
        </section>

        <div className="dash-content-grid">
          <section className="dash-panel dash-exams" aria-labelledby="dash-exams-title">
            {/* sections stack in one centred column — Claude-style home */}
            <header className="dash-panel-head">
              <div><h2 id="dash-exams-title">Recent exams</h2><p>Continue where you left off</p></div>
              <Link to="/exams/new" className="dash-text-link"><Plus size={15} aria-hidden="true" /> New exam</Link>
            </header>
            {recentExams.length === 0 ? (
              <div className="dash-empty"><FileText size={26} aria-hidden="true" /><h3>No exams yet</h3><p>Build an exam from your approved questions.</p><Link to="/exams/new" className="dash-text-link">Create your first exam <ArrowRight size={15} aria-hidden="true" /></Link></div>
            ) : (
              <>
                <ul className="dash-board-list">
                  {recentExams.map((exam) => {
                    const items = count(exam.total_items ?? exam.question_count);
                    return (
                      <li key={exam.id}>
                        <Link to={`/exams/${exam.id}`} className="b-rowline" style={{ '--gc': groupColor(exam.subject_id || exam.subject_name || exam.id) }}>
                          <span className="b-rowline-main">
                            <span className="dash-doc"><FileText size={18} aria-hidden="true" /></span>
                            <span className="dash-exam-main">
                              <strong className="b-rowline-title">{exam.title}</strong>
                              <span className="b-rowline-meta">
                                {exam.subject_name ? <>{exam.subject_name}<span aria-hidden="true"> · </span></> : null}
                                {items > 0 ? <>{items} {items === 1 ? 'item' : 'items'}<span aria-hidden="true"> · </span></> : null}
                                {formatDate(exam.created_at)}
                              </span>
                            </span>
                          </span>
                          <StatusPill status={exam.status} small />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                <div className="dash-board-sum">
                  <StatusSummary
                    counts={recentExams.reduce((m, e) => { const t = statusOf(e.status); m[t] = (m[t] || 0) + 1; return m; }, {})}
                    order={['live', 'published', 'draft', 'archived']}
                    totalLabel={`${recentExams.length} recent`}
                  />
                </div>
              </>
            )}
            <Link to="/exams" className="dash-panel-foot">View all exams <ArrowRight size={15} aria-hidden="true" /></Link>
          </section>

          <div className="dash-side">
            <section className="dash-panel dash-subjects" aria-labelledby="dash-subjects-title">
              <header className="dash-panel-head">
                <h2 id="dash-subjects-title">Subjects</h2>
                <Link to="/subjects?new=1" className="dash-icon-link" aria-label="Create subject"><Plus size={17} aria-hidden="true" /></Link>
              </header>
              {recentSubjects.length === 0 ? (
                <div className="dash-empty"><BookOpen size={24} aria-hidden="true" /><p>Your subjects will appear here.</p></div>
              ) : (
                <ul className="dash-subject-list">
                  {recentSubjects.map((subject) => {
                    const name = subject.title || subject.name;
                    const questions = count(subject.question_count);
                    return (
                      <li key={subject.id}>
                        <Link to={`/questions?subject_id=${encodeURIComponent(subject.id)}`} className="dash-subject-row" style={{ '--gc': groupColor(subject.id) }} aria-label={`Open questions for ${name}`}>
                          <span className="dash-subject-dot" aria-hidden="true" />
                          <span><strong>{name}</strong><small>{subject.code ? `${subject.code} · ` : ''}{questions} {questions === 1 ? 'question' : 'questions'}</small></span>
                          <ChevronRight size={15} className="dash-row-chevron" aria-hidden="true" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Link to="/subjects" className="dash-panel-foot">Manage subjects <ArrowRight size={15} aria-hidden="true" /></Link>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
