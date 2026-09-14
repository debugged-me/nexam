/**
 * AccountPage — profile view/edit and password change.
 *
 * Shows the current user's profile (name, email, role, verification status)
 * with forms to update name fields and change password.
 */
import { useEffect, useState } from 'react';
import { useToast } from '../components/Toast.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
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

  if (!profile) return <AppShell activeNav="account" pageTitle="Account"><p className="placeholder">Loading…</p></AppShell>;

  const initials = (profile.full_name || 'U').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <AppShell activeNav="account" pageTitle="Account">
      <div className="page-header"><h1>Account</h1></div>
          <div className="account-layout">
            {/* Profile card */}
            <div className="account-card">
              <div className="account-avatar">{initials}</div>
              <div className="account-name">{profile.full_name}</div>
              <div className="account-email">{profile.email}</div>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <span className="account-badge">{profile.role}</span>
                {profile.email_verified ? (
                  <span className="account-badge" style={{ marginLeft: 6, background: 'var(--green-50)', color: 'var(--green-700)' }}>Verified</span>
                ) : (
                  <span className="account-badge" style={{ marginLeft: 6, background: 'var(--amber-50)', color: 'var(--amber-700)' }}>Unverified</span>
                )}
              </div>
              <div className="account-info-row">
                <span className="account-info-label">Member since</span>
                <span className="account-info-value">{new Date(profile.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Edit forms */}
            <div>
              {/* Name section */}
              <div className="account-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h2 style={{ margin: 0 }}>Profile</h2>
                  {!editingName && (
                    <button className="btn" onClick={() => setEditingName(true)}>Edit</button>
                  )}
                </div>
                {editingName ? (
                  <form onSubmit={handleSaveName} noValidate>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">First Name <span className="req">*</span></label>
                        <input className="form-input" style={{ paddingLeft: 16 }} value={nameForm.first_name || ''} required
                          onChange={(e) => setNameForm({ ...nameForm, first_name: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Middle Name</label>
                        <input className="form-input" style={{ paddingLeft: 16 }} value={nameForm.middle_name || ''}
                          onChange={(e) => setNameForm({ ...nameForm, middle_name: e.target.value })} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Last Name <span className="req">*</span></label>
                        <input className="form-input" style={{ paddingLeft: 16 }} value={nameForm.last_name || ''} required
                          onChange={(e) => setNameForm({ ...nameForm, last_name: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Name Extension</label>
                        <input className="form-input" style={{ paddingLeft: 16 }} value={nameForm.name_ext || ''} placeholder="Jr., Sr., III"
                          onChange={(e) => setNameForm({ ...nameForm, name_ext: e.target.value })} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button type="button" className="btn" onClick={() => setEditingName(false)}>Cancel</button>
                      <button type="submit" className="btn btn-primary" disabled={savingName}>
                        {savingName && <span className="btn-spinner" />}Save
                      </button>
                    </div>
                  </form>
                ) : (
                  <div>
                    <div className="account-info-row"><span className="account-info-label">First Name</span><span className="account-info-value">{profile.first_name || '—'}</span></div>
                    <div className="account-info-row"><span className="account-info-label">Middle Name</span><span className="account-info-value">{profile.middle_name || '—'}</span></div>
                    <div className="account-info-row"><span className="account-info-label">Last Name</span><span className="account-info-value">{profile.last_name || '—'}</span></div>
                    <div className="account-info-row"><span className="account-info-label">Extension</span><span className="account-info-value">{profile.name_ext || '—'}</span></div>
                    <div className="account-info-row"><span className="account-info-label">Email</span><span className="account-info-value">{profile.email}</span></div>
                  </div>
                )}
              </div>

              {/* Password section */}
              <div className="account-section">
                <h2>Change Password</h2>
                <form onSubmit={handleChangePw} noValidate>
                  <div className="form-group">
                    <label className="form-label">Current Password <span className="req">*</span></label>
                    <input type="password" className="form-input" style={{ paddingLeft: 16 }} value={pwForm.current_password} required
                      onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })} />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">New Password <span className="req">*</span></label>
                      <input type="password" className="form-input" style={{ paddingLeft: 16 }} value={pwForm.new_password} minLength={8} required
                        onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Confirm New Password <span className="req">*</span></label>
                      <input type="password" className="form-input" style={{ paddingLeft: 16 }} value={pwForm.confirm} required
                        onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={savingPw}>
                    {savingPw && <span className="btn-spinner" />}Change password
                  </button>
                </form>
              </div>
            </div>
          </div>
    </AppShell>
  );
}
