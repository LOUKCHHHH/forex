import React, { useState } from 'react';
import { KeyRound, Save, UserRound } from 'lucide-react';

export function ProfilePage({ username, onSave }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState(username);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSaved(false);
    const nextUsername = newUsername.trim();
    if (!nextUsername) return setError('Enter a username.');
    if (newPassword.length < 6) return setError('Choose a password with at least 6 characters.');
    if (newPassword !== confirmPassword) return setError('The new passwords do not match.');
    setSaving(true);
    try {
      await onSave({ currentPassword, username: nextUsername, newPassword });
      setNewUsername(nextUsername);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Could not update shared login. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return <>
    <div className="date-line">SHARED ACCOUNT SETTINGS</div>
    <h1>Your profile<span>.</span></h1>
    <p className="intro">Changes here update the shared login for everyone using this dashboard.</p>
    <section className="profile-panel">
      <div className="profile-heading"><span className="profile-icon"><UserRound size={20}/></span><div><small>SHARED LOGIN</small><h2>Update credentials</h2></div></div>
      <form className="profile-form" onSubmit={submit}>
        <label>USERNAME<input autoComplete="username" value={newUsername} onChange={event => setNewUsername(event.target.value)} maxLength={40} required/></label>
        <label>CURRENT PASSWORD<input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required/></label>
        <div className="profile-divider"><KeyRound size={15}/> NEW PASSWORD</div>
        <label>NEW PASSWORD<input type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={6} maxLength={200} required/><small>Use at least 6 characters.</small></label>
        <label>CONFIRM NEW PASSWORD<input type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={6} maxLength={200} required/></label>
        {error&&<p className="profile-message error" role="alert">{error}</p>}
        {saved&&<p className="profile-message success" role="status">Shared login updated. Other users will need the new username and password the next time they sign in.</p>}
        <button className="profile-save" type="submit" disabled={saving}>{saving?'Saving…':<><Save size={15}/> Save changes</>}</button>
      </form>
    </section>
    <p className="profile-storage-note">Credentials are stored in the shared cloud database, with the password saved as a one-way hash. This is for a shared personal dashboard, not high-security account access.</p>
  </>;
}
