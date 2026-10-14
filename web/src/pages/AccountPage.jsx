import '../styles/account.css';
/**
 * AccountPage — profile view/edit and password change.
 * Uses the PHP design system classes (card, form-group, form-control, etc.)
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import { PageLoader } from '../components/Loaders.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import UserAvatar from '../components/UserAvatar.jsx';
import AvatarPickerModal from '../components/AvatarPickerModal.jsx';
import { useLetterheadSrc, useLetterheadFootSrc } from '../lib/useLetterheadSrc.js';
import { Lock, Mail, Check, Save, Eye, EyeOff, Camera, Trash2, Palette, ShieldCheck, ScrollText, ArrowUpRight } from 'lucide-react';

function nameFormFrom(user) {
  return {
    first_name: user?.first_name || '',
    middle_name: user?.middle_name || '',
    last_name: user?.last_name || '',
    name_ext: user?.name_ext || '',
  };
}

export default function AccountPage() {
  const { refreshUser } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState(() => api.peek('/auth/me')?.user ?? null);
  const [editingName, setEditingName] = useState(false);
  const [nameForm, setNameForm] = useState(() => nameFormFrom(api.peek('/auth/me')?.user));
  const [savingName, setSavingName] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwShow, setPwShow] = useState({ current_password: false, new_password: false, confirm: false });
  const [savingPw, setSavingPw] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lhBusy, setLhBusy] = useState(false);
  const lhSrc = useLetterheadSrc(profile);
  const lhFootSrc = useLetterheadFootSrc(profile);

  function handlePhotoUploaded(result) {
    setProfile((p) => (p ? { ...p, has_avatar: 1, avatar_v: result.avatar_v } : p));
    refreshUser?.();
  }

  async function handleLetterheadPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLhBusy(true);
    try {
      const result = await api.uploadFile('/auth/letterhead', file);
      setProfile((p) => (p ? { ...p, has_letterhead: 1, letterhead_v: result.letterhead_v } : p));
      refreshUser?.();
      toast.success('Letterhead saved — it will head your printed exams and reports.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not upload the letterhead.');
    } finally {
      setLhBusy(false);
    }
  }

  async function handleLetterheadRemove() {
    setLhBusy(true);
    try {
      await api.del('/auth/letterhead');
      setProfile((p) => (p ? { ...p, has_letterhead: 0, letterhead_v: 0 } : p));
      refreshUser?.();
      toast.success('Letterhead removed — printouts use the default header again.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not remove the letterhead.');
    } finally {
      setLhBusy(false);
    }
  }

  async function handleFootPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLhBusy(true);
    try {
      const result = await api.uploadFile('/auth/letterhead-foot', file);
      setProfile((p) => (p ? { ...p, has_letterhead_foot: 1, letterhead_foot_v: result.letterhead_foot_v } : p));
      refreshUser?.();
      toast.success('Footer banner saved — it prints at the bottom of your documents.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not upload the footer banner.');
    } finally {
      setLhBusy(false);
    }
  }

  async function handleFootRemove() {
    setLhBusy(true);
    try {
      await api.del('/auth/letterhead-foot');
      setProfile((p) => (p ? { ...p, has_letterhead_foot: 0, letterhead_foot_v: 0 } : p));
      refreshUser?.();
      toast.success('Footer banner removed.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not remove the footer banner.');
    } finally {
      setLhBusy(false);
    }
  }

  async function handlePhotoRemove() {
    setPhotoBusy(true);
    try {
      await api.del('/auth/avatar');
      setProfile((p) => (p ? { ...p, has_avatar: 0, avatar_v: 0 } : p));
      refreshUser?.();
      toast.success('Profile photo removed.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not remove photo.');
    } finally {
      setPhotoBusy(false);
    }
  }

  useEffect(() => {
    api.get('/auth/me')
      .then((data) => {
        setProfile(data.user);
        setNameForm(nameFormFrom(data.user));
      })
      .catch((err) => toast.error(err.message || 'Could not load profile.'));
  }, [toast]);

  async function handleSaveName(e) {
    e.preventDefault();
    setSavingName(true);
    try {
      const result = await api.put('/auth/me', nameForm);
      setProfile(result.user);
      setEditingName(false);
      refreshUser?.();
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed.');
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangePw(e) {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) {
      toast.error('New passwords do not match.');
      return;
    }
    setSavingPw(true);
    try {
      await api.post('/auth/change-password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      toast.success('Password changed.');
      setPwForm({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Password change failed.');
    } finally {
      setSavingPw(false);
    }
  }

  if (!profile) return <AppShell pageClass="account" activeNav="account" pageTitle="Account"><PageLoader label="Loading your profile…" /></AppShell>;

  const roleLabel = { instructor: 'Instructor', admin: 'Administrator', superadmin: 'Superadmin' }[profile.role] || 'Instructor';

  return (
    <AppShell pageClass="account" activeNav="account" pageTitle="Account">

      {/* Identity hero */}
      <div className="card account-hero" data-tour="account-stats">
        <UserAvatar user={profile} className="avatar account-hero-avatar" />
        <div className="account-hero-meta">
          <h2 className="account-hero-name">{profile.full_name}</h2>
          <div className="account-hero-line">
            <Mail size={13} />
            <span>{profile.email}</span>
            {profile.email_verified
              ? <span className="badge badge-green">Verified</span>
              : <span className="badge badge-amber">Unverified</span>}
          </div>
          <div className="account-hero-line account-hero-line--sub">
            {roleLabel} · Member since {new Date(profile.created_at).toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <div className="account-hero-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={photoBusy}
            onClick={() => setPickerOpen(true)}
          >
            <Camera size={15} /> {profile.has_avatar ? 'Change photo' : 'Upload photo'}
          </button>
          {!!profile.has_avatar && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={photoBusy}
              onClick={handlePhotoRemove}
            >
              <Trash2 size={14} /> Remove
            </button>
          )}
          <Link to="/appearance" className="btn btn-outline btn-sm">
            <Palette size={15} /> Appearance
          </Link>
        </div>
        {pickerOpen && (
          <AvatarPickerModal
            onClose={() => setPickerOpen(false)}
            onUploaded={handlePhotoUploaded}
          />
        )}
      </div>

      <div className="detail-grid-2">

        {/* Profile card */}
        <div className="card" data-tour="account-profile">
          <div className="card-header">
            <span className="card-title">Profile</span>
            <div className="card-header-actions">
              {!editingName && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditingName(true)}>
                  <Lock size={16} /> Edit
                </button>
              )}
            </div>
          </div>
          <div className="card-body">
            {editingName ? (
              <form onSubmit={handleSaveName} noValidate>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">First Name <span className="req">*</span></label>
                    <input className="form-control" value={nameForm.first_name || ''} required
                      onChange={(e) => setNameForm({ ...nameForm, first_name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Middle Name</label>
                    <input className="form-control" value={nameForm.middle_name || ''}
                      onChange={(e) => setNameForm({ ...nameForm, middle_name: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Last Name <span className="req">*</span></label>
                    <input className="form-control" value={nameForm.last_name || ''} required
                      onChange={(e) => setNameForm({ ...nameForm, last_name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Name Extension</label>
                    <input className="form-control" value={nameForm.name_ext || ''} placeholder="Jr., Sr., III"
                      onChange={(e) => setNameForm({ ...nameForm, name_ext: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-control" value={profile.email} disabled />
                </div>
                <div className="form-actions form-actions--sticky">
                  <button type="submit" className="btn btn-primary" disabled={savingName}>
                    <Save size={16} /> {savingName ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => setEditingName(false)}>Cancel</button>
                </div>
              </form>
            ) : (
              <div className="table-wrap table-bare">
                <table className="data-table">
                  <tbody>
                    <tr><td className="text-muted">First Name</td><td>{profile.first_name || '—'}</td></tr>
                    <tr><td className="text-muted">Middle Name</td><td>{profile.middle_name || '—'}</td></tr>
                    <tr><td className="text-muted">Last Name</td><td>{profile.last_name || '—'}</td></tr>
                    <tr><td className="text-muted">Extension</td><td>{profile.name_ext || '—'}</td></tr>
                    <tr><td className="text-muted">Email</td><td>{profile.email}</td></tr>
                    <tr><td className="text-muted">Verified</td><td>{profile.email_verified ? <span className="badge badge-green">Yes</span> : <span className="badge badge-amber">No</span>}</td></tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Password card */}
        <div className="card" data-tour="account-password">
          <div className="card-header">
            <span className="card-title">Change Password</span>
          </div>
          <div className="card-body">
            <form onSubmit={handleChangePw} noValidate>
              {[
                { key: 'current_password', label: 'Current Password', auto: 'current-password' },
                { key: 'new_password', label: 'New Password', auto: 'new-password', hint: 'At least 8 characters' },
                { key: 'confirm', label: 'Confirm New Password', auto: 'new-password' },
              ].map((f) => (
                <div className="form-group" key={f.key}>
                  <label className="form-label">{f.label} <span className="req">*</span></label>
                  <div className="password-wrap">
                    <input
                      type={pwShow[f.key] ? 'text' : 'password'}
                      className="form-control"
                      value={pwForm[f.key]}
                      required
                      minLength={f.key === 'current_password' ? undefined : 8}
                      placeholder={f.hint}
                      autoComplete={f.auto}
                      onChange={(e) => setPwForm({ ...pwForm, [f.key]: e.target.value })}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setPwShow({ ...pwShow, [f.key]: !pwShow[f.key] })}
                      aria-label={pwShow[f.key] ? `Hide ${f.label}` : `Show ${f.label}`}
                    >
                      {pwShow[f.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              ))}
              <div className="form-actions form-actions--sticky">
                <button type="submit" className="btn btn-primary" disabled={savingPw}>
                  <Check size={16} /> {savingPw ? 'Changing…' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Print letterhead — mini paper preview, Appearance-style */}
        <div className="card account-letterhead-card" data-tour="account-letterhead">
          <div className="card-header">
            <span className="card-title">Print letterhead</span>
          </div>
          <div className="card-body">
            <div className="lh-layout">
              <div className="lh-doc" aria-hidden="true">
                {lhSrc
                  ? <img className="lh-doc-banner" src={lhSrc} alt="" />
                  : <div className="lh-doc-org">nexam — Faculty workspace</div>}
                <div className="lh-doc-title">Midterm Examination</div>
                <div className="lh-doc-meta">PE 3 — Physical Education · 60 minutes · 30 items · Set A</div>
                <div className="lh-doc-lines">
                  <i style={{ width: '96%' }} /><i style={{ width: '88%' }} /><i style={{ width: '70%' }} />
                </div>
                <div className="lh-doc-bubbles">
                  {['A', 'B', 'C', 'D'].map((l, i) => (
                    <span key={l} className={`lh-bub${i === 1 ? ' is-key' : ''}`}>{l}</span>
                  ))}
                </div>
                {lhFootSrc && <img className="lh-doc-footbanner" src={lhFootSrc} alt="" />}
              </div>
              <div className="lh-side">
                <p>
                  Banner images printed at the top — and optionally the bottom —
                  of your exam papers, answer keys, and reports. The header
                  replaces the default nexam title block.
                </p>
                <div className="lh-controls">
                  <div className="lh-control">
                    <div className="lh-control-meta">
                      <strong>Header banner</strong>
                      <small>Shown above the document title.</small>
                    </div>
                    <div className="lh-control-btns">
                      <label className={`btn btn-outline btn-sm${lhBusy ? ' is-disabled' : ''}`}>
                        <Camera size={15} /> {profile.has_letterhead ? 'Change' : 'Upload'}
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden disabled={lhBusy} onChange={handleLetterheadPick} />
                      </label>
                      {!!profile.has_letterhead && (
                        <button type="button" className="btn btn-ghost btn-sm" disabled={lhBusy} onClick={handleLetterheadRemove}>
                          <Trash2 size={14} /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="lh-control">
                    <div className="lh-control-meta">
                      <strong>Footer banner <small className="lh-optional">optional</small></strong>
                      <small>Printed under the footer line.</small>
                    </div>
                    <div className="lh-control-btns">
                      <label className={`btn btn-outline btn-sm${lhBusy ? ' is-disabled' : ''}`}>
                        <Camera size={15} /> {profile.has_letterhead_foot ? 'Change' : 'Upload'}
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden disabled={lhBusy} onChange={handleFootPick} />
                      </label>
                      {!!profile.has_letterhead_foot && (
                        <button type="button" className="btn btn-ghost btn-sm" disabled={lhBusy} onClick={handleFootRemove}>
                          <Trash2 size={14} /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <ul className="lh-notes">
                  <li>Wide banner images look best (roughly 4:1 or wider).</li>
                  <li>PNG, JPG, WebP, or GIF — up to 5 MB.</li>
                  <li>Only you see and print your letterhead.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy & terms — always reachable so the AI/data story stays
            reviewable, not buried in a signup checkbox. */}
        <div className="card" data-tour="account-legal">
          <div className="card-header">
            <span className="card-title">Privacy &amp; terms</span>
          </div>
          <div className="card-body account-legal">
            <p>
              Nexam is AI-assisted. Your uploads stay private to your account and
              are used only to ground your own questions — never to train outside
              models or to serve other instructors.
            </p>
            <div className="account-legal-links">
              <Link to="/privacy" className="account-legal-link">
                <span className="account-legal-ico"><ShieldCheck size={16} /></span>
                <span className="account-legal-copy">
                  <strong>Data Privacy Notice</strong>
                  <small>What we collect, how AI features use it, and your choices.</small>
                </span>
                <ArrowUpRight size={14} />
              </Link>
              <Link to="/terms" className="account-legal-link">
                <span className="account-legal-ico"><ScrollText size={16} /></span>
                <span className="account-legal-copy">
                  <strong>Terms of Use</strong>
                  <small>Who may use it, acceptable use, and how AI drafting works.</small>
                </span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </div>

      </div>

    </AppShell>
  );
}
