/**
 * RegisterPage — create an instructor account.
 *
 * On success, the API returns a verifyToken (short-lived JWT) + email.
 * We navigate to /verify carrying both, so the verify page can call
 * /auth/verify without a session.
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail, Lock, Eye, EyeOff, AlertCircle, GraduationCap, ShieldCheck, User,
} from 'lucide-react';
import api, { ApiError } from '../../lib/api.js';

export default function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '', name_ext: '',
    email: '', password: '', confirm_password: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(k) { return (e) => setForm((f) => ({ ...f, [k]: e.target.value })); }

  async function handleSubmit(e) {
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

    setLoading(true);
    try {
      const data = await api.post('/auth/register', {
        first_name: form.first_name,
        middle_name: form.middle_name || undefined,
        last_name: form.last_name,
        name_ext: form.name_ext || undefined,
        email: form.email,
        password: form.password,
      });
      navigate('/verify', {
        state: { verifyToken: data.verifyToken, email: data.email },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page auth-page-register">
      <a href="#register-form" className="skip-link">Skip to registration form</a>
      <div className="auth-wrap">
        {/* Brand panel */}
        <div className="auth-panel">
          <span className="panel-badge">New Account</span>
          <div className="panel-title">
            Join nexam<em>and let your materials build the exam.</em>
          </div>
          <p className="panel-tagline">
            Upload your syllabus and lecture notes. Nexam drafts objective items
            grounded in your content, checks them for similarity, and assembles
            print-ready exams aligned to your Table of Specifications.
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
          <form id="register-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-logo">
              <span className="logo-mark"><ShieldCheck /></span>
              <span>nexam</span>
            </div>
            <div className="auth-heading">
              <h1>Create your account</h1>
              <p>Instructor access — verify your email to get started.</p>
            </div>

            {error && (
              <div className="form-alert" role="alert">
                <AlertCircle />
                <span>{error}</span>
              </div>
            )}

            <div className="form-row">
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

            <div className="form-row-ext">
              <div className="form-group form-group-ext">
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

            <div className="form-group">
              <label className="form-label" htmlFor="email">Email <span className="req">*</span></label>
              <div className="input-wrap">
                <span className="input-icon"><Mail /></span>
                <input id="email" type="email" className="form-input" autoComplete="email"
                  placeholder="you@school.edu" value={form.email} onChange={set('email')} maxLength={255} required />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="password">Password <span className="req">*</span></label>
                <div className="input-wrap password-wrap">
                  <span className="input-icon"><Lock /></span>
                  <input id="password" type={showPw ? 'text' : 'password'} className="form-input"
                    autoComplete="new-password" placeholder="Min. 8 characters"
                    value={form.password} onChange={set('password')} maxLength={128} required />
                  <button type="button" className="password-toggle" onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="confirm_password">Confirm Password <span className="req">*</span></label>
                <div className="input-wrap">
                  <span className="input-icon"><Lock /></span>
                  <input id="confirm_password" type={showPw ? 'text' : 'password'} className="form-input"
                    autoComplete="new-password" placeholder="Re-enter password"
                    value={form.confirm_password} onChange={set('confirm_password')} maxLength={128} required />
                </div>
              </div>
            </div>

            <div className="btn-row-stacked">
              <button type="submit" className={`btn-login ${loading ? 'is-loading' : ''}`} disabled={loading}>
                {loading && <span className="btn-spinner" aria-hidden="true" />}
                {loading ? 'Creating account…' : 'Create account'}
              </button>
              <Link to="/login" className="btn-register">Back to sign in</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
