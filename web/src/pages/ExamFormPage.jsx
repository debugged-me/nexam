import '../styles/exam-form.css';
/**
 * ExamFormPage — create or edit an exam.
 *
 * One card: Source (blank or a finalized blueprint) → Details → Content,
 * with sticky form-actions. Blueprint summary sits inline under the picker.
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Check, Info, AlertTriangle } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';

const BLOOM_LABELS = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create' };

/** Only finalized blueprints may drive exam assembly. */
function finalizedOnly(list) {
  return (list || []).filter((item) => item.status === 'finalized');
}

export default function ExamFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const navigate = useNavigate();
  const isEdit = !!id;
  const subjectParam = searchParams.get('subject_id');
  const [selectedTosId, setSelectedTosId] = useState(() => searchParams.get('tos') || '');

  const [subjects, setSubjects] = useState(() => api.peek('/subjects')?.subjects ?? []);
  const [tosList, setTosList] = useState(() => finalizedOnly(api.peek('/tos')?.tos));
  const [tos, setTos] = useState(null);
  const [exam, setExam] = useState(null);
  const [form, setForm] = useState({
    title: '',
    subject_id: subjectParam || '',
    format: 'print',
    set_count: 2,
    duration_minutes: '',
    instructions: '',
  });
  const [saving, setSaving] = useState(false);
  const [shortages, setShortages] = useState([]); // topic × Bloom cells the bank can't fill

  useEffect(() => {
    api.get('/subjects').then((data) => setSubjects(data.subjects)).catch(() => {});
    api.get('/tos').then((data) => setTosList(finalizedOnly(data.tos))).catch(() => {});
  }, []);

  const loadExam = useCallback(() => {
    if (!isEdit) return;
    api.get(`/exams/${id}`)
      .then((d) => {
        setExam(d.exam);
        setForm({
          title: d.exam.title || '',
          subject_id: d.exam.subject_id || '',
          format: d.exam.format || 'print',
          set_count: 2,
          duration_minutes: d.exam.duration_minutes || '',
          instructions: d.exam.instructions || '',
        });
      })
      .catch((err) => {
        toast.error(err.message || 'Could not load exam.');
        navigate('/exams');
      });
  }, [id, isEdit, toast, navigate]);

  useEffect(() => { loadExam(); }, [loadExam]);

  // Load TOS details when a blueprint is selected
  useEffect(() => {
    if (isEdit || !selectedTosId) return;
    api.get(`/tos/${selectedTosId}`)
      .then((d) => {
        setTos(d.tos);
        setForm((f) => ({
          ...f,
          title: d.tos.title || f.title,
          subject_id: d.tos.subject_id || f.subject_id,
        }));
      })
      .catch(() => {});
  }, [isEdit, selectedTosId]);

  async function handleSave(e) {
    e.preventDefault();
    setShortages([]);
    setSaving(true);
    try {
      const body = {
        title: form.title,
        subject_id: form.subject_id,
        tos_id: selectedTosId || undefined,
        format: form.format || 'print',
        set_count: 2,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
        instructions: form.instructions || undefined,
        status: exam?.status || 'draft',
      };
      if (isEdit) {
        await api.put(`/exams/${id}`, body);
        toast.success('Exam updated.');
        navigate(`/exams/${id}`);
      } else {
        const result = await api.post('/exams', body);
        toast.success('Exam created.');
        navigate(`/exams/${result.exam.id}`);
      }
    } catch (err) {
      // A 409 from assembly includes per-cell shortages — show them inline so
      // the user can see exactly which topic × Bloom cells need more questions.
      const short = err instanceof ApiError ? err.payload?.shortages : null;
      setShortages(Array.isArray(short) && short.length ? short : []);
      toast.error(err instanceof ApiError ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  const showTosCallout = !isEdit && !!tos;
  const bloomWeights = tos?.bloom_weights || {};
  const distParts = Object.entries(bloomWeights)
    .filter(([, p]) => p > 0)
    .map(([b, p]) => `${BLOOM_LABELS[b] || b} ${p}%`);
  const distribution = distParts.join(', ');

  return (
    <AppShell pageClass="exam-form" activeNav="exams" pageTitle={isEdit ? 'Edit exam' : 'New exam'}>
      <div className="form-container form-container--wide">


        <div className="card">
          <div className="card-body">
            <form onSubmit={handleSave} noValidate>
              {!isEdit && (
                <div className="form-section">
                  <div className="form-section-title">Source</div>
                  <div className="src-options" role="radiogroup" aria-label="Exam source" data-tour="exam-source">
                    <label className={`src-option ${selectedTosId === '' ? 'is-selected' : ''}`}>
                      <input type="radio" name="source" checked={selectedTosId === ''} onChange={() => { setSelectedTosId(''); setTos(null); setShortages([]); }} />
                      <span className="src-option-copy">
                        <strong>Blank exam</strong>
                        <small>Assemble questions yourself after creating.</small>
                      </span>
                    </label>
                    {tosList.map((bp) => (
                      <label key={bp.id} className={`src-option ${selectedTosId === bp.id ? 'is-selected' : ''}`}>
                        <input type="radio" name="source" checked={selectedTosId === bp.id}
                          onChange={() => { setSelectedTosId(bp.id); setShortages([]); }} />
                        <span className="src-option-copy">
                          <strong>{bp.title}</strong>
                          <small>{bp.subject_name || bp.subject_code} · {bp.total_items} items</small>
                        </span>
                        <span className="src-option-tag">Blueprint</span>
                      </label>
                    ))}
                  </div>
                  {tosList.length === 0 && (
                    <p className="form-hint">No finalized blueprints yet — <Link to={`/tos?new=1${form.subject_id ? `&subject=${encodeURIComponent(form.subject_id)}` : ''}`}>create a blueprint</Link> to auto-fill the exam from your question bank.</p>
                  )}
                  {showTosCallout && (
                    <div className="src-summary">
                      <Info size={14} aria-hidden="true" />
                      <span>
                        <strong>{tos.total_items} items</strong> from your approved question bank
                        {distribution && <> · {distribution}</>}
                        {' '}— drafts are not pulled. Need more?{' '}
                        <Link to={`/tos/${selectedTosId}`}>Generate questions on the blueprint</Link>.
                      </span>
                    </div>
                  )}
                  {shortages.length > 0 && (
                    <div className="form-alert" role="alert">
                      <AlertTriangle size={18} aria-hidden="true" />
                      <div>
                        <strong>Not enough approved questions to fill this blueprint.</strong>
                        <span>Every topic × Bloom cell must be fully stocked:</span>
                        <ul className="form-alert-list">
                          {shortages.slice(0, 8).map((s, i) => (
                            <li key={i}>
                              {s.topic} — {BLOOM_LABELS[s.bloom] || s.bloom}: needs {s.needed}, has {s.available}
                            </li>
                          ))}
                          {shortages.length > 8 && <li>…and {shortages.length - 8} more cells</li>}
                        </ul>
                        <span>
                          Approve drafts in <Link to="/questions/review">Review drafts</Link>, or{' '}
                          <Link to={`/tos/${selectedTosId}`}>generate more questions</Link> from the blueprint.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

                  <div className="form-section" data-tour="exam-details">
                    <div className="form-section-title">Details</div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="title">Title <span className="req">*</span></label>
                      <input type="text" id="title" name="title" className="form-control" required maxLength={255}
                        autoComplete="off" autoFocus
                        value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="subject_id">Subject <span className="req">*</span></label>
                      <select id="subject_id" name="subject_id" className="form-control form-select" required
                        value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
                        <option value="">Select a subject…</option>
                        {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label" htmlFor="format">Format <span className="req">*</span></label>
                        <select id="format" name="format" className="form-control form-select" required
                          value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
                          {/* Wire values stay 'print' / 'digital' — both the Node API
                              (EXAM_FORMATS) and the Node API validate them.
                              Only the labels describe what each one actually produces. */}
                          <option value="print">Print — paper exam</option>
                          <option value="digital">LMS export — no paper</option>
                        </select>
                        <small className="form-hint">
                          Print: PDF papers, answer keys, and OMR sheets. LMS export: a GIFT or Canvas XML file
                          you upload yourself — Nexam doesn't run exams online.
                        </small>
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="set_count">Exam Sets</label>
                        <input id="set_count" name="set_count" className="form-control" value="2 sets (Set A + Set B)" disabled />
                        <small className="form-hint">Both sets are required — Set B shuffles the same questions.</small>
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="duration_minutes">Duration (minutes)</label>
                        <input type="number" id="duration_minutes" name="duration_minutes" className="form-control"
                          min={0} max={1000} placeholder="Optional"
                          value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
                      </div>
                    </div>
                  </div>

                  <div className="form-section">
                    <div className="form-section-title">Content</div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="instructions">Instructions</label>
                      <textarea id="instructions" name="instructions" className="form-control" rows={4}
                        maxLength={5000} placeholder="Optional instructions shown to examinees"
                        value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
                    </div>
                    {isEdit && exam && (
                      <div className="form-group">
                        <span className="form-label">Publishing status</span>
                        <div>
                          <span className={`badge badge-${exam.status === 'published' ? 'green' : 'amber'}`}>
                            {exam.status === 'published' ? 'Published' : 'Draft'}
                          </span>
                        </div>
                        <div className="form-hint">Publish from the exam details page — always an explicit step.</div>
                      </div>
                    )}
                  </div>

              <div className="form-actions form-actions--sticky" data-tour="exam-save">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner" /> : <Check size={16} />}
                  {isEdit ? 'Update exam' : (selectedTosId ? 'Generate exam' : 'Create blank exam')}
                </button>
                <Link to={isEdit ? `/exams/${id}` : '/exams'} className="btn btn-outline">Cancel</Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
