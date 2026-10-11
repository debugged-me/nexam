/** Persistent instructor workspace, shared by every protected screen. */
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  Camera,
  ChevronDown,
  ChevronRight,
  LogOut,
  Moon,
  Monitor,
  Palette,
  Sun,
  User,
  X,
  Search,
  Sparkles,
  ChevronsLeft,
  ChevronsRight,
  Settings2,
} from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useConfirm } from './ConfirmDialog.jsx';
import { useToast } from './Toast.jsx';
import { useTheme } from '../lib/theme.js';
import api from '../lib/api.js';
import useNetworkBusy from '../lib/useNetworkBusy.js';
import { startGuidedTour, stopGuidedTour, GUIDE_AVATAR_SVG } from '../help/guide.js';
import { ShellMetaContext } from './shellMeta.js';
import { Spinner, PageLoader } from './Loaders.jsx';
import { NAV_ITEMS, ADMIN_NAV_ITEMS, BUILD_ACTION } from './navigation.js';
import CommandMenu from './CommandMenu.jsx';
import JobsIndicator from './JobsIndicator.jsx';
import UserAvatar from './UserAvatar.jsx';
import AvatarPickerModal from './AvatarPickerModal.jsx';
import SidebarLink from './SidebarLink.jsx';

function activeFor(pathname) {
  if (pathname.startsWith('/questions/institution')) return 'institution';
  if (pathname.startsWith('/questions/review')) return 'review';
  if (pathname.startsWith('/questions')) return 'questions';
  return pathname.split('/')[1];
}

function prefetchAll(paths) {
  paths?.forEach((path) => api.prefetch(path));
}

const THEME_CHOICES = [
  { key: 'light', label: 'Light', Icon: Sun },
  { key: 'dark', label: 'Dark', Icon: Moon },
  { key: 'system', label: 'System', Icon: Monitor },
];

