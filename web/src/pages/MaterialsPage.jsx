/**
 * MaterialsPage — upload and manage instructor source materials.
 *
 * Supports file upload (PDF/DOCX/PPTX/TXT), URL, YouTube, and raw text.
 * Status vocabulary is pending → processed | failed: the row is created
 * 'pending' (routes/materials.js), and the extract worker flips it to
 * 'processed' or 'failed' (worker/handlers/extract.js). There is no separate
 * "processing" row state — a pending row is what "still working" looks like,
 * so the list polls while anything is pending.
 *
 * Upload ergonomics: files can be dropped anywhere on the page, several at a
 * time. They land in a staging queue that remembers the subject for the rest
 * of the session and guesses "is this a syllabus?" from the filename — a
 * guess that is always shown and always overridable, because the syllabus
 * flag is what unlocks TOS generation.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Upload, Link2, Video, FileText, Trash2, RotateCw, FileStack, Sparkles,
  BookOpen, Loader2, CheckCircle2, AlertCircle, RefreshCw, X,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import api, { ApiError, getToken } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import '../styles/materials.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';

/** Subject is remembered per session so a batch of uploads never re-asks. */
const SUBJECT_MEMORY_KEY = 'nexam.materials.subject';

/** Filenames that obviously name a syllabus — a hint, never a silent decision. */
const SYLLABUS_HINT = /syllab|course[\s_-]*outline/i;

const POLL_MS = 5000;
const MAX_POLLS = 60; // 5 minutes of polling, then the manual Refresh takes over

let queueSeq = 0;

function looksLikeSyllabus(name) {
  return SYLLABUS_HINT.test(name || '');
}

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** sessionStorage can throw (private mode, blocked storage) — never let it break the page. */
function recallSubject() {
  try { return sessionStorage.getItem(SUBJECT_MEMORY_KEY) || ''; } catch { return ''; }
}
function rememberSubject(id) {
  try { if (id) sessionStorage.setItem(SUBJECT_MEMORY_KEY, String(id)); } catch { /* ignore */ }
}

/** True when a drag actually carries files (not text selections or links). */
function dragHasFiles(e) {
  const types = e.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes('Files');
}

