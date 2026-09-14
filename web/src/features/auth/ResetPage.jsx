/**
 * ResetPage — enter the reset OTP code + choose a new password.
 *
 * Receives { resetToken, email } via router location state (from /forgot).
 * On success, redirects to /login with a success toast.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react';
import api, { ApiError } from '../../lib/api.js';

export default function ResetPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { resetToken, email } = location.state || {};

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const codeRef = useRef(null);

  useEffect(() => {
    if (!resetToken) {
      navigate('/forgot', { replace: true });
      return;
    }
    codeRef.current?.focus();
  }, [resetToken, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset', { resetToken, code, password });
      navigate('/login', { state: { toast: 'Password reset successfully! You can now log in.' } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reset failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page auth-page-reset">
      <div className="auth-wrap">
        <div className="auth-panel">
          <span className="panel-badge">New Password</span>
          <div className="panel-title">
            Set a new password<em>and you're back in.</em>
          </div>
          <p className="panel-tagline">
            Enter the reset code we sent, then choose a new password (min. 8 characters).
          </p>
          <div className="panel-footer">
            <div className="panel-icon"><ShieldCheck /></div>
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
              <h1>Reset password</h1>
              <p>Enter the code and your new password.</p>
            </div>

            {email && <div className="verify-email-line">Code sent to <strong>{email}</strong></div>}

            {error && (
              <div className="form-alert" role="alert">
                <AlertCircle />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="code">Reset Code <span className="req">*</span></label>
              <div className="input-wrap">
                <input id="code" ref={codeRef} type="text" inputMode="numeric" pattern="\d{6}"
                  className="form-input code-input" placeholder="••••••" maxLength={6}
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">New Password <span className="req">*</span></label>
              <div className="input-wrap password-wrap">
                <span className="input-icon"><Lock /></span>
                <input id="password" type={showPw ? 'text' : 'password'} className="form-input"
                  autoComplete="new-password" placeholder="Min. 8 characters"
                  value={password} onChange={(e) => setPassword(e.target.value)} maxLength={128} required />
                <button type="button" className="password-toggle" onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirm">Confirm Password <span className="req">*</span></label>
              <div className="input-wrap">
                <span className="input-icon"><Lock /></span>
                <input id="confirm" type={showPw ? 'text' : 'password'} className="form-input"
                  autoComplete="new-password" placeholder="Re-enter password"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} maxLength={128} required />
              </div>
            </div>

            <div className="btn-row-stacked">
              <button type="submit" className={`btn-login ${loading ? 'is-loading' : ''}`} disabled={loading}>
                <span className="btn-spinner" />
                {loading ? 'Resetting…' : 'Reset password'}
              </button>
              <Link to="/login" className="btn-register">Back to sign in</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
