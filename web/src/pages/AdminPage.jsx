import '../styles/admin.css';
/**
 * AdminPage — admin + superadmin console, inside the shared AppLayout shell
 * at /admin/:view where view is dashboard | users | announcements | reports |
 * bank | logins | audit | settings.
 *
 * Views:
 *   Dashboard     — KPI tiles, a census strip, approval queue, recent sign-ins,
 *                   and (superadmin) integration health
 *   Users         — searchable/sortable account directory with approve/reject,
 *                   provision, edit, and reset-link actions
 *   Announcements — staff notices shown on the instructor dashboard
 *   Reports       — usage report: on-screen cards plus a real print document
 *                   (.print-doc) and CSV/XLSX exports; admins get the scoped
 *                   instructor-activity variant
 *   Question bank — read-only catalog of institution-wide approved questions
 *   Login logs    — every sign-in attempt with IP + user agent (superadmin)
 *   Audit trail   — console actions and security events (superadmin)
 *   Settings      — reCAPTCHA keys + AI provider credentials (superadmin)
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
  Search, ScrollText, ListChecks, Users, ChevronDown, Megaphone,
  Trash2, Plus, Eye, EyeOff, CircleHelp, MailCheck, Undo2,
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
import { subjectLabel } from '../lib/subjectProgress.js';
import { timeAgo } from '../lib/time.js';
import { useAuth } from '../features/auth/AuthContext.jsx';
import api, { ApiError } from '../lib/api.js';
import { downloadCsv, downloadXlsx } from '../lib/exports.js';
import { CountsBarChart, LoginTrendChart } from '../components/AnalyticsCharts.jsx';
import { BLOOM_LABELS, BLOOM_ORDER } from '../lib/insights.js';

const USER_FILTERS = ['all', 'pending', 'active', 'rejected'];
const VIEWS = ['dashboard', 'users', 'announcements', 'reports', 'bank', 'logins', 'audit', 'settings'];
const ADMIN_VIEWS = ['dashboard', 'users', 'announcements', 'reports', 'bank'];
const TYPE_LABELS = { mcq: 'Multiple choice', true_false: 'True / false', matching: 'Matching', identification: 'Fill in the blank' };

const VIEW_META = {
  dashboard: { title: 'Overview', sub: 'Approvals, sign-in activity, and system health at a glance.' },
  users: { title: 'Users', sub: 'Approve, provision, and maintain staff accounts.' },
  announcements: { title: 'Announcements', sub: 'Notices shown on every instructor dashboard.' },
  reports: { title: 'Reports', sub: 'Institution-wide usage — print it or export it for the record.' },
  bank: { title: 'Question bank', sub: 'Read-only catalog of every approved question in the institution.' },
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

/** Normalize stored IPs for display: IPv4-mapped forms collapse to the
 *  dotted quad and loopback reads as "localhost" instead of "::1". */
