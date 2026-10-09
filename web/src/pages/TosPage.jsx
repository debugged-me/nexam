/**
 * TosPage — list of TOS blueprints with create/edit/delete.
 *
 * Uses the shared list header, empty state, grid, row actions, and a
 * modal form using .form-section / .bloom-grid.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Info, Eye, FilePlus2, Upload, Check, Layers } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import Modal from '../components/Modal.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import { PageLoader } from '../components/Loaders.jsx';
import {
  StatusPill, StatusSummary, BoardGroupHead, BoardGroupFoot,
  GroupChip, groupColor, statusOf, STATUS_ORDER,
} from '../components/Board.jsx';
import '../styles/tos.css';

const BLOOM_LABELS = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create' };
const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
const DEFAULT_BLOOM = { remember: 15, understand: 20, apply: 20, analyze: 20, evaluate: 15, create: 10 };

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TosPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tosList, setTosList] = useState(() => api.peek('/tos')?.tos ?? null);
  const [subjects, setSubjects] = useState(() => api.peek('/subjects')?.subjects ?? []);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [groupBy, setGroupBy] = useState('subject'); // subject | none
  const [collapsed, setCollapsed] = useState(() => new Set());

  const tosGroups = useMemo(() => {
    if (!tosList || !tosList.length || groupBy === 'none') return null;
    const map = new Map();
    for (const t of tosList) {
      const key = t.subject_id || t.subject_name || 'none';
      if (!map.has(key)) {
        map.set(key, { key, title: t.subject_name || 'No subject', color: groupColor(key), rows: [] });
      }
      map.get(key).rows.push(t);
    }
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [tosList, groupBy]);

  function toggleGroup(key) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const load = useCallback(() => {
    api.get('/tos')
      .then((data) => setTosList(data.tos))
      .catch((err) => toast.error(err.message || 'Could not load TOS.'));
  }, [toast]);

  useEffect(() => {
    api.get('/subjects').then((data) => setSubjects(data.subjects)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    setEditing({ title: '', subject_id: subjects[0]?.id || '', total_items: 50, bloom_weights: { ...DEFAULT_BLOOM } });
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, subjects]);

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
    if (!(await confirm(`Delete "${tos.title}"? This cannot be undone.`, { title: 'Delete blueprint' }))) return;
    try { await api.del(`/tos/${tos.id}`); toast.success('TOS deleted.'); load(); }
    catch (err) { toast.error(err.message || 'Delete failed.'); }
  }

  const bloomTotal = editing
    ? BLOOM_ORDER.reduce((s, k) => s + (Number(editing.bloom_weights?.[k]) || 0), 0)
    : 0;

  function renderTosRow(t) {
    const topics = t.topic_count != null ? Number(t.topic_count) : 0;
    const items = Number(t.total_items);
    const touched = t.updated_at || t.created_at;
    return (
      <tr key={t.id} data-id={t.id} className="b-row">
        <td>
          <span className="g-primary">
            <Link to={`/tos/${t.id}`} className="g-title">{t.title}</Link>
            <span className="g-meta">
              {topics
                ? `${topics} ${topics === 1 ? 'topic' : 'topics'} · ${items} items`
                : 'No topics defined yet'}
            </span>
          </span>
        </td>
        <td>
          {t.subject_name ? (
            <GroupChip color={groupColor(t.subject_id || t.subject_name)}>{t.subject_name}</GroupChip>
          ) : (
            <span className="g-mute">—</span>
          )}
        </td>
        <td data-order={statusOf(t.status)}><StatusPill status={t.status} /></td>
        <td className="is-num">
          <span className={`g-count${topics ? '' : ' is-zero'}`}>{topics || '—'}</span>
        </td>
        <td className="is-num"><span className="g-count">{items}</span></td>
        <td className="g-mute">{fmtDate(touched)}</td>
        <td className="col-actions">
          <details className="g-menu">
            <summary className="g-menu-trigger" aria-label={`Actions for ${t.title}`}><Eye size={16} /></summary>
            <div className="g-menu-panel">
              <Link to={`/tos/${t.id}`} className="g-menu-item"><Eye size={15} /> Open</Link>
              <button className="g-menu-item" onClick={() => setEditing({ ...t, bloom_weights: t.bloom_weights || { ...DEFAULT_BLOOM } })}><Pencil size={15} /> Edit</button>
              <Link to="/exams" className="g-menu-item"><FilePlus2 size={15} /> Build exam</Link>
              <div className="g-menu-sep" />
              <button className="g-menu-item is-danger" onClick={() => handleDelete(t)}><Trash2 size={15} /> Delete</button>
            </div>
          </details>
        </td>
      </tr>
    );
  }

  return (
    <AppShell activeNav="tos" pageTitle="Blueprints (TOS)" wide>

      <header className="list-head">
        <div className="list-head-main">
          <h1 className="list-head-title">
            Blueprints (TOS)
            {tosList && tosList.length > 0 && (
              <span className="list-head-count">{tosList.length}</span>
            )}
          </h1>
          <details className="list-head-info">
            <summary aria-label="What is a blueprint?"><Info size={16} /></summary>
            <p>A Table of Specification (TOS) defines how many items each topic and Bloom level contributes to an exam. Upload a syllabus and auto-generate one, or create it manually.</p>
          </details>
        </div>
        <div className="list-head-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setEditing({ title: '', subject_id: subjects[0]?.id || '', total_items: 50, bloom_weights: { ...DEFAULT_BLOOM } })}>
            <Plus size={16} /> New Blueprint
          </button>
        </div>
      </header>

      {tosList === null ? (
        <PageLoader label="Loading blueprints…" />
      ) : tosList.length === 0 ? (
        <div className="empty-state">
          <h4>No blueprints yet</h4>
          <p>Upload a syllabus and click "Auto-generate Blueprint" to create one automatically, or create one manually and set the item count and Bloom weights yourself.</p>
          <div className="empty-state-actions">
            <Link to="/materials" className="btn btn-outline">
              <Upload size={16} /> Upload Syllabus
            </Link>
            <button className="btn btn-primary" onClick={() => setEditing({ title: '', subject_id: subjects[0]?.id || '', total_items: 50, bloom_weights: { ...DEFAULT_BLOOM } })}>
              <Plus size={16} /> New Blueprint
            </button>
          </div>
        </div>
      ) : (
        <div className="dataset">
          <div className="dataset-bar">
            <div className="dataset-bar-lead">
              <span className="b-groupby">
                <Layers size={14} aria-hidden="true" />
                <select
                  aria-label="Group blueprints by"
                  data-active={groupBy !== 'none'}
                  value={groupBy}
                  onChange={(e) => { setGroupBy(e.target.value); setCollapsed(new Set()); }}
                >
                  <option value="subject">Group: Subject</option>
                  <option value="none">Group: None</option>
                </select>
              </span>
            </div>
            <div className="dataset-bar-trail">
              <StatusSummary
                counts={tosList.reduce((m, t) => { const k = statusOf(t.status); m[k] = (m[k] || 0) + 1; return m; }, {})}
                order={STATUS_ORDER.tos}
                legend={false}
                totalLabel={`${tosList.length} blueprint${tosList.length === 1 ? '' : 's'}`}
              />
            </div>
          </div>
          <div className="dataset-scroll">
        <table className="grid datatable">
          <caption className="sr-only">Table of Specification blueprints in your workspace</caption>
          <thead>
            <tr>
              <th className="col-primary wp-31">Blueprint</th>
              <th className="wp-17">Subject</th>
              <th className="wp-12">Status</th>
              <th className="is-num wp-10">Topics</th>
              <th className="is-num wp-9">Items</th>
              <th className="wp-16">Updated</th>
              <th className="col-actions wp-5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          {tosGroups ? tosGroups.map((g) => {
            const isCollapsed = collapsed.has(g.key);
            const counts = {};
            for (const t of g.rows) { const k = statusOf(t.status); counts[k] = (counts[k] || 0) + 1; }
            return (
              <tbody key={g.key} className={`b-group${isCollapsed ? ' is-collapsed' : ''}`} style={{ '--gc': g.color }}>
                <BoardGroupHead color={g.color} title={g.title} count={g.rows.length} colSpan={7} collapsed={isCollapsed} onToggle={() => toggleGroup(g.key)} />
                {g.rows.map(renderTosRow)}
                <BoardGroupFoot colSpan={7}>
                  <StatusSummary counts={counts} order={STATUS_ORDER.tos} totalLabel={`${g.rows.length} blueprint${g.rows.length === 1 ? '' : 's'}`} />
                </BoardGroupFoot>
              </tbody>
            );
          }) : (
            <tbody>{tosList.map(renderTosRow)}</tbody>
          )}
        </table>
          </div>
        </div>
      )}

      <Modal open={!!editing} title={editing?.id ? 'Edit TOS Blueprint' : 'New TOS Blueprint'}
        subtitle={editing?.id ? 'Update this blueprint.' : 'Set the total items and how they spread across Bloom levels.'}
        onClose={() => setEditing(null)} size="lg"
        footer={<>
          <button className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
          <button className="btn btn-primary" form="tos-form" type="submit" disabled={saving}>
            {saving && <span className="btn-spinner" />}{editing?.id ? 'Save Changes' : 'Create Blueprint'}
          </button>
        </>}>
        {editing && (
          <form id="tos-form" onSubmit={handleSave} noValidate>
            <div className="form-section">
              <div className="form-section-title">Details</div>
              <div className="form-group">
                <label className="form-label" htmlFor="title">Title <span className="req">*</span></label>
                <input type="text" id="title" className="form-control" required maxLength={255}
                  placeholder="e.g. Midterm Exam Blueprint" autoFocus
                  value={editing.title || ''}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="subject_id">Subject <span className="req">*</span></label>
                <select id="subject_id" className="form-control form-select" required
                  value={editing.subject_id || ''}
                  onChange={(e) => setEditing({ ...editing, subject_id: e.target.value })}>
                  <option value="">Select a subject…</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="total_items">Total Items <span className="req">*</span></label>
                <input type="number" id="total_items" className="form-control" required min={1} max={500}
                  value={editing.total_items || 50}
                  onChange={(e) => setEditing({ ...editing, total_items: e.target.value })} />
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">Bloom's Taxonomy Weights</div>
              <p className="form-hint mb-2">
                Distribute percentages across the six cognitive levels. Should total 100%.
              </p>
              <div className="bloom-grid">
                {BLOOM_ORDER.map((k) => (
                  <div key={k} className="bloom-cell">
                    <label className="form-label" htmlFor={`bloom_${k}`}>{BLOOM_LABELS[k]}</label>
                    <div className="bloom-input-wrap">
                      <input type="number" id={`bloom_${k}`} className="form-control bloom-input" min={0} max={100} step={1}
                        value={editing.bloom_weights?.[k] || 0}
                        onChange={(e) => setEditing({ ...editing, bloom_weights: { ...editing.bloom_weights, [k]: Number(e.target.value) } })} />
                      <span className="bloom-pct">%</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bloom-total" role="status" aria-live="polite">
                Total: <span>{bloomTotal}</span>%
                <span className={`bloom-total-badge ${bloomTotal === 100 ? 'ok' : 'warn'}`}>
                  {bloomTotal === 100 ? <><Check size={12} /> OK</> : `${bloomTotal}%`}
                </span>
              </div>
            </div>
          </form>
        )}
      </Modal>

    </AppShell>
  );
}
