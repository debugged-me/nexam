/** Instructor home: recent exams, question review, and subject shortcuts. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BookOpen, ChevronRight, CircleHelp, FileText,
  ListChecks, Plus, Sparkles, Upload,
} from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext.jsx';
import AppShell from '../components/AppShell.jsx';
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

function examStatus(value) {
  const labels = { draft: 'Draft', live: 'Live', published: 'Published', archived: 'Archived' };
  return labels[value] || 'Unknown';
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
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
    return <AppShell activeNav="dashboard" pageTitle="Home" wide><div className="dash-loading" role="status">Loading your workspace…</div></AppShell>;
  }

  const stats = data.stats || {};
  const bank = data.bank || {};
  const firstName = (user?.full_name || 'there').trim().split(/\s+/)[0];
  const approved = count(bank.approved);
  const drafts = count(bank.draft);
  const total = count(bank.total);
  const readyPct = total ? Math.min(100, Math.round((approved / total) * 100)) : 0;
  const recentExams = (data.recentExams || []).slice(0, 5);
  const recentSubjects = (data.recentSubjects || []).slice(0, 4);

  return (
    <AppShell activeNav="dashboard" pageTitle="Home" wide>
      <div className="dash-home">
        <header className="dash-heading">
          <div>
            <h1>{greeting()}, {firstName}</h1>
            <p>Pick up an exam or prepare your next assessment.</p>
          </div>
          <Link to="/wizard" className="btn btn-primary dash-build"><Sparkles size={16} aria-hidden="true" /> Build an exam</Link>
        </header>

        <div className="dash-overview">
          <dl className="dash-totals" aria-label="Workspace totals">
            {[
              ['Exams', stats.exams, '/exams'],
              ['Questions', stats.questions, '/questions'],
              ['Subjects', stats.subjects, '/subjects'],
              ['Blueprints', stats.tos, '/tos'],
            ].map(([label, value, url]) => (
              <div key={label} className="dash-total">
                <dt><Link to={url}>{label}</Link></dt>
                <dd>{count(value).toLocaleString()}</dd>
              </div>
            ))}
          </dl>
          <nav className="dash-quick-links" aria-label="Quick actions">
            <Link to="/questions?new=1"><Plus size={15} aria-hidden="true" /> Add question</Link>
            <Link to="/materials?upload=1"><Upload size={15} aria-hidden="true" /> Upload material</Link>
          </nav>
        </div>

        {count(stats.subjects) === 0 && (
          <section className="dash-start" aria-labelledby="dash-start-title">
            <BookOpen size={22} aria-hidden="true" />
            <div><h2 id="dash-start-title">Start with a subject</h2><p>Keep your course materials, questions, and exams together.</p></div>
            <Link to="/subjects?new=1" className="btn btn-outline">Create subject <ArrowRight size={15} aria-hidden="true" /></Link>
          </section>
        )}

        <div className="dash-content-grid">
          <section className="dash-panel dash-exams" aria-labelledby="dash-exams-title">
            <header className="dash-panel-head">
              <div><h2 id="dash-exams-title">Recent exams</h2><p>Continue where you left off</p></div>
              <Link to="/exams/new" className="dash-text-link"><Plus size={15} aria-hidden="true" /> New exam</Link>
            </header>
            {recentExams.length === 0 ? (
              <div className="dash-empty"><FileText size={26} aria-hidden="true" /><h3>No exams yet</h3><p>Build an exam from your approved questions.</p><Link to="/exams/new" className="dash-text-link">Create your first exam <ArrowRight size={15} aria-hidden="true" /></Link></div>
            ) : (
              <ul className="dash-exam-list">
                {recentExams.map((exam) => {
                  const items = count(exam.total_items ?? exam.question_count);
                  const isLive = ['live', 'published'].includes(exam.status);
                  return (
                    <li key={exam.id}>
                      <Link to={`/exams/${exam.id}`} className="dash-exam-row">
                        <span className="dash-doc"><FileText size={19} aria-hidden="true" /></span>
                        <span className="dash-exam-main">
                          <strong>{exam.title}</strong>
                          <span className="dash-exam-meta">{items} {items === 1 ? 'item' : 'items'}<span aria-hidden="true">·</span>{formatDate(exam.created_at)}</span>
                        </span>
                        <span className={`dash-exam-status ${isLive ? 'is-live' : ''}`}>{examStatus(exam.status)}</span>
                        <ChevronRight size={16} className="dash-row-chevron" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link to="/exams" className="dash-panel-foot">View all exams <ArrowRight size={15} aria-hidden="true" /></Link>
          </section>

          <div className="dash-side">
            <section className="dash-panel dash-bank" aria-labelledby="dash-bank-title">
              <header className="dash-panel-head"><h2 id="dash-bank-title">Question bank</h2><CircleHelp size={18} aria-hidden="true" /></header>
              <div className="dash-bank-body">
                <div className="dash-ready-label"><span>{approved.toLocaleString()} of {total.toLocaleString()} ready to use</span><strong>{readyPct}%</strong></div>
                <progress className="dash-ready-track" max="100" value={readyPct} aria-label={`${approved} of ${total} questions ready to use`} />
                <dl className="dash-bank-counts">
                  <div><dt>Active</dt><dd>{approved.toLocaleString()}</dd></div>
                  <div className={drafts > 0 ? 'has-drafts' : undefined}><dt>To review</dt><dd>{drafts.toLocaleString()}</dd></div>
                </dl>
                {drafts > 0 ? <Link to="/questions/review" className="btn btn-primary dash-review"><ListChecks size={16} aria-hidden="true" /> Review {drafts.toLocaleString()} {drafts === 1 ? 'draft' : 'drafts'}<ArrowRight size={15} aria-hidden="true" /></Link>
                  : <Link to="/questions" className="btn btn-outline dash-review">Open question bank <ArrowRight size={15} aria-hidden="true" /></Link>}
              </div>
            </section>

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
                        <Link to={`/questions?subject_id=${encodeURIComponent(subject.id)}`} className="dash-subject-row" aria-label={`Open questions for ${name}`}>
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
