import '../../styles/auth-shared.css';
/**
 * VerifyPage — enter the 6-character OTP code sent to the email.
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
import { AlertCircle, RotateCw, Mail, ArrowRight } from 'lucide-react';
import api, { ApiError } from '../../lib/api.js';
import { useAuth } from './AuthContext.jsx';
import { useAuthEntrance } from './authEntrance.js';

export default function VerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { verifyToken, email, unverified } = location.state || {};
  const pageRef = useRef(null);
  useAuthEntrance(pageRef);

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(unverified ? 'Please verify your email before logging in.' : '');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef(null);

  // Live countdown for the resend cooldown.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const autoSent = useRef(false);

  useEffect(() => {
    if (!verifyToken && !unverified) {
      navigate('/login', { replace: true });
      return;
    }
    inputRef.current?.focus();
  }, [verifyToken, unverified, navigate]);

  // Arrived from login unverified — nothing was sent yet. Request a real
  // verification code once on mount so the email actually goes out.
  useEffect(() => {
    if (autoSent.current || verifyToken || !unverified || !email) return;
    autoSent.current = true;
    (async () => {
      setResending(true);
      try {
        const data = await api.post('/auth/send-verification', { email });
        if (data.verifyToken) {
          setCooldown(120);
          navigate('/verify', { replace: true, state: { verifyToken: data.verifyToken, email } });
        } else {
          setInfo(data.message || 'If an account exists, a code has been sent.');
        }
      } catch (err) {
        resendError(err);
      } finally {
        setResending(false);
      }
    })();
  }, [verifyToken, unverified, email, navigate]);

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
      // Drop any stale session — if another account was logged in while this
      // one registered/verified, its token must not survive into the next.
      logout();
      navigate('/login', { state: { toast: 'Email verified! You can now log in.' } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed.');
    } finally {
      setLoading(false);
    }
  }

  /** A resend cooldown means a code was already sent recently — surface it
   *  as a live countdown note instead of a red error. */
  function resendError(err) {
    if (err instanceof ApiError && err.status === 429) {
      setCooldown(err.payload?.retryAfter || 60);
    } else {
      setError(err instanceof ApiError ? err.message : 'Could not resend code.');
    }
  }

  async function handleResend() {
    setError('');
    setInfo('');
    if (!verifyToken) {
      // Arrived from login (unverified) — request a real verification code
      // and a matching verifyToken.
      if (!email) {
        setError('No email on file. Please register or log in again.');
        return;
      }
      setResending(true);
      try {
        const data = await api.post('/auth/send-verification', { email });
        if (data.verifyToken) {
          setCooldown(120);
          navigate('/verify', { replace: true, state: { verifyToken: data.verifyToken, email } });
        } else {
          setInfo(data.message || 'If an account exists, a code has been sent.');
        }
      } catch (err) {
        resendError(err);
      } finally {
        setResending(false);
      }
      return;
    }
    setResending(true);
    try {
      const data = await api.post('/auth/resend', { verifyToken });
      setCooldown(60);
      setInfo(data.message || 'A new code has been sent.');
    } catch (err) {
      resendError(err);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="auth-page auth-page-verify page--auth-verify" ref={pageRef}>
      <a href="#verify-form" className="skip-link">Skip to verification form</a>

      <div className="auth-shell">
        {/* Brand side */}
        <aside className="auth-side">
          <div className="auth-side-brand anim-in">
            <img src="/favicon.png" alt="" />
            <span>nexam</span>
          </div>
          <h2 className="anim-in">One last step —<br /><em>confirm your email.</em></h2>
          <p className="auth-side-tag anim-in">
            Enter the 6-character code we sent to your inbox. It expires in 15 minutes.
          </p>
          <ol className="auth-steps">
            <li className="anim-in">
              <i>01</i>
              <span>
                <strong>We sent a code</strong>
                <small>6 characters, valid 15 minutes</small>
              </span>
            </li>
            <li className="anim-in">
              <i>02</i>
              <span>
                <strong>Enter it here</strong>
                <small>Activates your instructor account</small>
              </span>
            </li>
            <li className="anim-in">
              <i>03</i>
              <span>
                <strong>You're in</strong>
                <small>Build your first blueprint</small>
              </span>
            </li>
          </ol>
        </aside>

        {/* Form card */}
        <main className="auth-card">
          <form id="verify-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-card-brand anim-in">
              <img src="/favicon.png" alt="" />
              <span>nexam</span>
            </div>
            <div className="auth-heading anim-in">
              <h1>Check your email</h1>
              <p>Enter the verification code to activate your account.</p>
            </div>

            {email && (
              <div className="form-alert form-alert--info anim-in" role="status">
                <Mail />
                <span>We sent a code to <strong>{email}</strong></span>
              </div>
            )}

            {error && (
              <div className="form-alert anim-in" role="alert">
                <AlertCircle />
                <span>{error}</span>
              </div>
            )}
            {(cooldown > 0 || (info && !error)) && (
              <div className="form-alert form-alert--info anim-in" role="status">
                <AlertCircle />
                <span>
                  {cooldown > 0
                    ? `A code was already sent — you can request a new one in ${cooldown}s.`
                    : info}
                </span>
              </div>
            )}

            <div className="form-group anim-in">
              <label className="form-label" htmlFor="code">Verification Code <span className="req">*</span></label>
              <div className="input-wrap">
                <input
                  id="code" ref={inputRef} type="text" inputMode="text" pattern="[0-9A-Za-z]{6}"
                  className="form-input code-input" placeholder="••••••" maxLength={6}
                  value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 6))} required
                />
              </div>
            </div>

            <div className="anim-in">
              <button type="submit" className={`btn-login${loading ? ' is-loading' : ''}`} disabled={loading}>
                {loading && <span className="btn-spinner" aria-hidden="true" />}
                {loading ? 'Verifying…' : 'Verify email'}
                {!loading && <ArrowRight size={15} aria-hidden="true" />}
              </button>
              <button type="button" className="btn-register" onClick={handleResend} disabled={resending || cooldown > 0}>
                <RotateCw />
                {resending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>

            <div className="form-links anim-in">
              <Link to="/login">Back to sign in</Link>
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
