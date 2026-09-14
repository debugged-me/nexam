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
import { Mail, Lock, Eye, EyeOff, AlertCircle, GraduationCap, ShieldCheck } from 'lucide-react';
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
      navigate('/dashboard');
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
      <a href="#login-form" className="skip-link">Skip to login form</a>
      <div className="auth-wrap">
        {/* Brand panel */}
        <div className="auth-panel">
          <span className="panel-badge">Faculty Portal</span>
          <div className="panel-title">
            Build TOS-aligned exams<em>faster, grounded in your own materials.</em>
          </div>
          <p className="panel-tagline">
            Nexam turns your syllabus and lecture notes into a vetted question bank —
            with Bloom alignment, similarity checks, and print-ready output.
          </p>
          <div className="panel-footer">
            <div className="panel-icon"><GraduationCap /></div>
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
              <span className="logo-mark"><ShieldCheck /></span>
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
              <label className="form-label" htmlFor="email">Email <span className="req">*</span></label>
              <div className="input-wrap">
                <span className="input-icon"><Mail /></span>
                <input
                  id="email" type="email" className="form-input" autoComplete="email"
                  placeholder="you@school.edu"
                  value={email} onChange={(e) => setEmail(e.target.value)} required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password <span className="req">*</span></label>
              <div className="input-wrap password-wrap">
                <span className="input-icon"><Lock /></span>
                <input
                  id="password" type={showPw ? 'text' : 'password'} className="form-input"
                  autoComplete="current-password" placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} required
                />
                <button type="button" className="password-toggle" onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            <div className="btn-row">
              <button type="submit" className={`btn-login ${loading ? 'is-loading' : ''}`} disabled={loading}>
                <span className="btn-spinner" />
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
              <Link to="/register" className="btn-register">
                Create account
              </Link>
            </div>

            <div className="form-links">
              <Link to="/forgot">Forgot password?</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
