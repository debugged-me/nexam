/**
 * AppShell — the application chrome: grouped sidebar + topbar + content area.
 *
 * This is a faithful React port of the PHP app's sidebar.php + topbar.php.
 * It uses the same class names so the ported layout.css styles apply directly.
 *
 * The sidebar is grouped by workflow phase (Overview / Content / Assessment),
 * each item has a Lucide icon + label, and the active item gets the accent wash.
 * The topbar has breadcrumbs, a mobile toggle, and a user dropdown.
 */
import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  GraduationCap, LayoutDashboard, BookOpen, FolderOpen, CircleHelp,
  PanelsTopLeft, FileText, BarChart3, Menu, ChevronDown, ChevronRight,
  LogOut, User, Lock, X, Sparkles,
} from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext.jsx';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', key: 'dashboard', icon: LayoutDashboard, to: '/dashboard' },
      { label: 'Exam Wizard', key: 'wizard', icon: Sparkles, to: '/wizard' },
    ],
  },
  {
    label: 'Content',
    items: [
      { label: 'Subjects',  key: 'subjects',  icon: BookOpen,    to: '/subjects' },
      { label: 'Materials', key: 'materials', icon: FolderOpen,  to: '/materials' },
      { label: 'Questions', key: 'questions', icon: CircleHelp,  to: '/questions' },
    ],
  },
  {
    label: 'Assessment',
    items: [
      { label: 'Blueprints (TOS)', key: 'tos',      icon: PanelsTopLeft, to: '/tos' },
      { label: 'Exams',            key: 'exams',    icon: FileText,      to: '/exams' },
      { label: 'Analytics',        key: 'analytics', icon: BarChart3,    to: '/analytics' },
    ],
  },
];

const SECTION_TITLES = {
  dashboard: 'Dashboard',
  wizard: 'Exam Wizard',
  subjects: 'Subjects',
  materials: 'Materials',
  questions: 'Questions',
  tos: 'Blueprints (TOS)',
  exams: 'Exams',
  analytics: 'Analytics',
  account: 'Account',
};

/** Derive the active nav key from the current pathname. */
function deriveActiveKey(pathname) {
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/wizard')) return 'wizard';
  if (pathname.startsWith('/subjects')) return 'subjects';
  if (pathname.startsWith('/materials')) return 'materials';
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

export default function AppShell({ activeNav, pageTitle, children, wide }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  const activeKey = activeNav || deriveActiveKey(location.pathname);
  const title = pageTitle || SECTION_TITLES[activeKey] || 'Dashboard';
  const section = SECTION_TITLES[activeKey] || '';
  const isSectionRoot = section === title;
  const initials = getInitials(user?.full_name);

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <span className="sidebar-mark"><GraduationCap size={16} /></span>
          <span className="sidebar-wordmark">
            nexam
            <small>Exam workspace</small>
          </span>
          <button className="sidebar-close" style={{ display: 'none' }} />
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="nav-group">
              <div className="nav-section" aria-hidden="true">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeKey === item.key;
                return (
                  <Link
                    key={item.key}
                    to={item.to}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
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

            <nav className="topbar-heading crumbs" aria-label="Breadcrumb">
              <ol className="crumb-list">
                <li className="crumb-item">
                  <span style={{ color: 'var(--ink-2)', fontFamily: 'var(--font-display)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                    Workspace
                  </span>
                </li>
                {!isSectionRoot && section && (
                  <>
                    <li className="crumb-sep" aria-hidden="true"><ChevronRight size={14} /></li>
                    <li className="crumb-item">
                      <Link to={`/${activeKey}`} style={{ color: 'var(--ink-3)' }}>{section}</Link>
                    </li>
                  </>
                )}
                <li className="crumb-sep" aria-hidden="true"><ChevronRight size={14} /></li>
                <li className="crumb-item" aria-current="page">
                  <span className="topbar-title">{title}</span>
                </li>
              </ol>
            </nav>
          </div>

          <div className="topbar-right">
            {/* User menu */}
            <div className="user-menu" ref={userMenuRef}>
              <button
                className="user-trigger"
                type="button"
                aria-label="Account menu"
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
        </header>

        {/* Page content */}
        <div className={`page-content ${wide ? 'page-content--wide' : ''}`}>
          {children}
        </div>
      </main>
    </div>
  );
}
