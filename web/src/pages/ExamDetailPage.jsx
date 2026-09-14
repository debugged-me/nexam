/**
 * ExamDetailPage — exam detail with question attachment, PDF generation,
 * download, and LMS export.
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, FileDown, FileText, FileCheck, Download, Sparkles } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import '../styles/exams.css';

const BLOOM_LABELS = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create' };
const TYPE_LABELS = { mcq: 'MCQ', true_false: 'T/F', matching: 'Match', identification: 'Ident' };

export default function ExamDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [availableQs, setAvailableQs] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [attaching, setAttaching] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(() => {
    api.get(`/exams/${id}`)
      .then(setData)
      .catch((err) => { toast.error(err.message || 'Could not load exam.'); navigate('/exams'); });
  }, [id, toast, navigate]);

  useEffect(() => { load(); }, [load]);

  async function openPicker() {
    if (!data) return;
    try {
      const qData = await api.get(`/questions?subject_id=${data.exam.subject_id}&status=active`);
      // Filter out already-attached
      const attachedIds = new Set(data.questions.map((q) => q.id));
      setAvailableQs(qData.questions.filter((q) => !attachedIds.has(q.id)));
      setSelected(new Set());
      setPickerOpen(true);
    } catch (err) {
      toast.error(err.message || 'Could not load questions.');
    }
  }

  async function handleAttach() {
    setAttaching(true);
    try {
      const ids = Array.from(selected);
      const result = await api.post(`/exams/${id}/questions`, { question_ids: ids });
      toast.success(`${result.added} question${result.added === 1 ? '' : 's'} attached.`);
      setPickerOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Attach failed.');
    } finally {
      setAttaching(false);
    }
  }

  async function handleRemoveQ(qid) {
    try {
      await api.del(`/exams/${id}/questions/${qid}`);
      toast.success('Question removed.');
      load();
    } catch (err) {
      toast.error(err.message || 'Remove failed.');
    }
  }

  async function handleGenerate() {
    if (!data?.questions?.length) { toast.error('Attach questions first.'); return; }
    setGenerating(true);
    try {
      const result = await api.post(`/exams/${id}/generate-sets`, { setCount: data.exam.set_count });
      toast.success(`Generated ${result.sets.length} set(s).`);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  }

  function downloadUrl(type, set) {
    const base = import.meta.env.VITE_API_BASE || '/api';
    const url = `${base}/exams/${id}/download/${type}${set ? `?set=${set}` : ''}`;
    // Append JWT as query param for download links (can't set headers on <a> tags)
    const token = localStorage.getItem('nexam_token');
    return `${url}&token=${token}`;
  }

  function exportUrl(format) {
    const base = import.meta.env.VITE_API_BASE || '/api';
    const token = localStorage.getItem('nexam_token');
    return `${base}/exams/${id}/export/${format}?token=${token}`;
  }

  if (!data) return <AppShell activeNav="exams" pageTitle="Exam"><p className="placeholder">Loading…</p></AppShell>;
  const { exam, questions, tos } = data;

  return (
    <AppShell activeNav="exams" pageTitle={exam.title}>
      <div className="page-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Link to="/exams" className="btn"><ArrowLeft size={16} /> Back</Link>
              <div>
                <h1 style={{ margin: 0 }}>{exam.title}</h1>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>
                  {exam.subject_code || exam.subject_name} · {questions.length} questions · {exam.status}
                  {tos && ` · TOS: ${tos.title}`}
                </p>
              </div>
            </div>
            <div className="page-header-actions">
              <button className="btn" onClick={openPicker}><Plus size={16} /> Add questions</button>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating || !questions.length}>
                {generating ? <span className="btn-spinner" /> : <Sparkles size={16} />}
                Generate PDFs
              </button>
            </div>
          </div>
          <div className="exam-detail">
            {/* Main: attached questions */}
            <div className="exam-main">
              <h2>Questions ({questions.length})</h2>
              {questions.length === 0 ? (
                <div className="empty-state">
                  <FileText size={36} style={{ color: 'var(--ink-faint)', marginBottom: 12 }} />
                  <h3>No questions attached</h3>
                  <p>Add approved questions from your question bank to build this exam.</p>
                  <button className="btn btn-primary" onClick={openPicker}><Plus size={16} /> Add questions</button>
                </div>
              ) : (
                questions.map((q, i) => (
                  <div key={q.id} className="attached-q">
                    <div style={{ flex: 1 }}>
                      <div className="attached-q-stem">{i + 1}. {q.stem}</div>
                      <div className="attached-q-meta">
                        {TYPE_LABELS[q.type] || q.type} · {q.bloom ? BLOOM_LABELS[q.bloom] : '—'} · {q.topic || 'No topic'}
                      </div>
                    </div>
                    <button className="btn btn-danger" onClick={() => handleRemoveQ(q.id)} title="Remove">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Side: downloads + export */}
            <div className="exam-side">
              <h2>Downloads</h2>
              {questions.length === 0 ? (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>
                  Generate PDFs after attaching questions.
                </p>
              ) : (
                <div className="download-grid">
                  {Array.from({ length: exam.set_count }, (_, i) => {
                    const label = String.fromCharCode(65 + i);
                    return (
                      <div key={label}>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', margin: '10px 0 6px' }}>
                          Set {label}
                        </div>
                        <a className="download-btn" href={downloadUrl('exam', label)} target="_blank" rel="noreferrer">
                          <FileText size={16} className="download-btn-icon" /> Exam PDF
                        </a>
                        <a className="download-btn" href={downloadUrl('answerkey', label)} target="_blank" rel="noreferrer">
                          <FileCheck size={16} className="download-btn-icon" /> Answer Key
                        </a>
                        <a className="download-btn" href={downloadUrl('omr', label)} target="_blank" rel="noreferrer">
                          <Download size={16} className="download-btn-icon" /> OMR Sheet
                        </a>
                      </div>
                    );
                  })}
                  {tos && (
                    <a className="download-btn" href={downloadUrl('tos-report')} target="_blank" rel="noreferrer" style={{ marginTop: 10 }}>
                      <FileText size={16} className="download-btn-icon" /> TOS Report
                    </a>
                  )}
                </div>
              )}

              <h2 style={{ marginTop: 28 }}>LMS Export</h2>
              {questions.length === 0 ? (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>Add questions first.</p>
              ) : (
                <div className="download-grid">
                  <a className="download-btn" href={exportUrl('gift')} target="_blank" rel="noreferrer">
                    <Download size={16} className="download-btn-icon" /> GIFT (Moodle)
                  </a>
                  <a className="download-btn" href={exportUrl('xml')} target="_blank" rel="noreferrer">
                    <Download size={16} className="download-btn-icon" /> QTI XML (Canvas)
                  </a>
                </div>
              )}
            </div>
          </div>

      {/* Question picker modal */}
      <Modal open={pickerOpen} title="Add questions" subtitle={`From ${exam.subject_code || exam.subject_name}`} onClose={() => setPickerOpen(false)} size="lg"
        footer={<>
          <button className="btn" onClick={() => setPickerOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAttach} disabled={attaching || selected.size === 0}>
            {attaching && <span className="btn-spinner" />}
            Attach {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </>}>
        {availableQs.length === 0 ? (
          <p className="placeholder">No more approved questions available for this subject.</p>
        ) : (
          <div className="q-picker">
            {availableQs.map((q) => (
              <label key={q.id} className={`q-pick-item ${selected.has(q.id) ? 'selected' : ''}`}>
                <input type="checkbox" className="q-pick-checkbox" checked={selected.has(q.id)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(q.id); else next.delete(q.id);
                    setSelected(next);
                  }} />
                <div style={{ flex: 1 }}>
                  <div className="q-pick-stem">{q.stem}</div>
                  <div className="q-pick-meta">
                    {TYPE_LABELS[q.type] || q.type} · {q.bloom ? BLOOM_LABELS[q.bloom] : '—'} · {q.topic || 'No topic'}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
