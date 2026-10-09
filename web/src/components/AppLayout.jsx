/** Persistent instructor workspace, shared by every protected screen. */
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  ChevronDown,
  ChevronRight,
  LogOut,
  User,
  X,
  Search,
  Sparkles,
  PanelLeft,
  Settings2,
} from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext.jsx';
import api from '../lib/api.js';
import useNetworkBusy from '../lib/useNetworkBusy.js';
import { ShellMetaContext } from './shellMeta.js';
import { Spinner, PageLoader } from './Loaders.jsx';
import { NAV_ITEMS, BUILD_ACTION } from './navigation.js';
import CommandMenu from './CommandMenu.jsx';

function activeFor(pathname) {
  if (pathname.startsWith('/questions/institution')) return 'institution';
  if (pathname.startsWith('/questions/review')) return 'review';
  if (pathname.startsWith('/questions')) return 'questions';
  return pathname.split('/')[1];
}

function prefetchAll(paths) {
  paths?.forEach((path) => api.prefetch(path));
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const busy = useNetworkBusy();
  const [meta, setMeta] = useState({});
  const [mobileOpen, setMobileOpen] = useState(false);
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
  const activeKey = activeFor(location.pathname) || meta.activeNav;
  const section =
    [...NAV_ITEMS, BUILD_ACTION].find((item) => item.key === activeKey)?.label || 'Account';
  const title = activeKey === 'dashboard' ? 'Overview' : meta.pageTitle || section;
  const initials = (user?.full_name || 'Instructor')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  useEffect(() => {
    function handleClick(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target))
        setUserMenuOpen(false);
    }
    function handleKey(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setMobileOpen(false);
        setCommandOpen((value) => !value);
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
    <div className="app-shell">
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
          <Link to="/dashboard" className="sidebar-brand-link" aria-label="Nexam overview">
            <img className="sidebar-mark" src="/favicon.png" alt="" />
            <span className="sidebar-wordmark">
              nexam<span className="sidebar-edition">workspace</span>
            </span>
          </Link>
          <button
            className="sidebar-close"
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <button
          type="button"
          className="sidebar-search"
          aria-haspopup="dialog"
          onClick={() => {
            setMobileOpen(false);
            setCommandOpen(true);
          }}
        >
          <Search size={15} />
          <span>Quick navigation</span>
          <kbd>⌘ K</kbd>
        </button>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {['home', 'Workspace', 'Assessment', 'Institution'].map((group) => (
            <div className="nav-group" key={group}>
              {group !== 'home' && <div className="nav-group-label">{group}</div>}
              {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    to={item.to}
                    className={`nav-item ${activeKey === item.key ? 'active' : ''}`}
                    aria-current={activeKey === item.key ? 'page' : undefined}
                    onPointerEnter={() => prefetchAll(item.prefetch)}
                    onFocus={() => prefetchAll(item.prefetch)}
                  >
                    <Icon size={17} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-create">
          <Link
            to="/wizard"
            className={`nav-item nav-item--featured ${activeKey === 'wizard' ? 'active' : ''}`}
            aria-current={activeKey === 'wizard' ? 'page' : undefined}
            onPointerEnter={() => prefetchAll(BUILD_ACTION.prefetch)}
          >
            <Sparkles size={17} />
            <span>Build an exam</span>
            <ChevronRight size={14} />
          </Link>
        </div>
        <Link
          to="/account"
          className="sidebar-foot"
          onPointerEnter={() => prefetchAll(['/auth/me'])}
          onFocus={() => prefetchAll(['/auth/me'])}
        >
          <span className="avatar avatar-sm">{initials}</span>
          <span className="sidebar-foot-meta">
            <strong>{user?.full_name || 'Instructor'}</strong>
            <small>Personal workspace</small>
          </span>
          <Settings2 size={16} aria-hidden="true" />
        </Link>
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
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={18} />
            </button>
            <PanelLeft size={16} className="topbar-workspace-icon" aria-hidden="true" />
            <div className="topbar-heading">
              <span className="topbar-workspace">Faculty workspace</span>
              <ChevronRight size={13} className="topbar-divider" aria-hidden="true" />
              <span className="topbar-title">{title}</span>
              <Spinner size="sm" className={`topbar-spinner ${busy ? 'is-active' : ''}`} />
            </div>
          </div>
          <div className="topbar-right">
            <button
              className="topbar-search"
              type="button"
              aria-label="Open quick navigation"
              aria-haspopup="dialog"
              onClick={() => setCommandOpen(true)}
            >
              <Search size={17} />
            </button>
            <div className="user-menu" ref={userMenuRef}>
              <button
                className="user-trigger"
                type="button"
                aria-label="Account menu"
                aria-expanded={userMenuOpen}
                onClick={() => setUserMenuOpen((value) => !value)}
              >
                <span className="avatar avatar-sm">{initials}</span>
                <ChevronDown size={14} />
              </button>
              {userMenuOpen && (
                <div className="user-dropdown">
                  <div className="user-dropdown-head">
                    <span className="avatar">{initials}</span>
                    <div className="ud-meta">
                      <div className="ud-name">{user?.full_name || 'Instructor'}</div>
                      <div className="ud-email">{user?.email || ''}</div>
                    </div>
                  </div>
                  <button
                    className="user-dropdown-item"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/account');
                    }}
                  >
                    <User size={16} /> Account settings
                  </button>
                  <div className="user-dropdown-sep" />
                  <button
                    className="user-dropdown-item danger"
                    onClick={() => {
                      setUserMenuOpen(false);
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
      {commandOpen && <CommandMenu open onClose={closeCommand} />}
    </div>
  );
}
