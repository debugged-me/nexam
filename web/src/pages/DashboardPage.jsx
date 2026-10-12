/** Instructor overview. All counts and recent work come from the scoped API. */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  Sparkles,
  FolderOpen,
  CircleHelp,
  PanelsTopLeft,
  ArrowUpRight,
  CircleCheck,
  ClipboardCheck,
  AlertTriangle,
  ScanLine,
  Flag,
  Send,
} from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext.jsx';
import AppShell from '../components/AppShell.jsx';
import KpiCard from '../components/KpiCard.jsx';
import { CardsSkeleton } from '../components/Loaders.jsx';
import { StatusPill } from '../components/Board.jsx';
import api, { ApiError } from '../lib/api.js';
import { vtNavigate } from '../lib/viewTransitions.js';
import { timeAgo } from '../lib/time.js';
import '../styles/dashboard.css';

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

/** One icon per to-do kind (keys from the queue below; ids stripped). */
const TODO_ICONS = {
  scans: ScanLine,
  failed: AlertTriangle,
  drafts: ClipboardCheck,
  gap: PanelsTopLeft,
  weak: Flag,
  ready: Send,
  exam: FileText,
  shortfall: Sparkles,
  next: CircleCheck,
  clear: CircleCheck,
};

const TYPE_LABELS = {
  mcq: 'Multiple choice',
  true_false: 'True / false',
  matching: 'Matching type',
  identification: 'Fill in the blank',
};

const BLOOM_LEVELS = [
  ['remember', 'Remember'],
  ['understand', 'Understand'],
  ['apply', 'Apply'],
  ['analyze', 'Analyze'],
  ['evaluate', 'Evaluate'],
  ['create', 'Create'],
];

/** 30-day delta descriptor for a stat. */
function deltaChip(d) {
  if (!d || d.current <= 0) return null;
  const title = `${d.current} added in the last 30 days`;
  if (d.dir === 'down') return { cls: 'is-down', text: `+${d.current}`, icon: 'down', title };
  if (d.previous === 0) return { cls: 'is-new', text: `+${d.current} new`, title };
  return { cls: 'is-up', text: `+${d.current}`, icon: 'up', title };
}

