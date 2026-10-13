import '../styles/admin.css';
/**
 * AdminPage — admin + superadmin console, inside the shared AppLayout shell
 * at /admin/:view where view is dashboard | users | reports | logins | audit | settings.
 *
 * Views:
 *   Dashboard   — KPI tiles, a census strip, approval queue, recent sign-ins,
 *                 and (superadmin) integration health
 *   Users       — searchable/sortable account directory with approve/reject,
 *                 provision, edit, and reset-link actions
 *   Reports     — institution-wide usage report: on-screen cards plus a real
 *                 print document (.print-doc) and CSV/XLSX exports
 *   Login logs  — every sign-in attempt with IP + user agent (superadmin)
 *   Audit trail — console actions and security events (superadmin)
 *   Settings    — reCAPTCHA keys + AI provider credentials (superadmin)
 *
 * Data surfaces reuse the instructor grid system — .dataset + table.grid +
 * useGridTable + DatasetFoot — so the console sorts, filters, and pages the
 * same way the workspace does. Rows support the shared right-click menu.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Navigate, Link, useSearchParams } from 'react-router-dom';
import {
  RefreshCw, Check, X, ShieldCheck, Settings2, UserCheck, Clock,
  LogIn, ShieldAlert, Activity, Copy, ArrowRight, UserPlus, Ellipsis,
  Pencil, KeyRound, Printer, FileSpreadsheet, FileDown, BarChart3,
  Search, ScrollText, ListChecks, Users,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import { useContextMenu, useCopyText } from '../components/ContextMenu.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import Modal from '../components/Modal.jsx';
import AppShell from '../components/AppShell.jsx';
import Tooltip from '../components/Tooltip.jsx';
import KpiCard from '../components/KpiCard.jsx';
import { StatusPill, groupColor } from '../components/Board.jsx';
import { useGridTable, DatasetFoot } from '../components/DataTable.jsx';
import { TableSkeleton } from '../components/Loaders.jsx';
import { animateRows } from '../lib/animRows.js';
import { timeAgo } from '../lib/time.js';
import { useAuth } from '../features/auth/AuthContext.jsx';
import api, { ApiError } from '../lib/api.js';
import { downloadCsv, downloadXlsx } from '../lib/exports.js';
import { CountsBarChart, LoginTrendChart } from '../components/AnalyticsCharts.jsx';
import { BLOOM_LABELS, BLOOM_ORDER } from '../lib/insights.js';

const USER_FILTERS = ['all', 'pending', 'active', 'rejected'];
const VIEWS = ['dashboard', 'users', 'reports', 'logins', 'audit', 'settings'];
const TYPE_LABELS = { mcq: 'Multiple choice', true_false: 'True / false', matching: 'Matching', identification: 'Fill in the blank' };

const VIEW_META = {
  dashboard: { title: 'Overview', sub: 'Approvals, sign-in activity, and system health at a glance.' },
  users: { title: 'Users', sub: 'Approve, provision, and maintain staff accounts.' },
  reports: { title: 'Reports', sub: 'Institution-wide usage — print it or export it for the record.' },
  logins: { title: 'Login logs', sub: 'Every sign-in attempt with its IP address and device agent.' },
  audit: { title: 'Audit trail', sub: 'Recorded console actions and security events.' },
  settings: { title: 'Settings', sub: 'reCAPTCHA and AI provider credentials.' },
};

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

function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function initialsOf(u) {
  const parts = [u.first_name, u.last_name].filter(Boolean);
  const src = parts.length ? parts : String(u.full_name || u.email || 'U').split(' ');
  return src.map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

/** Small tinted pill distinguishing the managed account's position. */
function RolePill({ role }) {
  return <span className={`adm-role ${role === 'admin' ? 'adm-role--admin' : 'adm-role--instructor'}`}>{role}</span>;
}

/** Verified-email marker — a quiet dot, not a competing status pill. */
function VerifiedMark({ yes }) {
  return <span className={`adm-verify${yes ? ' is-yes' : ''}`}>{yes ? 'Verified' : 'Unverified'}</span>;
}

/**
 * Shared per-view header — the same .page-header anatomy the instructor
 * pages use: eyebrow naming the console tier, title, description, actions.
 */
function AdminHeader({ tier, title, sub, children }) {
  return (
    <div className="page-header print-skip">
      <div>
        <span className="eyebrow"><ShieldCheck size={13} />{tier}</span>
        <h1>{title}</h1>
        <p className="page-sub">{sub}</p>
      </div>
      {/* Always rendered — an empty actions row keeps the title from being
          treated as the only child (board.css right-aligns that case). */}
      <div className="header-actions">{children}</div>
    </div>
  );
}

/** Toolbar refresh button in the shared ds-btn style. */
function RefreshButton({ onClick }) {
  return (
    <Tooltip label="Refresh">
      <button type="button" className="ds-btn" onClick={onClick} aria-label="Refresh">
        <RefreshCw size={15} />
      </button>
    </Tooltip>
  );
}

/**
 * AddUserModal — staff-provisioned account. Superadmin chooses Admin or
 * Instructor; admins may provision instructors only. The password is
 * generated server-side and emailed to the new user — it never appears
 * on this screen. Created accounts are verified + active immediately.
 */
