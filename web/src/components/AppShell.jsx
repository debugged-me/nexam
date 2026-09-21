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
  GraduationCap, Home, BookOpen, FolderOpen, CircleHelp,
  PanelsTopLeft, FileText, BarChart3, Menu, ChevronDown,
  LogOut, User, X, Sparkles, Plus, Upload, Library,
} from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext.jsx';

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { label: 'Home', key: 'dashboard', icon: Home, to: '/dashboard' },
      { label: 'Build an exam', key: 'wizard', icon: Sparkles, to: '/wizard', featured: true },
      { label: 'Question bank', key: 'questions', icon: CircleHelp, to: '/questions' },
      { label: 'Exams', key: 'exams', icon: FileText, to: '/exams' },
    ],
  },
  {
    label: 'Manage',
    items: [
      {
        label: 'Content library', key: 'library', icon: Library, to: '/subjects',
        children: [
          { label: 'Subjects', to: '/subjects', icon: BookOpen },
          { label: 'Materials', to: '/materials', icon: FolderOpen },
          { label: 'Blueprints', to: '/tos', icon: PanelsTopLeft },
        ],
      },
      { label: 'Results & insights', key: 'analytics', icon: BarChart3, to: '/analytics' },
    ],
  },
];

const SECTION_TITLES = {
  dashboard: 'Home',
  wizard: 'Build an exam',
  library: 'Content library',
  questions: 'Questions',
  exams: 'Exams',
  analytics: 'Results & insights',
  account: 'Account',
};

/** Derive the active nav key from the current pathname. */
function deriveActiveKey(pathname) {
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/wizard')) return 'wizard';
  if (pathname.startsWith('/subjects')) return 'library';
  if (pathname.startsWith('/materials')) return 'library';
  if (pathname.startsWith('/questions')) return 'questions';
  if (pathname.startsWith('/tos')) return 'library';
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
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const createMenuRef = useRef(null);

  const requestedKey = activeNav || deriveActiveKey(location.pathname);
  const activeKey = ['subjects', 'materials', 'tos'].includes(requestedKey) ? 'library' : requestedKey;
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
      if (createMenuRef.current && !createMenuRef.current.contains(e.target)) {
        setCreateMenuOpen(false);
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
            <small>Faculty workspace</small>
          </span>
          <button className="sidebar-close" type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="nav-group">
              <div className="nav-section" aria-hidden="true">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeKey === item.key;
                return (
                  <div className="nav-item-wrap" key={item.key}>
                    <Link
                      to={item.to}
                      className={`nav-item ${isActive ? 'active' : ''} ${item.featured ? 'nav-item--featured' : ''} ${item.children && isActive ? 'is-parent-active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon size={16} />
                      <span>{item.label}</span>
                    </Link>
                    {item.children && isActive && (
                      <div className="nav-subitems" aria-label="Content library">
                        {item.children.map((child) => {
                          const ChildIcon = child.icon;
                          const childActive = location.pathname.startsWith(child.to);
                          return (
                            <Link key={child.to} to={child.to} className={`nav-subitem ${childActive ? 'active' : ''}`} aria-current={childActive ? 'page' : undefined}>
                              <ChildIcon size={14} />
                              <span>{child.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
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

            <div className="topbar-heading">
              {!isSectionRoot && section && <span className="topbar-context">{section}</span>}
              <span className="topbar-title">{title}</span>
            </div>
          </div>

          <div className="topbar-right">
            <div className="quick-create" ref={createMenuRef}>
              <button className="quick-create-trigger" type="button" aria-haspopup="menu" aria-expanded={createMenuOpen} onClick={() => setCreateMenuOpen((v) => !v)}>
                <Plus size={16} />
                <span>Create</span>
                <ChevronDown size={14} />
              </button>
              {createMenuOpen && (
                <div className="quick-create-menu" role="menu">
                  <div className="quick-create-head">Create new</div>
                  <Link to="/exams/new" className="quick-create-item is-primary" role="menuitem" onClick={() => setCreateMenuOpen(false)}>
                    <span><FileText size={17} /></span><div><strong>Exam</strong><small>Build from your question bank</small></div>
                  </Link>
                  <Link to="/questions?new=1" className="quick-create-item" role="menuitem" onClick={() => setCreateMenuOpen(false)}>
                    <span><CircleHelp size={17} /></span><div><strong>Question</strong><small>Add one directly to the bank</small></div>
                  </Link>
                  <Link to="/materials?upload=1" className="quick-create-item" role="menuitem" onClick={() => setCreateMenuOpen(false)}>
                    <span><Upload size={17} /></span><div><strong>Material</strong><small>Upload a syllabus or reference</small></div>
                  </Link>
                  <Link to="/subjects?new=1" className="quick-create-item" role="menuitem" onClick={() => setCreateMenuOpen(false)}>
                    <span><BookOpen size={17} /></span><div><strong>Subject</strong><small>Start a new course workspace</small></div>
                  </Link>
                </div>
              )}
            </div>
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