export default function DashboardPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(() => api.peek('/dashboard') ?? null);
  const [error, setError] = useState('');
  const [examFilter, setExamFilter] = useState('all');
  const [queueExpanded, setQueueExpanded] = useState(false);
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
      <AppShell activeNav="dashboard" pageTitle="Overview" pageClass="dashboard">
        <CardsSkeleton tiles={4} />
      </AppShell>
    );

  const stats = data.stats || {},
    bank = data.bank || {};
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
  const deltas = data.deltas || {};
  const examDrafts = count(data.examStatus?.draft);
  const recentDrafts = (data.recentDrafts || []).slice(0, 3);
  const shortfall = Math.max(
    0,
    count(data.blueprint?.planned) - count(data.blueprint?.onHand)
  );
  const bloomMap = data.bloom || {};
  const bloomCovered = count(data.bloomCovered);
  const other = count(bank.other);

  // Activity chart — weekly by default, daily when history is still sparse.
  const daily = data.series || [];
  const byWeek = [];
  for (let i = 0; i < 10; i++) {
    const wk = daily.slice(-70).slice(i * 7, i * 7 + 7);
    byWeek.push({
      label: wk[0]?.l || '—',
      v: wk.reduce((s, d) => s + count(d.q) + count(d.e), 0),
    });
  }
  const sparse = byWeek.filter((w) => w.v > 0).length <= 2;
  const bars = sparse
    ? daily.slice(-14).map((d) => ({ label: d.l, v: count(d.q) + count(d.e) }))
    : byWeek;
  const chartMax = Math.max(1, ...bars.map((b) => b.v));
  const chartRange = sparse ? 'Last 14 days' : 'Last 10 weeks';

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

  // ── "Next up" queue — prioritized signals from /dashboard.signals ──
  // Ordered by what blocks the most: unconfirmed scans → unreviewed drafts →
  // named blueprint gaps → publish-ready exams → generic pipeline → onboarding.
  const sig = data.signals || {};
  const pendingScans = sig.pendingScans || [];
  const scanReviewCount = pendingScans.reduce((a, r) => a + count(r.n), 0);
  const gapTos = sig.gapTos || [];
  const readyExams = sig.readyExams || [];
  const weakItems = count(sig.weakItems);
  const runningJobs = count(sig.runningJobs);
  const failedMaterials = count(sig.failedMaterials);
  const draftTri = sig.draftTriage || {};
  const flaggedDrafts = count(draftTri.flagged);
  const uncheckedDrafts = count(draftTri.unchecked);

  const queue = [];
  if (scanReviewCount) {
    queue.push({
      key: 'scans',
      label: 'Scans to verify',
      tone: 'has-drafts',
      headline: `${scanReviewCount} scanned sheet${scanReviewCount === 1 ? '' : 's'} need${scanReviewCount === 1 ? 's' : ''} your review.`,
      copy: `${pendingScans[0]?.exam_title ? `Starting with ${pendingScans[0].exam_title} — ` : ''}results stay provisional until each flagged item is confirmed.`,
      cta: 'Review scans',
      to: '/analytics',
      draftsPreview: false,
    });
  }
  if (failedMaterials) {
    queue.push({
      key: 'failed-materials',
      label: 'Needs attention',
      tone: 'has-drafts',
      headline: `${failedMaterials} material${failedMaterials === 1 ? '' : 's'} failed to process.`,
      copy: 'AI drafts can’t ground on them — retry the upload from Materials, or delete and re-add the file.',
      cta: 'Open materials',
      to: '/materials',
      draftsPreview: false,
    });
  }
  if (drafts) {
    const triParts = [];
    if (flaggedDrafts) triParts.push(`${flaggedDrafts} flagged as possible duplicate${flaggedDrafts === 1 ? '' : 's'}`);
    if (uncheckedDrafts) triParts.push(`${uncheckedDrafts} couldn’t be duplicate-checked`);
    queue.push({
      key: 'drafts',
      label: 'Ready for your review',
      tone: 'has-drafts',
      headline: `${drafts.toLocaleString()} draft${drafts === 1 ? '' : 's'} waiting on you.`,
      copy: triParts.length
        ? `${triParts.join(' · ')} — those need a decision first, then check the rest.`
        : 'Check their evidence, then approve the ones that belong.',
      cta: 'Review drafts',
      to: '/questions/review',
      draftsPreview: true,
    });
  }
  for (const g of gapTos) {
    // Per topic × Bloom cell from the API — the same count the blueprint's
    // Generate button offers, so the two never disagree.
    const deficit = count(g.missing);
    if (!deficit) continue;
    queue.push({
      key: `gap-${g.id}`,
      label: 'Blueprint gap',
      tone: '',
      headline: `“${g.title}” is ${deficit} item${deficit === 1 ? '' : 's'} short.`,
      copy: `${count(g.covered)} of ${count(g.planned)} planned items banked — generate the missing ones or reuse from your bank.`,
      cta: 'Open blueprint',
      to: `/tos/${g.id}`,
      draftsPreview: false,
    });
  }
  if (weakItems) {
    queue.push({
      key: 'weak-items',
      label: 'Needs attention',
      tone: '',
      headline: `${weakItems} question${weakItems === 1 ? ' keeps' : 's keep'} tripping students up.`,
      copy: 'Correct rate is under 50% — reteach the topic or revise the item.',
      cta: 'Open attention list',
      to: '/analytics/attention',
      draftsPreview: false,
    });
  }
  for (const e of readyExams) {
    queue.push({
      key: `ready-${e.id}`,
      label: 'Ready to publish',
      tone: '',
      headline: `“${e.title}” is assembled.`,
      copy: `${count(e.items)} items attached — publish it, then print your sets.`,
      cta: 'Open exam',
      to: `/exams/${e.id}`,
      draftsPreview: false,
    });
  }
  if (examDrafts) {
    queue.push({
      key: 'exam-drafts',
      label: 'Exams in progress',
      tone: '',
      headline: `${examDrafts} exam${examDrafts === 1 ? '' : 's'} still in draft.`,
      copy: 'Pick one back up and finish assembling your sets.',
      cta: 'Open exams',
      to: '/exams',
      draftsPreview: false,
    });
  }
  if (shortfall) {
    queue.push({
      key: 'shortfall',
      label: 'Blueprint capacity',
      tone: '',
      headline: `${shortfall} item${shortfall === 1 ? '' : 's'} short of your plans.`,
      copy: 'Your blueprints ask for more questions than the bank holds.',
      cta: 'Generate questions',
      to: '/wizard',
      draftsPreview: false,
    });
  }
  if (nextStep) {
    queue.push({
      key: 'next-step',
      label: 'Getting started',
      tone: '',
      headline: `Next up: ${nextStep.label.toLowerCase()}.`,
      copy: `${nextStep.hint}.`,
      cta: nextStep.label,
      to: nextStep.to,
      draftsPreview: false,
    });
  }
  if (!queue.length) {
    queue.push({
      key: 'clear',
      label: 'All caught up',
      tone: '',
      headline: 'Nothing needs you right now.',
      copy: runningJobs
        ? `Every question is reviewed — ${runningJobs} AI job${runningJobs === 1 ? ' is' : 's are'} still running in the background.`
        : 'Every question is reviewed and every exam is published.',
      cta: 'Browse the bank',
      to: '/questions',
      draftsPreview: false,
    });
  }
  // The whole queue is the page's main list: four rows by default, the rest
  // behind an expander so a long queue never silently drops work it counted.
  const shownQueue = queueExpanded ? queue : queue.slice(0, 4);
  const hiddenCount = queueExpanded ? 0 : Math.max(0, queue.length - 4);
  const caughtUp = queue.length === 1 && queue[0].key === 'clear';
  const actions = [
    { label: 'Build an exam', hint: 'Guided, start to finish', to: '/wizard', icon: Sparkles, tint: 2 },
    { label: 'Add materials', hint: 'Upload course notes', to: '/materials?upload=1', icon: FolderOpen, tint: 3 },
    { label: 'Write a question', hint: 'Add to the bank', to: '/questions?new=1', icon: CircleHelp, tint: 4 },
    { label: 'New subject', hint: 'Create a course', to: '/subjects?new=1', icon: BookOpen, tint: 1 },
  ];
  const metrics = [
    {
      label: 'Subjects',
      value: count(stats.subjects),
      hint: 'Your courses, organized',
      to: '/subjects',
      icon: BookOpen,
      tint: 1,
      delta: deltaChip(deltas.subjects),
    },
    {
      label: 'Questions',
      value: total,
      hint:
        total === 0
          ? 'Nothing written yet'
          : approved === total
            ? 'All approved and ready'
            : `${approved} approved${drafts ? ` · ${drafts} in review` : ''}`,
      to: '/questions',
      icon: CircleHelp,
      tint: 2,
      delta: deltaChip(deltas.questions),
      spark: daily.map((d) => d.q || 0),
    },
    {
      label: 'Blueprints',
      value: count(stats.tos),
      hint: 'Plans for balanced assessments',
      to: '/tos',
      icon: PanelsTopLeft,
      tint: 3,
      delta: deltaChip(deltas.tos),
    },
    {
      label: 'Exams',
      value: count(stats.exams),
      hint: examDrafts ? `${examDrafts} in draft` : 'From first draft to exam day',
      to: '/exams',
      icon: FileText,
      tint: 4,
      delta: deltaChip(deltas.exams),
      spark: daily.map((d) => d.e || 0),
    },
  ];

  return (
    <AppShell activeNav="dashboard" pageTitle="Overview" pageClass="dashboard">
      <div className="dash-home">
        <div className="dash-kpis" data-tour="dash-kpis">
          {metrics.map((metric, i) => (
            <KpiCard
              key={metric.label}
              to={metric.to}
              i={i}
              icon={metric.icon}
              tint={metric.tint}
              value={metric.value}
              label={metric.label}
              hint={metric.hint}
              delta={metric.delta}
              spark={metric.spark}
              sparkColor={`var(--gc-${metric.tint})`}
            />
          ))}
        </div>

        <div className="dash-main">
          <div className="dash-col">
            <section className="dash-card dash-todo" aria-labelledby="dash-todo-title" data-tour="dash-focus">
              <header className="dash-card-head">
                <h2 id="dash-todo-title">Your to-do</h2>
                <span className="dash-chart-range">
                  {caughtUp ? 'All caught up' : `${queue.length} item${queue.length === 1 ? '' : 's'}, most urgent first`}
                </span>
              </header>
              <ol className="dash-todo-list">
                {shownQueue.map((item, idx) => {
                  const Icon = TODO_ICONS[item.key.replace(/-.*$/, '')] || TODO_ICONS[item.key] || CircleCheck;
                  return (
                    <li key={item.key} className="dash-todo-item" data-tone={item.tone ? 'urgent' : undefined} data-first={idx === 0 || undefined}>
                      <span className="dash-todo-icon" aria-hidden="true"><Icon size={16} /></span>
                      <div className="dash-todo-body">
                        <span className="dash-todo-label">{item.label}</span>
                        <strong>{item.headline}</strong>
                        <p>{item.copy}</p>
                        {item.draftsPreview && recentDrafts.length > 0 && (
                          <ul className="dash-todo-drafts">
                            {recentDrafts.map((q) => (
                              <li key={q.id}>
                                <Link to="/questions/review">
                                  <span>{String(q.stem || '').replace(/\s+/g, ' ').trim()}</span>
                                  <small>{q.subject_name || 'Question'}{q.type ? ` · ${TYPE_LABELS[q.type] || q.type}` : ''}</small>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <Link to={item.to} className={`btn btn-sm dash-todo-cta ${idx === 0 ? 'btn-primary' : 'btn-outline'}`}>
                        {item.cta} <ArrowRight size={14} />
                      </Link>
                    </li>
                  );
                })}
              </ol>
              {hiddenCount > 0 && (
                <button type="button" className="dash-card-foot dash-queue-toggle" onClick={() => setQueueExpanded(true)}>
                  <ChevronDown size={15} /> Show {hiddenCount} more
                </button>
              )}
            </section>

            <section className="dash-card" aria-labelledby="dash-exams-title" data-tour="dash-exams">
              <header className="dash-card-head">
                <h2 id="dash-exams-title">Recent exams</h2>
                <Link to="/exams" className="dash-text-link">
                  View all <ArrowRight size={14} />
                </Link>
              </header>
              {recentExams.length > 0 && (
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
              )}
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
                        <Link
                          to={`/exams/${exam.id}`}
                          className="dash-exam-row"
                          onClick={(ev) => {
                            if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button !== 0) return;
                            ev.preventDefault();
                            vtNavigate(navigate, `/exams/${exam.id}`, {
                              sharedEl: ev.currentTarget.querySelector('.dash-exam-name strong'),
                            });
                          }}
                        >
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
                          <span className="dash-exam-date" title={exam.created_at ? new Date(exam.created_at).toLocaleString() : undefined}>
                            {timeAgo(exam.created_at) || formatDate(exam.created_at)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="dash-empty">
                  <span className="dash-empty-icon">
                    <FileText size={20} />
                  </span>
                  <h3>
                    {recentExams.length
                      ? `No ${examFilter} exams in recent work`
                      : 'No exams yet'}
                  </h3>
                  <p>
                    {recentExams.length
                      ? 'Choose another filter to see your recent exams.'
                      : 'Bring your approved questions together in a balanced assessment.'}
                  </p>
                </div>
              )}
              <Link to="/exams/new" className="dash-card-foot">
                <Plus size={15} /> Create an exam
              </Link>
            </section>

            <section className="dash-card" aria-labelledby="dash-subjects-title" data-tour="dash-subjects">
              <header className="dash-card-head">
                <h2 id="dash-subjects-title">Your subjects</h2>
                <Link to="/subjects" className="dash-text-link">
                  Manage subjects <ArrowRight size={14} />
                </Link>
              </header>
              <div>
                {recentSubjects.map((subject, index) => (
                  <Link
                    key={subject.id}
                    to={`/questions?subject_id=${encodeURIComponent(subject.id)}`}
                    className="dash-row"
                  >
                    <span className="dash-row-label">
                      <span className={`dash-row-icon tint-${(index % 4) + 1}`}>
                        <BookOpen size={15} />
                      </span>
                      <span>
                        <strong>{subject.title || subject.name}</strong>
                        {subject.code && <small>{subject.code}</small>}
                      </span>
                    </span>
                    <span className="dash-row-value">
                      {count(subject.question_count)} questions
                      <ChevronRight size={14} />
                    </span>
                  </Link>
                ))}
                <Link to="/subjects?new=1" className="dash-row is-add">
                  <span className="dash-row-label">
                    <span className="dash-row-icon is-add">
                      <Plus size={15} />
                    </span>
                    <span>
                      <strong>Add a subject</strong>
                    </span>
                  </span>
                </Link>
              </div>
            </section>
          </div>

          <div className="dash-col">
            <section className="dash-card" aria-labelledby="dash-actions-title" data-tour="dash-actions">
              <header className="dash-card-head">
                <h2 id="dash-actions-title">Quick actions</h2>
              </header>
              <div>
                {actions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link key={action.label} to={action.to} className="dash-row">
                      <span className="dash-row-label">
                        <span className={`dash-row-icon tint-${action.tint}`}>
                          <Icon size={15} aria-hidden="true" />
                        </span>
                        <span>
                          <strong>{action.label}</strong>
                          <small>{action.hint}</small>
                        </span>
                      </span>
                      <span className="dash-row-value">
                        <ChevronRight size={14} />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="dash-card" aria-labelledby="dash-bank-title" data-tour="dash-bank">
              <header className="dash-card-head">
                <h2 id="dash-bank-title">Your question bank</h2>
                <Link to="/questions" className="dash-text-link">
                  Open bank <ArrowRight size={14} />
                </Link>
              </header>
              <div className="dash-row is-block is-static">
                <span className="dash-row-label">
                  <span>
                    <strong>Composition</strong>
                  </span>
                  <span className="dash-row-value">
                    {total.toLocaleString()} · {readyPct}% approved
                  </span>
                </span>
                <span
                  className="dash-bank-bar"
                  role="img"
                  aria-label={`${approved} active, ${drafts} draft, ${rejected} rejected questions`}
                >
                  <i className="is-active" style={{ flexGrow: approved }} />
                  <i className="is-draft" style={{ flexGrow: drafts }} />
                  <i className="is-rejected" style={{ flexGrow: rejected }} />
                  <i className="is-other" style={{ flexGrow: other }} />
                </span>
              </div>
              <div className="dash-row is-block is-static">
                <span className="dash-row-label">
                  <span>
                    <strong>By status</strong>
                  </span>
                </span>
                <span className="dash-row-value dash-status-links">
                  <Link className="dash-mini-link" to="/questions?status=active">
                    <i className="is-active" />
                    {approved} approved
                  </Link>
                  <Link className="dash-mini-link" to="/questions?status=draft">
                    <i className="is-draft" />
                    {drafts} draft
                  </Link>
                  <Link className="dash-mini-link" to="/questions?status=rejected">
                    <i className="is-rejected" />
                    {rejected} rejected
                  </Link>
                </span>
              </div>
              <div className="dash-row is-static">
                <span className="dash-row-label">
                  <span>
                    <strong>Bloom coverage</strong>
                  </span>
                </span>
                <span className="dash-row-value">
                  <span
                    className="dash-bloom-dots"
                    role="img"
                    aria-label={`${bloomCovered} of 6 Bloom levels covered`}
                  >
                    {BLOOM_LEVELS.map(([key, label]) => (
                      <i
                        key={key}
                        className={count(bloomMap[key]) ? 'is-on' : ''}
                        title={`${label}: ${count(bloomMap[key])}`}
                      />
                    ))}
                  </span>
                  {bloomCovered}/6
                </span>
              </div>
            </section>
            <section className="dash-card" aria-labelledby="dash-activity-title" data-tour="dash-activity">
              <header className="dash-card-head">
                <h2 id="dash-activity-title">Activity</h2>
                <span className="dash-chart-range">{chartRange}</span>
              </header>
              <div className="dash-bars dash-bars--compact" role="img" aria-label="Question and exam activity">
                {bars.map((b, i) => (
                  <div className="dash-bar-col" key={i}>
                    <i
                      className={`dash-bar ${i === bars.length - 1 ? 'is-current' : b.v ? '' : 'is-empty'}`}
                      style={{ height: b.v ? `${Math.max((b.v / chartMax) * 100, 8)}%` : '4%' }}
                      title={`${sparse ? b.label : `Week of ${b.label}`}: ${b.v} item${b.v === 1 ? '' : 's'}`}
                    />
                  </div>
                ))}
              </div>
              <div className="dash-bars-axis" aria-hidden="true">
                <span>{bars[0]?.label}</span>
                <span>{bars[bars.length - 1]?.label}</span>
              </div>
            </section>
          </div>
        </div>

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
