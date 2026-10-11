/**
 * App — root router.
 *
 * Auth pages: /login, /register, /verify, /forgot, /reset
 * App pages:  /dashboard, /subjects, /questions, /questions/review, /tos, /exams,
 *             /materials, /analytics, /account
 *
 * Protected routes share one <AppLayout> (sidebar + topbar) behind
 * <RequireAuth>, which redirects to /login if no JWT is present. The layout
 * stays mounted between pages so navigation only swaps the page body.
 */
import { BrowserRouter, Routes, Route, Navigate, useLocation, matchPath } from 'react-router-dom';
import { AuthProvider, useAuth } from './features/auth/AuthContext.jsx';
import { ToastProvider, useToast } from './components/Toast.jsx';
import { ConfirmProvider } from './components/ConfirmDialog.jsx';
import AppLayout from './components/AppLayout.jsx';
import { BootScreen } from './components/Loaders.jsx';
import { useEffect, useRef, lazy, Suspense } from 'react';

const LoginPage = lazy(() => import('./features/auth/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./features/auth/RegisterPage.jsx'));
const VerifyPage = lazy(() => import('./features/auth/VerifyPage.jsx'));
const ForgotPage = lazy(() => import('./features/auth/ForgotPage.jsx'));
const ResetPage = lazy(() => import('./features/auth/ResetPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const SubjectsPage = lazy(() => import('./pages/SubjectsPage.jsx'));
const QuestionsPage = lazy(() => import('./pages/QuestionsPage.jsx'));
const SimilarityReviewPage = lazy(() => import('./pages/SimilarityReviewPage.jsx'));
const ReviewQueuePage = lazy(() => import('./pages/ReviewQueuePage.jsx'));
const TosPage = lazy(() => import('./pages/TosPage.jsx'));
const TosDetailPage = lazy(() => import('./pages/TosDetailPage.jsx'));
const ExamsPage = lazy(() => import('./pages/ExamsPage.jsx'));
const ExamDetailPage = lazy(() => import('./pages/ExamDetailPage.jsx'));
const ExamFormPage = lazy(() => import('./pages/ExamFormPage.jsx'));
const MaterialsPage = lazy(() => import('./pages/MaterialsPage.jsx'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage.jsx'));
const ItemAnalysisPage = lazy(() => import('./pages/ItemAnalysisPage.jsx'));
const AiEvalPage = lazy(() => import('./pages/AiEvalPage.jsx'));
const AccountPage = lazy(() => import('./pages/AccountPage.jsx'));
const AppearancePage = lazy(() => import('./pages/AppearancePage.jsx'));
const WizardPage = lazy(() => import('./pages/WizardPage.jsx'));
const InstitutionBankPage = lazy(() => import('./pages/InstitutionBankPage.jsx'));
const LegalPage = lazy(() => import('./pages/LegalPage.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));

import './styles/tokens.css';
import './styles/app.css';
import './styles/board.css';
import './styles/toast.css';
import './styles/modal.css';
import './styles/loading.css';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <BootScreen />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

/** Auth pages (login/register/forgot/reset) — bounce authenticated users to
 *  the dashboard so a stale token can't leak one account's data into another
 *  account's registration flow. Log out first to switch accounts. */
function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <BootScreen />;
  if (user) return <Navigate to={user.role === 'superadmin' ? '/admin/dashboard' : '/dashboard'} replace />;
  return children;
}

/** Superadmin console — the overseer role only; instructors go to the app. */
function RequireSuperadmin({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <BootScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'superadmin') return <Navigate to="/dashboard" replace />;
  return children;
}

/** Instructor workspace — superadmins are bounced to /admin instead. */
function RequireInstructor({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <BootScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'superadmin') return <Navigate to="/admin/dashboard" replace />;
  if (user.role !== 'instructor') return <Navigate to="/login" replace />;
  return children;
}

/** Shared screens — any authenticated user (instructor or superadmin). */
function RequireAnyAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <BootScreen />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

/** Reads a `toast` from router state and shows it once on mount. */
function ToastOnMount() {
  const location = useLocation();
  const toast = useToast();
  const consumed = useRef(null);
  useEffect(() => {
    const msg = location.state?.toast;
    if (!msg || consumed.current === msg) return;
    consumed.current = msg;
    toast.success(msg);
    // Clear it so a refresh doesn't re-trigger. Native replaceState isn't
    // observed by the router, so `consumed` also guards the stale read.
    window.history.replaceState({ ...location.state, toast: undefined }, '');
  }, [location.state, toast]);
  return null;
}

/** Route pattern → document title segment. Order matters: static segments
 *  must precede param patterns that would also match (e.g. /exams/new vs
 *  /exams/:id). */
const PAGE_TITLES = [
  ['/privacy', 'Data Privacy'],
  ['/terms', 'Terms of Use'],
  ['/admin', 'Admin console'],
  ['/dashboard', 'Home'],
  ['/wizard', 'Build an exam'],
  ['/subjects', 'Subjects'],
  ['/materials', 'Materials'],
  ['/tos', 'Blueprints'],
  ['/tos/:id', 'Blueprint'],
  ['/questions/institution', 'Institution bank'],
  ['/questions/review', 'Review drafts'],
  ['/questions/:id/similarity', 'Similarity review'],
  ['/questions', 'Question bank'],
  ['/exams/new', 'New exam'],
  ['/exams/:id/edit', 'Edit exam'],
  ['/exams/:id', 'Exam'],
  ['/exams', 'Exams'],
  ['/analytics/items/:examId', 'Item analysis'],
  ['/analytics/ai-eval', 'AI evaluation'],
  ['/analytics', 'Results & insights'],
  ['/account', 'Account'],
  ['/appearance', 'Appearance'],
];

/** Keeps the browser tab title in sync with the current page. */
function TitleOnRoute() {
  const { pathname } = useLocation();
  useEffect(() => {
    const match = PAGE_TITLES.find(([pattern]) =>
      matchPath({ path: pattern, end: true }, pathname)
    );
    document.title = match ? `nexam — ${match[1]}` : 'nexam';
  }, [pathname]);
  return null;
}

/** Start each screen at its beginning. BrowserRouter otherwise preserves the
 * previous document scroll position, which can make a new route look clipped. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ConfirmProvider>
          <BrowserRouter>
            <TitleOnRoute />
            <ScrollToTop />
            <ToastOnMount />
            <Suspense fallback={<BootScreen />}>
              <Routes>
                {/* Auth */}
                <Route
                  path="/login"
                  element={
                    <RedirectIfAuthed>
                      <LoginPage />
                    </RedirectIfAuthed>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <RedirectIfAuthed>
                      <RegisterPage />
                    </RedirectIfAuthed>
                  }
                />
                <Route path="/privacy" element={<LegalPage doc="privacy" />} />
                <Route path="/terms" element={<LegalPage doc="terms" />} />

                {/* Superadmin console — same shell, console nav */}
                <Route
                  element={
                    <RequireSuperadmin>
                      <AppLayout />
                    </RequireSuperadmin>
                  }
                >
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/admin/:view" element={<AdminPage />} />
                </Route>
                <Route path="/verify" element={<VerifyPage />} />
                <Route
                  path="/forgot"
                  element={
                    <RedirectIfAuthed>
                      <ForgotPage />
                    </RedirectIfAuthed>
                  }
                />
                <Route
                  path="/reset"
                  element={
                    <RedirectIfAuthed>
                      <ResetPage />
                    </RedirectIfAuthed>
                  }
                />

                {/* Shared (protected, both roles) — keep ahead of the role
                    groups so /appearance isn't swallowed by a role guard. */}
                <Route
                  element={
                    <RequireAnyAuth>
                      <AppLayout />
                    </RequireAnyAuth>
                  }
                >
                  <Route path="/appearance" element={<AppearancePage />} />
                </Route>

                {/* App (protected) */}
                <Route
                  element={
                    <RequireInstructor>
                      <AppLayout />
                    </RequireInstructor>
                  }
                >
                  <Route path="/wizard" element={<WizardPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/subjects" element={<SubjectsPage />} />
                  <Route path="/questions" element={<QuestionsPage />} />
                  <Route path="/questions/institution" element={<InstitutionBankPage />} />
                  <Route path="/questions/review" element={<ReviewQueuePage />} />
                  <Route path="/questions/:id/similarity" element={<SimilarityReviewPage />} />
                  <Route path="/tos" element={<TosPage />} />
                  <Route path="/tos/:id" element={<TosDetailPage />} />
                  <Route path="/exams" element={<ExamsPage />} />
                  <Route path="/exams/new" element={<ExamFormPage />} />
                  <Route path="/exams/:id" element={<ExamDetailPage />} />
                  <Route path="/exams/:id/edit" element={<ExamFormPage />} />
                  <Route path="/materials" element={<MaterialsPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/analytics/items/:examId" element={<ItemAnalysisPage />} />
                  <Route path="/analytics/ai-eval" element={<AiEvalPage />} />
                  <Route path="/account" element={<AccountPage />} />
                </Route>

                {/* Default → dashboard (which redirects to /login if not authed) */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ConfirmProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
