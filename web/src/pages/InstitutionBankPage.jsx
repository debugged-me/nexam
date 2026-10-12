import '../styles/institution.css';
/**
 * InstitutionBankPage — the institution-wide, read-only bank of approved
 * questions, with "Reuse as draft" into the viewer's own review queue.
 *
 * Browsing a shared bank is a scanning job, so the default view is a list:
 * one row per question (stem, subject, Bloom, type), with the full question
 * a click away in a preview sheet. "Full" view shows every question with its
 * options and the correct answer marked. Both views are virtualized against
 * window scroll, so a bank of thousands stays light.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import {
  Copy, FileText, Check, Library, Rows3, Search, StretchHorizontal, Eye, Layers, Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EmptyStateArt from '../components/EmptyStateArt.jsx';
import AppShell from '../components/AppShell.jsx';
import { TableSkeleton } from '../components/Loaders.jsx';
import Modal from '../components/Modal.jsx';
import Select from '../components/Select.jsx';
import Tooltip from '../components/Tooltip.jsx';
import QuestionPreview from '../components/QuestionPreview.jsx';
import RichText from '../components/RichText.jsx';
import { useToast } from '../components/Toast.jsx';
import { useContextMenu, useCopyText } from '../components/ContextMenu.jsx';
import { groupColor } from '../components/Board.jsx';
import api from '../lib/api.js';

const BLOOM_LABELS = {
  remember: 'Remember', understand: 'Understand', apply: 'Apply',
  analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create',
};
const BLOOM_LEVELS = { remember: 1, understand: 2, apply: 3, analyze: 4, evaluate: 5, create: 6 };
const TYPE_LABELS = {
  mcq: 'Multiple choice', true_false: 'True / false',
  matching: 'Matching type', identification: 'Fill in the blank',
};
// Radix Select reserves '' — "all" is a real value here.
const ALL = 'all';
const BLOOM_OPTIONS = [{ value: ALL, label: 'All Bloom levels' }, ...Object.entries(BLOOM_LABELS).map(([value, label]) => ({ value, label }))];
const TYPE_OPTIONS = [{ value: ALL, label: 'All question types' }, ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))];
const DENSITY_KEY = 'nexam.institution.density';

/** Remembered view (per browser) — the list unless "Full" was chosen. */
function readDensity() {
  try { return localStorage.getItem(DENSITY_KEY) === 'comfortable' ? 'comfortable' : 'compact'; } catch { return 'compact'; }
}

