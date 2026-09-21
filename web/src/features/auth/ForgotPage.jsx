/**
 * ForgotPage — request a password-reset OTP.
 *
 * On success, the API returns a resetToken (short-lived JWT) + email.
 * We navigate to /reset carrying both.
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, AlertCircle, ShieldCheck, GraduationCap } from 'lucide-react';
import api, { ApiError } from '../../lib/api.js';

export default function ForgotPage() {
  const navigate = useNavigate();
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
    <div className="auth-page auth-page-forgot">
      <div className="auth-wrap">
        <div className="auth-panel">
          <span className="panel-badge">Reset Password</span>
          <div className="panel-title">
            Forgot your password?<em>we'll send a reset code.</em>
          </div>
          <p className="panel-tagline">
            Enter the email on your account. If it exists, we'll send a 6-digit
            code valid for 15 minutes.
          </p>
          <div className="panel-footer">
            <div className="panel-icon"><GraduationCap /></div>
            <div className="panel-org">
              nexam
              <small>TOS-aligned Exam Builder</small>
            </div>
          </div>
        </div>

        <div className="auth-form-wrap">
          <form onSubmit={handleSubmit} noValidate>
            <div className="auth-logo">
              <span className="logo-mark"><ShieldCheck /></span>
              <span>nexam</span>
            </div>
            <div className="auth-heading">
              <h1>Reset your password</h1>
              <p>Enter your account email to receive a reset code.</p>
            </div>

            {error && (
              <div className="form-alert" role="alert">
                <AlertCircle />
                <span>{error}</span>
              </div>
            )}
            {info && !error && (
              <div className="form-alert" role="status" style={{ background: 'var(--action-50)', borderColor: 'var(--action-100)', color: 'var(--action-700)' }}>
                <AlertCircle />
                <span>{info}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="email">Email <span className="req">*</span></label>
              <div className="input-wrap">
                <span className="input-icon"><Mail /></span>
                <input id="email" type="email" className="form-input" autoComplete="email"
                  placeholder="you@school.edu" value={email}
                  onChange={(e) => setEmail(e.target.value)} maxLength={255} required />
              </div>
            </div>

            <div className="btn-row-stacked">
              <button type="submit" className={`btn-login ${loading ? 'is-loading' : ''}`} disabled={loading}>
                {loading && <span className="btn-spinner" aria-hidden="true" />}
                {loading ? 'Sending…' : 'Send reset code'}
              </button>
              <Link to="/login" className="btn-register">Back to sign in</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
