import '../../styles/auth-shared.css';
/**
 * ResetPage — two-step reset: verify the OTP code first, then choose a
 * new password once it's confirmed (POST /auth/reset/check validates
 * without consuming; /auth/reset performs the authoritative consume+set).
 *
 * Receives { resetToken, email } via router location state (from /forgot).
 * Staff-initiated resets arrive as /reset?key=<token> and skip the code
 * step entirely — link possession is the proof factor.
 * On success, redirects to /login with a success toast.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, Mail, ArrowRight } from 'lucide-react';
import api, { ApiError } from '../../lib/api.js';
import { useAuthEntrance } from './authEntrance.js';

export default function ResetPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { resetToken, email } = location.state || {};
  const resetKey = searchParams.get('key') || '';
  const pageRef = useRef(null);
  useAuthEntrance(pageRef);

  // ?key= links have no code step — straight to the password form.
  const [step, setStep] = useState(resetKey ? 'password' : 'code');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const codeRef = useRef(null);
  const pwRef = useRef(null);

  useEffect(() => {
    if (!resetToken && !resetKey) {
      navigate('/forgot', { replace: true });
      return;
    }
    (resetKey ? pwRef : codeRef).current?.focus();
  }, [resetToken, resetKey, navigate]);

  // Landing on the password step (after a successful check) focuses the
  // new-password field.
  useEffect(() => {
    if (step === 'password') pwRef.current?.focus();
  }, [step]);

  /** Step 1 — confirm the code is valid before revealing the password form. */
  async function handleCheck(e) {
    e.preventDefault();
    setError('');
    setChecking(true);
    try {
      await api.post('/auth/reset/check', { resetToken, code });
      setStep('password');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid or expired verification code.');
    } finally {
      setChecking(false);
    }
  }

  /** Step 2 — set the new password (server re-verifies + consumes the code). */
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
      if (resetKey) {
        await api.post('/auth/reset-link', { key: resetKey, password });
      } else {
        await api.post('/auth/reset', { resetToken, code, password });
      }
      navigate('/login', { state: { toast: 'Password reset successfully! You can now log in.' } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reset failed.');
    } finally {
      setLoading(false);
    }
  }

  const onPasswordStep = step === 'password';

  return (
    <div className="auth-page auth-page-reset page--auth-reset" ref={pageRef}>
      <a href="#reset-form" className="skip-link">Skip to reset form</a>

      <div className="auth-shell">
        {/* Brand side */}
        <aside className="auth-side">
          <div className="auth-side-brand anim-in">
            <img src="/favicon.png" alt="" />
            <span>nexam</span>
          </div>
          <h2 className="anim-in">Set a new password<br /><em>and you're back in.</em></h2>
          <p className="auth-side-tag anim-in">
            {resetKey
              ? 'Choose a new password (min. 8 characters) and you\'re back in.'
              : 'Enter the reset code we sent, then choose a new password (min. 8 characters).'}
          </p>
          <ol className="auth-steps">
            <li className="anim-in">
              <i>01</i>
              <span>
                <strong>Prove it's you</strong>
                <small>{resetKey ? 'Your secure link did that' : 'The code from your email'}</small>
              </span>
            </li>
            <li className="anim-in">
              <i>02</i>
              <span>
                <strong>Choose a new password</strong>
                <small>At least 8 characters</small>
              </span>
            </li>
            <li className="anim-in">
              <i>03</i>
              <span>
                <strong>Back to sign in</strong>
                <small>Your workspace is waiting</small>
              </span>
            </li>
          </ol>
        </aside>

        {/* Form card */}
        <main className="auth-card">
          <form id="reset-form" onSubmit={onPasswordStep ? handleSubmit : handleCheck} noValidate>
            <div className="auth-card-brand anim-in">
              <img src="/favicon.png" alt="" />
              <span>nexam</span>
            </div>
            <div className="auth-heading anim-in">
              <h1>{onPasswordStep && !resetKey ? 'Choose a new password' : 'Reset password'}</h1>
              <p>
                {resetKey
                  ? 'Choose your new password.'
                  : onPasswordStep
                    ? 'Code confirmed — now pick your new password.'
                    : 'Enter the code we sent to your email.'}
              </p>
            </div>

            {email && !resetKey && !onPasswordStep && (
              <div className="form-alert form-alert--info anim-in" role="status">
                <Mail />
                <span>Code sent to <strong>{email}</strong></span>
              </div>
            )}

            {error && (
              <div className="form-alert anim-in" role="alert">
                <AlertCircle />
                <span>{error}</span>
              </div>
            )}

            {!onPasswordStep ? (
              <div className="step-in" key="code">
                <div className="form-group anim-in">
                  <label className="form-label" htmlFor="code">Reset Code <span className="req">*</span></label>
                  <div className="input-wrap">
                    <input id="code" ref={codeRef} type="text" inputMode="text" pattern="[0-9A-Za-z]{6}"
                      className="form-input code-input" placeholder="••••••" maxLength={6}
                      value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 6))} required />
                  </div>
                </div>

                <div className="anim-in">
                  <button type="submit" className={`btn-login${checking ? ' is-loading' : ''}`} disabled={checking || code.length !== 6}>
                    {checking && <span className="btn-spinner" aria-hidden="true" />}
                    {checking ? 'Checking…' : 'Continue'}
                    {!checking && <ArrowRight size={15} aria-hidden="true" />}
                  </button>
                  <Link to="/login" className="btn-register">Back to sign in</Link>
                </div>
              </div>
            ) : (
              <div className="step-in" key="password">
                <div className="form-group">
                  <label className="form-label" htmlFor="password">New Password <span className="req">*</span></label>
                  <div className="input-wrap password-wrap">
                    <span className="input-icon"><Lock /></span>
                    <input id="password" ref={pwRef} type={showPw ? 'text' : 'password'} className="form-input"
                      autoComplete="new-password" placeholder="8+ characters"
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

                <div>
                  <button type="submit" className={`btn-login${loading ? ' is-loading' : ''}`} disabled={loading}>
                    {loading && <span className="btn-spinner" aria-hidden="true" />}
                    {loading ? 'Resetting…' : 'Reset password'}
                    {!loading && <ArrowRight size={15} aria-hidden="true" />}
                  </button>
                  {resetKey ? (
                    <Link to="/login" className="btn-register">Back to sign in</Link>
                  ) : (
                    <button type="button" className="btn-register" onClick={() => { setStep('code'); setError(''); }}>Use a different code</button>
                  )}
                </div>
              </div>
            )}
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
