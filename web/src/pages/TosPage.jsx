/**
 * TosPage — list of TOS blueprints with create/edit/delete.
 *
 * TOS (Table of Specifications) defines the exam blueprint: total items and
 * Bloom taxonomy weight distribution. Topics are managed on the detail page.
 */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, ClipboardList, Eye } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import '../styles/tos.css';

const BLOOM_LABELS = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create' };
const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
const BLOOM_COLORS = ['var(--bloom-1)', 'var(--bloom-2)', 'var(--bloom-3)', 'var(--bloom-4)', 'var(--bloom-5)', 'var(--bloom-6)'];
const DEFAULT_BLOOM = { remember: 15, understand: 20, apply: 20, analyze: 20, evaluate: 15, create: 10 };

export default function TosPage() {
  const toast = useToast();
  const [tosList, setTosList] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get('/tos')
      .then((data) => setTosList(data.tos))
      .catch((err) => toast.error(err.message || 'Could not load TOS.'));
  }, [toast]);

  useEffect(() => {
    api.get('/subjects').then((data) => setSubjects(data.subjects)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleSave(e) {
    e.preventDefault();
    const total = BLOOM_ORDER.reduce((s, k) => s + (Number(editing.bloom_weights?.[k]) || 0), 0);
    if (total !== 100) { toast.error(`Bloom weights must total 100% (currently ${total}%).`); return; }
    setSaving(true);
    try {
      const body = {
        title: editing.title,
        subject_id: editing.subject_id,
        total_items: Number(editing.total_items),
        bloom_weights: editing.bloom_weights,
      };
      if (editing.id) {
        await api.put(`/tos/${editing.id}`, body);
        toast.success('TOS updated.');
      } else {
        await api.post('/tos', body);
        toast.success('TOS created.');
      }
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tos) {
    if (!confirm('Delete this TOS? This cannot be undone.')) return;
    try { await api.del(`/tos/${tos.id}`); toast.success('TOS deleted.'); load(); }
    catch (err) { toast.error(err.message || 'Delete failed.'); }
  }

  return (
    <AppShell activeNav="tos" pageTitle="Blueprints (TOS)">
      <div className="page-header">
            <h1>Table of Specifications</h1>
            <div className="page-header-actions">
              <button className="btn btn-primary" onClick={() => setEditing({ title: '', subject_id: subjects[0]?.id || '', total_items: 50, bloom_weights: { ...DEFAULT_BLOOM } })}>
                <Plus size={16} /> New TOS
              </button>
            </div>
          </div>
          {tosList === null ? (
            <p className="placeholder">Loading…</p>
          ) : tosList.length === 0 ? (
            <div className="empty-state">
              <ClipboardList size={40} style={{ color: 'var(--ink-faint)', marginBottom: 12 }} />
              <h3>No TOS yet</h3>
              <p>Create a Table of Specifications to define your exam blueprint and Bloom distribution.</p>
            </div>
          ) : (
            <div className="tos-list">
              {tosList.map((t) => (
                <div key={t.id} className="tos-card">
                  <div>
                    <div className="tos-card-title">{t.title}</div>
                    <div className="tos-card-meta">{t.subject_code || t.subject_name} · {t.total_items} items</div>
                  </div>
                  <div className="tos-card-stats">
                    {BLOOM_ORDER.map((k, i) => (
                      <div key={k} className="tos-stat" title={BLOOM_LABELS[k]}>
                        <span className="tos-stat-value" style={{ color: BLOOM_COLORS[i] }}>{t.bloom_weights?.[k] || 0}%</span>
                        <span className="tos-stat-label">{BLOOM_LABELS[k].slice(0, 4)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="tos-card-actions">
                    <Link to={`/tos/${t.id}`} className="btn" title="View"><Eye size={14} /></Link>
                    <button className="btn" onClick={() => setEditing({ ...t, bloom_weights: t.bloom_weights || { ...DEFAULT_BLOOM } })} title="Edit"><Pencil size={14} /></button>
                    <button className="btn btn-danger" onClick={() => handleDelete(t)} title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

      <Modal open={!!editing} title={editing?.id ? 'Edit TOS' : 'New TOS'} onClose={() => setEditing(null)} size="lg"
        footer={<>
          <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
          <button className="btn btn-primary" form="tos-form" type="submit" disabled={saving}>
            {saving && <span className="btn-spinner" />}{editing?.id ? 'Save' : 'Create'}
          </button>
        </>}>
        {editing && (
          <form id="tos-form" onSubmit={handleSave} noValidate>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Title <span className="req">*</span></label>
                <input className="form-input" style={{ paddingLeft: 16 }} value={editing.title || ''} maxLength={255} required
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Subject <span className="req">*</span></label>
                <select className="form-input" style={{ paddingLeft: 16 }} value={editing.subject_id || ''} required
                  onChange={(e) => setEditing({ ...editing, subject_id: e.target.value })}>
                  <option value="">Select…</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.code || s.name} — {s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Total Items <span className="req">*</span></label>
              <input type="number" className="form-input" style={{ paddingLeft: 16 }} value={editing.total_items || 50} min={1} required
                onChange={(e) => setEditing({ ...editing, total_items: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Bloom Taxonomy Weights (must total 100%)</label>
              <div className="bloom-editor">
                {BLOOM_ORDER.map((k, i) => (
                  <div key={k} className="bloom-weight-row">
                    <span className="bloom-weight-label">{BLOOM_LABELS[k]}</span>
                    <div className="bloom-weight-bar">
                      <div className="bloom-weight-fill" style={{ width: `${editing.bloom_weights?.[k] || 0}%`, background: BLOOM_COLORS[i] }} />
                    </div>
                    <input type="number" className="bloom-weight-input" min={0} max={100}
                      value={editing.bloom_weights?.[k] || 0}
                      onChange={(e) => setEditing({ ...editing, bloom_weights: { ...editing.bloom_weights, [k]: Number(e.target.value) } })} />
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>%</span>
                  </div>
                ))}
                {(() => {
                  const total = BLOOM_ORDER.reduce((s, k) => s + (Number(editing.bloom_weights?.[k]) || 0), 0);
                  return <div className={`bloom-total ${total === 100 ? 'ok' : 'bad'}`}>Total: {total}%</div>;
                })()}
              </div>
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}