export default function MaterialsPage() {
  const toast = useToast();
  const [materials, setMaterials] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState('file'); // file | url | text
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ subject_id: '', title: '', url: '', content: '', is_syllabus: false });
  const [dragOver, setDragOver] = useState(false);   // inside the modal drop zone
  const [pageDrag, setPageDrag] = useState(false);   // anywhere on the page
  const [queue, setQueue] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pollsUsed, setPollsUsed] = useState(0);
  const fileInput = useRef(null);
  const dragDepth = useRef(0);

  const load = useCallback(() => {
    api.get('/materials')
      .then((data) => setMaterials(data.materials))
      .catch((err) => toast.error(err.message || 'Could not load materials.'));
  }, [toast]);

  useEffect(() => {
    api.get('/subjects').then((data) => {
      const list = data.subjects || [];
      setSubjects(list);
      setForm((f) => {
        if (f.subject_id) return f;
        const remembered = recallSubject();
        if (remembered && list.some((s) => String(s.id) === String(remembered))) {
          return { ...f, subject_id: remembered };
        }
        // Exactly one subject: never ask. More than one and nothing remembered: ask.
        if (list.length === 1) return { ...f, subject_id: String(list[0].id) };
        return f;
      });
    }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const setSubject = useCallback((id) => {
    setForm((f) => ({ ...f, subject_id: id }));
    rememberSubject(id);
  }, []);

  // ── Pending-state polling ────────────────────────────────
  // Extraction + embedding run in a worker, so a fresh upload has no
  // "Auto-generate Blueprint" button yet. Poll while anything is pending and
  // stop the moment nothing is in flight (or the budget runs out). Each pass
  // arms a single timeout that the cleanup clears, so nothing leaks on unmount.
  const pendingCount = materials ? materials.filter((m) => m.status === 'pending').length : 0;

  useEffect(() => {
    if (!pendingCount || pollsUsed >= MAX_POLLS) return undefined;
    const timer = setTimeout(() => { setPollsUsed((n) => n + 1); load(); }, POLL_MS);
    return () => clearTimeout(timer);
  }, [pendingCount, pollsUsed, materials, load]);

  const pollExhausted = pendingCount > 0 && pollsUsed >= MAX_POLLS;

  function handleRefresh() {
    setPollsUsed(0);
    setRefreshing(true);
    api.get('/materials')
      .then((data) => setMaterials(data.materials))
      .catch((err) => toast.error(err.message || 'Could not load materials.'))
      .finally(() => setRefreshing(false));
  }

  // ── Upload queue ─────────────────────────────────────────
  const enqueueFiles = useCallback((files) => {
    const picked = Array.from(files || []);
    if (!picked.length) return;
    setQueue((q) => [
      ...q.filter((it) => it.state !== 'done'),
      ...picked.map((file) => ({
        id: ++queueSeq,
        file,
        name: file.name,
        size: file.size,
        is_syllabus: looksLikeSyllabus(file.name),
        inferred: looksLikeSyllabus(file.name),
        state: 'queued',
        error: null,
      })),
    ]);
    setUploadMode('file');
    setUploadOpen(true);
  }, []);

  // Page-wide drop target. The overlay is pointer-events:none, so drops are
  // caught here — except inside the modal's own zone (it enqueues itself) and
  // inside text controls, whose native drop behaviour must survive.
  useEffect(() => {
    const isOwnedElsewhere = (target) =>
      target instanceof Element &&
      target.closest('.upload-zone, input:not([type="file"]), textarea, [contenteditable="true"]');

    const onDragEnter = (e) => {
      if (!dragHasFiles(e)) return;
      dragDepth.current += 1;
      // The modal's own zone shows its own state — don't double up on feedback.
      setPageDrag(!isOwnedElsewhere(e.target));
    };
    const onDragOver = (e) => {
      if (!dragHasFiles(e) || isOwnedElsewhere(e.target)) return;
      e.preventDefault(); // required or the browser refuses the drop
    };
    const onDragLeave = (e) => {
      if (!dragHasFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setPageDrag(false);
    };
    const onDrop = (e) => {
      dragDepth.current = 0;
      setPageDrag(false);
      if (!dragHasFiles(e) || isOwnedElsewhere(e.target)) return;
      e.preventDefault();
      enqueueFiles(e.dataTransfer.files);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [enqueueFiles]);

  /**
   * POST one file as multipart/form-data.
   * FormData must not go through api.post() — that helper JSON-stringifies its
   * body, which would drop the file. Post it with fetch and let the browser
   * set the multipart boundary itself.
   */
  async function uploadFile(file, { subjectId, title, isSyllabus }) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('subject_id', subjectId);
    if (title) fd.append('title', title);
    fd.append('is_syllabus', isSyllabus ? 'true' : 'false');

    const token = getToken();
    const res = await fetch(`${API_BASE}/materials`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    let data = null;
    if ((res.headers.get('content-type') || '').includes('application/json')) {
      try { data = await res.json(); } catch { data = null; }
    }
    if (!res.ok) throw new ApiError(data?.error || `Upload failed (${res.status}).`, res.status, data);
    return data;
  }

  /** Upload the queue one file at a time — never a burst of concurrent posts. */
  async function handleQueueUpload() {
    if (!form.subject_id) { toast.error('Select a subject first.'); return; }
    const batch = queue.filter((it) => it.state === 'queued' || it.state === 'error');
    if (!batch.length) return;

    setUploading(true);
    let succeeded = 0;
    const failed = [];
    for (const item of batch) {
      setQueue((q) => q.map((it) => (it.id === item.id ? { ...it, state: 'uploading', error: null } : it)));
      try {
        await uploadFile(item.file, {
          subjectId: form.subject_id,
          // A custom title only makes sense for a single file; a batch takes
          // its titles from the filenames on the server side.
          title: batch.length === 1 ? form.title : '',
          isSyllabus: item.is_syllabus,
        });
        succeeded += 1;
        setQueue((q) => q.map((it) => (it.id === item.id ? { ...it, state: 'done' } : it)));
      } catch (err) {
        const message = err instanceof ApiError ? err.message : (err?.message || 'Upload failed.');
        failed.push(item.name);
        setQueue((q) => q.map((it) => (it.id === item.id ? { ...it, state: 'error', error: message } : it)));
      }
    }
    setUploading(false);
    setPollsUsed(0);
    load();

    // Report honestly: a partial batch is not a success.
    if (succeeded && !failed.length) {
      toast.success(`${succeeded} file${succeeded === 1 ? '' : 's'} uploaded. Processing started.`);
      setQueue([]);
      setForm((f) => ({ ...f, title: '' }));
      setUploadOpen(false);
    } else if (succeeded && failed.length) {
      toast.warning(`${succeeded} uploaded, ${failed.length} failed — retry the ones marked below.`);
    } else {
      toast.error(`Upload failed for ${failed.length} file${failed.length === 1 ? '' : 's'}.`);
    }
  }

  function removeFromQueue(id) {
    setQueue((q) => q.filter((it) => it.id !== id));
  }

  function toggleQueueSyllabus(id) {
    setQueue((q) => q.map((it) => (it.id === id ? { ...it, is_syllabus: !it.is_syllabus } : it)));
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
      setPollsUsed(0);
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
      setPollsUsed(0);
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
    try {
      await api.post(`/materials/${mat.id}/reprocess`);
      toast.success('Reprocessing started.');
      setPollsUsed(0);
      load();
    } catch (err) { toast.error(err.message || 'Reprocess failed.'); }
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

  const subjectName = subjects.find((s) => String(s.id) === String(form.subject_id));
  const queueReady = queue.filter((it) => it.state === 'queued' || it.state === 'error').length;

  return (
    <AppShell activeNav="materials" pageTitle="Materials">
      <div className="mat-toolbar">
            <h1>Materials</h1>
            <div className="mat-toolbar-actions">
              <button className="btn" onClick={handleRefresh} disabled={refreshing} title="Refresh list">
                <RefreshCw size={16} className={refreshing ? 'mat-spin' : undefined} /> Refresh
              </button>
              <button className="btn btn-primary" onClick={() => { setUploadMode('file'); setUploadOpen(true); }}>
                <Upload size={16} /> Upload material
              </button>
            </div>
          </div>

          <p className="mat-droptip">
            <Upload size={13} /> Tip: drag files anywhere onto this page — several at once — to queue them for upload.
          </p>

          {pendingCount > 0 && (
            <div className="mat-pending-banner" role="status">
              <Loader2 size={16} className="mat-spin" />
              <span>
                {pendingCount} material{pendingCount === 1 ? '' : 's'} still processing. Text extraction and embedding
                run in the background — the <strong>Auto-generate Blueprint</strong> button appears on a syllabus once
                it finishes. {pollExhausted ? 'Auto-refresh has paused — use Refresh to check again.' : 'This list refreshes itself.'}
              </span>
            </div>
          )}

          {materials === null ? (
            <p className="placeholder">Loading…</p>
          ) : materials.length === 0 ? (
            <div className="empty-state">
              <FileStack size={40} style={{ color: 'var(--ink-faint)', marginBottom: 12 }} />
              <h3>No materials yet</h3>
              <p>Upload PDFs, DOCX, PPTX, URLs, or YouTube transcripts to ground RAG question generation. You can also drag files straight onto this page.</p>
              <button className="btn btn-primary" onClick={() => { setUploadMode('file'); setUploadOpen(true); }}>
                <Upload size={16} /> Upload first material
              </button>
            </div>
          ) : (
            <div className="mat-list">
              {materials.map((m) => {
                const Icon = SOURCE_ICONS[m.source_type] || FileText;
                return (
                  <div key={m.id} className="mat-card">
                    <div className="mat-card-main">
                      <Icon size={20} style={{ color: 'var(--ink-3)' }} />
                      <div>
                        <div className="mat-card-title">{m.title}</div>
                        <div className="mat-card-meta">
                          {m.source_type} · {m.chunk_count || 0} chunks
                          {m.is_syllabus ? ' · syllabus' : ''}
                          {' · '}<span className={`mat-status ${m.status}`}>{m.status}</span>
                          {m.error && ` · ${m.error}`}
                        </div>
                        {m.status === 'pending' && (
                          <div className="mat-card-progress">
                            <Loader2 size={13} className="mat-spin" />
                            {m.is_syllabus
                              ? 'Processing — the Auto-generate Blueprint button appears here when it is ready.'
                              : 'Processing — chunks and embeddings are being built.'}
                          </div>
                        )}
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

      {/* Page-wide drag feedback. pointer-events:none so it never swallows a drop. */}
      {pageDrag && (
        <div className="mat-dropveil" aria-hidden="true">
          <div className="mat-dropveil-card">
            <Upload size={32} />
            <div className="mat-dropveil-title">Drop to queue for upload</div>
            <div className="mat-dropveil-hint">
              {subjectName ? `Subject: ${subjectName.code || subjectName.name}` : 'PDF, DOCX, PPTX, TXT'}
            </div>
          </div>
        </div>
      )}

      <Modal open={uploadOpen} title="Upload material" onClose={() => setUploadOpen(false)} size="lg"
        footer={uploadMode === 'file' ? (
          <>
            <button className="btn" onClick={() => setUploadOpen(false)}>Close</button>
            <button className="btn btn-primary" onClick={handleQueueUpload} disabled={uploading || !queueReady}>
              {uploading ? <span className="btn-spinner" /> : <Upload size={16} />}
              {queueReady > 1 ? `Upload ${queueReady} files` : 'Upload'}
            </button>
          </>
        ) : undefined}>
        {/* Subject + syllabus toggle (shared) */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="mat-subject">Subject <span className="req">*</span></label>
            <select id="mat-subject" className="form-input" style={{ paddingLeft: 16 }} value={form.subject_id}
              onChange={(e) => setSubject(e.target.value)}>
              <option value="">Select…</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.code || s.name} — {s.name}</option>)}
            </select>
            {form.subject_id && (
              <small className="form-hint">Remembered for the rest of this session, so a batch never re-asks.</small>
            )}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="mat-title">Title (optional)</label>
            <input id="mat-title" className="form-input" style={{ paddingLeft: 16 }} value={form.title} maxLength={255}
              disabled={uploadMode === 'file' && queueReady > 1}
              onChange={(e) => setForm({ ...form, title: e.target.value })} />
            {uploadMode === 'file' && queueReady > 1 && (
              <small className="form-hint">A batch takes its titles from each filename.</small>
            )}
          </div>
        </div>
        {uploadMode !== 'file' && (
          <div className="form-group">
            <label className="mat-check">
              <input type="checkbox" checked={form.is_syllabus}
                onChange={(e) => setForm({ ...form, is_syllabus: e.target.checked })} />
              Mark as syllabus (used for TOS generation)
            </label>
          </div>
        )}

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
          <>
            <div
              className={`upload-zone ${dragOver ? 'dragover' : ''}`}
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); e.stopPropagation(); setDragOver(false);
                dragDepth.current = 0; setPageDrag(false);
                enqueueFiles(e.dataTransfer.files);
              }}
            >
              <Upload size={36} className="upload-zone-icon" />
              <div className="upload-zone-text">Click to browse or drag files here</div>
              <div className="upload-zone-hint">PDF, DOCX, PPTX, TXT — max 50 MB each · multiple files allowed</div>
              <input ref={fileInput} type="file" multiple style={{ display: 'none' }}
                accept=".pdf,.docx,.pptx,.txt,application/pdf,text/plain"
                onChange={(e) => { enqueueFiles(e.target.files); e.target.value = ''; }} />
            </div>

            {queue.length > 0 && (
              <div className="mat-queue">
                <div className="mat-queue-head">
                  <span>{queue.length} file{queue.length === 1 ? '' : 's'} staged</span>
                  <button type="button" className="mat-queue-clear" onClick={() => setQueue([])} disabled={uploading}>
                    Clear all
                  </button>
                </div>
                <ul className="mat-queue-list">
                  {queue.map((it) => (
                    <li key={it.id} className={`mat-queue-item is-${it.state}`}>
                      <span className="mat-queue-icon">
                        {it.state === 'uploading' && <Loader2 size={16} className="mat-spin" />}
                        {it.state === 'done' && <CheckCircle2 size={16} />}
                        {it.state === 'error' && <AlertCircle size={16} />}
                        {it.state === 'queued' && <FileText size={16} />}
                      </span>
                      <span className="mat-queue-body">
                        <span className="mat-queue-name" title={it.name}>{it.name}</span>
                        <span className="mat-queue-sub">
                          {formatSize(it.size)}
                          {it.state === 'done' && ' · uploaded'}
                          {it.state === 'error' && ` · ${it.error}`}
                          {it.state === 'queued' && it.inferred && ' · filename looks like a syllabus'}
                        </span>
                      </span>
                      <label className={`mat-syl-toggle ${it.is_syllabus ? 'on' : ''}`}
                        title="Marking a material as a syllabus is what unlocks TOS generation">
                        <input type="checkbox" checked={it.is_syllabus} disabled={uploading || it.state === 'done'}
                          onChange={() => toggleQueueSyllabus(it.id)} />
                        <BookOpen size={14} />
                        <span>Syllabus</span>
                      </label>
                      <button type="button" className="mat-queue-remove" aria-label={`Remove ${it.name}`}
                        disabled={uploading} onClick={() => removeFromQueue(it.id)}>
                        <X size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mat-queue-note">
                  Files upload one at a time; each result is reported separately. The syllabus flag is a guess from the
                  filename — check it before uploading.
                </p>
              </div>
            )}
          </>
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
