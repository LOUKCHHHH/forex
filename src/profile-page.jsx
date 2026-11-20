import React, { useState } from 'react';
import { KeyRound, Save, UserRound } from 'lucide-react';

export function ProfilePage({ credentials, onSave }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState(credentials.username);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function submit(event) {
    event.preventDefault();
    setError('');
    setSaved(false);
    const username = newUsername.trim();
    if (currentPassword !== credentials.password) return setError('Current password is incorrect.');
    if (!username) return setError('Enter a username.');
    if (newPassword.length < 6) return setError('Choose a password with at least 6 characters.');
    if (newPassword !== confirmPassword) return setError('The new passwords do not match.');
    try {
      onSave({ username, password: newPassword });
      setNewUsername(username);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
    } catch {
      setError('Could not save changes in this browser. Check browser storage settings and try again.');
    }
  }

  return <>
    <div className="date-line">PERSONAL SETTINGS</div>
    <h1>Your profile<span>.</span></h1>
    <p className="intro">Change the username and password used to sign in to this browser.</p>
    <section className="profile-panel">
      <div className="profile-heading"><span className="profile-icon"><UserRound size={20}/></span><div><small>LOGIN DETAILS</small><h2>Update credentials</h2></div></div>
      <form className="profile-form" onSubmit={submit}>
        <label>USERNAME<input autoComplete="username" value={newUsername} onChange={event => setNewUsername(event.target.value)} required/></label>
        <label>CURRENT PASSWORD<input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required/></label>
        <div className="profile-divider"><KeyRound size={15}/> NEW PASSWORD</div>
        <label>NEW PASSWORD<input type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={6} required/><small>Use at least 6 characters.</small></label>
        <label>CONFIRM NEW PASSWORD<input type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={6} required/></label>
        {error&&<p className="profile-message error" role="alert">{error}</p>}
        {saved&&<p className="profile-message success" role="status">Login details updated. Use the new credentials next time you sign in.</p>}
        <button className="profile-save" type="submit"><Save size={15}/> Save changes</button>
      </form>
    </section>
    <p className="profile-storage-note">These credentials are stored in this browser only. They won’t sync to other devices, and this personal-use login is not secure account authentication.</p>
  </>;
}
