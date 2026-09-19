/**
 * App — root router.
 *
 * Auth pages: /login, /register, /verify, /forgot, /reset
 * App pages:  /dashboard, /subjects, /questions, /tos, /exams, /materials, /analytics, /account
 *
 * Protected routes are wrapped in <RequireAuth> which redirects to /login
 * if no JWT is present.
 */
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './features/auth/AuthContext.jsx';
import { ToastProvider, useToast } from './components/Toast.jsx';
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

import './styles/tokens.css';
import './styles/auth.css';
import './styles/app.css';
import './styles/grid.css';
import './styles/toast.css';
import './styles/modal.css';
import './styles/dashboard.css';
import './styles/subjects.css';
import './styles/questions.css';
import './styles/tos.css';
import './styles/exams.css';
import './styles/materials.css';
import './styles/analytics.css';
import './styles/account.css';
import './styles/wizard.css';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="app-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

/** Auth pages (login/register/forgot/reset) — bounce authenticated users to
 *  the dashboard so a stale token can't leak one account's data into another
 *  account's registration flow. Log out first to switch accounts. */
function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading">Loading…</div>;
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

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <ToastOnMount />
          <Routes>
            {/* Auth */}
            <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
            <Route path="/register" element={<RedirectIfAuthed><RegisterPage /></RedirectIfAuthed>} />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/forgot" element={<RedirectIfAuthed><ForgotPage /></RedirectIfAuthed>} />
            <Route path="/reset" element={<RedirectIfAuthed><ResetPage /></RedirectIfAuthed>} />

            {/* App (protected) */}
            <Route path="/wizard" element={<RequireAuth><WizardPage /></RequireAuth>} />
            <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
            <Route path="/subjects" element={<RequireAuth><SubjectsPage /></RequireAuth>} />
            <Route path="/questions" element={<RequireAuth><QuestionsPage /></RequireAuth>} />
            <Route path="/questions/:id/similarity" element={<RequireAuth><SimilarityReviewPage /></RequireAuth>} />
            <Route path="/tos" element={<RequireAuth><TosPage /></RequireAuth>} />
            <Route path="/tos/:id" element={<RequireAuth><TosDetailPage /></RequireAuth>} />
            <Route path="/exams" element={<RequireAuth><ExamsPage /></RequireAuth>} />
            <Route path="/exams/new" element={<RequireAuth><ExamFormPage /></RequireAuth>} />
            <Route path="/exams/:id" element={<RequireAuth><ExamDetailPage /></RequireAuth>} />
            <Route path="/exams/:id/edit" element={<RequireAuth><ExamFormPage /></RequireAuth>} />
            <Route path="/materials" element={<RequireAuth><MaterialsPage /></RequireAuth>} />
            <Route path="/analytics" element={<RequireAuth><AnalyticsPage /></RequireAuth>} />
            <Route path="/analytics/items/:examId" element={<RequireAuth><ItemAnalysisPage /></RequireAuth>} />
            <Route path="/analytics/ai-eval" element={<RequireAuth><AiEvalPage /></RequireAuth>} />
            <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />

            {/* Default → dashboard (which redirects to /login if not authed) */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
