/** Instructor overview. All counts and recent work come from the scoped API. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  ListChecks,
  Plus,
  Sparkles,
  Upload,
  CalendarDays,
  CircleHelp,
  PanelsTopLeft,
  ArrowUpRight,
  CircleCheck,
} from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext.jsx';
import AppShell from '../components/AppShell.jsx';
import { PageLoader } from '../components/Loaders.jsx';
import { StatusPill } from '../components/Board.jsx';
import api, { ApiError } from '../lib/api.js';
import '../styles/dashboard.css';

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}
function count(value) {
  return Math.max(0, Number(value) || 0);
}
function formatDate(value) {
  if (!value) return 'No date';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'No date'
    : date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(() => api.peek('/dashboard') ?? null);
  const [error, setError] = useState('');
  const [examFilter, setExamFilter] = useState('all');
  useEffect(() => {
    let active = true;
    api
      .get('/dashboard')
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) {
          logout();
          return;
        }
        setError(err.message || 'Could not load your workspace.');
      });
    return () => {
      active = false;
    };
  }, [logout]);

  if (error)
    return (
      <AppShell activeNav="dashboard" pageTitle="Overview" pageClass="dashboard">
        <div className="dash-message" role="alert">
          {error}
        </div>
      </AppShell>
    );
  if (!data)
    return (
      <AppShell activeNav="dashboard" pageTitle="Overview" pageClass="dashboard" wide>
        <PageLoader label="Loading your workspace…" />
      </AppShell>
    );

  const stats = data.stats || {},
    bank = data.bank || {};
  const firstName = (user?.full_name || 'there').trim().split(/\s+/)[0];
  const approved = count(bank.approved),
    drafts = count(bank.draft),
    rejected = count(bank.rejected),
    total = count(bank.total);
  const readyPct = total ? Math.min(100, Math.round((approved / total) * 100)) : 0;
  const recentExams = (data.recentExams || []).slice(0, 5);
  const shownExams = recentExams.filter(
    (exam) => examFilter === 'all' || exam.status === examFilter
  );
  const recentSubjects = (data.recentSubjects || []).slice(0, 4);
  const guideSteps = [
    {
      label: 'Create a subject',
      hint: 'Give your course a home',
      to: '/subjects?new=1',
      done: count(stats.subjects) > 0,
    },
    {
      label: 'Add your materials',
      hint: 'Upload notes and references',
      to: '/materials?upload=1',
      done: count(stats.materials) > 0,
    },
    {
      label: 'Plan a blueprint',
      hint: 'Define topics and Bloom levels',
      to: '/tos',
      done: count(stats.tos) > 0,
    },
    {
      label: 'Generate questions',
      hint: 'Start with grounded AI drafts',
      to: '/wizard',
      done: total > 0,
    },
    {
      label: 'Review and approve',
      hint: 'Check each question before use',
      to: '/questions/review',
      done: approved > 0,
    },
    {
      label: 'Build your exam',
      hint: 'Bring your approved items together',
      to: '/exams/new',
      done: count(stats.exams) > 0,
    },
  ];
  const completed = guideSteps.filter((step) => step.done).length;
  const nextStep = guideSteps.find((step) => !step.done);
  const metrics = [
    {
      label: 'Subjects',
      value: count(stats.subjects),
      hint: 'Your courses, organized',
      to: '/subjects',
      icon: BookOpen,
    },
    {
      label: 'Questions',
      value: total,
      hint: `${approved.toLocaleString()} approved and ready`,
      to: '/questions',
      icon: CircleHelp,
    },
    {
      label: 'Blueprints',
      value: count(stats.tos),
      hint: 'Plans for balanced assessments',
      to: '/tos',
      icon: PanelsTopLeft,
    },
    {
      label: 'Exams',
      value: count(stats.exams),
      hint: 'From first draft to exam day',
      to: '/exams',
      icon: FileText,
    },
  ];

  return (
    <AppShell activeNav="dashboard" pageTitle="Overview" pageClass="dashboard" wide>
      <div className="dash-home">
        <header className="dash-heading">
          <div>
            <div className="dash-kicker">Your workspace, in focus</div>
            <h1>
              {greeting()}, {firstName}
              <span className="dash-title-dot">.</span>
            </h1>
            <p>A clear view of your courses, questions, and what’s next.</p>
          </div>
          <span className="dash-date">
            <CalendarDays size={15} aria-hidden="true" />
            {new Date().toLocaleDateString('en', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </header>

        <div className="dash-section-bar">
          <span className="dash-section-tab">Overview</span>
          <Link to="/analytics">
            View insights <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="dash-metrics" aria-label="Workspace totals">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Link className="dash-metric" to={metric.to} key={metric.label}>
                <span className="dash-metric-label">
                  <Icon size={16} />
                  {metric.label}
                  <ArrowUpRight size={13} className="dash-metric-arrow" />
                </span>
                <strong>{metric.value.toLocaleString()}</strong>
                <small>{metric.hint}</small>
              </Link>
            );
          })}
        </div>

        <section className="dash-start-section" aria-labelledby="dash-start-title">
          <div className="dash-section-heading">
            <h2 id="dash-start-title">Make room for your next idea</h2>
            <span>Start something good.</span>
          </div>
          <div className="dash-shortcuts">
            <Link to="/wizard" className="dash-shortcut is-featured">
              <span className="dash-shortcut-icon">
                <Sparkles size={20} />
              </span>
              <span>
                <strong>Build an exam</strong>
                <small>A little guidance, from start to finish</small>
              </span>
              <ArrowUpRight size={17} />
            </Link>
            <Link to="/materials?upload=1" className="dash-shortcut">
              <span className="dash-shortcut-icon">
                <Upload size={20} />
              </span>
              <span>
                <strong>Add materials</strong>
                <small>Turn your course notes into a starting point</small>
              </span>
              <ArrowUpRight size={17} />
            </Link>
            <Link to="/questions?new=1" className="dash-shortcut">
              <span className="dash-shortcut-icon">
                <Plus size={20} />
              </span>
              <span>
                <strong>Write a question</strong>
                <small>Add your expertise to the bank</small>
              </span>
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </section>

        <div className="dash-content-grid">
          <section className="dash-panel dash-exams" aria-labelledby="dash-exams-title">
            <header className="dash-panel-head">
              <div>
                <h2 id="dash-exams-title">Recent exams</h2>
                <p>Pick up where you left off.</p>
              </div>
              <Link to="/exams" className="dash-text-link">
                View all <ArrowRight size={14} />
              </Link>
            </header>
            <div className="dash-exam-filters" role="group" aria-label="Filter recent exams">
              {[
                ['all', 'All exams'],
                ['draft', 'Drafts'],
                ['published', 'Published'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={examFilter === value}
                  onClick={() => setExamFilter(value)}
                >
                  {label}
                  {value === 'all' && <span>{recentExams.length}</span>}
                </button>
              ))}
            </div>
            {shownExams.length ? (
              <>
                <div className="dash-exam-columns" aria-hidden="true">
                  <span>Exam</span>
                  <span>Status</span>
                  <span>Created</span>
                </div>
                <ul className="dash-exam-list">
                  {shownExams.map((exam) => (
                    <li key={exam.id}>
                      <Link to={`/exams/${exam.id}`} className="dash-exam-row">
                        <span className="dash-exam-name">
                          <span className="dash-doc">
                            <FileText size={18} />
                          </span>
                          <span>
                            <strong>{exam.title}</strong>
                            <small>
                              {exam.subject_name || 'Exam'}
                              {count(exam.total_items ?? exam.question_count) > 0 &&
                                ` · ${count(exam.total_items ?? exam.question_count)} items`}
                            </small>
                          </span>
                        </span>
                        <StatusPill status={exam.status} small />
                        <span className="dash-exam-date">{formatDate(exam.created_at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="dash-empty">
                <span className="dash-empty-icon">
                  <FileText size={24} />
                </span>
                <h3>
                  {recentExams.length
                    ? `No ${examFilter} exams in recent work`
                    : 'Your next exam starts here'}
                </h3>
                <p>
                  {recentExams.length
                    ? 'Choose another filter to see your recent exams.'
                    : 'Bring your approved questions together in a balanced assessment.'}
                </p>
                {!recentExams.length && (
                  <Link to="/wizard" className="btn btn-outline">
                    Build your first exam <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            )}
            <Link to="/exams/new" className="dash-panel-foot">
              <Plus size={15} /> Create an exam
            </Link>
          </section>

          <section className="dash-panel dash-focus" aria-labelledby="dash-focus-title">
            <header className="dash-panel-head">
              <h2 id="dash-focus-title">A little focus</h2>
              <span className="dash-focus-icon">
                <ListChecks size={17} />
              </span>
            </header>
            <div className="dash-focus-body">
              <span className={`dash-focus-label ${drafts ? 'has-drafts' : ''}`}>
                {drafts
                  ? 'READY FOR YOUR REVIEW'
                  : total
                    ? 'YOUR QUESTION BANK'
                    : 'LET’S GET STARTED'}
              </span>
              <h3>
                {drafts
                  ? `${drafts.toLocaleString()} drafts. Your next step.`
                  : total
                    ? 'Good questions make great exams.'
                    : 'Every great exam starts with a subject.'}
              </h3>
              <p>
                {drafts
                  ? 'Give your drafts a final look. Check their evidence, then approve the ones that belong.'
                  : total
                    ? 'Keep building a bank of questions you can confidently use again.'
                    : 'Add a course, bring in your materials, and build from what you teach.'}
              </p>
              <Link
                to={drafts ? '/questions/review' : nextStep?.to || '/questions'}
                className="btn btn-primary"
              >
                {drafts ? 'Review drafts' : nextStep?.label || 'Open question bank'}
                <ArrowRight size={15} />
              </Link>
            </div>
            <div className="dash-bank">
              <div className="dash-bank-label">
                <span>Approved questions</span>
                <strong>{readyPct}%</strong>
              </div>
              <progress
                max="100"
                value={readyPct}
                aria-label={`${readyPct}% of questions approved`}
              />
              <div className="dash-bank-legend">
                <Link to="/questions?status=active">
                  <i className="is-active" />
                  {approved} active
                </Link>
                <Link to="/questions?status=draft">
                  <i className="is-draft" />
                  {drafts} draft
                </Link>
                <Link to="/questions?status=rejected">
                  <i className="is-rejected" />
                  {rejected} rejected
                </Link>
              </div>
            </div>
          </section>
        </div>

        <section className="dash-subjects" aria-labelledby="dash-subjects-title">
          <div className="dash-section-heading">
            <h2 id="dash-subjects-title">Your subjects</h2>
            <Link to="/subjects" className="dash-text-link">
              Manage subjects <ArrowRight size={14} />
            </Link>
          </div>
          <div className="dash-subject-grid">
            {recentSubjects.map((subject, index) => (
              <Link
                key={subject.id}
                to={`/questions?subject_id=${encodeURIComponent(subject.id)}`}
                className={`dash-subject-card subject-tone-${index}`}
              >
                <span className="dash-subject-icon">
                  <BookOpen size={19} />
                </span>
                <span>
                  <strong>{subject.title || subject.name}</strong>
                  <small>
                    {subject.code ? `${subject.code} · ` : ''}
                    {count(subject.question_count)} questions
                  </small>
                </span>
                <ChevronRight size={14} />
              </Link>
            ))}
            <Link to="/subjects?new=1" className="dash-add-subject">
              <Plus size={17} /> Add a subject
            </Link>
          </div>
        </section>

        {completed < guideSteps.length && (
          <details className="dash-guide">
            <summary>
              <span className="dash-guide-icon">
                <CircleCheck size={18} />
              </span>
              <span>
                <strong>Your first exam, step by step</strong>
                <small>
                  {completed} of {guideSteps.length} steps complete
                </small>
              </span>
              <progress
                max={guideSteps.length}
                value={completed}
                aria-label="Getting started progress"
              />
              <ChevronDown size={17} />
            </summary>
            <ol className="dash-steps">
              {guideSteps.map((step, index) => (
                <li key={step.label}>
                  <Link to={step.to} className={`dash-step ${step.done ? 'is-done' : ''}`}>
                    <span className="dash-step-num">
                      {step.done ? <Check size={13} /> : index + 1}
                    </span>
                    <span>
                      <strong>{step.label}</strong>
                      <small>{step.hint}</small>
                    </span>
                    <ArrowUpRight size={14} />
                  </Link>
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </AppShell>
  );
}
