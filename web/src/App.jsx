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
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './features/auth/AuthContext.jsx';
import { ToastProvider, useToast } from './components/Toast.jsx';
import AppLayout from './components/AppLayout.jsx';
import { BootScreen } from './components/Loaders.jsx';
import { useEffect } from 'react';

import LoginPage from './features/auth/LoginPage.jsx';
import RegisterPage from './features/auth/RegisterPage.jsx';
import VerifyPage from './features/auth/VerifyPage.jsx';
import ForgotPage from './features/auth/ForgotPage.jsx';
import ResetPage from './features/auth/ResetPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SubjectsPage from './pages/SubjectsPage.jsx';
import QuestionsPage from './pages/QuestionsPage.jsx';
import SimilarityReviewPage from './pages/SimilarityReviewPage.jsx';
import ReviewQueuePage from './pages/ReviewQueuePage.jsx';
import TosPage from './pages/TosPage.jsx';
import TosDetailPage from './pages/TosDetailPage.jsx';
import ExamsPage from './pages/ExamsPage.jsx';
import ExamDetailPage from './pages/ExamDetailPage.jsx';
import ExamFormPage from './pages/ExamFormPage.jsx';
import MaterialsPage from './pages/MaterialsPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import ItemAnalysisPage from './pages/ItemAnalysisPage.jsx';
import AiEvalPage from './pages/AiEvalPage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import WizardPage from './pages/WizardPage.jsx';
import InstitutionBankPage from './pages/InstitutionBankPage.jsx';

import './styles/tokens.css';
import './styles/auth.css';
import './styles/app.css';
import './styles/grid.css';
import './styles/toast.css';
import './styles/modal.css';
import './styles/dashboard.css';
import './styles/subjects.css';
import './styles/questions.css';
import './styles/review.css';
import './styles/tos.css';
import './styles/exams.css';
import './styles/materials.css';
import './styles/analytics.css';
import './styles/account.css';
import './styles/wizard.css';
import './styles/institution.css';
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
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

/** Reads a `toast` from router state and shows it once on mount. */
function ToastOnMount() {
  const location = useLocation();
  const toast = useToast();
  useEffect(() => {
    if (location.state?.toast) {
      toast.success(location.state.toast);
      // Clear it so a refresh doesn't re-trigger.
      window.history.replaceState({}, '');
    }
  }, [location.state, toast]);
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
        <BrowserRouter>
          <ScrollToTop />
          <ToastOnMount />
          <Routes>
            {/* Auth */}
            <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
            <Route path="/register" element={<RedirectIfAuthed><RegisterPage /></RedirectIfAuthed>} />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/forgot" element={<RedirectIfAuthed><ForgotPage /></RedirectIfAuthed>} />
            <Route path="/reset" element={<RedirectIfAuthed><ResetPage /></RedirectIfAuthed>} />

            {/* App (protected) */}
            <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
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
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
