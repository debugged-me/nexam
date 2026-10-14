import '../../styles/auth-shared.css';
/**
 * RegisterPage — create an instructor account.
 *
 * On success, the API returns a verifyToken (short-lived JWT) + email.
 * We navigate to /verify carrying both, so the verify page can call
 * /auth/verify without a session.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail, Lock, Eye, EyeOff, AlertCircle, User, ArrowRight,
} from 'lucide-react';
import api, { ApiError } from '../../lib/api.js';
import Recaptcha from '../../components/Recaptcha.jsx';
import { useAuthEntrance } from './authEntrance.js';
import AuthGlow from './AuthGlow.jsx';
import { OmrSheet } from '../../components/omr.jsx';

export default function RegisterPage() {
  const navigate = useNavigate();
  const pageRef = useRef(null);
  useAuthEntrance(pageRef);

  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '', name_ext: '',
    email: '', password: '', confirm_password: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaSiteKey, setCaptchaSiteKey] = useState(null);
  const captchaRef = useRef(null);

  useEffect(() => {
    api.get('/auth/captcha')
      .then((d) => setCaptchaSiteKey(d.siteKey || null))
      .catch(() => setCaptchaSiteKey(null));
  }, []);

  function set(k) { return (e) => setForm((f) => ({ ...f, [k]: e.target.value })); }

  async function doRegister(token) {
    setLoading(true);
    try {
      const data = await api.post('/auth/register', {
        first_name: form.first_name,
        middle_name: form.middle_name || undefined,
        last_name: form.last_name,
        name_ext: form.name_ext || undefined,
        email: form.email,
        password: form.password,
        client: 'web',
        captchaToken: token || undefined,
      });
      navigate('/verify', {
        state: { verifyToken: data.verifyToken, email: data.email },
      });
    } catch (err) {
      captchaRef.current?.reset();
      setError(err instanceof ApiError ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Invisible reCAPTCHA resolves (or challenges) on execute() and hands the
  // token back through this callback — registration only starts from here.
  function onCaptcha(token) {
    if (!token) {
      setLoading(false);
      setError('Security check failed — please try again.');
      return;
    }
    doRegister(token);
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (captchaSiteKey) {
      if (!captchaRef.current?.isReady?.()) {
        setError('Security check is still loading — try again in a moment.');
        return;
      }
      setLoading(true); // challenge is in flight; onCaptcha or error lands next
      captchaRef.current.execute();
      return;
    }
    doRegister('');
  }

  return (
    <div className="auth-page auth-page-register page--auth-register" ref={pageRef}>
      <AuthGlow />
      <a href="#register-form" className="skip-link">Skip to registration form</a>

      <div className="auth-shell">
        {/* Brand side */}
        <aside className="auth-side">
          <div className="auth-side-brand anim-in">
            <img src="/favicon.png" alt="" />
            <span>nexam</span>
          </div>
          <h2 className="anim-in">Your materials<br /><em>become the exam.</em></h2>
          <p className="auth-side-tag anim-in">
            Create an instructor account — verify your email to get started.
          </p>
          <ol className="auth-steps">
            <li className="anim-in">
              <i>01</i>
              <span>
                <strong>Upload your materials</strong>
                <small>Syllabus, notes, and references</small>
              </span>
            </li>
            <li className="anim-in">
              <i>02</i>
              <span>
                <strong>Review grounded drafts</strong>
                <small>Every item cites its source passage</small>
              </span>
            </li>
            <li className="anim-in">
              <i>03</i>
              <span>
                <strong>Print and score</strong>
                <small>Set A + Set B with QR-linked OMR keys</small>
              </span>
            </li>
          </ol>
          <OmrSheet className="auth-omr" rows={3} />
        </aside>

        {/* Form card */}
        <main className="auth-card">
          <form id="register-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-card-brand anim-in">
              <img src="/favicon.png" alt="" />
              <span>nexam</span>
            </div>
            <div className="auth-heading anim-in">
              <h1>Create your account</h1>
              <p>Instructor access — verify your email to get started.</p>
            </div>

            {error && (
              <div className="form-alert anim-in" role="alert">
                <AlertCircle />
                <span>{error}</span>
              </div>
            )}

            <div className="form-row anim-in">
              <div className="form-group">
                <label className="form-label" htmlFor="first_name">First Name <span className="req">*</span></label>
                <div className="input-wrap">
                  <span className="input-icon"><User /></span>
                  <input id="first_name" className="form-input" value={form.first_name}
                    onChange={set('first_name')} maxLength={100} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="last_name">Last Name <span className="req">*</span></label>
                <div className="input-wrap">
                  <span className="input-icon"><User /></span>
                  <input id="last_name" className="form-input" value={form.last_name}
                    onChange={set('last_name')} maxLength={100} required />
                </div>
              </div>
            </div>

            <div className="form-row-ext anim-in">
              <div className="form-group">
                <label className="form-label" htmlFor="middle_name">
                  Middle Name <span className="field-optional">(optional)</span>
                </label>
                <div className="input-wrap">
                  <span className="input-icon"><User /></span>
                  <input id="middle_name" className="form-input" value={form.middle_name}
                    onChange={set('middle_name')} maxLength={100} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="name_ext">
                  Ext. <span className="field-optional">(optional)</span>
                </label>
                <div className="input-wrap input-wrap-select">
                  <select id="name_ext" className="form-select" value={form.name_ext} onChange={set('name_ext')}>
                    <option value="">—</option>
                    <option value="Jr.">Jr.</option>
                    <option value="Sr.">Sr.</option>
                    <option value="II">II</option>
                    <option value="III">III</option>
                    <option value="IV">IV</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-group anim-in">
              <label className="form-label" htmlFor="email">Email <span className="req">*</span></label>
              <div className="input-wrap">
                <span className="input-icon"><Mail /></span>
                <input id="email" type="email" className="form-input" autoComplete="email"
                  placeholder="you@school.edu" value={form.email} onChange={set('email')} maxLength={255} required />
              </div>
            </div>

            <div className="form-row anim-in">
              <div className="form-group">
                <label className="form-label" htmlFor="password">Password <span className="req">*</span></label>
                <div className="input-wrap password-wrap">
                  <span className="input-icon"><Lock /></span>
                  <input id="password" type={showPw ? 'text' : 'password'} className="form-input"
                    autoComplete="new-password" placeholder="8+ characters"
                    value={form.password} onChange={set('password')} maxLength={128} required />
                  <button type="button" className="password-toggle" onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="confirm_password">Confirm <span className="req">*</span></label>
                <div className="input-wrap">
                  <span className="input-icon"><Lock /></span>
                  <input id="confirm_password" type={showPw ? 'text' : 'password'} className="form-input"
                    autoComplete="new-password" placeholder="Re-enter password"
                    value={form.confirm_password} onChange={set('confirm_password')} maxLength={128} required />
                </div>
              </div>
            </div>

            <div className="anim-in">
              <button type="submit" className={`btn-login${loading ? ' is-loading' : ''}`} disabled={loading}>
                {loading && <span className="btn-spinner" aria-hidden="true" />}
                {loading ? 'Creating account…' : 'Create account'}
                {!loading && <ArrowRight size={15} aria-hidden="true" />}
              </button>
              <Link to="/login" className="btn-register">Back to sign in</Link>
            </div>

          </form>

          <div className="auth-card-foot">
            <span>Already have an account?</span>
            <Link to="/login" className="auth-foot-link">Sign in</Link>
          </div>
          <div className="auth-legal">
            <Link to="/privacy">Data Privacy</Link>
            <span aria-hidden="true">·</span>
            <Link to="/terms">Terms of Use</Link>
          </div>
        </main>
      </div>

      {/* Invisible captcha mounts outside .auth-shell — GSAP transforms the
          shell during the entrance, and a transformed ancestor would trap
          the badge's fixed positioning inside the card instead of the
          viewport corner. */}
      {captchaSiteKey && (
        <Recaptcha ref={captchaRef} siteKey={captchaSiteKey} invisible onChange={onCaptcha} />
      )}
    </div>
  );
}