function AddUserModal({ role, onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '',
    role: 'instructor',
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/admin/users', form);
      toast.success(
        res.emailed
          ? `Credentials emailed to ${form.email}.`
          : `Account created, but the credentials email failed — ${form.email} can use “Forgot password” to sign in.`
      );
      onCreated?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create the account.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      size="sm"
      icon={UserPlus}
      title="Add user"
      subtitle="A generated password is emailed to the user — it never appears here."
      onClose={saving ? undefined : onClose}
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="adm-adduser" className="btn btn-primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create account'}
          </button>
        </>
      )}
    >
      <form id="adm-adduser" onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="au-fn">First name <span className="req">*</span></label>
            <input id="au-fn" className="form-control" value={form.first_name} onChange={set('first_name')} required autoComplete="off" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="au-ln">Last name <span className="req">*</span></label>
            <input id="au-ln" className="form-control" value={form.last_name} onChange={set('last_name')} required autoComplete="off" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="au-email">Email <span className="req">*</span></label>
          <input id="au-email" className="form-control" type="email" value={form.email} onChange={set('email')} required autoComplete="off" />
          <span className="form-hint">Sign-in credentials are sent to this address, and the account is active immediately.</span>
        </div>
        <div className="form-group">
          <span className="form-label">Position</span>
          <div className="adm-role-pick">
            <button
              type="button"
              className={`adm-role-opt ${form.role === 'instructor' ? 'is-active' : ''}`}
              onClick={() => setForm((f) => ({ ...f, role: 'instructor' }))}
            >
              <strong>Instructor</strong>
              <small>Teaches and builds exams</small>
            </button>
            {role === 'superadmin' && (
              <button
                type="button"
                className={`adm-role-opt ${form.role === 'admin' ? 'is-active' : ''}`}
                onClick={() => setForm((f) => ({ ...f, role: 'admin' }))}
              >
                <strong>Admin</strong>
                <small>Manages instructor accounts</small>
              </button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}

/** Shared approve/reject/reset actions with busy-state — Dashboard + Users. */
function useUserActions(toast, reload) {
  const [busyId, setBusyId] = useState(null);
  const confirm = useConfirm();

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

  const sendReset = useCallback(async (user) => {
    const ok = await confirm(
      `A single-use reset link will be emailed to ${user.email}. It expires in 30 minutes — the password itself is never shown to you.`,
      {
        title: 'Send password reset link?',
        confirmText: 'Send link',
        danger: false,
        icon: KeyRound,
        tone: 'accent',
      }
    );
    if (!ok) return;
    setBusyId(user.id);
    try {
      await api.post(`/admin/users/${user.id}/send-reset`);
      toast.success(`Reset link sent to ${user.email}.`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not send the reset link.');
    } finally {
      setBusyId(null);
    }
  }, [confirm, toast]);

  return { act, sendReset, busyId };
}

/** Context-menu items for a staff-managed account row. */
function userMenuItems(u, act, copyText, onEdit, sendReset) {
  return [
    ...(u.status === 'pending'
      ? [{ label: 'Approve', icon: Check, onClick: () => act(u, 'approve') }]
      : []),
    { label: 'Edit details', icon: Pencil, onClick: () => onEdit?.(u) },
    { label: 'Send reset link', icon: KeyRound, onClick: () => sendReset?.(u) },
    'sep',
    { label: 'Copy email', icon: Copy, onClick: () => copyText(u.email, 'Email') },
    { label: 'Copy name', icon: Copy, onClick: () => copyText(u.full_name || '', 'Name') },
    ...(u.status !== 'rejected'
      ? ['sep', { label: 'Reject', icon: X, danger: true, onClick: () => act(u, 'reject') }]
      : []),
  ];
}

/**
 * EditUserModal — staff edit of a managed account's name/email. Role
 * boundaries are enforced server-side; this dialog only ever opens for
 * accounts the caller can already see in their scoped list.
 */
function EditUserModal({ user, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    first_name: user.first_name || '',
    middle_name: user.middle_name || '',
    last_name: user.last_name || '',
    name_ext: user.name_ext || '',
    email: user.email || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/admin/users/${user.id}`, form);
      toast.success(`Updated ${[form.first_name, form.last_name].filter(Boolean).join(' ')}.`);
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update the account.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      size="sm"
      icon={Pencil}
      title="Edit details"
      subtitle={`${user.role} · applies on their next sign-in`}
      onClose={saving ? undefined : onClose}
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="adm-edituser" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      )}
    >
      <form id="adm-edituser" onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="eu-fn">First name <span className="req">*</span></label>
            <input id="eu-fn" className="form-control" value={form.first_name} onChange={set('first_name')} required autoComplete="off" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="eu-mn">Middle name <span className="adm-opt">(optional)</span></label>
            <input id="eu-mn" className="form-control" value={form.middle_name} onChange={set('middle_name')} maxLength={100} autoComplete="off" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="eu-ln">Last name <span className="req">*</span></label>
            <input id="eu-ln" className="form-control" value={form.last_name} onChange={set('last_name')} required autoComplete="off" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="eu-ext">Ext. <span className="adm-opt">(optional)</span></label>
            <select id="eu-ext" className="form-control form-select" value={form.name_ext} onChange={set('name_ext')}>
              <option value="">—</option>
              <option value="Jr.">Jr.</option>
              <option value="Sr.">Sr.</option>
              <option value="II">II</option>
              <option value="III">III</option>
              <option value="IV">IV</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="eu-email">Email <span className="req">*</span></label>
          <input id="eu-email" className="form-control" type="email" value={form.email} onChange={set('email')} required autoComplete="off" />
          <span className="form-hint">This is their sign-in address — password reset links go here too.</span>
        </div>
      </form>
    </Modal>
  );
}

// ── Dashboard tab ──────────────────────────────────────
function DashboardTab({ toast, tier }) {
  const [data, setData] = useState(() => api.peek('/admin/stats') ?? null);
  const [editing, setEditing] = useState(null);
  const { menuEl, openMenu } = useContextMenu();
  const copyText = useCopyText();

  const load = useCallback(() => {
    api.get('/admin/stats')
      .then(setData)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load overview.'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);

  const { act, sendReset, busyId } = useUserActions(toast, load);

  const u = data?.users || {};
  const l = data?.logins24h || {};
  const sys = data?.system || {};

  return (
    <>
      <AdminHeader tier={tier} title="Overview" sub={VIEW_META.dashboard.sub}>
        <button type="button" className="btn btn-outline btn-sm" onClick={load}>
          <RefreshCw size={14} /> Refresh
        </button>
      </AdminHeader>

      {!data ? (
        <TableSkeleton rows={5} />
      ) : (
        <div className="adm-dash">
          {/* KPI tiles — the same dash-kpi anatomy as the instructor overview */}
          <div className="dash-kpis" data-tour="admin-kpis">
            <KpiCard i={0} icon={Clock} tint={4} value={u.pending ?? 0}
              label="Pending approvals"
              hint="waiting for review"
              to="/admin/users?status=pending" />
            <KpiCard i={1} icon={UserCheck} tint={3} value={u.active ?? 0}
              label="Active instructors"
              hint={`${u.total ?? 0} registered`}
              to="/admin/users?status=active" />
            <KpiCard i={2} icon={LogIn} tint={2} value={l.success ?? 0}
              label="Sign-ins · 24h"
              hint={`${l.unique_ips ?? 0} unique IPs`} />
            <KpiCard i={3} icon={ShieldAlert} tint={5} value={l.failed ?? 0}
              label="Failed attempts · 24h"
              hint="blocked or wrong credentials" />
          </div>

          {/* Census strip — hairline-joined cells under the KPIs */}
          <div className="adm-strip">
            <div className="adm-strip-cell">
              <strong>{u.total ?? 0}</strong>
              <span>Total instructors</span>
            </div>
            <div className="adm-strip-cell">
              <strong>{u.verified ?? 0}</strong>
              <span>Verified emails</span>
            </div>
            <div className="adm-strip-cell">
              <strong>{u.rejected ?? 0}</strong>
              <span>Rejected</span>
            </div>
            <div className="adm-strip-cell">
              <strong>{l.unique_ips ?? 0}</strong>
              <span>Unique IPs · 24h</span>
            </div>
          </div>

          <div className="adm-dash-grid">
            {/* Approval queue */}
            <section className="adm-card">
              <header className="adm-card-head">
                <UserCheck size={15} />
                <h3>Approval queue</h3>
                {u.pending > 0 && <span className="adm-tag adm-tag-warn">{u.pending} waiting</span>}
              </header>
              <div className="adm-rows">
                {!data.pendingUsers?.length && (
                  <div className="adm-empty">Nobody is waiting for approval.</div>
                )}
                {data.pendingUsers?.map((p) => (
                  <div
                    className="adm-row"
                    key={p.id}
                    onContextMenu={(e) => openMenu(e, userMenuItems(p, act, copyText, setEditing, sendReset))}
                  >
                    <span className="adm-row-mark" style={{ '--gc': groupColor(p.id) }} aria-hidden="true">{initialsOf(p)}</span>
                    <div className="adm-row-main">
                      <strong>{p.full_name || '—'}</strong>
                      <small>{p.email}</small>
                    </div>
                    <div className="adm-row-side">
                      <span className="adm-muted adm-nowrap">{fmtShort(p.created_at)}</span>
                      <span className="row-actions">
                        <button
                          className="btn btn-primary btn-xs"
                          disabled={busyId === p.id}
                          onClick={() => act(p, 'approve')}
                        >
                          <Check size={13} /> Approve
                        </button>
                        <button
                          className="btn btn-outline btn-xs"
                          disabled={busyId === p.id}
                          onClick={() => act(p, 'reject')}
                        >
                          <X size={13} /> Reject
                        </button>
                        <Tooltip label="More actions">
                          <button
                            className="g-menu"
                            disabled={busyId === p.id}
                            onClick={(e) => openMenu(e, userMenuItems(p, act, copyText, setEditing, sendReset))}
                            aria-label={`Actions for ${p.email}`}
                          >
                            <Ellipsis size={15} />
                          </button>
                        </Tooltip>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <Link className="adm-card-foot" to="/admin/users?status=pending">
                Manage all users <ArrowRight size={13} />
              </Link>
            </section>

            {/* Recent sign-ins */}
            <section className="adm-card">
              <header className="adm-card-head">
                <Activity size={15} />
                <h3>Recent sign-ins</h3>
              </header>
              <div className="adm-rows">
                {!data.recentLogins?.length && (
                  <div className="adm-empty">No sign-in attempts yet.</div>
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
                      <StatusPill status={r.success ? 'active' : 'failed'} label={r.success ? 'Success' : 'Failed'} small />
                      <span className="adm-mono adm-nowrap">{r.ip || '—'}</span>
                      <span className="adm-muted adm-nowrap">{fmtShort(r.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Link className="adm-card-foot" to="/admin/logins">
                View all sign-in logs <ArrowRight size={13} />
              </Link>
            </section>
          </div>

          {/* Integration health — superadmin only (system is null for admins) */}
          {data.system && (
            <section className="adm-card">
              <header className="adm-card-head">
                <ShieldCheck size={15} />
                <h3>System</h3>
                <Link className="adm-card-link" to="/admin/settings">Open settings <ArrowRight size={12} /></Link>
              </header>
              <div className="adm-sys-grid">
                <div className="adm-sys-cell">
                  <span className="adm-sys-name">reCAPTCHA v2</span>
                  <small className="adm-muted">Registration challenge</small>
                  <span className={`adm-sys-state ${sys.recaptcha ? 'is-ok' : 'is-warn'}`}>
                    {sys.recaptcha ? 'Configured' : 'Missing keys'}
                  </span>
                </div>
                <div className="adm-sys-cell">
                  <span className="adm-sys-name">Gemini</span>
                  <small className="adm-muted">Primary AI provider</small>
                  <span className={`adm-sys-state ${sys.gemini ? 'is-ok' : 'is-warn'}`}>
                    {sys.gemini ? 'Configured' : 'Missing key'}
                  </span>
                </div>
                <div className="adm-sys-cell">
                  <span className="adm-sys-name">Groq</span>
                  <small className="adm-muted">Fallback AI provider</small>
                  <span className={`adm-sys-state ${sys.groq ? 'is-ok' : 'is-warn'}`}>
                    {sys.groq ? 'Configured' : 'Missing key'}
                  </span>
                </div>
                <div className="adm-sys-cell">
                  <span className="adm-sys-name">Ollama Cloud</span>
                  <small className="adm-muted">Additional AI fallback</small>
                  <span className={`adm-sys-state ${sys.ollama ? 'is-ok' : 'is-warn'}`}>
                    {sys.ollama ? 'Configured' : 'Not configured'}
                  </span>
                </div>
              </div>
            </section>
          )}

          {menuEl}
          {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={load} />}
        </div>
      )}
    </>
  );
}

// ── Users tab ──────────────────────────────────────────
function UsersTab({ toast, role, tier }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = USER_FILTERS.includes(searchParams.get('status')) ? searchParams.get('status') : 'all';
  const [users, setUsers] = useState(null);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const { menuEl, openMenu } = useContextMenu();
  const copyText = useCopyText();
  const searchRef = useRef(null);

  const setFilter = useCallback((f) => {
    setSearchParams(f === 'all' ? {} : { status: f }, { replace: true });
  }, [setSearchParams]);

  const load = useCallback(() => {
    api.get(`/admin/users?status=${filter}`)
      .then((d) => setUsers(d.users || []))
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load users.'));
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);

  const { act, sendReset, busyId } = useUserActions(toast, load);

  // "/" focuses the search field, mirroring the instructor list pages.
  useEffect(() => {
    function onKey(e) {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const columns = useMemo(() => [
    { id: 'user', accessorFn: (u) => `${u.full_name || ''} ${u.email || ''}`.toLowerCase() },
    { id: 'role', accessorFn: (u) => u.role || '' },
    { id: 'verified', accessorFn: (u) => (u.email_verified ? 1 : 0) },
    { id: 'status', accessorFn: (u) => u.status || '' },
    { id: 'created', accessorFn: (u) => new Date(u.created_at).getTime() || 0 },
  ], []);

  const grid = useGridTable({
    data: users || [],
    columns,
    pageSize: 15,
    storageKey: 'admin-users',
    initialSorting: [{ id: 'created', desc: true }],
    globalFilter: query,
    globalFilterFn: (row, _col, value) =>
      `${row.original.full_name || ''} ${row.original.email || ''} ${row.original.role || ''}`
        .toLowerCase()
        .includes(String(value).toLowerCase()),
    resetKey: filter,
  });
  const { pageRows, sortClass, sortHandler, renderSortArrow } = grid;

  return (
    <>
      <AdminHeader tier={tier} title="User management" sub={VIEW_META.users.sub}>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(true)} data-tour="admin-add">
          <UserPlus size={14} /> Add user
        </button>
      </AdminHeader>

      <section className="dataset">
        <div className="dataset-bar" data-tour="admin-toolbar">
          <div className="dataset-bar-lead">
            <label className="ds-search" htmlFor="adm-users-search">
              <Search size={15} />
              <span className="sr-only">Search users</span>
              <input
                id="adm-users-search"
                ref={searchRef}
                type="search"
                autoComplete="off"
                placeholder="Search by name or email…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd aria-hidden="true">/</kbd>
            </label>
            <div className="adm-seg" role="group" aria-label="Filter by status">
              {USER_FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="dataset-bar-trail">
            <RefreshButton onClick={load} />
          </div>
        </div>

        {users === null ? (
          <TableSkeleton rows={8} />
        ) : (
          <>
            <div className="dataset-scroll" data-tour="admin-table">
              <table className="grid" data-grid-label="managed accounts">
                <caption className="sr-only">Managed staff accounts</caption>
                <thead>
                  <tr>
                    <th className={`col-primary wp-45 ${sortClass('user')}`} onClick={sortHandler('user')} data-name="User">
                      User{renderSortArrow('user')}
                    </th>
                    <th className={`wp-11 ${sortClass('role')}`} onClick={sortHandler('role')} data-name="Position">
                      Position{renderSortArrow('role')}
                    </th>
                    <th className={`wp-10 ${sortClass('verified')}`} onClick={sortHandler('verified')} data-name="Verified">
                      Verified{renderSortArrow('verified')}
                    </th>
                    <th className={`wp-13 ${sortClass('status')}`} onClick={sortHandler('status')} data-name="Status">
                      Status{renderSortArrow('status')}
                    </th>
                    <th className={`wp-16 ${sortClass('created')}`} onClick={sortHandler('created')} data-name="Registered">
                      Registered{renderSortArrow('created')}
                    </th>
                    <th className="col-actions wp-5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody ref={animateRows}>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td className="ds-noresults" colSpan={6}>
                        <span className="ds-noresults-title">No accounts found</span>
                        <span className="ds-noresults-sub">
                          {query ? <>Try a different search or <button type="button" onClick={() => setQuery('')}>clear it</button>.</>
                            : `No ${filter === 'all' ? '' : `${filter} `}accounts.`}
                        </span>
                      </td>
                    </tr>
                  ) : pageRows.map((u) => (
                    <tr
                      key={u.id}
                      style={{ '--gc': groupColor(u.id) }}
                      onContextMenu={(e) => openMenu(e, userMenuItems(u, act, copyText, setEditing, sendReset))}
                    >
                      <td className="col-primary">
                        <span className="g-entity">
                          <span className="g-entity-mark" aria-hidden="true">{initialsOf(u)}</span>
                          <span className="g-primary">
                            <span className="g-title">{u.full_name || '—'}</span>
                            <span className="g-meta">{u.email}</span>
                          </span>
                        </span>
                      </td>
                      <td><RolePill role={u.role} /></td>
                      <td><VerifiedMark yes={!!u.email_verified} /></td>
                      <td><StatusPill status={u.status} /></td>
                      <td className="g-mute" title={fmtTime(u.created_at)}>{fmtDate(u.created_at)}</td>
                      <td className="col-actions">
                        <Tooltip label="Actions">
                          <button
                            type="button"
                            className="g-menu"
                            disabled={busyId === u.id}
                            onClick={(e) => openMenu(e, userMenuItems(u, act, copyText, setEditing, sendReset))}
                            aria-label={`Actions for ${u.email}`}
                          >
                            <Ellipsis size={15} />
                          </button>
                        </Tooltip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DatasetFoot grid={grid} pageSizeOptions={[15, 25, 50]} />
          </>
        )}
      </section>

      {menuEl}
      {adding && <AddUserModal role={role} onClose={() => setAdding(false)} onCreated={load} />}
      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </>
  );
}

// ── Login logs tab ─────────────────────────────────────
function LoginsTab({ toast, tier }) {
  const [logs, setLogs] = useState(null);
  const [query, setQuery] = useState('');
  const { menuEl, openMenu } = useContextMenu();
  const copyText = useCopyText();

  const load = useCallback(() => {
    api.get('/admin/login-logs?limit=200')
      .then((d) => setLogs(d.logs || []))
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load login logs.'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);

  const columns = useMemo(() => [
    { id: 'created', accessorFn: (l) => new Date(l.created_at).getTime() || 0 },
    { id: 'email', accessorFn: (l) => (l.email || '').toLowerCase() },
    { id: 'result', accessorFn: (l) => (l.success ? 1 : 0) },
    { id: 'ip', accessorFn: (l) => l.ip || '' },
  ], []);

  const grid = useGridTable({
    data: logs || [],
    columns,
    pageSize: 25,
    storageKey: 'admin-logins',
    initialSorting: [{ id: 'created', desc: true }],
    globalFilter: query,
    globalFilterFn: (row, _col, value) =>
      `${row.original.email || ''} ${row.original.ip || ''} ${row.original.reason || ''} ${row.original.user_agent || ''}`
        .toLowerCase()
        .includes(String(value).toLowerCase()),
  });
  const { pageRows, sortClass, sortHandler, renderSortArrow } = grid;

  return (
    <>
      <AdminHeader tier={tier} title="Login logs" sub={VIEW_META.logins.sub} />

      <section className="dataset">
        <div className="dataset-bar" data-tour="admin-toolbar">
          <div className="dataset-bar-lead">
            <label className="ds-search" htmlFor="adm-logins-search">
              <Search size={15} />
              <span className="sr-only">Search sign-in attempts</span>
              <input
                id="adm-logins-search"
                type="search"
                autoComplete="off"
                placeholder="Search email, IP, or device…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <span className="adm-hint">Latest 200 attempts</span>
          </div>
          <div className="dataset-bar-trail">
            <RefreshButton onClick={load} />
          </div>
        </div>

        {logs === null ? (
          <TableSkeleton rows={8} />
        ) : (
          <>
            <div className="dataset-scroll" data-tour="admin-table">
              <table className="grid" data-grid-label="sign-in attempts">
                <caption className="sr-only">Sign-in attempts</caption>
                <thead>
                  <tr>
                    <th className={`wp-14 ${sortClass('created')}`} onClick={sortHandler('created')} data-name="Time">
                      Time{renderSortArrow('created')}
                    </th>
                    <th className={`wp-22 ${sortClass('email')}`} onClick={sortHandler('email')} data-name="Email">
                      Email{renderSortArrow('email')}
                    </th>
                    <th className={`wp-9 ${sortClass('result')}`} onClick={sortHandler('result')} data-name="Result">
                      Result{renderSortArrow('result')}
                    </th>
                    <th className="wp-17" data-name="Reason">Reason</th>
                    <th className={`wp-11 ${sortClass('ip')}`} onClick={sortHandler('ip')} data-name="IP address">
                      IP address{renderSortArrow('ip')}
                    </th>
                    <th className="wp-27" data-name="User agent">User agent</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td className="ds-noresults" colSpan={6}>
                        <span className="ds-noresults-title">No sign-in attempts found</span>
                        <span className="ds-noresults-sub">
                          {query ? <>Try a different search or <button type="button" onClick={() => setQuery('')}>clear it</button>.</>
                            : 'No sign-in attempts recorded yet.'}
                        </span>
                      </td>
                    </tr>
                  ) : pageRows.map((l) => (
                    <tr
                      key={l.id}
                      onContextMenu={(e) => openMenu(e, [
                        { label: 'Copy email', icon: Copy, onClick: () => copyText(l.email, 'Email') },
                        { label: 'Copy IP', icon: Copy, onClick: () => copyText(l.ip, 'IP address') },
                        { label: 'Copy user agent', icon: Copy, onClick: () => copyText(l.user_agent, 'User agent') },
                      ])}
                    >
                      <td className="g-mute" title={fmtTime(l.created_at)}>{timeAgo(l.created_at) || fmtShort(l.created_at)}</td>
                      <td>{l.email}</td>
                      <td><StatusPill status={l.success ? 'active' : 'failed'} label={l.success ? 'Success' : 'Failed'} /></td>
                      <td className="g-mute" title={l.reason || ''}>{l.reason || '—'}</td>
                      <td><span className="g-code">{l.ip || '—'}</span></td>
                      <td className="g-mute" title={l.user_agent || ''}>{l.user_agent || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DatasetFoot grid={grid} pageSizeOptions={[25, 50, 100]} />
          </>
        )}
      </section>
      {menuEl}
    </>
  );
}

// ── Audit trail tab ────────────────────────────────────
function AuditTab({ toast, tier }) {
  const [logs, setLogs] = useState(null);
  const [query, setQuery] = useState('');
  const { menuEl, openMenu } = useContextMenu();
  const copyText = useCopyText();

  const load = useCallback(() => {
    api.get('/admin/audit-logs?limit=200')
      .then((d) => setLogs(d.logs || []))
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load audit trail.'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);

  const columns = useMemo(() => [
    { id: 'created', accessorFn: (l) => new Date(l.created_at).getTime() || 0 },
    { id: 'actor', accessorFn: (l) => (l.actor_email || 'system').toLowerCase() },
    { id: 'action', accessorFn: (l) => l.action || '' },
  ], []);

  const grid = useGridTable({
    data: logs || [],
    columns,
    pageSize: 25,
    storageKey: 'admin-audit',
    initialSorting: [{ id: 'created', desc: true }],
    globalFilter: query,
    globalFilterFn: (row, _col, value) => {
      const l = row.original;
      const detail = typeof l.detail === 'string' ? l.detail : JSON.stringify(l.detail || '');
      return `${l.actor_email || ''} ${l.action || ''} ${l.target_type || ''} ${l.target_id || ''} ${detail}`
        .toLowerCase()
        .includes(String(value).toLowerCase());
    },
  });
  const { pageRows, sortClass, sortHandler, renderSortArrow } = grid;

  return (
    <>
      <AdminHeader tier={tier} title="Audit trail" sub={VIEW_META.audit.sub} />

      <section className="dataset">
        <div className="dataset-bar" data-tour="admin-toolbar">
          <div className="dataset-bar-lead">
            <label className="ds-search" htmlFor="adm-audit-search">
              <Search size={15} />
              <span className="sr-only">Search audit events</span>
              <input
                id="adm-audit-search"
                type="search"
                autoComplete="off"
                placeholder="Search actor, action, or target…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <span className="adm-hint">Latest 200 events</span>
          </div>
          <div className="dataset-bar-trail">
            <RefreshButton onClick={load} />
          </div>
        </div>

        {logs === null ? (
          <TableSkeleton rows={8} />
        ) : (
          <>
            <div className="dataset-scroll" data-tour="admin-table">
              <table className="grid" data-grid-label="audit events">
                <caption className="sr-only">Audit trail events</caption>
                <thead>
                  <tr>
                    <th className={`wp-16 ${sortClass('created')}`} onClick={sortHandler('created')} data-name="Time">
                      Time{renderSortArrow('created')}
                    </th>
                    <th className={`wp-20 ${sortClass('actor')}`} onClick={sortHandler('actor')} data-name="Actor">
                      Actor{renderSortArrow('actor')}
                    </th>
                    <th className={`wp-14 ${sortClass('action')}`} onClick={sortHandler('action')} data-name="Action">
                      Action{renderSortArrow('action')}
                    </th>
                    <th className="wp-14" data-name="Target">Target</th>
                    <th className="wp-22" data-name="Detail">Detail</th>
                    <th className="wp-14" data-name="IP">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td className="ds-noresults" colSpan={6}>
                        <span className="ds-noresults-title">No audit events found</span>
                        <span className="ds-noresults-sub">
                          {query ? <>Try a different search or <button type="button" onClick={() => setQuery('')}>clear it</button>.</>
                            : 'No audit events recorded yet.'}
                        </span>
                      </td>
                    </tr>
                  ) : pageRows.map((l) => (
                    <tr
                      key={l.id}
                      onContextMenu={(e) => openMenu(e, [
                        { label: 'Copy action', icon: Copy, onClick: () => copyText(l.action, 'Action') },
                        { label: 'Copy actor', icon: Copy, onClick: () => copyText(l.actor_email, 'Actor') },
                        { label: 'Copy detail', icon: Copy, onClick: () => copyText(typeof l.detail === 'string' ? l.detail : JSON.stringify(l.detail), 'Detail') },
                      ])}
                    >
                      <td className="g-mute" title={fmtTime(l.created_at)}>{fmtShort(l.created_at)}</td>
                      <td>{l.actor_email || 'system'}</td>
                      <td><span className="g-code">{l.action}</span></td>
                      <td className="g-mute" title={[l.target_type, l.target_id].filter(Boolean).join(' · ')}>
                        {[l.target_type, l.target_id].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="g-mute" title={typeof l.detail === 'string' ? l.detail : (l.detail ? JSON.stringify(l.detail) : '')}>
                        {typeof l.detail === 'string' ? l.detail : (l.detail ? JSON.stringify(l.detail) : '—')}
                      </td>
                      <td><span className="g-code">{l.ip || '—'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DatasetFoot grid={grid} pageSizeOptions={[25, 50, 100]} />
          </>
        )}
      </section>
      {menuEl}
    </>
  );
}

/**
 * ProviderTestRow — "Test connection" row inside a provider section. The
 * probe hits saved credentials only, so the button stays disabled while a
 * key/model edit is unsaved or no key is configured.
 */
function ProviderTestRow({ testing, busy, configured, dirty, onTest, result }) {
  const hint = !configured
    ? 'Save an API key to enable the test.'
    : dirty
      ? 'Save your changes first — testing always uses the saved credentials.'
      : 'Sends a tiny request with the saved key and model.';
  return (
    <>
      <div className="adm-provider-test">
        <button type="button" className="btn btn-outline btn-sm" onClick={onTest} disabled={!configured || dirty || busy}>
          {testing ? 'Testing connection…' : 'Test connection'}
        </button>
        <span className="form-hint">{hint}</span>
      </div>
      {result && (
        <p className={`adm-provider-result ${result.ok ? 'is-success' : 'is-error'}`} role="status">
          {result.message}
        </p>
      )}
    </>
  );
}

// ── Settings tab ───────────────────────────────────────
function SettingsTab({ toast, tier }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);
  const [testResults, setTestResults] = useState({});

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
          ollama_api_key: '',
          ollama_model: d.ai?.ollamaModel || '',
        });
      })
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load settings.'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    const provider = k.split('_')[0];
    if (provider === 'gemini' || provider === 'groq' || provider === 'ollama') {
      setTestResults((r) => (r[provider] ? { ...r, [provider]: null } : r));
    }
  };

  async function testProvider(provider) {
    setTesting(provider);
    setTestResults((r) => ({ ...r, [provider]: null }));
    try {
      const result = await api.post(`/admin/settings/${provider}/test`, {});
      setTestResults((r) => ({
        ...r,
        [provider]: { ok: true, message: `Connected to ${result.model}. JSON and source evidence verified.` },
      }));
    } catch (error) {
      setTestResults((r) => ({
        ...r,
        [provider]: { ok: false, message: error instanceof ApiError ? error.message : `Could not test ${provider}.` },
      }));
    } finally {
      setTesting(null);
    }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setTestResults({});
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

  const field = (key, label, { type = 'text', placeholder = '', hint = '' } = {}) => (
    <div className="form-group">
      <label className="form-label" htmlFor={`set-${key}`}>{label}</label>
      <input
        id={`set-${key}`}
        className="form-control"
        type={type}
        autoComplete="off"
        disabled={saving || testing !== null}
        value={form[key] || ''}
        placeholder={placeholder}
        onChange={set(key)}
      />
      {hint && <span className="form-hint">{hint}</span>}
    </div>
  );

  // A provider test only ever probes the saved credentials — editing a key
  // or model marks it dirty until Save so the button can't test a mix.
  const same = (a, b) => (a || '') === (b || '');
  const dirty = data ? {
    gemini: Boolean(form.gemini_api_key?.trim())
      || !same(form.gemini_model?.trim(), data.ai?.geminiModel)
      || !same(form.gemini_embedding_model?.trim(), data.ai?.geminiEmbeddingModel),
    groq: Boolean(form.groq_api_key?.trim())
      || !same(form.groq_model?.trim(), data.ai?.groqModel),
    ollama: Boolean(form.ollama_api_key?.trim())
      || !same(form.ollama_model?.trim(), data.ai?.ollamaModel),
  } : {};

  return (
    <>
      <AdminHeader tier={tier} title="Settings" sub={VIEW_META.settings.sub} />

      {!data ? (
        <TableSkeleton rows={4} />
      ) : (
        <form className="adm-settings" onSubmit={save}>
          <section className="adm-card">
            <header className="adm-card-head">
              <ShieldCheck size={15} />
              <h3>reCAPTCHA v2</h3>
              {data.recaptcha?.secretSet && <span className="adm-tag adm-tag-ok">configured</span>}
            </header>
            <div className="adm-card-body">
              <div className="form-row">
                {field('recaptcha_site_key', 'Site key', { placeholder: 'Site key shown to visitors' })}
                {field('recaptcha_secret_key', 'Secret key', {
                  type: 'password',
                  placeholder: data.recaptcha?.secretMasked || 'Not configured',
                  hint: 'Leave blank to keep the current secret.',
                })}
              </div>
            </div>
          </section>

          <section className="adm-card">
            <header className="adm-card-head">
              <Settings2 size={15} />
              <h3>AI providers</h3>
            </header>
            <div className="adm-card-body adm-providers">
              <div className="adm-provider">
                <div className="adm-provider-head">
                  <strong>Gemini</strong>
                  <small>Primary — question generation and embeddings</small>
                  {data.ai?.geminiApiKeySet && <span className="adm-tag adm-tag-ok">configured</span>}
                </div>
                <div className="form-row">
                  {field('gemini_api_key', 'API key', {
                    type: 'password',
                    placeholder: data.ai?.geminiApiKeyMasked || 'Not configured',
                    hint: data.ai?.geminiApiKeySource ? `Source: ${data.ai.geminiApiKeySource}. Leave blank to keep.` : 'Leave blank to keep.',
                  })}
                  {field('gemini_model', 'Chat model')}
                </div>
                <div className="form-row">
                  {field('gemini_embedding_model', 'Embedding model')}
                </div>
                <ProviderTestRow
                  testing={testing === 'gemini'}
                  busy={testing !== null}
                  configured={Boolean(data.ai?.geminiApiKeySet)}
                  dirty={dirty.gemini}
                  onTest={() => testProvider('gemini')}
                  result={testResults.gemini}
                />
              </div>

              <div className="adm-provider">
                <div className="adm-provider-head">
                  <strong>Groq</strong>
                  <small>Fallback — generation only, no embeddings</small>
                  {data.ai?.groqApiKeySet && <span className="adm-tag adm-tag-ok">configured</span>}
                </div>
                <div className="form-row">
                  {field('groq_api_key', 'API key', {
                    type: 'password',
                    placeholder: data.ai?.groqApiKeyMasked || 'Not configured',
                    hint: data.ai?.groqApiKeySource ? `Source: ${data.ai.groqApiKeySource}. Leave blank to keep.` : 'Leave blank to keep.',
                  })}
                  {field('groq_model', 'Model')}
                </div>
                <ProviderTestRow
                  testing={testing === 'groq'}
                  busy={testing !== null}
                  configured={Boolean(data.ai?.groqApiKeySet)}
                  dirty={dirty.groq}
                  onTest={() => testProvider('groq')}
                  result={testResults.groq}
                />
              </div>

              <div className="adm-provider">
                <div className="adm-provider-head">
                  <strong>Ollama Cloud</strong>
                  <small>Last resort — runs in the cloud, no local install</small>
                  {data.ai?.ollamaApiKeySet && <span className="adm-tag adm-tag-ok">configured</span>}
                </div>
                <div className="form-row">
                  {field('ollama_api_key', 'API key', {
                    type: 'password',
                    placeholder: data.ai?.ollamaApiKeyMasked || 'Paste your Ollama API key',
                    hint: 'Leave blank to keep the saved key.',
                  })}
                  {field('ollama_model', 'Model', {
                    placeholder: 'gemma4:31b',
                    hint: 'Use the API model name included in your free allowance. Availability depends on your Ollama account.',
                  })}
                </div>
                <ProviderTestRow
                  testing={testing === 'ollama'}
                  busy={testing !== null}
                  configured={Boolean(data.ai?.ollamaApiKeySet)}
                  dirty={dirty.ollama}
                  onTest={() => testProvider('ollama')}
                  result={testResults.ollama}
                />
              </div>
            </div>
          </section>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving || testing !== null}>
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

// ── Reports ──────────────────────────────────────────

/**
 * ReportsTab — institution-wide usage report (superadmin only).
 * On screen: KPI tiles + report cards. On paper: a dedicated .print-doc
 * report (the same anatomy as the instructor analytics reports), plus
 * CSV/XLSX exports.
 */
function ReportsTab({ toast, tier }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    api.get('/admin/reports/usage')
      .then(setData)
      .catch((err) => toast.error(err.message || 'Could not load the usage report.'));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const t = data?.totals || {};
  const metricRows = [
    ['Instructors', `${t.active_instructors || 0} active · ${t.pending_instructors || 0} pending · ${t.instructors || 0} total`],
    ['Subjects', t.subjects ?? 0],
    ['Questions', `${t.approved_questions || 0} approved · ${t.draft_questions || 0} drafts · ${t.rejected_questions || 0} rejected`],
    ['Blueprints', `${t.finalized_blueprints || 0} finalized · ${t.blueprints || 0} total`],
    ['Materials', t.materials ?? 0],
    ['Exams', `${t.published_exams || 0} published · ${t.exams || 0} total`],
    ['Scanned sheets', t.scans ?? 0],
    ['Students', t.students ?? 0],
    ['AI jobs', `${t.ai_jobs || 0} total · ${t.failed_jobs || 0} failed`],
  ];
  const instructorRows = (data?.instructorActivity || []).map((r) => [
    r.full_name || '—', r.email, r.status, r.subjects, r.questions, r.exams, r.scans,
  ]);
  const bloomRows = (data?.bloomMix || []).map((r) => [r.bloom || 'unclassified', r.n]);
  const typeRows = (data?.typeMix || []).map((r) => [TYPE_LABELS[r.type] || r.type, r.n]);
  const trendRows = (() => {
    const months = new Set([
      ...(data?.scanTrend || []).map((r) => r.month),
      ...(data?.loginTrend || []).map((r) => r.month),
    ]);
    const scans = Object.fromEntries((data?.scanTrend || []).map((r) => [r.month, r.n]));
    const logins = Object.fromEntries((data?.loginTrend || []).map((r) => [r.month, r]));
    return [...months].sort().reverse().map((m) => [m, scans[m] || 0, logins[m]?.n || 0, logins[m]?.succeeded || 0]);
  })();
  const jobRows = (data?.jobMix || []).map((r) => [r.kind, r.n, r.failed || 0]);

  function exportCsv() {
    const lines = [
      ['nexam — Institution usage report'],
      ['Generated', new Date(data.generatedAt).toLocaleString(), 'Prepared by', user?.email || ''],
      [],
      ['Section', 'Metric', 'Value'],
      ...metricRows.map(([m, v]) => ['Totals', m, v]),
      [],
      ['Instructors', 'Name', 'Email', 'Status', 'Subjects', 'Questions', 'Exams', 'Scans'],
      ...instructorRows.map((r) => ['', ...r]),
      [],
      ['Question mix', 'Bloom level', 'Questions'],
      ...bloomRows.map((r) => ['', ...r]),
      ['', 'Type', 'Questions'],
      ...typeRows.map((r) => ['', ...r]),
      [],
      ['Activity', 'Month', 'Scans', 'Sign-ins', 'Succeeded'],
      ...trendRows.map((r) => ['', ...r]),
      [],
      ['AI jobs', 'Kind', 'Runs', 'Failed'],
      ...jobRows.map((r) => ['', ...r]),
    ];
    // downloadCsv takes uniform headers/rows — flatten into a single table.
    const maxCols = Math.max(...lines.map((l) => l.length));
    downloadCsv('nexam-usage-report', Array(maxCols).fill(''), lines.map((l) => [...l, ...Array(maxCols - l.length).fill('')]));
  }

  function exportXlsx() {
    downloadXlsx('nexam-usage-report', [
      { title: 'Totals', headers: ['Metric', 'Value'], rows: metricRows },
      { title: 'Instructors', headers: ['Name', 'Email', 'Status', 'Subjects', 'Questions', 'Exams', 'Scans'], rows: instructorRows },
      { title: 'Question mix', headers: ['Group', 'Value', 'Questions'], rows: [...bloomRows.map(([b, n]) => ['Bloom', b, n]), ...typeRows.map(([ty, n]) => ['Type', ty, n])] },
      { title: 'Activity', headers: ['Month', 'Scans', 'Sign-ins', 'Succeeded'], rows: trendRows },
      { title: 'AI jobs', headers: ['Kind', 'Runs', 'Failed'], rows: jobRows },
    ]);
  }

  const printMeta = `Generated ${data ? fmtTime(data.generatedAt) : ''} · Prepared by ${user?.full_name || user?.email || 'administrator'}`;

  return (
    <>
      <AdminHeader tier={tier} title="Usage report" sub={VIEW_META.reports.sub}>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => window.print()} disabled={!data} title="Print the report as a document">
          <Printer size={14} /> Print
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={exportCsv} disabled={!data} title="Download all sections as CSV">
          <FileDown size={14} /> CSV
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={exportXlsx} disabled={!data} title="Download a multi-sheet Excel workbook">
          <FileSpreadsheet size={14} /> Excel
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={load} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </AdminHeader>

      {!data ? (
        <TableSkeleton rows={5} />
      ) : (
        <>
          {/* ── Print document: a paginated memo, not flattened app cards ── */}
          <div className="print-doc print-only">
            <div className="print-doc-head">
              <div className="pd-org">nexam — Administrator Console</div>
              <div className="pd-title">Institution Usage Report</div>
              <div className="pd-meta">{printMeta}</div>
            </div>

            <div className="report-section-title">System totals</div>
            <table className="report-table">
              <tbody>
                {metricRows.map(([m, v]) => <tr key={m}><th>{m}</th><td>{v}</td></tr>)}
              </tbody>
            </table>

            <div className="report-section-title">Activity by month</div>
            <table className="report-table">
              <thead><tr><th>Month</th><th>Scans</th><th>Sign-ins</th><th>Succeeded</th></tr></thead>
              <tbody>
                {trendRows.length === 0 && <tr><td colSpan={4}>No activity recorded yet.</td></tr>}
                {trendRows.map(([m, s, l, ok]) => (
                  <tr key={m}><td>{m}</td><td>{s}</td><td>{l}</td><td>{ok}</td></tr>
                ))}
              </tbody>
            </table>

            <div className="report-section-title">Instructor activity</div>
            <table className="report-table">
              <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Subjects</th><th>Questions</th><th>Exams</th><th>Scans</th></tr></thead>
              <tbody>
                {instructorRows.length === 0 && <tr><td colSpan={7}>No instructor activity yet.</td></tr>}
                {instructorRows.map((r, i) => (
                  <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>

            <div className="report-section-title">Question mix</div>
            <table className="report-table">
              <thead><tr><th>Group</th><th>Value</th><th>Questions</th></tr></thead>
              <tbody>
                {(bloomRows.length + typeRows.length) === 0 && <tr><td colSpan={3}>No questions yet.</td></tr>}
                {bloomRows.map(([b, n]) => <tr key={`b-${b}`}><td>Bloom</td><td>{BLOOM_LABELS[b] || b}</td><td>{n}</td></tr>)}
                {typeRows.map(([ty, n]) => <tr key={`t-${ty}`}><td>Type</td><td>{ty}</td><td>{n}</td></tr>)}
              </tbody>
            </table>

            <div className="report-section-title">AI jobs</div>
            <table className="report-table">
              <thead><tr><th>Kind</th><th>Runs</th><th>Failed</th></tr></thead>
              <tbody>
                {jobRows.length === 0 && <tr><td colSpan={3}>No AI jobs yet.</td></tr>}
                {jobRows.map(([k, n, f]) => <tr key={k}><td>{k}</td><td>{n}</td><td>{f}</td></tr>)}
              </tbody>
            </table>

            <div className="print-doc-foot">
              <span>nexam — Administrator Console</span>
              <span>Institution Usage Report</span>
            </div>
          </div>

          {/* ── Interactive UI (hidden on paper) ── */}
          <div className="adm-dash print-skip">
            <p className="adm-hint adm-report-meta">{printMeta}</p>

            <div className="stats-grid">
              <div className="stat-card"><div className="stat-icon blue"><Users size={18} /></div>
                <div className="stat-info"><div className="stat-value">{t.instructors || 0}</div><div className="stat-label">Instructors</div></div>
              </div>
              <div className="stat-card"><div className="stat-icon green"><ListChecks size={18} /></div>
                <div className="stat-info"><div className="stat-value">{t.approved_questions || 0}</div><div className="stat-label">Approved questions</div></div>
              </div>
              <div className="stat-card"><div className="stat-icon cyan"><ScrollText size={18} /></div>
                <div className="stat-info"><div className="stat-value">{t.exams || 0}</div><div className="stat-label">Exams</div></div>
              </div>
              <div className="stat-card"><div className="stat-icon purple"><Activity size={18} /></div>
                <div className="stat-info"><div className="stat-value">{t.scans || 0}</div><div className="stat-label">Scanned sheets</div></div>
              </div>
            </div>

            <div className="adm-dash-grid">
              <section className="adm-card">
                <header className="adm-card-head"><BarChart3 size={15} /><h3>System totals</h3></header>
                <div className="adm-card-body">
                  <table className="adm-rt">
                    <tbody>
                      {metricRows.map(([m, v]) => (
                        <tr key={m}><td><strong>{m}</strong></td><td>{v ?? 0}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="adm-card">
                <header className="adm-card-head"><Activity size={15} /><h3>Activity by month</h3></header>
                <div className="adm-card-body">
                  {trendRows.length > 0 && (
                    <div className="adm-chart">
                      <LoginTrendChart
                        rows={trendRows.slice().reverse().map(([m, s, l, ok]) => ({ month: m, scans: s, logins: l, succeeded: ok }))}
                      />
                    </div>
                  )}
                  <table className="adm-rt">
                    <thead><tr><th>Month</th><th>Scans</th><th>Sign-ins</th><th>Succeeded</th></tr></thead>
                    <tbody>
                      {trendRows.length === 0 && <tr><td colSpan={4} className="adm-muted">No activity recorded yet.</td></tr>}
                      {trendRows.map(([m, s, l, ok]) => (
                        <tr key={m}><td><strong>{m}</strong></td><td>{s}</td><td>{l}</td><td>{ok}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <section className="adm-card">
              <header className="adm-card-head"><UserCheck size={15} /><h3>Instructor activity</h3></header>
              <div className="adm-card-body">
                <table className="adm-rt">
                  <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Subjects</th><th>Questions</th><th>Exams</th><th>Scans</th></tr></thead>
                  <tbody>
                    {(data.instructorActivity || []).length === 0 && (
                      <tr><td colSpan={7} className="adm-muted">No instructor activity yet.</td></tr>
                    )}
                    {(data.instructorActivity || []).map((r) => (
                      <tr key={r.id}>
                        <td><strong>{r.full_name || '—'}</strong></td>
                        <td className="adm-muted">{r.email}</td>
                        <td><StatusPill status={r.status} small /></td>
                        <td>{r.subjects}</td><td>{r.questions}</td><td>{r.exams}</td><td>{r.scans}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="adm-dash-grid">
              <section className="adm-card">
                <header className="adm-card-head"><BarChart3 size={15} /><h3>Question mix</h3></header>
                <div className="adm-card-body">
                  {(bloomRows.length + typeRows.length) > 0 && (
                    <div className="adm-chart">
                      <CountsBarChart
                        rows={[
                          ...BLOOM_ORDER.map((b, i) => {
                            const hit = bloomRows.find(([name]) => name === b);
                            return hit ? { name: BLOOM_LABELS[b] || b, n: hit[1], var: `--bloom-${i + 1}` } : null;
                          }).filter(Boolean),
                          ...typeRows
                            .sort((a, b) => b[1] - a[1])
                            .map(([ty, n], i) => ({ name: ty, n, var: `--gc-${(i % 8) + 1}` })),
                        ]}
                      />
                    </div>
                  )}
                  <table className="adm-rt">
                    <thead><tr><th>Group</th><th>Value</th><th>Questions</th></tr></thead>
                    <tbody>
                      {(bloomRows.length + typeRows.length) === 0 && (
                        <tr><td colSpan={3} className="adm-muted">No questions yet.</td></tr>
                      )}
                      {bloomRows.map(([b, n]) => <tr key={`b-${b}`}><td>Bloom</td><td><strong>{BLOOM_LABELS[b] || b}</strong></td><td>{n}</td></tr>)}
                      {typeRows.map(([ty, n]) => <tr key={`t-${ty}`}><td>Type</td><td><strong>{ty}</strong></td><td>{n}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="adm-card">
                <header className="adm-card-head"><ShieldCheck size={15} /><h3>AI jobs</h3></header>
                <div className="adm-card-body">
                  <table className="adm-rt">
                    <thead><tr><th>Kind</th><th>Runs</th><th>Failed</th></tr></thead>
                    <tbody>
                      {jobRows.length === 0 && <tr><td colSpan={3} className="adm-muted">No AI jobs yet.</td></tr>}
                      {jobRows.map(([k, n, f]) => <tr key={k}><td><strong>{k}</strong></td><td>{n}</td><td>{f}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ── Page ───────────────────────────────────────────────
export default function AdminPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { view } = useParams();
  // Mid-tier admins get Dashboard + Users; everything else is superadmin-only.
  const allowed = user?.role === 'superadmin' ? VIEWS : ['dashboard', 'users'];
  if (!view) return <Navigate to="/admin/dashboard" replace />;
  if (!allowed.includes(view)) return <Navigate to="/admin/dashboard" replace />;

  const meta = VIEW_META[view];
  const tier = user?.role === 'superadmin' ? 'Superadmin console' : 'Admin console';

  return (
    <AppShell activeNav={view} pageClass="admin" pageTitle={meta.title} wide>
      {view === 'dashboard' && <DashboardTab toast={toast} tier={tier} />}
      {view === 'users' && <UsersTab toast={toast} role={user?.role} tier={tier} />}
      {view === 'reports' && <ReportsTab toast={toast} tier={tier} />}
      {view === 'logins' && <LoginsTab toast={toast} tier={tier} />}
      {view === 'audit' && <AuditTab toast={toast} tier={tier} />}
      {view === 'settings' && <SettingsTab toast={toast} tier={tier} />}
    </AppShell>
  );
}
