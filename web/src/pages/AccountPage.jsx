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
import { User, Lock, Mail, Calendar, Check, Save, Eye, EyeOff, Camera, Trash2, Palette } from 'lucide-react';

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

  function handlePhotoUploaded(result) {
    setProfile((p) => (p ? { ...p, has_avatar: 1, avatar_v: result.avatar_v } : p));
    refreshUser?.();
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

  const initials = (profile.full_name || 'U').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <AppShell pageClass="account" activeNav="account" pageTitle="Account">

      <div className="page-header">
        <div>
          <span className="eyebrow">Settings</span>
          <h1>Account</h1>
          <p className="page-sub">Manage your profile and password.</p>
        </div>
        <Link to="/appearance" className="btn btn-outline btn-sm">
          <Palette size={15} /> Appearance
        </Link>
      </div>

      {/* Profile summary stats */}
      <div className="stats-grid mb-3">
        <div className="stat-card">
          <div className="stat-icon blue"><User size={20} /></div>
          <div className="stat-info">
            <div className="stat-value stat-value-sm" title={profile.full_name}>{profile.full_name}</div>
            <div className="stat-label">Name</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Mail size={20} /></div>
          <div className="stat-info">
            <div className="stat-value stat-value-sm stat-value-literal" title={profile.email}>{profile.email}</div>
            <div className="stat-label">Email{profile.email_verified ? ' (Verified)' : ''}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><Calendar size={20} /></div>
          <div className="stat-info">
            <div className="stat-value stat-value-sm">{new Date(profile.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            <div className="stat-label">Member Since</div>
          </div>
        </div>
      </div>

      <div className="detail-grid-2">

        {/* Profile card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Profile</span>
            {!editingName && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditingName(true)}>
                <Lock size={16} /> Edit
              </button>
            )}
          </div>
          <div className="card-body">
            <div className="account-photo-row">
              <UserAvatar user={profile} className="avatar account-photo" />
              <div className="account-photo-meta">
                <strong>Profile photo</strong>
              </div>
              <div className="account-photo-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={photoBusy}
                  onClick={() => setPickerOpen(true)}
                >
                  <Camera size={15} /> {profile.has_avatar ? 'Change' : 'Upload'}
                </button>
                {!!profile.has_avatar && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={photoBusy}
                    onClick={handlePhotoRemove}
                  >
                    <Trash2 size={15} /> Remove
                  </button>
                )}
              </div>
              {pickerOpen && (
                <AvatarPickerModal
                  onClose={() => setPickerOpen(false)}
                  onUploaded={handlePhotoUploaded}
                />
              )}
            </div>
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
        <div className="card">
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

      </div>

    </AppShell>
  );
}