const subjectLabel = (q) => q.subject_code || q.subject_name || 'No subject';

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(String(iso).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Subject chip · Bloom · type · topic — shared by both views and the sheet. */
function QuestionMeta({ question }) {
  const level = BLOOM_LEVELS[question.bloom];
  return (
    <div className="ib-meta">
      <span className="b-chip" style={{ '--gc': groupColor(question.subject_name || question.subject_code) }}>
        <span>{subjectLabel(question)}</span>
      </span>
      {level && <span className="g-bloom" data-level={level}>{BLOOM_LABELS[question.bloom]}</span>}
      <span className="ib-meta-text">{TYPE_LABELS[question.type] || question.type}</span>
      {question.topic && <span className="ib-meta-text ib-meta-topic" title={question.topic}>{question.topic}</span>}
      {!!question.owned_by_viewer && <span className="ib-yours">Yours</span>}
    </div>
  );
}

export default function InstitutionBankPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { menuEl, openMenu } = useContextMenu();
  const copyText = useCopyText();
  const [questions, setQuestions] = useState(() => api.peek('/questions/institution')?.questions ?? null);
  const [subjects, setSubjects] = useState(() => api.peek('/subjects')?.subjects ?? []);
  const [query, setQuery] = useState('');
  const [bloom, setBloom] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [subject, setSubject] = useState(ALL);
  const [previewing, setPreviewing] = useState(null);
  const [reusing, setReusing] = useState(null);
  const [targetSubjectId, setTargetSubjectId] = useState('');
  const [saving, setSaving] = useState(false);
  const [density, setDensity] = useState(readDensity);
  const [scrollMargin, setScrollMargin] = useState(0);

  function changeDensity(next) {
    setDensity(next);
    try { localStorage.setItem(DENSITY_KEY, next); } catch { /* storage unavailable */ }
  }

  useEffect(() => {
    Promise.all([api.get('/questions/institution'), api.get('/subjects')])
      .then(([bank, owned]) => {
        setQuestions(bank.questions || []);
        setSubjects(owned.subjects || []);
      })
      .catch((err) => toast.error(err.message || 'Could not load the institution bank.'));
  }, [toast]);

  // Subject filter choices come from the bank itself — other instructors'
  // subjects included — labelled by code when there is one.
  const subjectOptions = useMemo(() => {
    const labels = [...new Set((questions || []).map(subjectLabel))].sort((a, b) => a.localeCompare(b));
    return [{ value: ALL, label: 'All subjects' }, ...labels.map((label) => ({ value: label, label }))];
  }, [questions]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (questions || []).filter((question) => {
      if (bloom !== ALL && question.bloom !== bloom) return false;
      if (type !== ALL && question.type !== type) return false;
      if (subject !== ALL && subjectLabel(question) !== subject) return false;
      if (!needle) return true;
      return [question.stem, question.topic, question.subject_name, question.subject_code]
        .some((value) => String(value || '').toLowerCase().includes(needle));
    });
  }, [questions, query, bloom, type, subject]);

  const filtering = !!query.trim() || bloom !== ALL || type !== ALL || subject !== ALL;
  const clearFilters = () => { setQuery(''); setBloom(ALL); setType(ALL); setSubject(ALL); };

  // Only rows near the viewport are mounted, driven by window scroll.
  // `scrollMargin` is the list's offset from the document top so positions
  // line up with page scroll; the callback ref measures when the list mounts.
  const listRef = useCallback((el) => {
    if (el) setScrollMargin(el.getBoundingClientRect().top + window.scrollY);
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: filtered.length,
    estimateSize: () => (density === 'compact' ? 84 : 320),
    overscan: 8,
    gap: density === 'compact' ? 0 : 12,
    scrollMargin,
    getItemKey: (index) => filtered[index]?.id ?? index,
  });

  // Density swaps row height and spacing — drop the measurement cache so
  // everything re-measures under the new estimate.
  useEffect(() => {
    virtualizer.measure();
  }, [density, virtualizer]);

  function openReuse(question) {
    setPreviewing(null);
    setReusing(question);
    setTargetSubjectId(subjects[0]?.id || '');
  }

  async function submitReuse(event) {
    event.preventDefault();
    if (!targetSubjectId) {
      toast.warning('Create or select one of your subjects first.');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/questions/institution/${reusing.id}/reuse`, { targetSubjectId });
      toast.success('Question copied to your review queue as a draft.');
      setReusing(null);
      navigate('/questions?status=draft');
    } catch (err) {
      toast.error(err.message || 'Could not reuse this question.');
    } finally {
      setSaving(false);
    }
  }

  function rowMenu(e, question) {
    openMenu(e, [
      { label: 'Preview', icon: Eye, onClick: () => setPreviewing(question) },
      { label: 'Reuse as draft', icon: Copy, disabled: !subjects.length, onClick: () => openReuse(question) },
      'sep',
      { label: 'Copy question', icon: FileText, onClick: () => copyText(question.stem, 'Question') },
      { label: 'Copy answer', icon: Check, onClick: () => copyText(question.answer, 'Answer') },
    ]);
  }

  const reuseTitle = subjects.length ? 'Copy into your review queue as a draft' : 'Create a subject first to reuse questions';

  return (
    <AppShell pageClass="institution" activeNav="institution" pageTitle="Institution question bank" wide>
      <section className="ib-bar" aria-label="Shared bank filters" data-tour="institution-filters">
        <label className="ds-search ib-search" htmlFor="institution-search">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Search institution questions</span>
          <input
            id="institution-search"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search question, topic, or subject…"
          />
        </label>
        <Select value={subject} onChange={setSubject} options={subjectOptions} label="Filter by subject" icon={Library} />
        <Select value={bloom} onChange={setBloom} options={BLOOM_OPTIONS} label="Filter by Bloom level" icon={Layers} />
        <Select value={type} onChange={setType} options={TYPE_OPTIONS} label="Filter by question type" icon={FileText} />
        <div className="ib-bar-side" data-tour="institution-side">
          <span className="ib-count" aria-live="polite">
            <strong>{filtered.length}</strong> {filtered.length === 1 ? 'question' : 'questions'}
          </span>
          <div className="ib-view" role="group" aria-label="Layout">
            <Tooltip label="List">
              <button type="button" aria-pressed={density === 'compact'} onClick={() => changeDensity('compact')} aria-label="List view">
                <Rows3 size={15} />
              </button>
            </Tooltip>
            <Tooltip label="Full questions">
              <button type="button" aria-pressed={density === 'comfortable'} onClick={() => changeDensity('comfortable')} aria-label="Full question view">
                <StretchHorizontal size={15} />
              </button>
            </Tooltip>
          </div>
        </div>
      </section>

      {questions === null ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="ib-empty">
          <EmptyStateArt size={120} art="library" tone={7} />
          <strong>{filtering ? 'No approved questions match these filters.' : 'The shared bank is empty.'}</strong>
          <span>
            {filtering
              ? <button type="button" className="ib-linkbtn" onClick={clearFilters}>Clear filters</button>
              : 'Questions appear here once an instructor approves them.'}
          </span>
        </div>
      ) : (
        <div
          className="ib-list"
          data-density={density}
          data-tour="institution-list"
          ref={listRef}
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const question = filtered[virtualItem.index];
            if (!question) return null;
            return (
              <article
                className="ib-item"
                key={virtualItem.key}
                data-index={virtualItem.index}
                onContextMenu={(e) => rowMenu(e, question)}
                ref={virtualizer.measureElement}
                style={{ transform: `translateY(${virtualItem.start - virtualizer.options.scrollMargin}px)` }}
              >
                {density === 'compact' ? (
                  <>
                    <div className="ib-row-main">
                      <button type="button" className="ib-stem" onClick={() => setPreviewing(question)} title="Preview this question">
                        <RichText text={question.stem} />
                      </button>
                      <QuestionMeta question={question} />
                    </div>
                    <div className="ib-row-actions">
                      <Tooltip label="Preview">
                        <button type="button" className="ib-icon-btn" onClick={() => setPreviewing(question)} aria-label="Preview question">
                          <Eye size={15} />
                        </button>
                      </Tooltip>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => openReuse(question)} disabled={!subjects.length} title={reuseTitle}>
                        <Copy size={14} /> Reuse
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <QuestionMeta question={question} />
                    <QuestionPreview question={question} />
                    <div className="ib-card-foot">
                      {fmtDate(question.approved_at) && <span className="ib-approved">Approved {fmtDate(question.approved_at)}</span>}
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => openReuse(question)} disabled={!subjects.length} title={reuseTitle}>
                        <Copy size={14} /> Reuse as draft
                      </button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Preview sheet — the whole question, answer marked, one click to reuse. */}
      <Modal
        open={!!previewing}
        side
        title="Shared question"
        subtitle={previewing ? [previewing.subject_name, previewing.topic].filter(Boolean).join(' · ') : ''}
        icon={Library}
        accent={previewing ? groupColor(previewing.subject_name || previewing.subject_code) : undefined}
        onClose={() => setPreviewing(null)}
        footer={previewing && (
          <>
            <button type="button" className="btn btn-outline" onClick={() => copyText(previewing.stem, 'Question')}>
              <FileText size={15} /> Copy text
            </button>
            <button type="button" className="btn btn-primary" onClick={() => openReuse(previewing)} disabled={!subjects.length} title={reuseTitle}>
              <Copy size={15} /> Reuse as draft
            </button>
          </>
        )}
      >
        {previewing && (
          <div className="ib-sheet">
            <QuestionMeta question={previewing} />
            <QuestionPreview question={previewing} />
            <p className="ib-sheet-note">
              <Sparkles size={14} aria-hidden="true" />
              Reusing copies this question into your own review queue as a draft. It is duplicate-checked and needs your approval before you can use it.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={!!reusing}
        title="Reuse approved question"
        onClose={() => !saving && setReusing(null)}
        footer={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setReusing(null)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" type="submit" form="institution-reuse-form" disabled={saving || !targetSubjectId}>{saving ? 'Copying…' : 'Copy to review queue'}</button>
          </>
        }
      >
        <form id="institution-reuse-form" onSubmit={submitReuse} className="institution-reuse-form">
          <p>The copied item will be similarity-checked and must be reviewed before approval.</p>
          <label className="form-group">
            <span>Target subject</span>
            <select value={targetSubjectId} onChange={(event) => setTargetSubjectId(event.target.value)} required>
              <option value="">Select a subject</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.code ? `${s.code} — ` : ''}{s.name}</option>)}
            </select>
          </label>
        </form>
      </Modal>
      {menuEl}
    </AppShell>
  );
}