function fmtIp(ip) {
  const s = String(ip || '').trim();
  if (!s) return '—';
  if (s === '::1' || s === '::ffff:127.0.0.1' || s === '127.0.0.1') return 'localhost';
  const v4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
  return v4 ? v4[1] : s;
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
 * Shared per-view action row — the topbar already carries the view title,
 * so the console only renders controls, not a repeated heading.
 */
function AdminHeader({ children }) {
  if (!children) return null;
  return (
    <div className="page-header print-skip">
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
function DashboardTab({ toast }) {
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
      <AdminHeader>
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
                      <span className="adm-actions">
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
                      <span className="adm-mono adm-nowrap">{fmtIp(r.ip)}</span>
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
function UsersTab({ toast, role }) {
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
      <AdminHeader>
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

// ── Announcements tab ────────────────────────────────
function AnnouncementsTab({ toast }) {
  const [rows, setRows] = useState(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null); // announcement being edited, or {} for new
  const [busyId, setBusyId] = useState(null);
  const { menuEl, openMenu } = useContextMenu();
  const copyText = useCopyText();
  const confirm = useConfirm();

  const load = useCallback(() => {
    api.get('/admin/announcements')
      .then((d) => setRows(d.announcements || []))
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load announcements.'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);

  const toggle = useCallback(async (a) => {
    setBusyId(a.id);
    try {
      await api.put(`/admin/announcements/${a.id}`, { is_active: !a.is_active });
      toast.success(a.is_active ? `"${a.title}" hidden from instructors.` : `"${a.title}" is live on instructor dashboards.`);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not update the announcement.');
    } finally {
      setBusyId(null);
    }
  }, [load, toast]);

  const remove = useCallback(async (a) => {
    const ok = await confirm(
      `"${a.title}" will be permanently removed. Instructors will no longer see it.`,
      { title: 'Delete announcement?', confirmText: 'Delete', danger: true, icon: Trash2 }
    );
    if (!ok) return;
    setBusyId(a.id);
    try {
      await api.del(`/admin/announcements/${a.id}`);
      toast.success('Announcement deleted.');
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not delete the announcement.');
    } finally {
      setBusyId(null);
    }
  }, [confirm, load, toast]);

  const menuItems = (a) => [
    { label: 'Edit', icon: Pencil, onClick: () => setEditing(a) },
    { label: a.is_active ? 'Hide from instructors' : 'Publish to instructors', icon: a.is_active ? EyeOff : Eye, onClick: () => toggle(a) },
    'sep',
    { label: 'Copy title', icon: Copy, onClick: () => copyText(a.title, 'Title') },
    { label: 'Copy body', icon: Copy, onClick: () => copyText(a.body, 'Body') },
    'sep',
    { label: 'Delete', icon: Trash2, danger: true, onClick: () => remove(a) },
  ];

  const columns = useMemo(() => [
    { id: 'created', accessorFn: (a) => new Date(a.created_at).getTime() || 0 },
    { id: 'title', accessorFn: (a) => (a.title || '').toLowerCase() },
    { id: 'status', accessorFn: (a) => (a.is_active ? 1 : 0) },
    { id: 'author', accessorFn: (a) => (a.author || '').toLowerCase() },
  ], []);

  const grid = useGridTable({
    data: rows || [],
    columns,
    pageSize: 15,
    storageKey: 'admin-announcements',
    initialSorting: [{ id: 'created', desc: true }],
    globalFilter: query,
    globalFilterFn: (row, _col, value) =>
      `${row.original.title || ''} ${row.original.body || ''} ${row.original.author || ''}`
        .toLowerCase().includes(String(value).toLowerCase()),
  });
  const { pageRows, sortClass, sortHandler, renderSortArrow } = grid;

  return (
    <>
      <AdminHeader>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({})}>
          <Plus size={14} /> New announcement
        </button>
        <RefreshButton onClick={load} />
      </AdminHeader>

      <section className="dataset">
        <div className="dataset-bar">
          <div className="dataset-bar-lead">
            <label className="ds-search" htmlFor="adm-ann-search">
              <Search size={15} />
              <span className="sr-only">Search announcements</span>
              <input
                id="adm-ann-search"
                type="search"
                autoComplete="off"
                placeholder="Search title or body…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <span className="adm-hint">Live notices show on every instructor dashboard.</span>
          </div>
        </div>

        {rows === null ? (
          <TableSkeleton rows={5} />
        ) : (
          <>
            <div className="dataset-scroll">
              <table className="grid" data-grid-label="announcements">
                <caption className="sr-only">Announcements</caption>
                <thead>
                  <tr>
                    <th className={`col-primary wp-45 ${sortClass('title')}`} onClick={sortHandler('title')} data-name="Announcement">
                      Announcement{renderSortArrow('title')}
                    </th>
                    <th className={`wp-10 ${sortClass('status')}`} onClick={sortHandler('status')} data-name="Status">
                      Status{renderSortArrow('status')}
                    </th>
                    <th className={`wp-17 ${sortClass('author')}`} onClick={sortHandler('author')} data-name="Posted by">
                      Posted by{renderSortArrow('author')}
                    </th>
                    <th className={`wp-12 ${sortClass('created')}`} onClick={sortHandler('created')} data-name="Posted">
                      Posted{renderSortArrow('created')}
                    </th>
                    <th className="wp-11" data-name="Updated">Updated</th>
                    <th className="col-actions wp-5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody ref={animateRows}>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td className="ds-noresults" colSpan={6}>
                        <span className="ds-noresults-title">No announcements</span>
                        <span className="ds-noresults-sub">
                          {query ? <>Try a different search or <button type="button" onClick={() => setQuery('')}>clear it</button>.</>
                            : 'Post one and it appears on every instructor dashboard.'}
                        </span>
                      </td>
                    </tr>
                  ) : pageRows.map((a) => (
                    <tr key={a.id} onContextMenu={(e) => openMenu(e, menuItems(a))}>
                      <td className="col-primary">
                        <span className="g-primary">
                          <span className="g-title">{a.title}</span>
                          <span className="g-meta adm-ann-preview">{a.body}</span>
                        </span>
                      </td>
                      <td>
                        <StatusPill status={a.is_active ? 'live' : 'draft'} label={a.is_active ? 'Live' : 'Hidden'} small />
                      </td>
                      <td className="g-mute">{a.author || '—'}</td>
                      <td className="g-mute" title={fmtTime(a.created_at)}>{fmtDate(a.created_at)}</td>
                      <td className="g-mute" title={fmtTime(a.updated_at)}>{fmtDate(a.updated_at)}</td>
                      <td className="col-actions">
                        <Tooltip label="Actions">
                          <button
                            type="button"
                            className="g-menu"
                            disabled={busyId === a.id}
                            onClick={(e) => openMenu(e, menuItems(a))}
                            aria-label={`Actions for ${a.title}`}
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
      {editing && (
        <AnnouncementModal
          announcement={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </>
  );
}

/** AnnouncementModal — create or edit a staff notice. */
function AnnouncementModal({ announcement, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: announcement?.title || '', body: announcement?.body || '' });
  const [saving, setSaving] = useState(false);
  const isNew = !announcement;

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) {
        await api.post('/admin/announcements', form);
        toast.success('Announcement published to instructor dashboards.');
      } else {
        await api.put(`/admin/announcements/${announcement.id}`, form);
        toast.success('Announcement updated.');
      }
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save the announcement.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      size="sm"
      icon={Megaphone}
      title={isNew ? 'New announcement' : 'Edit announcement'}
      subtitle={isNew ? 'Goes live on every instructor dashboard' : announcement?.title}
      onClose={saving ? undefined : onClose}
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="adm-announcement" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Publish' : 'Save changes'}
          </button>
        </>
      )}
    >
      <form id="adm-announcement" onSubmit={submit}>
        <div className="form-group">
          <label className="form-label" htmlFor="ann-title">Title <span className="req">*</span></label>
          <input
            id="ann-title"
            className="form-control"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Submit TOS blueprints by Friday"
            maxLength={160}
            required
            autoFocus
            autoComplete="off"
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="ann-body">Message <span className="req">*</span></label>
          <textarea
            id="ann-body"
            className="form-control"
            rows={5}
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            placeholder="What should every instructor know?"
            maxLength={2000}
            required
          />
          <span className="form-hint">Shown as a banner on the instructor dashboard until you hide or delete it.</span>
        </div>
      </form>
    </Modal>
  );
}

// ── Question bank tab ────────────────────────────────
const BANK_BLOOMS = BLOOM_ORDER;
const BANK_TYPES = ['mcq', 'true_false', 'matching', 'identification'];

function BankTab({ toast }) {
  const [data, setData] = useState(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ subject: '', bloom: '', type: '' });
  const [viewing, setViewing] = useState(null);
  const { menuEl, openMenu } = useContextMenu();
  const copyText = useCopyText();

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.subject) params.set('subject', filters.subject);
    if (filters.bloom) params.set('bloom', filters.bloom);
    if (filters.type) params.set('type', filters.type);
    const qs = params.toString();
    api.get(`/admin/question-bank${qs ? `?${qs}` : ''}`)
      .then(setData)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load the question bank.'));
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);

  const questions = data?.questions || [];
  const subjects = data?.subjects || [];

  const columns = useMemo(() => [
    { id: 'stem', accessorFn: (q) => (q.stem || '').toLowerCase() },
    { id: 'type', accessorFn: (q) => q.type || '' },
    { id: 'bloom', accessorFn: (q) => q.bloom || '' },
    { id: 'subject', accessorFn: (q) => (q.subject_name || '').toLowerCase() },
    { id: 'author', accessorFn: (q) => (q.author || '').toLowerCase() },
    { id: 'created', accessorFn: (q) => new Date(q.created_at).getTime() || 0 },
  ], []);

  const grid = useGridTable({
    data: questions,
    columns,
    pageSize: 25,
    storageKey: 'admin-bank',
    initialSorting: [{ id: 'created', desc: true }],
    resetKey: JSON.stringify(filters),
    globalFilter: query,
    globalFilterFn: (row, _col, value) =>
      `${row.original.stem || ''} ${row.original.topic || ''} ${row.original.subject_name || ''} ${row.original.author || ''}`
        .toLowerCase().includes(String(value).toLowerCase()),
  });
  const { pageRows, sortClass, sortHandler, renderSortArrow } = grid;

  const menuItems = (q) => [
    { label: 'View full question', icon: Eye, onClick: () => setViewing(q) },
    'sep',
    { label: 'Copy question', icon: Copy, onClick: () => copyText(q.stem, 'Question') },
    { label: 'Copy subject', icon: Copy, onClick: () => copyText(q.subject_name || '', 'Subject') },
  ];

  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const hasFilters = filters.subject || filters.bloom || filters.type;

  return (
    <>
      <AdminHeader>
        <RefreshButton onClick={load} />
      </AdminHeader>

      <section className="dataset">
        <div className="dataset-bar">
          <div className="dataset-bar-lead">
            <label className="ds-search" htmlFor="adm-bank-search">
              <Search size={15} />
              <span className="sr-only">Search approved questions</span>
              <input
                id="adm-bank-search"
                type="search"
                autoComplete="off"
                placeholder="Search stem, topic, subject, or author…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select className="form-control form-select adm-select" value={filters.subject} onChange={setFilter('subject')} aria-label="Filter by subject">
              <option value="">All subjects</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{subjectLabel(s)}</option>)}
            </select>
            <select className="form-control form-select adm-select" value={filters.bloom} onChange={setFilter('bloom')} aria-label="Filter by Bloom level">
              <option value="">All Bloom levels</option>
              {BANK_BLOOMS.map((b) => <option key={b} value={b}>{BLOOM_LABELS[b] || b}</option>)}
            </select>
            <select className="form-control form-select adm-select" value={filters.type} onChange={setFilter('type')} aria-label="Filter by question type">
              <option value="">All types</option>
              {BANK_TYPES.map((ty) => <option key={ty} value={ty}>{TYPE_LABELS[ty] || ty}</option>)}
            </select>
          </div>
          <div className="dataset-bar-trail">
            <span className="adm-hint">Approved questions only — read-only.</span>
          </div>
        </div>

        {data === null ? (
          <TableSkeleton rows={8} />
        ) : (
          <>
            <div className="dataset-scroll">
              <table className="grid" data-grid-label="approved questions">
                <caption className="sr-only">Institution approved question bank</caption>
                <thead>
                  <tr>
                    <th className={`col-primary wp-36 ${sortClass('stem')}`} onClick={sortHandler('stem')} data-name="Question">
                      Question{renderSortArrow('stem')}
                    </th>
                    <th className={`wp-11 ${sortClass('type')}`} onClick={sortHandler('type')} data-name="Type">
                      Type{renderSortArrow('type')}
                    </th>
                    <th className={`wp-12 ${sortClass('bloom')}`} onClick={sortHandler('bloom')} data-name="Bloom">
                      Bloom{renderSortArrow('bloom')}
                    </th>
                    <th className={`wp-17 ${sortClass('subject')}`} onClick={sortHandler('subject')} data-name="Subject">
                      Subject{renderSortArrow('subject')}
                    </th>
                    <th className={`wp-14 ${sortClass('author')}`} onClick={sortHandler('author')} data-name="Author">
                      Author{renderSortArrow('author')}
                    </th>
                    <th className={`wp-10 ${sortClass('created')}`} onClick={sortHandler('created')} data-name="Added">
                      Added{renderSortArrow('created')}
                    </th>
                  </tr>
                </thead>
                <tbody ref={animateRows}>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td className="ds-noresults" colSpan={6}>
                        <span className="ds-noresults-title">No approved questions found</span>
                        <span className="ds-noresults-sub">
                          {query || hasFilters ? <>Try different filters or <button type="button" onClick={() => { setQuery(''); setFilters({ subject: '', bloom: '', type: '' }); }}>clear them</button>.</>
                            : 'Questions appear here once instructors approve them.'}
                        </span>
                      </td>
                    </tr>
                  ) : pageRows.map((q) => (
                    <tr
                      key={q.id}
                      className="adm-bank-row"
                      onClick={() => setViewing(q)}
                      onContextMenu={(e) => openMenu(e, menuItems(q))}
                    >
                      <td className="col-primary">
                        <span className="g-primary">
                          <span className="g-title adm-bank-stem">{q.stem}</span>
                          {q.topic && <span className="g-meta" title={q.topic}>{q.topic}</span>}
                        </span>
                      </td>
                      <td>{TYPE_LABELS[q.type] || q.type}</td>
                      <td>{BLOOM_LABELS[q.bloom] || q.bloom || '—'}</td>
                      <td className="g-mute" title={subjectLabel(q)}>{subjectLabel(q)}</td>
                      <td className="g-mute" title={q.author || ''}>{q.author || '—'}</td>
                      <td className="g-mute" title={fmtTime(q.created_at)}>{fmtDate(q.created_at)}</td>
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
      {viewing && <BankViewModal question={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

/** BankViewModal — read-only full view of one approved question. */
function BankViewModal({ question: q, onClose }) {
  const copyText = useCopyText();
  return (
    <Modal
      open
      size="md"
      icon={CircleHelp}
      title={TYPE_LABELS[q.type] || 'Question'}
      subtitle={subjectLabel(q)}
      onClose={onClose}
      footer={(
        <button type="button" className="btn btn-outline" onClick={() => copyText(q.stem, 'Question')}>
          <Copy size={14} /> Copy question
        </button>
      )}
    >
      <div className="adm-bank-detail">
        <p className="adm-bank-full">{q.stem}</p>
        <dl className="adm-detail-grid">
          <div><dt>Bloom level</dt><dd>{BLOOM_LABELS[q.bloom] || q.bloom || '—'}</dd></div>
          <div><dt>Topic</dt><dd>{q.topic || '—'}</dd></div>
          <div><dt>Subject</dt><dd>{subjectLabel(q)}</dd></div>
          <div><dt>Author</dt><dd>{q.author || '—'}</dd></div>
          <div><dt>Added</dt><dd>{fmtTime(q.created_at)}</dd></div>
        </dl>
      </div>
    </Modal>
  );
}

// ── Login logs tab ─────────────────────────────────────
function LoginsTab({ toast }) {
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
                      <td><span className="g-code">{fmtIp(l.ip)}</span></td>
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
// Audit rows store machine actions ("exam.create") and a JSON detail bag —
// both read poorly in a table, so translate them into plain language.
const AUDIT_VERBS = {
  create: 'Created', update: 'Updated', delete: 'Deleted', approve: 'Approved',
  reject: 'Rejected', import: 'Imported', upload: 'Uploaded', review: 'Reviewed',
  finalize: 'Finalized', generate_sets: 'Generated sets for',
  questions_add: 'Added questions to', questions_remove: 'Removed a question from',
  send_reset: 'Sent a password reset for', bulk_approve: 'Bulk-approved',
  bulk_reject: 'Bulk-rejected', bulk_delete: 'Bulk-deleted',
  publish: 'Published', unpublish: 'Unpublished',
};
const AUDIT_NOUNS = {
  exam: 'exam', question: 'question', material: 'material', subject: 'subject',
  tos: 'blueprint', user: 'user', settings: 'settings', scan: 'scan',
  announcement: 'announcement',
};
const AUDIT_DETAIL_LABELS = {
  title: 'title', name: 'name', code: 'code', email: 'email', role: 'role',
  status: 'status', keys: 'fields', changes: 'changes', questionId: 'question',
  subjectId: 'subject', tosId: 'blueprint', version: 'version', sets: 'sets',
  added: 'added', skipped: 'skipped', deleted: 'deleted', requested: 'requested',
  approved: 'approved', rejected: 'rejected', imported: 'imported',
  emailed: 'emailed', sourceType: 'type', corrections: 'corrections',
  score: 'score', needsReview: 'needs review', similarityBypassed: 'similarity bypassed',
};

function auditActionLabel(action) {
  const [scope, verb] = String(action || '').split('.');
  const v = AUDIT_VERBS[verb];
  return v ? `${v} ${AUDIT_NOUNS[scope] || scope}` : String(action || '—');
}

function auditDetailText(detail) {
  let d = detail;
  if (typeof d === 'string') {
    if (!d) return '—';
    try { d = JSON.parse(d); } catch { return d; }
  }
  if (!d || typeof d !== 'object') return '—';
  return Object.entries(d).map(([k, v]) => {
    const label = AUDIT_DETAIL_LABELS[k] || k.replace(/[_-]+/g, ' ');
    let val = v;
    if (Array.isArray(v)) val = v.map((x) => String(x).replace(/_/g, ' ')).join(', ');
    else if (typeof v === 'boolean') val = v ? 'yes' : 'no';
    else if (v && typeof v === 'object') val = JSON.stringify(v);
    else if (/Id$/.test(k) && (typeof v === 'number' || /^\d+$/.test(String(v)))) val = `#${v}`;
    return `${label}: ${val}`;
  }).join(' · ') || '—';
}

function auditTargetText(l) {
  const noun = AUDIT_NOUNS[l.target_type] || l.target_type;
  return [noun, l.target_id ? `#${l.target_id}` : null].filter(Boolean).join(' ') || '—';
}

function AuditTab({ toast }) {
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
                    <th className={`wp-17 ${sortClass('actor')}`} onClick={sortHandler('actor')} data-name="Actor">
                      Actor{renderSortArrow('actor')}
                    </th>
                    <th className={`wp-20 ${sortClass('action')}`} onClick={sortHandler('action')} data-name="Action">
                      Action{renderSortArrow('action')}
                    </th>
                    <th className="wp-13" data-name="Target">Target</th>
                    <th className="wp-22" data-name="Detail">Detail</th>
                    <th className="wp-12" data-name="IP">IP</th>
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
                      <td title={l.action}>{auditActionLabel(l.action)}</td>
                      <td className="g-mute" title={[l.target_type, l.target_id].filter(Boolean).join(' · ')}>
                        {auditTargetText(l)}
                      </td>
                      <td className="g-mute" title={typeof l.detail === 'string' ? l.detail : (l.detail ? JSON.stringify(l.detail) : '')}>
                        {auditDetailText(l.detail)}
                      </td>
                      <td><span className="g-code">{fmtIp(l.ip)}</span></td>
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

/**
 * PoolKeyRows — one input row per key slot with its own Test button.
 * Rows are draft-only: blank keeps the saved key, typed text replaces it,
 * and Remove drops it on save. Masked placeholders show which index is
 * configured; keys from api/.env are labelled and removable only there.
 * Testing probes the SAVED key at that index, so a row with unsaved text,
 * a pending removal or a model edit disables its button.
 */
function PoolKeyRows({ provider, rows, masked, sources, savedCount, removed, modelDirty, saving, testing, onKeyChange, onTest, onAdd, onToggleRemove, results }) {
  return (
    <div className="adm-keys">
      {rows.map((v, i) => {
        const index = i + 1;
        const configured = index <= savedCount;
        const fromEnv = configured && sources?.[i] === 'env';
        const removing = removed?.has(i);
        const rowDirty = Boolean(v.trim()) || removing;
        const rowTesting = testing === `${provider}:${index}`;
        const res = results?.[index];
        return (
          <div className="adm-key-slot" key={index}>
            <div className="adm-key-row">
              <label className="adm-key-label" htmlFor={`set-${provider}-key-${index}`}>
                Key {index}{fromEnv ? <em>from api/.env</em> : index === 1 && <em>primary</em>}
              </label>
              <input
                id={`set-${provider}-key-${index}`}
                className="form-control adm-key-input"
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                disabled={saving || testing !== null || removing || fromEnv}
                value={v}
                placeholder={removing ? 'Removed when you save' : fromEnv ? `${masked?.[i] || 'Saved key'} — change it in api/.env` : configured ? `${masked?.[i] || 'Saved key'} — paste to replace` : 'Paste an API key'}
                onChange={onKeyChange(i)}
              />
              <button
                type="button"
                className="btn btn-outline btn-sm adm-key-test"
                disabled={saving || testing !== null || modelDirty || rowDirty || !configured}
                title={!configured ? 'Save a key in this slot to enable its test.'
                  : rowDirty || modelDirty ? 'Save your changes first — testing uses the saved credentials.'
                    : `Test saved key ${index}.`}
                onClick={() => onTest(index)}
              >
                {rowTesting ? 'Testing…' : 'Test'}
              </button>
              {configured && !fromEnv && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm adm-key-remove"
                  disabled={saving || testing !== null}
                  aria-label={removing ? `Keep key ${index}` : `Remove key ${index}`}
                  title={removing ? 'Keep this key' : 'Remove this key when you save'}
                  onClick={() => onToggleRemove(i)}
                >
                  {removing ? <Undo2 size={15} aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />}
                </button>
              )}
              {!(configured && !fromEnv) && <span className="adm-key-spacer" aria-hidden="true" />}
            </div>
            {res && (
              <p className={`adm-provider-result adm-key-result ${res.ok ? 'is-success' : 'is-error'}`} role="status">
                {res.message}
              </p>
            )}
          </div>
        );
      })}
      <div className="adm-keys-foot">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onAdd} disabled={saving || testing !== null || rows.length >= 10}>
          + Add another key
        </button>
        <span className="form-hint">Paste into a saved slot to replace that key. Keys from different accounts each get their own quota; several keys created in the same project or organization share one.</span>
      </div>
    </div>
  );
}

// ── Settings tab ───────────────────────────────────────
function SettingsTab({ toast }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({});
  // Draft key edits — one row per pool slot; blank rows keep the saved key.
  const [keyRows, setKeyRows] = useState({ gemini: [''], groq: [''] });
  // Saved slots (0-based) marked for removal on the next save.
  const [removedKeys, setRemovedKeys] = useState({ gemini: new Set(), groq: new Set() });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null); // 'ollama' | 'gemini:2' | 'groq:1'
  const [testResults, setTestResults] = useState({});

  const load = useCallback(() => {
    api.get('/admin/settings')
      .then((d) => {
        setData(d);
        setForm({
          recaptcha_site_key: d.recaptcha?.siteKey || '',
          recaptcha_secret_key: '',
          auto_approve_domains: d.autoApproveDomains || '',
          gemini_model: d.ai?.geminiModel || '',
          gemini_fallback_models: d.ai?.geminiFallbackModels || '',
          gemini_embedding_model: d.ai?.geminiEmbeddingModel || '',
          groq_model: d.ai?.groqModel || '',
          groq_fallback_models: d.ai?.groqFallbackModels || '',
          ollama_api_key: '',
          ollama_model: d.ai?.ollamaModel || '',
        });
        setKeyRows({
          gemini: Array(Math.max(1, d.ai?.geminiKeyCount || 0)).fill(''),
          groq: Array(Math.max(1, d.ai?.groqKeyCount || 0)).fill(''),
        });
        setRemovedKeys({ gemini: new Set(), groq: new Set() });
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

  const setKey = (provider, i) => (e) => {
    setKeyRows((r) => {
      const rows = [...r[provider]];
      rows[i] = e.target.value;
      return { ...r, [provider]: rows };
    });
    setTestResults((r) => (r[provider]?.[i + 1]
      ? { ...r, [provider]: { ...r[provider], [i + 1]: null } }
      : r));
  };

  const toggleRemoveKey = (provider, i) => {
    setRemovedKeys((r) => {
      const next = new Set(r[provider]);
      if (next.has(i)) next.delete(i); else next.add(i);
      return { ...r, [provider]: next };
    });
    setTestResults((r) => (r[provider]?.[i + 1] ? { ...r, [provider]: { ...r[provider], [i + 1]: null } } : r));
  };

  // Slot edits for the API: keep each untouched saved key by its index,
  // send typed text as a new or replacement key, and omit removed slots.
  // Sent only when the pool changed, so an unrelated save never rewrites keys.
  const keySlots = (provider) => {
    const saved = data?.ai?.[`${provider}KeyCount`] || 0;
    const rows = keyRows[provider];
    const touched = rows.some((v) => v.trim()) || removedKeys[provider].size > 0;
    if (!touched) return undefined;
    return rows.flatMap((v, i) => {
      if (v.trim()) return [{ value: v.trim() }];
      if (i < saved && !removedKeys[provider].has(i)) return [{ keep: i + 1 }];
      return [];
    });
  };

  const addKeyRow = (provider) => {
    setKeyRows((r) => (r[provider].length >= 10 ? r : { ...r, [provider]: [...r[provider], ''] }));
  };

  async function testProvider(provider, keyIndex = null) {
    setTesting(keyIndex === null ? provider : `${provider}:${keyIndex}`);
    try {
      const result = await api.post(`/admin/settings/${provider}/test`,
        keyIndex === null ? {} : { keyIndex });
      if (keyIndex !== null) {
        const k = result.keys?.[0];
        setTestResults((r) => ({
          ...r,
          [provider]: { ...r[provider], [keyIndex]: { ok: Boolean(k?.ok), message: k?.message || 'Done.' } },
        }));
      } else {
        const k = result.keys?.[0];
        setTestResults((r) => ({
          ...r,
          [provider]: k && !k.ok
            ? { ok: false, message: k.message }
            : { ok: true, message: `Connected to ${result.model}. JSON and source evidence verified.` },
        }));
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : `Could not test ${provider}.`;
      setTestResults((r) => (keyIndex === null
        ? { ...r, [provider]: { ok: false, message } }
        : { ...r, [provider]: { ...r[provider], [keyIndex]: { ok: false, message } } }));
    } finally {
      setTesting(null);
    }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setTestResults({});
    try {
      const res = await api.put('/admin/settings', {
        ...form,
        gemini_key_slots: keySlots('gemini'),
        groq_key_slots: keySlots('groq'),
      });
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
    ollama: Boolean(form.ollama_api_key?.trim())
      || !same(form.ollama_model?.trim(), data.ai?.ollamaModel),
  } : {};
  // Model edits invalidate every saved-key test for that provider.
  const modelDirty = data ? {
    gemini: !same(form.gemini_model?.trim(), data.ai?.geminiModel)
      || !same(form.gemini_embedding_model?.trim(), data.ai?.geminiEmbeddingModel),
    groq: !same(form.groq_model?.trim(), data.ai?.groqModel),
  } : {};

  return (
    <>

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
              <MailCheck size={15} />
              <h3>Self-registration</h3>
            </header>
            <div className="adm-card-body">
              {field('auto_approve_domains', 'Auto-approve email domains', {
                placeholder: 'dorsu.edu.ph, deped.gov.ph',
                hint: 'Verified emails on these domains (and their subdomains) activate instantly — all others wait for admin approval. Clear the field to require approval for everyone.',
              })}
            </div>
          </section>

          <section className="adm-card">
            <header className="adm-card-head">
              <Settings2 size={15} />
              <h3>AI providers</h3>
            </header>
            <div className="adm-card-body adm-providers">
              <details className="adm-provider" open={!data.ai?.geminiApiKeySet}>
                <summary className="adm-provider-head">
                  <strong>Gemini</strong>
                  <small>Primary — generation + embeddings</small>
                  {data.ai?.geminiKeyCount > 0 && (
                    <span className="adm-tag adm-tag-ok">
                      {data.ai.geminiKeyCount} key{data.ai.geminiKeyCount > 1 ? 's' : ''}
                    </span>
                  )}
                  <ChevronDown size={15} className="adm-provider-caret" aria-hidden="true" />
                </summary>
                <div className="adm-provider-body">
                  <PoolKeyRows
                    provider="gemini"
                    rows={keyRows.gemini}
                    masked={data.ai?.geminiKeysMasked}
                    sources={data.ai?.geminiKeys?.map((k) => k.source)}
                    savedCount={data.ai?.geminiKeyCount || 0}
                    removed={removedKeys.gemini}
                    onToggleRemove={(i) => toggleRemoveKey('gemini', i)}
                    modelDirty={modelDirty.gemini}
                    saving={saving}
                    testing={testing}
                    onKeyChange={(i) => setKey('gemini', i)}
                    onTest={(index) => testProvider('gemini', index)}
                    onAdd={() => addKeyRow('gemini')}
                    results={testResults.gemini}
                  />
                  <div className="form-row">
                    {field('gemini_model', 'Chat model')}
                    {field('gemini_fallback_models', 'Fallback models', {
                      placeholder: 'gemini-3.8-flash, gemini-3.7-flash',
                      hint: 'Comma-separated — tried when the chat model is overloaded.',
                    })}
                  </div>
                  <div className="form-row">
                    {field('gemini_embedding_model', 'Embedding model', {
                      hint: 'Fixed — the vector space must stay consistent.',
                    })}
                  </div>
                </div>
              </details>

              <details className="adm-provider" open={!data.ai?.groqApiKeySet}>
                <summary className="adm-provider-head">
                  <strong>Groq</strong>
                  <small>Fallback — generation only</small>
                  {data.ai?.groqKeyCount > 0 && (
                    <span className="adm-tag adm-tag-ok">
                      {data.ai.groqKeyCount} key{data.ai.groqKeyCount > 1 ? 's' : ''}
                    </span>
                  )}
                  <ChevronDown size={15} className="adm-provider-caret" aria-hidden="true" />
                </summary>
                <div className="adm-provider-body">
                  <PoolKeyRows
                    provider="groq"
                    rows={keyRows.groq}
                    masked={data.ai?.groqKeysMasked}
                    sources={data.ai?.groqKeys?.map((k) => k.source)}
                    savedCount={data.ai?.groqKeyCount || 0}
                    removed={removedKeys.groq}
                    onToggleRemove={(i) => toggleRemoveKey('groq', i)}
                    modelDirty={modelDirty.groq}
                    saving={saving}
                    testing={testing}
                    onKeyChange={(i) => setKey('groq', i)}
                    onTest={(index) => testProvider('groq', index)}
                    onAdd={() => addKeyRow('groq')}
                    results={testResults.groq}
                  />
                  <div className="form-row">
                    {field('groq_model', 'Model')}
                    {field('groq_fallback_models', 'Fallback models', {
                      placeholder: 'qwen/qwen3.8-27b, openai/gpt-oss-20b',
                      hint: 'Comma-separated — each has its own free limit, and a different model family makes a more independent answer check.',
                    })}
                  </div>
                </div>
              </details>

              <details className="adm-provider" open={!data.ai?.ollamaApiKeySet}>
                <summary className="adm-provider-head">
                  <strong>Ollama Cloud</strong>
                  <small>Last resort — cloud API</small>
                  {data.ai?.ollamaApiKeySet && <span className="adm-tag adm-tag-ok">configured</span>}
                  <ChevronDown size={15} className="adm-provider-caret" aria-hidden="true" />
                </summary>
                <div className="adm-provider-body">
                  <div className="form-row">
                    {field('ollama_api_key', 'API key', {
                      type: 'password',
                      placeholder: data.ai?.ollamaApiKeyMasked || 'Paste your Ollama API key',
                      hint: 'Leave blank to keep the saved key.',
                    })}
                    {field('ollama_model', 'Model', {
                      placeholder: 'gemma4:31b',
                      hint: 'Use a model included in your account allowance.',
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
              </details>
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
function ReportsTab({ toast, scoped }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    api.get(scoped ? '/admin/reports/instructors' : '/admin/reports/usage')
      .then(setData)
      .catch((err) => toast.error(err.message || 'Could not load the report.'));
  }, [toast, scoped]);

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
    ...(scoped ? [] : [
      ['Students', t.students ?? 0],
      ['AI jobs', `${t.ai_jobs || 0} total · ${t.failed_jobs || 0} failed`],
    ]),
  ];
  const instructorCols = scoped
    ? ['Name', 'Email', 'Status', 'Subjects', 'Questions', 'Approved', 'Drafts', 'Exams', 'Scans']
    : ['Name', 'Email', 'Status', 'Subjects', 'Questions', 'Exams', 'Scans'];
  const instructorRows = (data?.instructorActivity || []).map((r) => (
    scoped
      ? [r.full_name || '—', r.email, r.status, r.subjects, r.questions, r.approved, r.drafts, r.exams, r.scans]
      : [r.full_name || '—', r.email, r.status, r.subjects, r.questions, r.exams, r.scans]
  ));
  const bloomRows = (data?.bloomMix || []).map((r) => [r.bloom || 'unclassified', r.n]);
  const typeRows = (data?.typeMix || []).map((r) => [TYPE_LABELS[r.type] || r.type, r.n]);
  const trendCols = scoped ? ['Month', 'Scans'] : ['Month', 'Scans', 'Sign-ins', 'Succeeded'];
  const trendRows = (() => {
    const months = new Set([
      ...(data?.scanTrend || []).map((r) => r.month),
      ...(data?.loginTrend || []).map((r) => r.month),
    ]);
    const scans = Object.fromEntries((data?.scanTrend || []).map((r) => [r.month, r.n]));
    const logins = Object.fromEntries((data?.loginTrend || []).map((r) => [r.month, r]));
    return [...months].sort().reverse().map((m) => (
      scoped ? [m, scans[m] || 0] : [m, scans[m] || 0, logins[m]?.n || 0, logins[m]?.succeeded || 0]
    ));
  })();
  const jobRows = (data?.jobMix || []).map((r) => [r.kind, r.n, r.failed || 0]);
  const reportTitle = scoped ? 'Instructor Activity Report' : 'Institution Usage Report';

  function exportCsv() {
    const lines = [
      [`nexam — ${reportTitle.toLowerCase()}`],
      ['Generated', new Date(data.generatedAt).toLocaleString(), 'Prepared by', user?.email || ''],
      [],
      ['Section', 'Metric', 'Value'],
      ...metricRows.map(([m, v]) => ['Totals', m, v]),
      [],
      ['Instructors', ...instructorCols],
      ...instructorRows.map((r) => ['', ...r]),
      [],
      ['Question mix', 'Bloom level', 'Questions'],
      ...bloomRows.map((r) => ['', ...r]),
      ['', 'Type', 'Questions'],
      ...typeRows.map((r) => ['', ...r]),
      [],
      ['Activity', ...trendCols],
      ...trendRows.map((r) => ['', ...r]),
      ...(scoped ? [] : [
        [],
        ['AI jobs', 'Kind', 'Runs', 'Failed'],
        ...jobRows.map((r) => ['', ...r]),
      ]),
    ];
    // downloadCsv takes uniform headers/rows — flatten into a single table.
    const maxCols = Math.max(...lines.map((l) => l.length));
    downloadCsv('nexam-usage-report', Array(maxCols).fill(''), lines.map((l) => [...l, ...Array(maxCols - l.length).fill('')]));
  }

  function exportXlsx() {
    downloadXlsx('nexam-usage-report', [
      { title: 'Totals', headers: ['Metric', 'Value'], rows: metricRows },
      { title: 'Instructors', headers: instructorCols, rows: instructorRows },
      { title: 'Question mix', headers: ['Group', 'Value', 'Questions'], rows: [...bloomRows.map(([b, n]) => ['Bloom', b, n]), ...typeRows.map(([ty, n]) => ['Type', ty, n])] },
      { title: 'Activity', headers: trendCols, rows: trendRows },
      ...(scoped ? [] : [{ title: 'AI jobs', headers: ['Kind', 'Runs', 'Failed'], rows: jobRows }]),
    ]);
  }

  const printMeta = `Generated ${data ? fmtTime(data.generatedAt) : ''} · Prepared by ${user?.full_name || user?.email || 'administrator'}`;

  return (
    <>
      <AdminHeader>
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
              <div className="pd-title">{reportTitle}</div>
              <div className="pd-meta">{printMeta}</div>
            </div>

            <div className="report-section-title">{scoped ? 'Totals' : 'System totals'}</div>
            <table className="report-table">
              <tbody>
                {metricRows.map(([m, v]) => <tr key={m}><th>{m}</th><td>{v}</td></tr>)}
              </tbody>
            </table>

            <div className="report-section-title">Activity by month</div>
            <table className="report-table">
              <thead><tr>{trendCols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {trendRows.length === 0 && <tr><td colSpan={trendCols.length}>No activity recorded yet.</td></tr>}
                {trendRows.map((r) => (
                  <tr key={r[0]}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>

            <div className="report-section-title">Instructor activity</div>
            <table className="report-table">
              <thead><tr>{instructorCols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {instructorRows.length === 0 && <tr><td colSpan={instructorCols.length}>No instructor activity yet.</td></tr>}
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

            {!scoped && (
              <>
                <div className="report-section-title">AI jobs</div>
                <table className="report-table">
                  <thead><tr><th>Kind</th><th>Runs</th><th>Failed</th></tr></thead>
                  <tbody>
                    {jobRows.length === 0 && <tr><td colSpan={3}>No AI jobs yet.</td></tr>}
                    {jobRows.map(([k, n, f]) => <tr key={k}><td>{k}</td><td>{n}</td><td>{f}</td></tr>)}
                  </tbody>
                </table>
              </>
            )}

            <div className="print-doc-foot">
              <span>nexam — Administrator Console</span>
              <span>{reportTitle}</span>
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
                <header className="adm-card-head"><BarChart3 size={15} /><h3>{scoped ? 'Totals' : 'System totals'}</h3></header>
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
                  {!scoped && trendRows.length > 0 && (
                    <div className="adm-chart">
                      <LoginTrendChart
                        rows={trendRows.slice().reverse().map(([m, s, l, ok]) => ({ month: m, scans: s, logins: l, succeeded: ok }))}
                      />
                    </div>
                  )}
                  <table className="adm-rt">
                    <thead><tr>{trendCols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                    <tbody>
                      {trendRows.length === 0 && <tr><td colSpan={trendCols.length} className="adm-muted">No activity recorded yet.</td></tr>}
                      {trendRows.map((r) => (
                        <tr key={r[0]}><td><strong>{r[0]}</strong></td>{r.slice(1).map((c, j) => <td key={j}>{c}</td>)}</tr>
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
                  <thead><tr>{instructorCols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {(data.instructorActivity || []).length === 0 && (
                      <tr><td colSpan={instructorCols.length} className="adm-muted">No instructor activity yet.</td></tr>
                    )}
                    {(data.instructorActivity || []).map((r) => (
                      <tr key={r.id}>
                        <td><strong>{r.full_name || '—'}</strong></td>
                        <td className="adm-muted">{r.email}</td>
                        <td><StatusPill status={r.status} small /></td>
                        <td>{r.subjects}</td><td>{r.questions}</td>
                        {scoped && <><td>{r.approved}</td><td>{r.drafts}</td></>}
                        <td>{r.exams}</td><td>{r.scans}</td>
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

              {!scoped && (
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
              )}
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
  // Mid-tier admins get the instructor-facing surfaces; security and
  // system areas stay superadmin-only.
  const allowed = user?.role === 'superadmin' ? VIEWS : ADMIN_VIEWS;
  if (!view) return <Navigate to="/admin/dashboard" replace />;
  if (!allowed.includes(view)) return <Navigate to="/admin/dashboard" replace />;

  const meta = VIEW_META[view];

  return (
    <AppShell activeNav={view} pageClass="admin" pageTitle={meta.title} wide>
      {view === 'dashboard' && <DashboardTab toast={toast} />}
      {view === 'users' && <UsersTab toast={toast} role={user?.role} />}
      {view === 'announcements' && <AnnouncementsTab toast={toast} />}
      {view === 'reports' && <ReportsTab toast={toast} scoped={user?.role !== 'superadmin'} />}
      {view === 'bank' && <BankTab toast={toast} />}
      {view === 'logins' && <LoginsTab toast={toast} />}
      {view === 'audit' && <AuditTab toast={toast} />}
      {view === 'settings' && <SettingsTab toast={toast} />}
    </AppShell>
  );
}
