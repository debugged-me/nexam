/**
 * ExamFormPage — create or edit an exam.
 *
 * Matches the PHP CodeIgniter design (application/views/exams/form.php)
 * exactly: form-container--wide, page-header with page-sub, creation-panel
 * for new exams (blueprints or empty), callout-warning for TOS-based creation,
 * and a card with form-sections (Details / Content) + sticky form-actions.
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Check, ChevronRight, ArrowRight, Table as TableIcon, Info, Plus,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import '../styles/exams.css';

const BLOOM_LABELS = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create' };

export default function ExamFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const navigate = useNavigate();
  const isEdit = !!id;
  const tosId = searchParams.get('tos');

  const [subjects, setSubjects] = useState([]);
  const [tosList, setTosList] = useState([]);
  const [tos, setTos] = useState(null);
  const [exam, setExam] = useState(null);
  const [form, setForm] = useState({
    title: '',
    subject_id: '',
    format: 'print',
    set_count: 1,
    duration_minutes: '',
    instructions: '',
  });
  const [saving, setSaving] = useState(false);
  const [showBlank, setShowBlank] = useState(false);

  useEffect(() => {
    api.get('/subjects').then((data) => setSubjects(data.subjects)).catch(() => {});
    api.get('/tos').then((data) => setTosList(data.tos)).catch(() => {});
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
          set_count: d.exam.set_count || 1,
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

  // Load TOS details if creating from a blueprint
  useEffect(() => {
    if (isEdit || !tosId) return;
    api.get(`/tos/${tosId}`)
      .then((d) => {
        setTos(d.tos);
        setForm((f) => ({
          ...f,
          title: d.tos.title || f.title,
          subject_id: d.tos.subject_id || f.subject_id,
        }));
      })
      .catch(() => {});
  }, [isEdit, tosId]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        title: form.title,
        subject_id: form.subject_id,
        tos_id: tosId || undefined,
        format: form.format || 'print',
        set_count: Number(form.set_count) || 1,
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
      toast.error(err instanceof ApiError ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  const showCreationPanel = !isEdit && !tosId;
  const showTosCallout = !isEdit && !!tos;
  const bloomWeights = tos?.bloom_weights || {};
  const distParts = Object.entries(bloomWeights)
    .filter(([, p]) => p > 0)
    .map(([b, p]) => `${BLOOM_LABELS[b] || b} ${p}%`);
  const distribution = distParts.join(', ');

  return (
    <AppShell activeNav="exams" pageTitle={isEdit ? 'Edit exam' : 'New exam'}>
      <div className="form-container form-container--wide">
        <div className="page-header">
          <div>
            <h1>{isEdit ? 'Edit exam' : 'New exam'}</h1>
            <p className="page-sub">{isEdit ? 'Update the exam details.' : 'Start from a blueprint or create a blank exam.'}</p>
          </div>
        </div>

        {showCreationPanel && (
          <section className="creation-panel mb-2" aria-labelledby="creation-method-title">
            <div className="creation-panel-head">
              <div>
                <h2 id="creation-method-title">Start from a blueprint</h2>
                <p>Automatically select questions using the blueprint's subject and Bloom distribution.</p>
              </div>
              <span className="creation-tag">Recommended</span>
            </div>
            <div className="creation-panel-body">
              {tosList.length > 0 ? (
                <>
                  <div className="creation-blueprints">
                    {tosList.slice(0, 3).map((bp) => (
                      <Link key={bp.id} to={`/exams/new?tos=${bp.id}`} className="creation-blueprint-link">
                        <span>
                          <strong>{bp.title}</strong>
                          <small>{bp.subject_name || bp.subject_code} · {bp.total_items} items</small>
                        </span>
                        <ChevronRight size={15} />
                      </Link>
                    ))}
                  </div>
                  <Link to="/tos" className="creation-mode-action">View all blueprints <ArrowRight size={14} /></Link>
                </>
              ) : (
                <div className="creation-empty">
                  <span>No blueprints yet.</span>
                  <Link to="/tos">Create a blueprint</Link>
                </div>
              )}
            </div>
            <div className="creation-panel-footer">
              <div>
                <strong>Start with a blank exam</strong>
                <span>Add and organize questions manually.</span>
              </div>
              <button className="btn btn-outline" onClick={() => setShowBlank(true)}>Continue blank</button>
            </div>
          </section>
        )}

        {showTosCallout && (
          <div className="callout callout-warning mb-2">
            <div className="callout-icon"><TableIcon size={18} /></div>
            <div>
              <div className="callout-title">Generating from TOS: {tos.title}</div>
              <div className="callout-detail">
                Total items: {tos.total_items}
                {distribution && ` · Bloom distribution: ${distribution}`}
              </div>
              <div className="callout-note">
                <Info size={13} />
                This pulls from your <strong>approved (active)</strong> question bank — not drafts. If you need more questions, use the blueprint's "Auto-generate Questions" button first, then approve the drafts on the Questions page.
              </div>
            </div>
          </div>
        )}

        {(isEdit || showTosCallout || showBlank) && (
          <>
            {!isEdit && !showTosCallout && showBlank && (
              <div className="section-kicker" id="exam-details">Blank exam details</div>
            )}
            <div className="card" aria-labelledby={showBlank ? 'exam-details' : undefined}>
              <div className="card-body">
                <form onSubmit={handleSave} noValidate>
                  <div className="form-section">
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
                          <option value="print">Print</option>
                          <option value="digital">Digital</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="set_count">Exam Sets</label>
                        <select id="set_count" name="set_count" className="form-control form-select"
                          value={form.set_count} onChange={(e) => setForm({ ...form, set_count: e.target.value })}>
                          <option value={1}>1 set (Set A only)</option>
                          <option value={2}>2 sets (Set A + Set B)</option>
                        </select>
                        <small className="form-hint">Set B has the same questions in shuffled order.</small>
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
                        <div className="form-hint">Publishing is managed from the exam details page so it always requires an explicit confirmation.</div>
                      </div>
                    )}
                  </div>

                  <div className="form-actions form-actions--sticky">
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? <span className="btn-spinner" /> : <Check size={16} />}
                      {isEdit ? 'Update Exam' : (showTosCallout ? 'Generate Exam' : 'Create Blank Exam')}
                    </button>
                    <Link to={isEdit ? `/exams/${id}` : '/exams'} className="btn btn-outline">Cancel</Link>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
