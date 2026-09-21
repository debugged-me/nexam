/**
 * WizardPage — guided syllabus-to-exam pipeline.
 *
 * Shows the full flow on one page with live progress:
 *   1. Upload syllabus
 *   2. Extract + embed (auto)
 *   3. Generate TOS (auto-chained)
 *   4. Generate questions (auto-chained)
 *   5. Review & approve questions
 *   6. Create exam
 *
 * The instructor picks a subject, and the page polls the pipeline
 * status endpoint to show where things are. Auto-chaining means
 * steps 2-4 happen without any clicks after upload.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload, Sparkles, CheckCircle2, Loader2,
  ClipboardCheck, FilePlus2, ArrowRight, AlertCircle, RefreshCw,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import '../styles/wizard.css';

const STAGES = [
  { key: 'source', label: 'Add source', hint: 'Your syllabus or reference', icon: Upload },
  { key: 'generate', label: 'Generate', hint: 'Blueprint and questions', icon: Sparkles },
  { key: 'review', label: 'Review', hint: 'Approve the strongest items', icon: ClipboardCheck },
  { key: 'exam', label: 'Create exam', hint: 'Assemble and publish', icon: FilePlus2 },
];
const AUTO_STAGES = ['extracting', 'embedding', 'tos_generating', 'question_generating'];

export default function WizardPage() {
  const toast = useToast();
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef(null);
  const pollRef = useRef(null);

  // Load subjects
  useEffect(() => {
    api.get('/subjects').then((data) => {
      setSubjects(data.subjects);
      if (data.subjects[0]) setSelectedSubject(data.subjects[0].id);
    }).catch(() => {});
  }, []);

  // Poll pipeline status when a subject is selected
  const loadPipeline = useCallback(() => {
    if (!selectedSubject) return;
    setLoading(true);
    api.get(`/ai/pipeline/${selectedSubject}`)
      .then((data) => setPipeline(data))
      .catch((err) => toast.error(err.message || 'Could not load pipeline.'))
      .finally(() => setLoading(false));
  }, [selectedSubject, toast]);

  useEffect(() => {
    loadPipeline();
    // Poll every 3s while there are active jobs
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      const activeStages = ['extracting', 'embedding', 'tos_generating', 'question_generating'];
      if (pipeline && activeStages.includes(pipeline.stage)) {
        loadPipeline();
      }
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [selectedSubject, loadPipeline]);

  async function handleFile(file) {
    if (!selectedSubject) { toast.error('Select a subject first.'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('subject_id', selectedSubject);
      fd.append('is_syllabus', 'true');
      await api.post('/materials', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Syllabus uploaded. Pipeline started.');
      setUploadOpen(false);
      loadPipeline();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  // Map failed stages
  const effectiveStage = pipeline?.stage || 'upload';
  const failedStage = effectiveStage.endsWith('_failed') ? effectiveStage : null;

  const stageStatus = (stageKey) => {
    if (!pipeline) return 'pending';
    const hasExam = Boolean(pipeline.exam);
    const autoFailed = Boolean(failedStage);
    if (stageKey === 'source') return effectiveStage === 'upload' ? 'current' : 'done';
    if (stageKey === 'generate') {
      if (autoFailed) return 'failed';
      if (AUTO_STAGES.includes(effectiveStage)) return 'active';
      if (['review', 'exam_ready'].includes(effectiveStage) || hasExam) return 'done';
      return 'pending';
    }
    if (stageKey === 'review') {
      if (effectiveStage === 'review') return 'current';
      if (effectiveStage === 'exam_ready' || hasExam) return 'done';
      return 'pending';
    }
    if (stageKey === 'exam') {
      if (hasExam) return 'done';
      return effectiveStage === 'exam_ready' ? 'current' : 'pending';
    }
    return 'pending';
  };

  return (
    <AppShell activeNav="wizard" pageTitle="Build an exam">
      <header className="wizard-head">
        <div className="wizard-head-copy">
          <span className="wizard-eyebrow"><Sparkles size={13} /> Guided workspace</span>
          <h1>Build an exam</h1>
          <p>Choose a subject and add one source. Nexam handles the setup work; you review the questions and stay in control.</p>
        </div>
        <div className="wizard-subject-picker">
          <label htmlFor="wizard-subject">Subject</label>
          <select
            id="wizard-subject"
            className="form-select"
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
          >
            <option value="">Select subject…</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.code || s.name} — {s.name}</option>
            ))}
          </select>
          <button className="wizard-refresh" onClick={loadPipeline} title="Refresh" aria-label="Refresh workflow status">
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      {!selectedSubject ? (
        <div className="empty-state">
          <h4>Select a subject to begin</h4>
          <p>Choose a subject above to start or continue the exam generation pipeline.</p>
        </div>
      ) : loading && !pipeline ? (
        <p className="placeholder">Loading…</p>
      ) : pipeline && (
        <div className="wizard-pipeline">
          {/* Stage indicators */}
          <div className="wizard-stages">
            {STAGES.map((stage, idx) => {
              const status = stageStatus(stage.key);
              const isFailed = status === 'failed';
              const Icon = stage.icon;
              return (
                <div key={stage.key} className={`wizard-stage ${status} ${isFailed ? 'failed' : ''}`}>
                  <div className="wizard-stage-icon">
                    {status === 'done' ? <CheckCircle2 size={20} /> :
                     status === 'active' ? <Loader2 size={20} className="spin" /> :
                     isFailed ? <AlertCircle size={20} /> :
                     <Icon size={20} />}
                  </div>
                  <div className="wizard-stage-label">
                    <span className="wizard-stage-name">{stage.label}</span>
                    <span className="wizard-stage-status">
                      {status === 'done' ? 'Complete' :
                       status === 'active' ? 'Working automatically…' :
                       status === 'current' ? stage.hint :
                       isFailed ? 'Failed' :
                       stage.hint}
                    </span>
                  </div>
                  {idx < STAGES.length - 1 && <div className="wizard-stage-connector" />}
                </div>
              );
            })}
          </div>

          {/* Current stage detail */}
          <div className="wizard-detail">
            {effectiveStage === 'upload' && (
              <div className="wizard-card">
                <h3>Step 1: Upload Syllabus</h3>
                <p>Upload a college syllabus (PDF, DOCX, PPTX, TXT, or MD). The system will extract topics, instructional hours, and learning outcomes to build the exam blueprint.</p>
                <button className="btn btn-primary" onClick={() => setUploadOpen(true)}>
                  <Upload size={16} /> Upload Syllabus
                </button>
              </div>
            )}

            {(effectiveStage === 'extracting' || effectiveStage === 'embedding') && (
              <div className="wizard-card">
                <h3>Processing Syllabus</h3>
                <p>Extracting text and embedding chunks into the vector store. This happens automatically — no action needed.</p>
                {pipeline.syllabus && (
                  <div className="wizard-info">
                    <span className="badge badge-gray">{pipeline.syllabus.title}</span>
                    <span className="text-muted">Status: {pipeline.syllabus.status}</span>
                  </div>
                )}
              </div>
            )}

            {effectiveStage === 'tos_generating' && (
              <div className="wizard-card">
                <h3>Generating Blueprint (TOS)</h3>
                <p>The AI is extracting topics and instructional hours from your syllabus and computing item weights. This happens automatically.</p>
              </div>
            )}

            {effectiveStage === 'question_generating' && (
              <div className="wizard-card">
                <h3>Generating Questions</h3>
                <p>The AI is generating RAG-grounded questions from your materials based on the blueprint. This may take a few minutes due to rate limits.</p>
                {pipeline.tos && (
                  <div className="wizard-info">
                    <Link to={`/tos/${pipeline.tos.id}`} className="g-link">View blueprint: {pipeline.tos.title}</Link>
                  </div>
                )}
              </div>
            )}

            {effectiveStage === 'review' && (
              <div className="wizard-card">
                <h3>Review & Approve Questions</h3>
                <p>Generated questions are drafts awaiting your approval. Review each one — only approved questions enter the question bank and can be used in exams.</p>
                <div className="wizard-stats">
                  <div className="wizard-stat">
                    <span className="wizard-stat-num">{pipeline.questions.draft}</span>
                    <span className="wizard-stat-label">Draft (pending review)</span>
                  </div>
                  <div className="wizard-stat">
                    <span className="wizard-stat-num">{pipeline.questions.approved}</span>
                    <span className="wizard-stat-label">Approved</span>
                  </div>
                  <div className="wizard-stat">
                    <span className="wizard-stat-num">{pipeline.questions.rejected}</span>
                    <span className="wizard-stat-label">Rejected</span>
                  </div>
                </div>
                <Link to="/questions" className="btn btn-primary">
                  <ClipboardCheck size={16} /> Review Questions <ArrowRight size={14} />
                </Link>
              </div>
            )}

            {effectiveStage === 'exam_ready' && (
              <div className="wizard-card">
                <h3>Create Exam</h3>
                <p>All questions are approved. Create an exam from your blueprint and generate print-ready PDFs, answer keys, and OMR sheets.</p>
                {pipeline.tos && (
                  <div className="wizard-info">
                    <Link to={`/tos/${pipeline.tos.id}`} className="g-link">Blueprint: {pipeline.tos.title}</Link>
                  </div>
                )}
                <Link to="/exams/new" className="btn btn-primary">
                  <FilePlus2 size={16} /> Create Exam <ArrowRight size={14} />
                </Link>
              </div>
            )}

            {/* Failed states */}
            {failedStage && (
              <div className="wizard-card wizard-card-error">
                <h3>Stage Failed</h3>
                <p>The pipeline encountered an error at the <strong>{failedStage.replace('_', ' ')}</strong> stage.</p>
                {pipeline.jobs.extract?.error && <p className="text-muted">{pipeline.jobs.extract.error}</p>}
                {pipeline.jobs.embed?.error && <p className="text-muted">{pipeline.jobs.embed.error}</p>}
                {pipeline.jobs.tos?.error && <p className="text-muted">{pipeline.jobs.tos.error}</p>}
                {pipeline.jobs.generate?.error && <p className="text-muted">{pipeline.jobs.generate.error}</p>}
                <button className="btn btn-outline" onClick={loadPipeline}>
                  <RefreshCw size={14} /> Retry / Refresh
                </button>
              </div>
            )}

            {/* Already has an exam */}
            {pipeline.exam && (
              <div className="wizard-card wizard-card-success">
                <h3>Exam Created</h3>
                <p>An exam has already been generated for this subject.</p>
                <Link to={`/exams/${pipeline.exam.id}`} className="btn btn-primary">
                  View Exam <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload modal */}
      <Modal open={uploadOpen} title="Upload Syllabus" onClose={() => setUploadOpen(false)} size="lg"
        footer={<button className="btn" onClick={() => setUploadOpen(false)}>Close</button>}>
        <div className="form-group">
          <label className="form-label">Subject</label>
          <input className="form-input" disabled value={subjects.find((s) => s.id === selectedSubject)?.name || ''} />
        </div>
        <div
          className={`upload-zone ${dragOver ? 'dragover' : ''}`}
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          <Upload size={36} className="upload-zone-icon" />
          <div className="upload-zone-text">{uploading ? 'Uploading…' : 'Click to browse or drag a file here'}</div>
          <div className="upload-zone-hint">PDF, DOCX, PPTX, TXT, MD — max 50 MB</div>
          <input ref={fileInput} type="file" style={{ display: 'none' }}
            accept=".pdf,.docx,.pptx,.txt,.md,application/pdf,text/plain,text/markdown"
            onChange={(e) => { const f = e.target.files[0]; if (f) handleFile(f); }} />
        </div>
        <p className="text-muted" style={{ marginTop: 12, fontSize: 'var(--text-sm)' }}>
          After upload, the system automatically: extracts text → embeds chunks → generates TOS blueprint → generates questions. You then review and approve.
        </p>
      </Modal>
    </AppShell>
  );
}
