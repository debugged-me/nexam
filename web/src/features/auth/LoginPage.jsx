import '../../styles/auth-login.css';
/**
 * LoginPage — email + password sign-in.
 *
 * On success, stores the JWT and redirects to the dashboard.
 * If the server reports the email is unverified, redirects to /verify
 * with a verify token (re-issued via a quick login-then-forgot flow is not
 * needed here because the API returns needsVerification + email).
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  FileText,
  ListChecks,
  Layers,
  ArrowDown,
} from 'lucide-react';
import { useAuth } from './AuthContext.jsx';
import api, { ApiError } from '../../lib/api.js';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/auth/login', { email, password });
      login(data.token, data.user);
      navigate(data.user.role === 'superadmin' ? '/admin' : '/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.payload?.needsVerification) {
        // Email not verified — go to the verify page. We don't have a verify
        // token here (login doesn't issue one), so the user must use "resend"
        // from the verify page, which will issue a fresh token via /forgot.
        navigate('/verify', { state: { email: err.payload.email, unverified: true } });
        return;
      }
      setError(err.message || 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page auth-page-login">
      <a href="#login-form" className="skip-link">
        Skip to login form
      </a>
      <div className="auth-wrap">
        {/* Brand panel */}
        <div className="auth-panel">
          <div className="auth-workflow" aria-label="From your materials to an exam">
            <div className="auth-workflow-label">A clearer path to exam day</div>
            <div className="auth-workflow-step">
              <span className="auth-workflow-icon">
                <FileText size={20} />
              </span>
              <span>
                <strong>Your course materials</strong>
                <small>Notes, syllabus, and references</small>
              </span>
              <span className="auth-workflow-number">01</span>
            </div>
            <ArrowDown className="auth-workflow-arrow" size={17} aria-hidden="true" />
            <div className="auth-workflow-step">
              <span className="auth-workflow-icon">
                <ListChecks size={20} />
              </span>
              <span>
                <strong>Questions you can trust</strong>
                <small>Grounded drafts. Your review and approval.</small>
              </span>
              <span className="auth-workflow-number">02</span>
            </div>
            <ArrowDown className="auth-workflow-arrow" size={17} aria-hidden="true" />
            <div className="auth-workflow-step">
              <span className="auth-workflow-icon">
                <Layers size={20} />
              </span>
              <span>
                <strong>Ready for the classroom</strong>
                <small>Set A + Set B, keys, and OMR sheets</small>
              </span>
              <span className="auth-workflow-number">03</span>
            </div>
          </div>
          <span className="panel-badge">Built for instructors</span>
          <div className="panel-title">
            Less busywork.<em>More thoughtful assessments.</em>
          </div>
          <p className="panel-tagline">
            Your materials, your expertise, one organized place. Create balanced exams with a little
            help along the way.
          </p>
          <div className="panel-footer">
            <div className="panel-icon">
              <img src="/favicon.png" alt="" />
            </div>
            <div className="panel-org">
              nexam
              <small>TOS-aligned Exam Builder</small>
            </div>
          </div>
        </div>

        {/* Form panel */}
        <div className="auth-form-wrap">
          <form id="login-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-logo">
              <img className="logo-mark-img" src="/favicon.png" alt="" />
              <span>nexam</span>
            </div>
            <div className="auth-heading">
              <h1>Welcome back</h1>
              <p>Sign in to your instructor account.</p>
            </div>

            {error && (
              <div className="form-alert" role="alert">
                <AlertCircle />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email <span className="req">*</span>
              </label>
              <div className="input-wrap">
                <span className="input-icon">
                  <Mail />
                </span>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  autoComplete="email"
                  placeholder="you@school.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Password <span className="req">*</span>
              </label>
              <div className="input-wrap password-wrap">
                <span className="input-icon">
                  <Lock />
                </span>
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  className="form-input"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            <div className="btn-row-stacked">
              <button
                type="submit"
                className={`btn-login ${loading ? 'is-loading' : ''}`}
                disabled={loading}
              >
                {loading && <span className="btn-spinner" aria-hidden="true" />}
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
              <Link to="/register" className="btn-register">
                Create account
              </Link>
            </div>

            <div className="form-links">
              <Link to="/forgot">Forgot password?</Link>
            </div>
            <div className="form-links form-links--legal">
              <Link to="/privacy">Data Privacy</Link>
              <span aria-hidden="true">·</span>
              <Link to="/terms">Terms of Use</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
