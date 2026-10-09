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
  Pencil, HelpCircle, Clock, Monitor, QrCode, ScanLine, Sparkles,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import Modal from '../components/Modal.jsx';
import api, { ApiError, getToken } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import { PageLoader } from '../components/Loaders.jsx';
import { StatusPill, GroupChip, groupColor } from '../components/Board.jsx';
import '../styles/exams.css';

const BLOOM_LABELS = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create' };
const TYPE_LABELS = { mcq: 'MCQ', true_false: 'T/F', matching: 'Match', identification: 'Ident' };

export default function ExamDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [data, setData] = useState(() => api.peek(`/exams/${id}`) ?? null);
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
    if (!(await confirm('Publish exam? The exam will be marked as published and ready for use.', { title: 'Publish exam', confirmText: 'Publish', danger: false }))) return;
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

  if (!data) return <AppShell activeNav="exams" pageTitle="Exam"><PageLoader label="Loading exam…" /></AppShell>;
  const { exam, questions, tos, sets } = data;
  const published = exam.status === 'published';
  const print = exam.format === 'print';
  const hasSets = Array.isArray(sets) && sets.length > 0;
  const showDownloads = downloadsVisible || hasSets;
  const accent = groupColor(exam.subject_id || exam.subject_name);
  const setLabels = hasSets
    ? sets.map((s) => s.set_label)
    : Array.from({ length: exam.set_count }, (_, i) => String.fromCharCode(65 + i));

  return (
    <AppShell activeNav="exams" pageTitle={exam.title}>
      <div className="page-header">
        <div>
          <span className="eyebrow">Exam</span>
          <h1>{exam.title}</h1>
          <div className="exam-meta">
            {exam.subject_name && <GroupChip color={accent}>{exam.subject_name}</GroupChip>}
            <StatusPill status={exam.status} small inline />
          </div>
        </div>
        <div className="header-actions">
          {!published && (
            <button className="btn btn-primary btn-sm" onClick={handlePublish}>
              <Send size={14} /> Publish
            </button>
          )}
          <button className={`btn btn-sm ${hasSets ? 'btn-outline' : 'btn-brand'}`} onClick={handleGenerate} disabled={generating || !questions.length}>
            {generating ? <span className="btn-spinner" /> : <Sparkles size={14} />}
            {hasSets ? 'Regenerate sets' : 'Generate sets'}
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

      <div className="exam-detail-layout">
        <div className="exam-detail-main">
          {/* The payoff: parallel print packs. One card per set, every artefact a real target. */}
          {showDownloads && (
            <section className="print-packs" id="exam-downloads" aria-label="Generated print packs">
              {setLabels.map((label) => (
                <article key={label} className="print-pack">
                  <header className="print-pack-head">
                    <span className="print-pack-set">Set {label}</span>
                    <span className="print-pack-meta">{questions.length} {questions.length === 1 ? 'item' : 'items'}{print ? ' · print' : ' · digital'}</span>
                    <QrCode size={18} className="print-pack-qr" aria-hidden="true" />
                  </header>
                  <div className="print-pack-files">
                    <a className="print-pack-file" href={downloadUrl('exam', label)} target="_blank" rel="noreferrer">
                      <FileText size={16} aria-hidden="true" /><span><strong>Exam paper</strong><small>PDF</small></span><Download size={14} aria-hidden="true" />
                    </a>
                    <a className="print-pack-file" href={downloadUrl('answerkey', label)} target="_blank" rel="noreferrer">
                      <FileCheck size={16} aria-hidden="true" /><span><strong>Answer key</strong><small>PDF</small></span><Download size={14} aria-hidden="true" />
                    </a>
                    <a className="print-pack-file" href={downloadUrl('omr', label)} target="_blank" rel="noreferrer">
                      <ScanLine size={16} aria-hidden="true" /><span><strong>OMR sheet</strong><small>QR-linked · PDF</small></span><Download size={14} aria-hidden="true" />
                    </a>
                  </div>
                </article>
              ))}
            </section>
          )}

          {exam.instructions && (
            <div className="card card-instructions" style={{ '--gc': accent }}>
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
              <div className="empty-state">
                <div className="empty-icon"><HelpCircle size={24} /></div>
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
        </div>

        <aside className="exam-detail-side">
          <div className="card">
            <div className="card-header"><span className="card-title">Details</span></div>
            <dl className="detail-rows">
              <div className="detail-row"><dt>Status</dt><dd><StatusPill status={exam.status} small inline /></dd></div>
              {exam.subject_name && (
                <div className="detail-row"><dt>Subject</dt><dd><GroupChip color={accent}>{exam.subject_name}</GroupChip></dd></div>
              )}
              <div className="detail-row">
                <dt>Format</dt>
                <dd>{print ? <Printer size={13} /> : <Monitor size={13} />} {print ? 'Print' : 'Digital'}</dd>
              </div>
              {exam.duration_minutes && (
                <div className="detail-row"><dt>Duration</dt><dd><Clock size={13} /> {exam.duration_minutes} min</dd></div>
              )}
              <div className="detail-row"><dt>Questions</dt><dd>{questions.length}</dd></div>
              <div className="detail-row"><dt>Sets</dt><dd>{exam.set_count > 1 ? 'A + B' : 'A'}</dd></div>
              {tos && (
                <div className="detail-row"><dt>Blueprint</dt><dd className="detail-ellip" title={tos.title}>{tos.title || 'Linked'}</dd></div>
              )}
              <div className="detail-row"><dt>Created</dt><dd>{new Date(exam.created_at).toLocaleDateString()}</dd></div>
            </dl>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Export</span></div>
            <div className="card-body dl-body">
              {showDownloads && tos && (
                <a className="print-pack-file" href={downloadUrl('tos-report')} target="_blank" rel="noreferrer">
                  <FileText size={16} aria-hidden="true" /><span><strong>TOS report</strong><small>Blueprint coverage · PDF</small></span><Download size={14} aria-hidden="true" />
                </a>
              )}
              <a className="print-pack-file" href={exportUrl('gift')} target="_blank" rel="noreferrer">
                <Download size={16} aria-hidden="true" /><span><strong>Moodle</strong><small>GIFT</small></span><Download size={14} aria-hidden="true" />
              </a>
              <a className="print-pack-file" href={exportUrl('xml')} target="_blank" rel="noreferrer">
                <Download size={16} aria-hidden="true" /><span><strong>Canvas</strong><small>QTI XML</small></span><Download size={14} aria-hidden="true" />
              </a>
            </div>
          </div>
        </aside>
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
