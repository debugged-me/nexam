/**
 * ExamDetailPage — exam detail with question attachment, PDF generation,
 * download, and LMS export.
 *
 * Uses a page header, status badges, actions, statistics, and cards for
 * Instructions / Questions / Downloads / LMS Export.
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Plus, Trash2, FileText, FileCheck, Download, Send, Printer,
  Pencil, HelpCircle, Clock, Monitor,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import api, { ApiError, getToken } from '../lib/api.js';
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
  const [downloadsVisible, setDownloadsVisible] = useState(false);

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
      setDownloadsVisible(true);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublish() {
    if (!confirm('Publish exam? The exam will be marked as published and ready for use.')) return;
    try {
      await api.put(`/exams/${id}`, { ...data.exam, status: 'published' });
      toast.success('Exam published.');
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Publish failed.');
    }
  }

  function downloadUrl(type, set) {
    const base = import.meta.env.VITE_API_BASE || '/api';
    const params = new URLSearchParams();
    if (set) params.set('set', set);
    params.set('token', getToken());
    return `${base}/exams/${id}/download/${type}?${params.toString()}`;
  }

  function exportUrl(format) {
    const base = import.meta.env.VITE_API_BASE || '/api';
    const params = new URLSearchParams({ token: getToken() });
    return `${base}/exams/${id}/export/${format}?${params.toString()}`;
  }

  if (!data) return <AppShell activeNav="exams" pageTitle="Exam"><p className="placeholder">Loading…</p></AppShell>;
  const { exam, questions, tos, sets } = data;
  const published = exam.status === 'published';
  const print = exam.format === 'print';
  const hasSets = Array.isArray(sets) && sets.length > 0;
  const showDownloads = downloadsVisible || hasSets;

  return (
    <AppShell activeNav="exams" pageTitle={exam.title}>
      <div className="page-header">
        <div>
          <h1>{exam.title}</h1>
          {exam.subject_name && <span className="badge badge-gray">{exam.subject_name}</span>}
          {published
            ? <span className="badge badge-green">Published</span>
            : <span className="badge badge-amber">Draft</span>}
        </div>
        <div className="header-actions">
          {!published && (
            <button className="btn btn-primary btn-sm" onClick={handlePublish}>
              <Send size={14} /> Publish
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={generating || !questions.length}>
            {generating ? <span className="btn-spinner" /> : <FileText size={14} />}
            Generate PDFs
          </button>
          {print && (
            <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
              <Printer size={14} /> Print
            </button>
          )}
          <Link to={`/exams/${id}/edit`} className="btn btn-outline btn-sm">
            <Pencil size={14} /> Edit
          </Link>
        </div>
      </div>

      <div className="stats-grid mb-2">
        <div className="stat-card">
          <div className="stat-icon blue"><FileText size={18} /></div>
          <div className="stat-info"><div className="stat-value">{questions.length}</div><div className="stat-label">Questions</div></div>
        </div>
        <div className="stat-card">
          <div className={`stat-icon ${print ? 'amber' : 'green'}`}>
            {print ? <Printer size={18} /> : <Monitor size={18} />}
          </div>
          <div className="stat-info"><div className="stat-value stat-value-sm">{exam.format}</div><div className="stat-label">Format</div></div>
        </div>
        {exam.duration_minutes && (
          <div className="stat-card">
            <div className="stat-icon purple"><Clock size={18} /></div>
            <div className="stat-info"><div className="stat-value">{exam.duration_minutes}</div><div className="stat-label">Minutes</div></div>
          </div>
        )}
      </div>

      {exam.instructions && (
        <div className="card mb-2">
          <div className="card-header"><span className="card-title">Instructions</span></div>
          <div className="card-body">
            <p className="preserve-lines">{exam.instructions}</p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Questions</span>
          {questions.length > 0 && (
            <>
              <span className="text-muted meta-sm">{questions.length} total</span>
              <button className="btn btn-outline btn-sm" onClick={openPicker}>
                <Plus size={14} /> Add questions
              </button>
            </>
          )}
        </div>
        {questions.length === 0 ? (
          <div className="empty-state empty-state-lg">
            <div className="empty-icon"><HelpCircle size={26} /></div>
            <h4>No questions in this exam</h4>
            <p>Add approved questions from your question bank or generate from a TOS blueprint.</p>
            <button className="btn btn-primary btn-sm" onClick={openPicker}>
              <Plus size={14} /> Add questions
            </button>
          </div>
        ) : (
          <div className="table-wrap table-bare">
            <table className="data-table">
              <caption className="sr-only">Questions included in {exam.title}</caption>
              <thead>
                <tr>
                  <th className="col-num">#</th>
                  <th>Question</th>
                  <th>Type</th>
                  <th>Bloom</th>
                  <th style={{ width: 50 }}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q, i) => (
                  <tr key={q.id}>
                    <td className="text-muted">{i + 1}</td>
                    <td className="cell-medium">{q.stem}</td>
                    <td><span className="badge badge-gray">{TYPE_LABELS[q.type] || q.type}</span></td>
                    <td>{q.bloom
                      ? <span className="badge badge-purple">{BLOOM_LABELS[q.bloom] || q.bloom}</span>
                      : <span className="g-mute">—</span>}
                    </td>
                    <td>
                      <button className="action-icon danger" onClick={() => handleRemoveQ(q.id)} title="Remove question">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDownloads && (
        <div className="card" id="exam-downloads">
          <div className="card-header">
            <span className="card-title">Downloads</span>
            <span className="text-muted meta-sm">Generated PDFs</span>
          </div>
          <div className="card-body">
            <div className="download-list">
              {(hasSets ? sets.map((s) => s.set_label) : Array.from({ length: exam.set_count }, (_, i) => String.fromCharCode(65 + i))).map((label) => {
                return (
                  <div key={label} className="download-group">
                    <h4>Set {label}</h4>
                    <a className="btn btn-outline btn-sm" href={downloadUrl('exam', label)} target="_blank" rel="noreferrer">
                      <FileText size={14} /> Exam PDF
                    </a>
                    <a className="btn btn-outline btn-sm" href={downloadUrl('answerkey', label)} target="_blank" rel="noreferrer">
                      <FileCheck size={14} /> Answer Key
                    </a>
                    <a className="btn btn-outline btn-sm" href={downloadUrl('omr', label)} target="_blank" rel="noreferrer">
                      <Download size={14} /> OMR Sheet
                    </a>
                  </div>
                );
              })}
              {tos && (
                <a className="btn btn-outline btn-sm" href={downloadUrl('tos-report')} target="_blank" rel="noreferrer">
                  <FileText size={14} /> TOS Report
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">LMS Export</span>
          <span className="text-muted meta-sm">Moodle & Canvas</span>
        </div>
        <div className="card-body">
          <p className="text-muted mb-2">Export this exam's questions to a learning management system.</p>
          <a className="btn btn-outline btn-sm" href={exportUrl('gift')} target="_blank" rel="noreferrer">
            <Download size={14} /> Moodle GIFT
          </a>
          <a className="btn btn-outline btn-sm" href={exportUrl('xml')} target="_blank" rel="noreferrer">
            <Download size={14} /> Canvas XML
          </a>
        </div>
      </div>

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
