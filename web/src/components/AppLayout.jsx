/**
 * AppLayout — the persistent application chrome: grouped sidebar + topbar +
 * content area, rendered once for every protected route.
 *
 * Pages render inside <Outlet/> and describe themselves through <AppShell>,
 * so moving between pages swaps only the content: the sidebar, topbar and
 * open menus stay put instead of remounting like a full page load. A thin
 * progress bar and topbar spinner show quietly while data refreshes.
 *
 * Hovering or focusing a nav item prefetches that screen's data so it
 * usually renders immediately on click.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, BookOpen, FolderOpen, CircleHelp,
  PanelsTopLeft, FileText, BarChart3, Menu, ChevronDown,
  LogOut, User, X, Sparkles, Library,
} from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext.jsx';
import api from '../lib/api.js';
import useNetworkBusy from '../lib/useNetworkBusy.js';
import { ShellMetaContext } from './shellMeta.js';
import { Spinner } from './Loaders.jsx';

// One flat list in workflow order: set up a subject → feed it materials →
// plan with a blueprint → questions fill the bank → assemble an exam.
const NAV_ITEMS = [
  { label: 'Home', key: 'dashboard', icon: Home, to: '/dashboard', prefetch: ['/dashboard'] },
  { label: 'Build an exam', key: 'wizard', icon: Sparkles, to: '/wizard', featured: true, prefetch: ['/subjects'] },
  { label: 'Subjects', key: 'subjects', icon: BookOpen, to: '/subjects', prefetch: ['/subjects'] },
  { label: 'Materials', key: 'materials', icon: FolderOpen, to: '/materials', prefetch: ['/materials', '/subjects'] },
  { label: 'Blueprints', key: 'tos', icon: PanelsTopLeft, to: '/tos', prefetch: ['/tos', '/subjects'] },
  { label: 'Questions', key: 'questions', icon: CircleHelp, to: '/questions', prefetch: ['/questions?', '/subjects', '/tos'] },
  { label: 'Exams', key: 'exams', icon: FileText, to: '/exams', prefetch: ['/exams'] },
  { label: 'Shared bank', key: 'institution', icon: Library, to: '/questions/institution', prefetch: ['/questions/institution', '/subjects'] },
  { label: 'Results', key: 'analytics', icon: BarChart3, to: '/analytics', prefetch: ['/analytics/overview'] },
];

const SECTION_TITLES = {
  dashboard: 'Home',
  wizard: 'Build an exam',
  subjects: 'Subjects',
  materials: 'Materials',
  tos: 'Blueprints',
  questions: 'Questions',
  institution: 'Shared question bank',
  exams: 'Exams',
  analytics: 'Results & insights',
  account: 'Account',
};

/** Derive the active nav key from the current pathname. */
function deriveActiveKey(pathname) {
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/wizard')) return 'wizard';
  if (pathname.startsWith('/subjects')) return 'subjects';
  if (pathname.startsWith('/materials')) return 'materials';
  if (pathname.startsWith('/questions/institution')) return 'institution';
  if (pathname.startsWith('/questions')) return 'questions';
  if (pathname.startsWith('/tos')) return 'tos';
  if (pathname.startsWith('/exams')) return 'exams';
  if (pathname.startsWith('/analytics')) return 'analytics';
  if (pathname.startsWith('/account')) return 'account';
  return '';
}

/** Get user initials from full name. */
function getInitials(name) {
  if (!name) return 'U';
  return name.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
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
  const userMenuRef = useRef(null);

  const updateMeta = useCallback((next) => {
    setMeta((prev) => (
      prev.activeNav === next.activeNav && prev.pageTitle === next.pageTitle && prev.wide === next.wide
        ? prev
        : next
    ));
  }, []);

  const activeKey = meta.activeNav || deriveActiveKey(location.pathname);
  const title = meta.pageTitle || SECTION_TITLES[activeKey] || 'Dashboard';
  const section = SECTION_TITLES[activeKey] || '';
  const isSectionRoot = section === title;
  const initials = getInitials(user?.full_name);

  // Close menus on outside click
  useEffect(() => {
    function handleClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close the mobile sidebar and any open menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <img className="sidebar-mark" src="/favicon.png" alt="" />
          <span className="sidebar-wordmark">
            nexam
            <small>Faculty workspace</small>
          </span>
          <button className="sidebar-close" type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeKey === item.key;
            return (
              <Link
                key={item.key}
                to={item.to}
                className={`nav-item ${isActive ? 'active' : ''} ${item.featured ? 'nav-item--featured' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onPointerEnter={() => prefetchAll(item.prefetch)}
                onFocus={() => prefetchAll(item.prefetch)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Account card pinned to the rail bottom */}
        <Link
          to="/account"
          className="sidebar-foot"
          onPointerEnter={() => prefetchAll(['/auth/me'])}
          onFocus={() => prefetchAll(['/auth/me'])}
        >
          <span className="avatar avatar-sm">{initials}</span>
          <span className="sidebar-foot-meta">
            <strong>{user?.full_name || 'nexam user'}</strong>
            <small>{user?.email || 'Account settings'}</small>
          </span>
        </Link>

      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="mobile-sidebar-overlay show" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <main className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="rail-toggle"
              type="button"
              aria-label="Toggle navigation"
              onClick={() => setMobileOpen((v) => !v)}
            >
              <Menu size={18} />
            </button>

            <div className="topbar-heading">
              {!isSectionRoot && section && <span className="topbar-context">{section}</span>}
              <span className="topbar-title">{title}</span>
              <Spinner size="sm" className={`topbar-spinner ${busy ? 'is-active' : ''}`} />
            </div>
          </div>

          <div className="topbar-right">
            {/* User menu */}
            <div className="user-menu" ref={userMenuRef}>
              <button
                className="user-trigger"
                type="button"
                aria-label="Account menu"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                onClick={() => setUserMenuOpen((v) => !v)}
              >
                <span className="avatar avatar-sm">{initials}</span>
                <ChevronDown size={15} />
              </button>

              {userMenuOpen && (
                <div className="user-dropdown" role="menu">
                  <div className="user-dropdown-head">
                    <span className="avatar">{initials}</span>
                    <div className="ud-meta">
                      <div className="ud-name">{user?.full_name || 'nexam user'}</div>
                      <div className="ud-email">{user?.email || ''}</div>
                    </div>
                  </div>
                  <button
                    className="user-dropdown-item"
                    role="menuitem"
                    onClick={() => { setUserMenuOpen(false); navigate('/account'); }}
                  >
                    <User size={16} /> Change Profile
                  </button>
                  <div className="user-dropdown-sep" />
                  <button
                    className="user-dropdown-item danger"
                    role="menuitem"
                    onClick={() => { setUserMenuOpen(false); logout(); navigate('/login'); }}
                  >
                    <LogOut size={16} /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={`top-progress ${busy ? 'is-active' : ''}`} aria-hidden="true"><span /></div>
        </header>

        {/* Page content */}
        <div className={`page-content ${meta.wide ? 'page-content--wide' : ''}`} aria-busy={busy}>
          <ShellMetaContext.Provider value={updateMeta}>
            <Outlet />
          </ShellMetaContext.Provider>
        </div>
      </main>
    </div>
  );
}
