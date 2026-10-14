import '../../styles/auth-shared.css';
/**
 * ForgotPage — request a password-reset OTP.
 *
 * On success, the API returns a resetToken (short-lived JWT) + email.
 * We navigate to /reset carrying both.
 */
import { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, AlertCircle, ArrowRight } from 'lucide-react';
import api, { ApiError } from '../../lib/api.js';
import { useAuthEntrance } from './authEntrance.js';
import AuthGlow from './AuthGlow.jsx';

export default function ForgotPage() {
  const navigate = useNavigate();
  const pageRef = useRef(null);
  useAuthEntrance(pageRef);

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const data = await api.post('/auth/forgot', { email });
      if (data.resetToken) {
        navigate('/reset', { state: { resetToken: data.resetToken, email: data.email } });
      } else {
        // Account doesn't exist — API returns the same generic message.
        setInfo(data.message || 'If an account exists for that email, a reset code has been sent.');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not request a reset.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page auth-page-forgot page--auth-forgot" ref={pageRef}>
      <AuthGlow />
      <a href="#forgot-form" className="skip-link">Skip to reset form</a>

      <div className="auth-shell">
        {/* Brand side */}
        <aside className="auth-side">
          <div className="auth-side-brand anim-in">
            <img src="/favicon.png" alt="" />
            <span>nexam</span>
          </div>
          <h2 className="anim-in">Locked out?<br /><em>We'll get you back in.</em></h2>
          <p className="auth-side-tag anim-in">
            Enter the email on your account. If it exists, we'll send a
            6-character code valid for 15 minutes.
          </p>
          <ol className="auth-steps">
            <li className="anim-in">
              <i>01</i>
              <span>
                <strong>Enter your email</strong>
                <small>The one on your instructor account</small>
              </span>
            </li>
            <li className="anim-in">
              <i>02</i>
              <span>
                <strong>Check your inbox</strong>
                <small>A short-lived reset code arrives</small>
              </span>
            </li>
            <li className="anim-in">
              <i>03</i>
              <span>
                <strong>Choose a new password</strong>
                <small>Back to your workspace in a minute</small>
              </span>
            </li>
          </ol>
        </aside>

        {/* Form card */}
        <main className="auth-card">
          <form id="forgot-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-card-brand anim-in">
              <img src="/favicon.png" alt="" />
              <span>nexam</span>
            </div>
            <div className="auth-heading anim-in">
              <h1>Reset your password</h1>
              <p>Enter your account email to receive a reset code.</p>
            </div>

            {error && (
              <div className="form-alert anim-in" role="alert">
                <AlertCircle />
                <span>{error}</span>
              </div>
            )}
            {info && !error && (
              <div className="form-alert form-alert--info anim-in" role="status">
                <AlertCircle />
                <span>{info}</span>
              </div>
            )}

            <div className="form-group anim-in">
              <label className="form-label" htmlFor="email">Email <span className="req">*</span></label>
              <div className="input-wrap">
                <span className="input-icon"><Mail /></span>
                <input id="email" type="email" className="form-input" autoComplete="email"
                  placeholder="you@school.edu" value={email}
                  onChange={(e) => setEmail(e.target.value)} maxLength={255} required />
              </div>
            </div>

            <div className="anim-in">
              <button type="submit" className={`btn-login${loading ? ' is-loading' : ''}`} disabled={loading}>
                {loading && <span className="btn-spinner" aria-hidden="true" />}
                {loading ? 'Sending…' : 'Send reset code'}
                {!loading && <ArrowRight size={15} aria-hidden="true" />}
              </button>
              <Link to="/login" className="btn-register">Back to sign in</Link>
            </div>
          </form>

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
