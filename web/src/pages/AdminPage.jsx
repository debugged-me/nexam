import '../styles/admin.css';
/**
 * AdminPage — superadmin console, rendered inside the shared AppLayout shell
 * at /admin/:view where view is users | logins | audit | settings.
 *
 * Views:
 *   Users       — pending/active/rejected instructor accounts, approve/reject
 *   Login logs  — every sign-in attempt with IP + user agent
 *   Audit trail — superadmin actions and security events
 *   Settings    — reCAPTCHA keys + AI provider credentials (masked)
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { RefreshCw, Check, X, ShieldCheck, Settings2 } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import api, { ApiError } from '../lib/api.js';

const USER_FILTERS = ['pending', 'active', 'rejected', 'all'];
const VIEWS = ['users', 'logins', 'audit', 'settings'];

function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleString();
}

function StatusPill({ status }) {
  return <span className={`adm-pill adm-pill-${status}`}>{status}</span>;
}

// ── Users tab ──────────────────────────────────────────
function UsersTab({ toast }) {
  const [filter, setFilter] = useState('pending');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/admin/users?status=${filter}`)
      .then((d) => setUsers(d.users || []))
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load users.'))
      .finally(() => setLoading(false));
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);

  async function act(user, action) {
    setBusyId(user.id);
    try {
      await api.post(`/admin/users/${user.id}/${action}`);
      toast.success(`${user.full_name || user.email} ${action === 'approve' ? 'approved' : 'rejected'}.`);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="adm-panel">
      <div className="adm-toolbar">
        <div className="adm-chips">
          {USER_FILTERS.map((f) => (
            <button
              key={f}
              className={`adm-chip ${filter === f ? 'is-active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <button className="adm-icon-btn" onClick={load} title="Refresh" aria-label="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Verified</th><th>Status</th>
              <th>Registered</th><th className="adm-col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="6" className="adm-empty">Loading…</td></tr>}
            {!loading && !users.length && (
              <tr><td colSpan="6" className="adm-empty">No {filter === 'all' ? '' : filter} instructor accounts.</td></tr>
            )}
            {!loading && users.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.full_name || '—'}</strong></td>
                <td>{u.email}</td>
                <td>{u.email_verified ? 'Yes' : 'No'}</td>
                <td><StatusPill status={u.status} /></td>
                <td className="adm-nowrap">{fmtTime(u.created_at)}</td>
                <td className="adm-col-actions">
                  {u.status === 'pending' && (
                    <button className="adm-btn adm-btn-ok" disabled={busyId === u.id} onClick={() => act(u, 'approve')}>
                      <Check size={13} /> Approve
                    </button>
                  )}
                  {u.status !== 'rejected' && (
                    <button className="adm-btn adm-btn-danger" disabled={busyId === u.id} onClick={() => act(u, 'reject')}>
                      <X size={13} /> Reject
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Login logs tab ─────────────────────────────────────
function LoginsTab({ toast }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/login-logs?limit=200')
      .then((d) => setLogs(d.logs || []))
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load login logs.'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);

  return (
    <div className="adm-panel">
      <div className="adm-toolbar">
        <span className="adm-hint">Latest 200 sign-in attempts.</span>
        <button className="adm-icon-btn" onClick={load} title="Refresh" aria-label="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>Time</th><th>Email</th><th>Result</th><th>Reason</th><th>IP address</th><th>User agent</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="6" className="adm-empty">Loading…</td></tr>}
            {!loading && !logs.length && <tr><td colSpan="6" className="adm-empty">No sign-in attempts recorded yet.</td></tr>}
            {!loading && logs.map((l) => (
              <tr key={l.id}>
                <td className="adm-nowrap">{fmtTime(l.created_at)}</td>
                <td>{l.email}</td>
                <td><span className={`adm-pill ${l.success ? 'adm-pill-active' : 'adm-pill-rejected'}`}>{l.success ? 'success' : 'failed'}</span></td>
                <td className="adm-muted">{l.reason || '—'}</td>
                <td className="adm-mono">{l.ip || '—'}</td>
                <td className="adm-ua" title={l.user_agent || ''}>{l.user_agent || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Audit trail tab ────────────────────────────────────
function AuditTab({ toast }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/audit-logs?limit=200')
      .then((d) => setLogs(d.logs || []))
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load audit trail.'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);

  return (
    <div className="adm-panel">
      <div className="adm-toolbar">
        <span className="adm-hint">Latest 200 recorded actions.</span>
        <button className="adm-icon-btn" onClick={load} title="Refresh" aria-label="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Detail</th><th>IP</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="6" className="adm-empty">Loading…</td></tr>}
            {!loading && !logs.length && <tr><td colSpan="6" className="adm-empty">No audit events recorded yet.</td></tr>}
            {!loading && logs.map((l) => (
              <tr key={l.id}>
                <td className="adm-nowrap">{fmtTime(l.created_at)}</td>
                <td>{l.actor_email || 'system'}</td>
                <td><span className="adm-tag">{l.action}</span></td>
                <td className="adm-muted">{[l.target_type, l.target_id].filter(Boolean).join(' · ') || '—'}</td>
                <td className="adm-ua" title={typeof l.detail === 'string' ? l.detail : ''}>{l.detail || '—'}</td>
                <td className="adm-mono">{l.ip || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Settings tab ───────────────────────────────────────
function SettingsTab({ toast }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get('/admin/settings')
      .then((d) => {
        setData(d);
        setForm({
          recaptcha_site_key: d.recaptcha?.siteKey || '',
          recaptcha_secret_key: '',
          gemini_api_key: '',
          gemini_model: d.ai?.geminiModel || '',
          gemini_embedding_model: d.ai?.geminiEmbeddingModel || '',
          groq_api_key: '',
          groq_model: d.ai?.groqModel || '',
        });
      })
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load settings.'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/admin/settings', form);
      toast.success(`Updated ${res.changed?.length || 0} setting(s).`);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  if (!data) return <div className="adm-panel adm-empty">Loading…</div>;

  const field = (key, label, { type = 'text', placeholder = '', hint = '' } = {}) => (
    <div className="adm-field">
      <label className="adm-label" htmlFor={`set-${key}`}>{label}</label>
      <input
        id={`set-${key}`}
        className="adm-input"
        type={type}
        autoComplete="off"
        value={form[key] || ''}
        placeholder={placeholder}
        onChange={set(key)}
      />
      {hint && <span className="adm-field-hint">{hint}</span>}
    </div>
  );

  return (
    <form className="adm-panel adm-settings" onSubmit={save}>
      <div className="adm-card">
        <div className="adm-card-head">
          <ShieldCheck size={15} />
          <h3>reCAPTCHA v2</h3>
          {data.recaptcha?.secretSet && <span className="adm-tag adm-tag-ok">configured</span>}
        </div>
        <div className="adm-grid-2">
          {field('recaptcha_site_key', 'Site key', { placeholder: 'Site key shown to visitors' })}
          {field('recaptcha_secret_key', 'Secret key', {
            type: 'password',
            placeholder: data.recaptcha?.secretMasked || 'Not configured',
            hint: 'Leave blank to keep the current secret.',
          })}
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-card-head">
          <Settings2 size={15} />
          <h3>AI providers</h3>
        </div>
        <div className="adm-grid-2">
          {field('gemini_api_key', 'Gemini API key', {
            type: 'password',
            placeholder: data.ai?.geminiApiKeyMasked || 'Not configured',
            hint: data.ai?.geminiApiKeySource ? `Source: ${data.ai.geminiApiKeySource}. Leave blank to keep.` : 'Leave blank to keep.',
          })}
          {field('gemini_model', 'Gemini chat model')}
          {field('gemini_embedding_model', 'Gemini embedding model')}
          <div />
          {field('groq_api_key', 'Groq API key (fallback)', {
            type: 'password',
            placeholder: data.ai?.groqApiKeyMasked || 'Not configured',
            hint: data.ai?.groqApiKeySource ? `Source: ${data.ai.groqApiKeySource}. Leave blank to keep.` : 'Leave blank to keep.',
          })}
          {field('groq_model', 'Groq model')}
        </div>
      </div>

      <div className="adm-save-row">
        <button type="submit" className="adm-btn adm-btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}

// ── Page ───────────────────────────────────────────────
export default function AdminPage() {
  const toast = useToast();
  const { view = 'users' } = useParams();
  if (!VIEWS.includes(view)) return <Navigate to="/admin" replace />;

  return (
    <div className="admin-page">
      {view === 'users' && <UsersTab toast={toast} />}
      {view === 'logins' && <LoginsTab toast={toast} />}
      {view === 'audit' && <AuditTab toast={toast} />}
      {view === 'settings' && <SettingsTab toast={toast} />}
    </div>
  );
}
