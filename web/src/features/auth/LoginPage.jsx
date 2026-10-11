import '../../styles/auth-shared.css';
/**
 * LoginPage — premium split-panel sign-in.
 *
 * Left: quiet brand panel with the three-step product story.
 * Right: the working form — same contract as before: POST /auth/login,
 * store token via useAuth().login, role-based redirect, and the
 * needsVerification detour to /verify.
 *
 * Entrance: one GSAP timeline on mount (card settles, side panel steps in,
 * fields cascade). prefers-reduced-motion renders the final state.
 */
import { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from './AuthContext.jsx';
import api, { ApiError } from '../../lib/api.js';
import { useAuthEntrance } from './authEntrance.js';
import AuthGlow from './AuthGlow.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const pageRef = useRef(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useAuthEntrance(pageRef);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/auth/login', { email, password });
      login(data.token, data.user);
      navigate(['admin', 'superadmin'].includes(data.user.role) ? '/admin/dashboard' : '/dashboard');
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
    <div className="auth-page auth-page-login page--auth-login" ref={pageRef}>
      <AuthGlow />
      <a href="#login-form" className="skip-link">
        Skip to login form
      </a>

      <div className="auth-shell">
        {/* Brand side */}
        <aside className="auth-side">
          <div className="auth-side-brand anim-in">
            <img src="/favicon.png" alt="" />
            <span>nexam</span>
          </div>
          <h2 className="anim-in">Less busywork.<br /><em>More thoughtful assessments.</em></h2>
          <p className="auth-side-tag anim-in">
            Your materials, your expertise, one organized place.
          </p>
          <ol className="auth-steps">
            <li className="anim-in">
              <i>01</i>
              <span>
                <strong>Your course materials</strong>
                <small>Notes, syllabus, and references</small>
              </span>
            </li>
            <li className="anim-in">
              <i>02</i>
              <span>
                <strong>Questions you can trust</strong>
                <small>Grounded drafts. Your review and approval.</small>
              </span>
            </li>
            <li className="anim-in">
              <i>03</i>
              <span>
                <strong>Ready for the classroom</strong>
                <small>Set A + Set B, keys, and OMR sheets</small>
              </span>
            </li>
          </ol>
        </aside>

        {/* Form card */}
        <main className="auth-card">
          <form id="login-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-card-brand anim-in">
              <img src="/favicon.png" alt="" />
              <span>nexam</span>
            </div>
            <div className="auth-heading anim-in">
              <h1>Welcome back</h1>
              <p>Sign in to your instructor account.</p>
            </div>

            {error && (
              <div className="form-alert anim-in" role="alert">
                <AlertCircle />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group anim-in">
              <label className="form-label" htmlFor="email">
                Email <span className="req">*</span>
              </label>
              <div className="input-wrap">
                <span className="input-icon"><Mail /></span>
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

            <div className="form-group anim-in">
              <label className="form-label" htmlFor="password">
                Password <span className="req">*</span>
              </label>
              <div className="input-wrap password-wrap">
                <span className="input-icon"><Lock /></span>
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

            <div className="anim-in">
              <button type="submit" className={`btn-login${loading ? ' is-loading' : ''}`} disabled={loading}>
                {loading && <span className="btn-spinner" aria-hidden="true" />}
                {loading ? 'Signing in…' : 'Sign in'}
                {!loading && <ArrowRight size={15} aria-hidden="true" />}
              </button>
            </div>

            <div className="form-links anim-in">
              <Link to="/forgot">Forgot password?</Link>
            </div>
          </form>

          <div className="auth-card-foot">
            <span>New to nexam?</span>
            <Link to="/register" className="auth-foot-link">Create account</Link>
          </div>
          <div className="auth-legal">
            <Link to="/privacy">Data Privacy</Link>
            <span aria-hidden="true">·</span>
            <Link to="/terms">Terms of Use</Link>
          </div>
        </main>
      </div>
    </div>
  );
}
