/**
 * MaterialsPage — upload and manage instructor source materials.
 *
 * Supports file upload (PDF/DOCX/PPTX/TXT), URL, YouTube, and raw text.
 * Shows processing status (pending/processing/completed/failed).
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { Upload, Link2, Video, FileText, Trash2, RotateCw, FileStack, Sparkles } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import '../styles/materials.css';

export default function MaterialsPage() {
  const toast = useToast();
  const [materials, setMaterials] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState('file'); // file | url | text
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ subject_id: '', title: '', url: '', content: '', is_syllabus: false });
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef(null);

  const load = useCallback(() => {
    api.get('/materials')
      .then((data) => setMaterials(data.materials))
      .catch((err) => toast.error(err.message || 'Could not load materials.'));
  }, [toast]);

  useEffect(() => {
    api.get('/subjects').then((data) => {
      setSubjects(data.subjects);
      if (data.subjects[0]) setForm((f) => ({ ...f, subject_id: f.subject_id || data.subjects[0].id }));
    }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleFile(file) {
    if (!form.subject_id) { toast.error('Select a subject first.'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('subject_id', form.subject_id);
      if (form.title) fd.append('title', form.title);
      fd.append('is_syllabus', form.is_syllabus ? 'true' : 'false');
      await api.post('/materials', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Material uploaded. Processing started.');
      setUploadOpen(false);
      setForm({ ...form, title: '' });
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleUrlSubmit(e) {
    e.preventDefault();
    if (!form.subject_id) { toast.error('Select a subject first.'); return; }
    if (!form.url) { toast.error('URL is required.'); return; }
    setUploading(true);
    try {
      await api.post('/materials', {
        subject_id: form.subject_id,
        title: form.title || undefined,
        url: form.url,
        is_syllabus: form.is_syllabus,
      });
      toast.success('Material submitted. Processing started.');
      setUploadOpen(false);
      setForm({ ...form, url: '', title: '' });
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Submit failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleTextSubmit(e) {
    e.preventDefault();
    if (!form.subject_id) { toast.error('Select a subject first.'); return; }
    if (!form.content || form.content.trim().length < 10) { toast.error('Content is too short.'); return; }
    setUploading(true);
    try {
      await api.post('/materials', {
        subject_id: form.subject_id,
        title: form.title || 'Pasted text',
        content: form.content,
        is_syllabus: form.is_syllabus,
      });
      toast.success('Material submitted. Processing started.');
      setUploadOpen(false);
      setForm({ ...form, content: '', title: '' });
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Submit failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(mat) {
    if (!confirm('Delete this material? Its chunks and embeddings will be removed.')) return;
    try { await api.del(`/materials/${mat.id}`); toast.success('Material deleted.'); load(); }
    catch (err) { toast.error(err.message || 'Delete failed.'); }
  }

  async function handleReprocess(mat) {
    try { await api.post(`/materials/${mat.id}/reprocess`); toast.success('Reprocessing started.'); load(); }
    catch (err) { toast.error(err.message || 'Reprocess failed.'); }
  }

  async function handleGenerateTos(mat) {
    try {
      await api.post('/ai/syllabus-tos', { materialId: mat.id });
      toast.success('TOS generation queued. Check the Blueprints (TOS) page shortly.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'TOS generation failed.');
    }
  }

  const SOURCE_ICONS = { pdf: FileText, docx: FileText, pptx: FileText, text: FileText, url: Link2, youtube: Video, file: FileStack };

  return (
    <AppShell activeNav="materials" pageTitle="Materials">
      <div className="mat-toolbar">
            <h1>Materials</h1>
            <button className="btn btn-primary" onClick={() => setUploadOpen(true)}>
              <Upload size={16} /> Upload material
            </button>
          </div>
          {materials === null ? (
            <p className="placeholder">Loading…</p>
          ) : materials.length === 0 ? (
            <div className="empty-state">
              <FileStack size={40} style={{ color: 'var(--ink-faint)', marginBottom: 12 }} />
              <h3>No materials yet</h3>
              <p>Upload PDFs, DOCX, PPTX, URLs, or YouTube transcripts to ground RAG question generation.</p>
              <button className="btn btn-primary" onClick={() => setUploadOpen(true)}>
                <Upload size={16} /> Upload first material
              </button>
            </div>
          ) : (
            <div className="mat-list">
              {materials.map((m) => {
                const Icon = SOURCE_ICONS[m.source_type] || FileText;
                return (
                  <div key={m.id} className="mat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                      <Icon size={20} style={{ color: 'var(--ink-3)' }} />
                      <div>
                        <div className="mat-card-title">{m.title}</div>
                        <div className="mat-card-meta">
                          {m.source_type} · {m.chunk_count || 0} chunks
                          {m.is_syllabus ? ' · syllabus' : ''}
                          {' · '}<span className={`mat-status ${m.status}`}>{m.status}</span>
                          {m.error && ` · ${m.error}`}
                        </div>
                      </div>
                    </div>
                    <div className="mat-card-actions">
                      {m.is_syllabus && m.status === 'processed' && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleGenerateTos(m)} title="Auto-create a Table of Specification blueprint from this syllabus">
                          <Sparkles size={14} /> Auto-generate Blueprint
                        </button>
                      )}
                      {m.status === 'failed' && (
                        <button className="btn" onClick={() => handleReprocess(m)} title="Reprocess">
                          <RotateCw size={14} />
                        </button>
                      )}
                      <button className="btn btn-danger" onClick={() => handleDelete(m)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

      <Modal open={uploadOpen} title="Upload material" onClose={() => setUploadOpen(false)} size="lg"
        footer={uploadMode === 'file' ? (
          <button className="btn" onClick={() => setUploadOpen(false)}>Close</button>
        ) : undefined}>
        {/* Subject + syllabus toggle (shared) */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Subject <span className="req">*</span></label>
            <select className="form-input" style={{ paddingLeft: 16 }} value={form.subject_id}
              onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
              <option value="">Select…</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.code || s.name} — {s.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Title (optional)</label>
            <input className="form-input" style={{ paddingLeft: 16 }} value={form.title} maxLength={255}
              onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--ink-2)' }}>
            <input type="checkbox" checked={form.is_syllabus}
              onChange={(e) => setForm({ ...form, is_syllabus: e.target.checked })} />
            Mark as syllabus (used for TOS generation)
          </label>
        </div>

        {/* Source tabs */}
        <div className="mat-source-tabs">
          <button className={`mat-source-tab ${uploadMode === 'file' ? 'active' : ''}`} onClick={() => setUploadMode('file')}>
            <Upload size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />File
          </button>
          <button className={`mat-source-tab ${uploadMode === 'url' ? 'active' : ''}`} onClick={() => setUploadMode('url')}>
            <Link2 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />URL / Video
          </button>
          <button className={`mat-source-tab ${uploadMode === 'text' ? 'active' : ''}`} onClick={() => setUploadMode('text')}>
            <FileText size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Text
          </button>
        </div>

        {uploadMode === 'file' && (
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
            <div className="upload-zone-hint">PDF, DOCX, PPTX, TXT — max 50 MB</div>
            <input ref={fileInput} type="file" style={{ display: 'none' }}
              accept=".pdf,.docx,.pptx,.txt,application/pdf,text/plain"
              onChange={(e) => { const f = e.target.files[0]; if (f) handleFile(f); }} />
          </div>
        )}

        {uploadMode === 'url' && (
          <form onSubmit={handleUrlSubmit}>
            <div className="form-group">
              <label className="form-label">URL <span className="req">*</span></label>
              <input className="form-input" style={{ paddingLeft: 16 }} placeholder="https://… or https://youtube.com/…"
                value={form.url} required
                onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button type="button" className="btn" onClick={() => setUploadOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={uploading}>
                {uploading && <span className="btn-spinner" />}Submit
              </button>
            </div>
          </form>
        )}

        {uploadMode === 'text' && (
          <form onSubmit={handleTextSubmit}>
            <div className="form-group">
              <label className="form-label">Content <span className="req">*</span></label>
              <textarea className="form-input" style={{ minHeight: 200, padding: '12px 16px', resize: 'vertical' }}
                placeholder="Paste text content here…" value={form.content} required
                onChange={(e) => setForm({ ...form, content: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button type="button" className="btn" onClick={() => setUploadOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={uploading}>
                {uploading && <span className="btn-spinner" />}Submit
              </button>
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}
