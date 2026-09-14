/**
 * VerifyPage — enter the 6-digit OTP code sent to the email.
 *
 * Receives { verifyToken, email } via router location state (from /register).
 * If arrived from /login (unverified account), there's no verifyToken — the
 * user clicks "Resend code" which calls /forgot to issue a reset token, then
 * we swap to reset mode.
 *
 * On success, redirects to /login with a success toast.
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { AlertCircle, ShieldCheck, RotateCw } from 'lucide-react';
import api, { ApiError } from '../../lib/api.js';

export default function VerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyToken, email, unverified } = location.state || {};

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(unverified ? 'Please verify your email before logging in.' : '');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!verifyToken && !unverified) {
      navigate('/login', { replace: true });
      return;
    }
    inputRef.current?.focus();
  }, [verifyToken, unverified, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!verifyToken) {
      setError('No verification session. Please request a new code below.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/verify', { verifyToken, code });
      navigate('/login', { state: { toast: 'Email verified! You can now log in.' } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    setInfo('');
    if (!verifyToken) {
      // Arrived from login (unverified) — use /forgot to issue a fresh token.
      if (!email) {
        setError('No email on file. Please register or log in again.');
        return;
      }
      setResending(true);
      try {
        const data = await api.post('/auth/forgot', { email });
        if (data.resetToken) {
          setInfo('A new code has been sent. Use it below to verify your email.');
          // Re-route into the verify flow with the reset token acting as verify.
          navigate('/verify', { replace: true, state: { verifyToken: data.resetToken, email } });
        } else {
          setInfo(data.message || 'If an account exists, a code has been sent.');
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not resend code.');
      } finally {
        setResending(false);
      }
      return;
    }
    setResending(true);
    try {
      const data = await api.post('/auth/resend', { verifyToken });
      setInfo(data.message || 'A new code has been sent.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend code.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="auth-page auth-page-verify">
      <div className="auth-wrap">
        <div className="auth-panel">
          <span className="panel-badge">Verify Email</span>
          <div className="panel-title">
            One last step<em>confirm your email address.</em>
          </div>
          <p className="panel-tagline">
            Enter the 6-digit code we sent to your inbox. It expires in 15 minutes.
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
              <h1>Check your email</h1>
              <p>Enter the verification code to activate your account.</p>
            </div>

            {email && <div className="verify-email-line">We sent a code to <strong>{email}</strong></div>}

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
              <label className="form-label" htmlFor="code">Verification Code <span className="req">*</span></label>
              <div className="input-wrap">
                <input
                  id="code" ref={inputRef} type="text" inputMode="numeric" pattern="\d{6}"
                  className="form-input code-input" placeholder="••••••" maxLength={6}
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required
                />
              </div>
            </div>

            <div className="btn-row-stacked">
              <button type="submit" className={`btn-login ${loading ? 'is-loading' : ''}`} disabled={loading}>
                <span className="btn-spinner" />
                {loading ? 'Verifying…' : 'Verify email'}
              </button>
              <button type="button" className="btn-register" onClick={handleResend} disabled={resending}>
                <RotateCw />
                {resending ? 'Sending…' : 'Resend code'}
              </button>
            </div>

            <div className="form-links">
              <Link to="/login">Back to sign in</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
