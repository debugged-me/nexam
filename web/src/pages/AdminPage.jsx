import '../styles/admin.css';
/**
 * AdminPage — superadmin console, rendered inside the shared AppLayout shell
 * at /admin/:view where view is dashboard | users | logins | audit | settings.
 *
 * Views:
 *   Dashboard   — overview: KPI cards, stats bar, approval queue, recent sign-ins
 *   Users       — pending/active/rejected instructor accounts, approve/reject
 *   Login logs  — every sign-in attempt with IP + user agent
 *   Audit trail — superadmin actions and security events
 *   Settings    — reCAPTCHA keys + AI provider credentials (masked)
 *
 * Every table supports the shared right-click context menu (approve/reject,
 * copy email/IP/detail) — same pattern as the instructor pages.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import {
  RefreshCw, Check, X, ShieldCheck, Settings2, UserCheck, Clock,
  LogIn, ShieldAlert, Activity, Copy, ArrowRight,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import { useContextMenu, useCopyText } from '../components/ContextMenu.jsx';
import api, { ApiError } from '../lib/api.js';

const USER_FILTERS = ['pending', 'active', 'rejected', 'all'];
const VIEWS = ['dashboard', 'users', 'logins', 'audit', 'settings'];

function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleString();
}

function fmtShort(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function StatusPill({ status }) {
  return <span className={`adm-pill adm-pill-${status}`}>{status}</span>;
}

/** Shared approve/reject action with busy-state, used by Dashboard + Users. */
function useUserActions(toast, reload) {
  const [busyId, setBusyId] = useState(null);
  const act = useCallback(async (user, action) => {
    setBusyId(user.id);
    try {
      await api.post(`/admin/users/${user.id}/${action}`);
      toast.success(`${user.full_name || user.email} ${action === 'approve' ? 'approved' : 'rejected'}.`);
      reload?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  }, [toast, reload]);
  return { act, busyId };
}

/** Context-menu items for an instructor account row. */
function userMenuItems(u, act, copyText) {
  return [
    ...(u.status === 'pending'
      ? [{ label: 'Approve', icon: Check, onClick: () => act(u, 'approve') }]
      : []),
    ...(u.status !== 'rejected'
      ? [{ label: 'Reject', icon: X, danger: true, onClick: () => act(u, 'reject') }]
      : []),
    'sep',
    { label: 'Copy email', icon: Copy, onClick: () => copyText(u.email, 'Email') },
    { label: 'Copy name', icon: Copy, onClick: () => copyText(u.full_name || '', 'Name') },
  ];
}

// ── Dashboard tab ──────────────────────────────────────
function DashboardTab({ toast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { menuEl, openMenu } = useContextMenu();
  const copyText = useCopyText();
  const { act, busyId } = useUserActions(toast, () => load());

  const load = useCallback(() => {
    api.get('/admin/stats')
      .then(setData)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load overview.'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);

  if (loading) return <div className="adm-panel adm-empty">Loading overview…</div>;
  if (!data) return <div className="adm-panel adm-empty">Could not load the console overview.</div>;

  const u = data.users || {};
  const l = data.logins24h || {};
  const sys = data.system || {};

  return (
    <div className="adm-panel adm-dash">
      {/* KPI cards — dbmanager stat-card pattern */}
      <div className="stats-grid adm-kpis">
        <div className="stat-card">
          <div className="stat-icon amber"><Clock size={20} /></div>
          <div className="stat-info">
            <div className="stat-value">{u.pending ?? 0}</div>
            <div className="stat-label">Pending approvals</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><UserCheck size={20} /></div>
          <div className="stat-info">
            <div className="stat-value">{u.active ?? 0}</div>
            <div className="stat-label">Active instructors</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><LogIn size={20} /></div>
          <div className="stat-info">
            <div className="stat-value">{l.success ?? 0}</div>
            <div className="stat-label">Sign-ins · 24h</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><ShieldAlert size={20} /></div>
          <div className="stat-info">
            <div className="stat-value">{l.failed ?? 0}</div>
            <div className="stat-label">Failed attempts · 24h</div>
          </div>
        </div>
      </div>

      {/* Stats bar — hairline-joined cells, dbmanager stats-strip */}
      <div className="adm-statsbar">
        <div className="adm-statcell">
          <strong>{u.total ?? 0}</strong>
          <span>Total instructors</span>
        </div>
        <div className="adm-statcell">
          <strong>{u.verified ?? 0}</strong>
          <span>Verified emails</span>
        </div>
        <div className="adm-statcell">
          <strong>{u.rejected ?? 0}</strong>
          <span>Rejected</span>
        </div>
        <div className="adm-statcell">
          <strong>{l.unique_ips ?? 0}</strong>
          <span>Unique IPs · 24h</span>
        </div>
      </div>

      <div className="adm-dash-grid">
        {/* Approval queue */}
        <div className="adm-card">
          <div className="adm-card-head">
            <UserCheck size={15} />
            <h3>Approval queue</h3>
            {u.pending > 0 && <span className="adm-tag adm-tag-warn">{u.pending} waiting</span>}
          </div>
          <div className="adm-rows">
            {!data.pendingUsers?.length && (
              <div className="adm-empty adm-empty-sm">Nobody is waiting for approval.</div>
            )}
            {data.pendingUsers?.map((p) => (
              <div
                className="adm-row"
                key={p.id}
                onContextMenu={(e) => openMenu(e, userMenuItems(p, act, copyText))}
              >
                <div className="adm-row-main">
                  <strong>{p.full_name || '—'}</strong>
                  <small>{p.email}</small>
                </div>
                <div className="adm-row-side">
                  <span className="adm-muted adm-nowrap">{fmtShort(p.created_at)}</span>
                  <button
                    className="adm-btn adm-btn-ok"
                    disabled={busyId === p.id}
                    onClick={() => act(p, 'approve')}
                  >
                    <Check size={13} /> Approve
                  </button>
                  <button
                    className="adm-btn adm-btn-danger"
                    disabled={busyId === p.id}
                    onClick={() => act(p, 'reject')}
                  >
                    <X size={13} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Link className="adm-card-foot" to="/admin/users">
            Manage all users <ArrowRight size={13} />
          </Link>
        </div>

        {/* Recent sign-ins — compact process-table look */}
        <div className="adm-card">
          <div className="adm-card-head">
            <Activity size={15} />
            <h3>Recent sign-ins</h3>
          </div>
          <div className="adm-rows">
            {!data.recentLogins?.length && (
              <div className="adm-empty adm-empty-sm">No sign-in attempts yet.</div>
            )}
            {data.recentLogins?.map((r, i) => (
              <div
                className="adm-row"
                key={i}
                onContextMenu={(e) => openMenu(e, [
                  { label: 'Copy email', icon: Copy, onClick: () => copyText(r.email, 'Email') },
                  { label: 'Copy IP', icon: Copy, onClick: () => copyText(r.ip, 'IP address') },
                ])}
              >
                <div className="adm-row-main">
                  <strong>{r.full_name || r.email}</strong>
                  <small>{r.full_name ? r.email : (r.reason || '')}</small>
                </div>
                <div className="adm-row-side">
                  <span className={`adm-pill ${r.success ? 'adm-pill-active' : 'adm-pill-rejected'}`}>
                    {r.success ? 'success' : 'failed'}
                  </span>
                  <span className="adm-mono adm-nowrap">{r.ip || '—'}</span>
                  <span className="adm-muted adm-nowrap">{fmtShort(r.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
          <Link className="adm-card-foot" to="/admin/logins">
            View all sign-in logs <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* System configuration status */}
      <div className="adm-card">
        <div className="adm-card-head">
          <ShieldCheck size={15} />
          <h3>System</h3>
          <Link className="adm-card-link" to="/admin/settings">Open settings <ArrowRight size={12} /></Link>
        </div>
        <div className="adm-sys-grid">
          <div className="adm-sys-cell">
            <span className="adm-sys-name">reCAPTCHA v2</span>
            <small className="adm-muted">Registration challenge</small>
            <span className={`adm-tag ${sys.recaptcha ? 'adm-tag-ok' : 'adm-tag-warn'}`}>
              {sys.recaptcha ? 'configured' : 'missing keys'}
            </span>
          </div>
          <div className="adm-sys-cell">
            <span className="adm-sys-name">Gemini</span>
            <small className="adm-muted">Primary AI provider</small>
            <span className={`adm-tag ${sys.gemini ? 'adm-tag-ok' : 'adm-tag-warn'}`}>
              {sys.gemini ? 'configured' : 'missing key'}
            </span>
          </div>
          <div className="adm-sys-cell">
            <span className="adm-sys-name">Groq</span>
            <small className="adm-muted">Fallback AI provider</small>
            <span className={`adm-tag ${sys.groq ? 'adm-tag-ok' : 'adm-tag-warn'}`}>
              {sys.groq ? 'configured' : 'missing key'}
            </span>
          </div>
        </div>
      </div>

      {menuEl}
    </div>
  );
}

// ── Users tab ──────────────────────────────────────────
function UsersTab({ toast }) {
  const [filter, setFilter] = useState('pending');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { menuEl, openMenu } = useContextMenu();
  const copyText = useCopyText();
  const { act, busyId } = useUserActions(toast, () => load());

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/admin/users?status=${filter}`)
      .then((d) => setUsers(d.users || []))
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load users.'))
      .finally(() => setLoading(false));
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);

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
              <tr key={u.id} onContextMenu={(e) => openMenu(e, userMenuItems(u, act, copyText))}>
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
      {menuEl}
    </div>
  );
}

// ── Login logs tab ─────────────────────────────────────
function LoginsTab({ toast }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { menuEl, openMenu } = useContextMenu();
  const copyText = useCopyText();

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
              <tr
                key={l.id}
                onContextMenu={(e) => openMenu(e, [
                  { label: 'Copy email', icon: Copy, onClick: () => copyText(l.email, 'Email') },
                  { label: 'Copy IP', icon: Copy, onClick: () => copyText(l.ip, 'IP address') },
                  { label: 'Copy user agent', icon: Copy, onClick: () => copyText(l.user_agent, 'User agent') },
                ])}
              >
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
      {menuEl}
    </div>
  );
}

// ── Audit trail tab ────────────────────────────────────
function AuditTab({ toast }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { menuEl, openMenu } = useContextMenu();
  const copyText = useCopyText();

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
              <tr
                key={l.id}
                onContextMenu={(e) => openMenu(e, [
                  { label: 'Copy action', icon: Copy, onClick: () => copyText(l.action, 'Action') },
                  { label: 'Copy actor', icon: Copy, onClick: () => copyText(l.actor_email, 'Actor') },
                  { label: 'Copy detail', icon: Copy, onClick: () => copyText(typeof l.detail === 'string' ? l.detail : JSON.stringify(l.detail), 'Detail') },
                ])}
              >
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
      {menuEl}
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
  const { view } = useParams();
  if (!view) return <Navigate to="/admin/dashboard" replace />;
  if (!VIEWS.includes(view)) return <Navigate to="/admin/dashboard" replace />;

  return (
    <div className="admin-page">
      {view === 'dashboard' && <DashboardTab toast={toast} />}
      {view === 'users' && <UsersTab toast={toast} />}
      {view === 'logins' && <LoginsTab toast={toast} />}
      {view === 'audit' && <AuditTab toast={toast} />}
      {view === 'settings' && <SettingsTab toast={toast} />}
    </div>
  );
}
