import '../styles/institution.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Library, Rows3, Search, StretchHorizontal, ChevronFirst, ChevronLeft, ChevronRight, ChevronLast } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { PageLoader } from '../components/Loaders.jsx';
import Modal from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';
import { groupColor } from '../components/Board.jsx';
import api from '../lib/api.js';

const BLOOM_LABELS = {
  remember: 'Remember', understand: 'Understand', apply: 'Apply',
  analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create',
};
const TYPE_LABELS = {
  mcq: 'Multiple choice', true_false: 'True / false',
  matching: 'Matching type', identification: 'Fill in the blank',
};

const PAGE_SIZE = 12;

export default function InstitutionBankPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState(() => api.peek('/questions/institution')?.questions ?? null);
  const [subjects, setSubjects] = useState(() => api.peek('/subjects')?.subjects ?? []);
  const [query, setQuery] = useState('');
  const [bloom, setBloom] = useState('');
  const [type, setType] = useState('');
  const [reusing, setReusing] = useState(null);
  const [targetSubjectId, setTargetSubjectId] = useState('');
  const [saving, setSaving] = useState(false);
  const [density, setDensity] = useState(() => localStorage.getItem('nexam.institution.density') || 'comfortable');
  const [page, setPage] = useState(0);
  const listRef = useRef(null);

  function toggleDensity() {
    const next = density === 'compact' ? 'comfortable' : 'compact';
    setDensity(next);
    localStorage.setItem('nexam.institution.density', next);
  }

  useEffect(() => {
    Promise.all([api.get('/questions/institution'), api.get('/subjects')])
      .then(([bank, owned]) => {
        setQuestions(bank.questions || []);
        setSubjects(owned.subjects || []);
      })
      .catch((err) => toast.error(err.message || 'Could not load the institution bank.'));
  }, [toast]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (questions || []).filter((question) => {
      if (bloom && question.bloom !== bloom) return false;
      if (type && question.type !== type) return false;
      if (!needle) return true;
      return [question.stem, question.topic, question.subject_name, question.subject_code]
        .some((value) => String(value || '').toLowerCase().includes(needle));
    });
  }, [questions, query, bloom, type]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const start = filtered.length ? safePage * PAGE_SIZE + 1 : 0;
  const end = Math.min((safePage + 1) * PAGE_SIZE, filtered.length);

  function goTo(p) {
    setPage(p);
    listRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function openReuse(question) {
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

  return (
    <AppShell pageClass="institution" activeNav="institution" pageTitle="Institution question bank" wide>
      <section className="institution-head">
        <div>
          <span className="eyebrow">Approved resources</span>
          <h1>Institution question bank</h1>
          <p>Search approved questions across the school. Reused items enter your private review queue before they can be placed in an exam.</p>
        </div>
        <div className="institution-head-side" data-tour="institution-side">
          <div className="institution-count"><Library size={18} /> {filtered.length} questions</div>
          <button type="button" className="ds-btn" onClick={toggleDensity} aria-pressed={density === 'compact'} title={density === 'compact' ? 'Show full questions' : 'Show compact list'}>
            {density === 'compact' ? <StretchHorizontal size={15} /> : <Rows3 size={15} />}
            {density === 'compact' ? 'Comfortable' : 'Compact'}
          </button>
        </div>
      </section>

      <section className="institution-toolbar" aria-label="Institution bank filters" data-tour="institution-filters">
        <label className="institution-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search institution questions</span>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search question, topic, or subject" />
        </label>
        <select value={bloom} onChange={(event) => { setBloom(event.target.value); setPage(0); }} aria-label="Filter by Bloom level">
          <option value="">All Bloom levels</option>
          {Object.entries(BLOOM_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={type} onChange={(event) => { setType(event.target.value); setPage(0); }} aria-label="Filter by question type">
          <option value="">All question types</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </section>

      {questions === null ? (
        <PageLoader label="Loading approved questions…" />
      ) : filtered.length === 0 ? (
        <div className="institution-empty">
          <Library size={28} />
          <strong>No approved questions match these filters.</strong>
          <span>Questions appear here after an instructor approves them.</span>
        </div>
      ) : (
        <div className="institution-list" data-density={density} data-tour="institution-list" ref={listRef}>
          {pageItems.map((question) => (
            <article className="institution-question" key={question.id}>
              <div className="institution-meta">
                <span className="b-chip" style={{ '--gc': groupColor(question.subject_id || question.subject_name) }}>
                  <span>{question.subject_code || question.subject_name}</span>
                </span>
                <span>{question.topic || 'No topic'}</span>
                <span>{BLOOM_LABELS[question.bloom] || question.bloom}</span>
                <span>{TYPE_LABELS[question.type] || question.type}</span>
              </div>
              <h2>{question.stem}</h2>
              {Array.isArray(question.options) && question.options.length > 0 && (
                <ol className="institution-options" type="A">
                  {question.options.map((option, index) => <li key={`${question.id}-${index}`}>{option}</li>)}
                </ol>
              )}
              <div className="institution-answer"><strong>Answer:</strong> {question.answer || 'Not specified'}</div>
              <button className="btn btn-outline btn-sm institution-reuse" type="button" onClick={() => openReuse(question)} disabled={!subjects.length}>
                <Copy size={15} /> Reuse as draft
              </button>
            </article>
          ))}
        </div>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="dataset-foot">
          <div className="ds-range">
            <b>{start}</b>–<b>{end}</b> of <b>{filtered.length}</b>
          </div>
          <div className="ds-pager">
            <button type="button" className="ds-page" onClick={() => goTo(0)} disabled={safePage === 0} aria-label="First page">
              <ChevronFirst size={15} />
            </button>
            <button type="button" className="ds-page" onClick={() => goTo(safePage - 1)} disabled={safePage === 0} aria-label="Previous page">
              <ChevronLeft size={15} />
            </button>
            <span className="ds-page" aria-current="page">{safePage + 1}</span>
            <span className="ds-gap">/</span>
            <span className="ds-page">{pageCount}</span>
            <button type="button" className="ds-page" onClick={() => goTo(safePage + 1)} disabled={safePage >= pageCount - 1} aria-label="Next page">
              <ChevronRight size={15} />
            </button>
            <button type="button" className="ds-page" onClick={() => goTo(pageCount - 1)} disabled={safePage >= pageCount - 1} aria-label="Last page">
              <ChevronLast size={15} />
            </button>
          </div>
        </div>
      )}

      <Modal open={!!reusing} title="Reuse approved question" onClose={() => !saving && setReusing(null)}>
        <form onSubmit={submitReuse} className="institution-reuse-form">
          <p>The copied item will be similarity-checked and must be reviewed before approval.</p>
          <label className="form-group">
            <span>Target subject</span>
            <select value={targetSubjectId} onChange={(event) => setTargetSubjectId(event.target.value)} required>
              <option value="">Select a subject</option>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code ? `${subject.code} — ` : ''}{subject.name}</option>)}
            </select>
          </label>
          <div className="modal-actions">
            <button className="btn btn-secondary" type="button" onClick={() => setReusing(null)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={saving || !targetSubjectId}>{saving ? 'Copying…' : 'Copy to review queue'}</button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
