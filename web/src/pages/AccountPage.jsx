/**
 * AccountPage — profile view/edit and password change.
 * Uses the PHP design system classes (card, form-group, form-control, etc.)
 */
import { useEffect, useState } from 'react';
import { useToast } from '../components/Toast.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { User, Lock, Mail, Calendar, Check, Save } from 'lucide-react';
import '../styles/account.css';

export default function AccountPage() {
  const { refreshUser } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameForm, setNameForm] = useState({});
  const [savingName, setSavingName] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    api.get('/auth/me')
      .then((data) => {
        setProfile(data.user);
        setNameForm({
          first_name: data.user.first_name || '',
          middle_name: data.user.middle_name || '',
          last_name: data.user.last_name || '',
          name_ext: data.user.name_ext || '',
        });
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

  if (!profile) return <AppShell activeNav="account" pageTitle="Account"><div className="page-content"><p className="text-muted">Loading…</p></div></AppShell>;

  const initials = (profile.full_name || 'U').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <AppShell activeNav="account" pageTitle="Account">
      <div className="page-content">

        <div className="page-header">
          <div>
            <h1>Account</h1>
            <p className="page-sub">Manage your profile and password.</p>
          </div>
        </div>

        {/* Profile summary stats */}
        <div className="stats-grid mb-3">
          <div className="stat-card">
            <div className="stat-icon blue"><User size={20} /></div>
            <div className="stat-info">
              <div className="stat-value stat-value-sm">{profile.full_name}</div>
              <div className="stat-label">Name</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><Mail size={20} /></div>
            <div className="stat-info">
              <div className="stat-value stat-value-sm">{profile.email}</div>
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
                <div className="form-group">
                  <label className="form-label">Current Password <span className="req">*</span></label>
                  <input type="password" className="form-control" value={pwForm.current_password} required
                    onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">New Password <span className="req">*</span></label>
                  <input type="password" className="form-control" value={pwForm.new_password} minLength={8} required
                    placeholder="At least 8 characters"
                    onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password <span className="req">*</span></label>
                  <input type="password" className="form-control" value={pwForm.confirm} required
                    onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} />
                </div>
                <div className="form-actions form-actions--sticky">
                  <button type="submit" className="btn btn-primary" disabled={savingPw}>
                    <Check size={16} /> {savingPw ? 'Changing…' : 'Change Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>

        </div>

      </div>
    </AppShell>
  );
}