const SIDEBAR_COLLAPSED_KEY = 'nexam.sidebar.collapsed';

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function AppLayout() {
  const { user, logout, refreshUser } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const { mode, setThemeMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const busy = useNetworkBusy();
  const [meta, setMeta] = useState({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const userMenuRef = useRef(null);
  const sidebarRef = useRef(null);
  const menuButtonRef = useRef(null);
  const updateMeta = useCallback((next) => {
    setMeta((prev) =>
      prev.activeNav === next.activeNav &&
      prev.pageTitle === next.pageTitle &&
      prev.wide === next.wide
        ? prev
        : next
    );
  }, []);
  const closeCommand = useCallback(() => setCommandOpen(false), []);
  const isAdmin = ['admin', 'superadmin'].includes(user?.role);
  const navItems = isAdmin
    ? ADMIN_NAV_ITEMS.filter((item) => user?.role === 'superadmin' || !item.superOnly)
    : NAV_ITEMS;
  const navGroups = isAdmin
    ? (user?.role === 'superadmin' ? ['home', 'Manage', 'Security'] : ['home', 'Manage'])
    : ['home', 'Workspace', 'Assessment', 'Institution'];
  const activeKey = isAdmin
    ? location.pathname.split('/')[2] || 'dashboard'
    : activeFor(location.pathname) || meta.activeNav;
  const section =
    [...navItems, ...(isAdmin ? [] : [BUILD_ACTION])].find((item) => item.key === activeKey)?.label || 'Account';
  const title = activeKey === 'dashboard' ? 'Overview' : meta.pageTitle || section;
  const [pickerOpen, setPickerOpen] = useState(false);

  function toggleSidebar() {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
    } catch { /* Keep the current choice in memory when storage is unavailable. */ }
  }

  useEffect(() => {
    function handleClick(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target))
        setUserMenuOpen(false);
    }
    function handleKey(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setMobileOpen(false);
        if (!isAdmin) setCommandOpen((value) => !value);
      }
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
        if (userMenuRef.current?.contains(document.activeElement))
          userMenuRef.current.querySelector('button')?.focus();
      }
    }
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
    setCommandOpen(false);
  }, [location.pathname, location.search]);

  // Guided tours are manual-start only: the Help button click below is the
  // single entry point. These effects only ever tear a running tour down —
  // on route change, layout unmount, or tab unload — they never start one.
  useEffect(() => () => stopGuidedTour(), []);
  useEffect(() => {
    stopGuidedTour();
  }, [location.pathname]);
  useEffect(() => {
    window.addEventListener('pagehide', stopGuidedTour);
    return () => window.removeEventListener('pagehide', stopGuidedTour);
  }, []);
  const handleHelp = useCallback(() => {
    void startGuidedTour(location.pathname, user?.role).then((result) => {
      if (!result.started && result.message) toast.info(result.message);
    });
  }, [location.pathname, user?.role, toast]);

  // The mobile rail behaves as a dialog: contained focus, Escape, and return focus.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    const menuButton = menuButtonRef.current;
    document.body.style.overflow = 'hidden';
    sidebarRef.current.querySelector('button')?.focus();
    function onKey(event) {
      if (event.key === 'Escape') setMobileOpen(false);
      if (event.key !== 'Tab') return;
      const controls = [...sidebarRef.current.querySelectorAll('a[href], button')].filter(
        (element) => element.getClientRects().length
      );
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    const desktop = window.matchMedia('(min-width: 992px)');
    function onResize(event) {
      if (event.matches) setMobileOpen(false);
    }
    desktop.addEventListener('change', onResize);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
      desktop.removeEventListener('change', onResize);
      menuButton?.focus();
    };
  }, [mobileOpen]);

  return (
    <div className={`app-shell${sidebarCollapsed ? ' app-shell--sidebar-collapsed' : ''}`}>
      <a href="#workspace-content" className="skip-link">
        Skip to content
      </a>
      <aside
        ref={sidebarRef}
        id="workspace-navigation"
        className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}
        role={mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileOpen || undefined}
        aria-label="Workspace navigation"
      >
        <div className="sidebar-brand">
          <SidebarLink
            to={isAdmin ? '/admin/dashboard' : '/dashboard'}
            className="sidebar-brand-link"
            label="Nexam overview"
            compact={sidebarCollapsed}
            onClick={() => setMobileOpen(false)}
          >
            <img className="sidebar-mark" src="/favicon.png" alt="" />
            <span className="sidebar-wordmark">
              nexam<span className="sidebar-edition">{isAdmin ? 'console' : 'workspace'}</span>
            </span>
          </SidebarLink>
          <button
            className="sidebar-close"
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <nav className="sidebar-nav" aria-label="Primary navigation" data-tour="shell-nav">
          {navGroups.map((group) => (
            <div className="nav-group" key={group}>
              {group !== 'home' && <div className="nav-group-label">{group}</div>}
              {navItems.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarLink
                    key={item.key}
                    to={item.to}
                    className={`nav-item ${activeKey === item.key ? 'active' : ''}`}
                    label={item.label}
                    compact={sidebarCollapsed}
                    aria-current={activeKey === item.key ? 'page' : undefined}
                    data-tour={`nav-${item.key}`}
                    onClick={() => setMobileOpen(false)}
                    onPointerEnter={() => prefetchAll(item.prefetch)}
                    onFocus={() => prefetchAll(item.prefetch)}
                  >
                    <Icon size={17} aria-hidden="true" />
                    <span className="nav-item-label">{item.label}</span>
                  </SidebarLink>
                );
              })}
            </div>
          ))}
        </nav>
        {!isAdmin && (
          <div className="sidebar-create">
            <SidebarLink
              to="/wizard"
              className={`nav-item nav-item--featured ${activeKey === 'wizard' ? 'active' : ''}`}
              label="Build an exam"
              compact={sidebarCollapsed}
              aria-current={activeKey === 'wizard' ? 'page' : undefined}
              data-tour="shell-build"
              onClick={() => setMobileOpen(false)}
              onPointerEnter={() => prefetchAll(BUILD_ACTION.prefetch)}
              onFocus={() => prefetchAll(BUILD_ACTION.prefetch)}
            >
              <Sparkles size={17} aria-hidden="true" />
              <span className="nav-item-label">Build an exam</span>
              <ChevronRight className="nav-item-chevron" size={14} aria-hidden="true" />
            </SidebarLink>
          </div>
        )}
        <SidebarLink
          to="/account"
          className="sidebar-foot"
          label="Account settings"
          compact={sidebarCollapsed}
          onClick={() => setMobileOpen(false)}
          onPointerEnter={() => prefetchAll(isAdmin ? undefined : ['/auth/me'])}
          onFocus={() => prefetchAll(isAdmin ? undefined : ['/auth/me'])}
        >
          <UserAvatar user={user} className="avatar avatar-sm" />
          <span className="sidebar-foot-meta">
            <strong>{user?.full_name || (isAdmin ? 'Console' : 'Instructor')}</strong>
            <small>
              {user?.role === 'superadmin' ? 'Superadmin console'
                : user?.role === 'admin' ? 'Admin console'
                : 'Personal workspace'}
            </small>
          </span>
          <Settings2 size={16} aria-hidden="true" />
        </SidebarLink>
      </aside>
      {mobileOpen && (
        <div
          className="mobile-sidebar-overlay show"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <main className="main-content" inert={mobileOpen}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              ref={menuButtonRef}
              className="rail-toggle"
              type="button"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              aria-controls="workspace-navigation"
              data-tour="shell-menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={18} />
            </button>
            <button
              className="sidebar-toggle"
              type="button"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!sidebarCollapsed}
              aria-controls="workspace-navigation"
              onClick={toggleSidebar}
            >
              {sidebarCollapsed ? <ChevronsRight size={18} aria-hidden="true" /> : <ChevronsLeft size={18} aria-hidden="true" />}
            </button>
            <div className="topbar-heading">
              <span className="topbar-workspace">{isAdmin ? 'Admin console' : 'Faculty workspace'}</span>
              <ChevronRight size={13} className="topbar-divider" aria-hidden="true" />
              <span className="topbar-title">{title}</span>
              <Spinner size="sm" className={`topbar-spinner ${busy ? 'is-active' : ''}`} />
            </div>
          </div>
          <div className="topbar-right">
            {!isAdmin && (
              <button
                className="topbar-search"
                type="button"
                aria-label="Open quick navigation"
                aria-haspopup="dialog"
                data-tour="shell-quicknav"
                onClick={() => setCommandOpen(true)}
              >
                <Search size={15} />
                <span>Quick navigation</span>
                <kbd>⌘ K</kbd>
              </button>
            )}
            {!isAdmin && <JobsIndicator />}
            <button
              className="topbar-help"
              type="button"
              aria-label="Start the guided tour for this page"
              title="Guided tour"
              data-tour="shell-help"
              onClick={handleHelp}
            >
              <span
                className="topbar-help-avatar"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: GUIDE_AVATAR_SVG }}
              />
              <span className="topbar-help-label">Guide</span>
              <span className="topbar-help-ping" aria-hidden="true" />
            </button>
            <div className="user-menu" ref={userMenuRef}>
              <button
                className="user-trigger"
                type="button"
                aria-label="Account menu"
                aria-expanded={userMenuOpen}
                data-tour="shell-account"
                onClick={() => setUserMenuOpen((value) => !value)}
              >
                <UserAvatar user={user} className="avatar avatar-sm" />
                <ChevronDown size={14} />
              </button>
              {userMenuOpen && (
                <div className="user-dropdown">
                  <div className="user-dropdown-head">
                    <UserAvatar user={user} className="avatar" />
                    <div className="ud-meta">
                      <div className="ud-name">{user?.full_name || 'Instructor'}</div>
                      <div className="ud-email">{user?.email || ''}</div>
                    </div>
                  </div>
                  <button
                    className="user-dropdown-item"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate(isAdmin ? '/admin/settings' : '/account');
                    }}
                  >
                    <User size={16} /> {isAdmin ? 'Console settings' : 'Account settings'}
                  </button>
                  <button
                    className="user-dropdown-item"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setPickerOpen(true);
                    }}
                  >
                    <Camera size={16} /> Change photo
                  </button>
                  <div className="user-dropdown-sep" />
                  <div className="user-dropdown-theme" role="group" aria-label="Appearance">
                    {THEME_CHOICES.map(({ key, label, Icon }) => (
                      <button
                        key={key}
                        type="button"
                        className={`theme-seg-item${mode === key ? ' is-active' : ''}`}
                        onClick={() => setThemeMode(key)}
                        aria-pressed={mode === key}
                      >
                        <Icon size={15} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    className="user-dropdown-item"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/appearance');
                    }}
                  >
                    <Palette size={16} /> Appearance settings
                  </button>
                  <div className="user-dropdown-sep" />
                  <button
                    className="user-dropdown-item danger"
                    onClick={async () => {
                      setUserMenuOpen(false);
                      if (!(await confirm('You will need to sign in again to continue working.', { title: 'Log out of nexam?', confirmText: 'Log out', danger: false, icon: LogOut }))) return;
                      logout();
                      navigate('/login');
                    }}
                  >
                    <LogOut size={16} /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className={`top-progress ${busy ? 'is-active' : ''}`} aria-hidden="true">
            <span />
          </div>
        </header>
        <div
          id="workspace-content"
          tabIndex={-1}
          className={`page-content ${meta.wide ? 'page-content--wide' : ''}`}
          aria-busy={busy}
        >
          <ShellMetaContext.Provider value={updateMeta}>
            <Suspense fallback={<PageLoader label="Opening workspace…" />}>
              <Outlet />
            </Suspense>
          </ShellMetaContext.Provider>
        </div>
      </main>
      {commandOpen && !isAdmin && <CommandMenu open onClose={closeCommand} />}
      {pickerOpen && (
        <AvatarPickerModal
          onClose={() => setPickerOpen(false)}
          onUploaded={() => refreshUser?.()}
        />
      )}
    </div>
  );
}
