import { useState } from 'react';
import { Link } from 'react-router-dom';
import { updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await updateProfile(auth.currentUser, { displayName: displayName.trim() });
      await setDoc(doc(db, 'users', user.uid), { displayName: displayName.trim() }, { merge: true });
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/" className="back-link">← Events</Link>
          <h1>Profile</h1>
        </div>
      </header>

      <main className="page-main">
        <section className="card">
          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              Email
              <input type="email" value={user?.email || ''} disabled />
            </label>
            <label>
              Name
              <input
                type="text"
                value={displayName}
                onChange={(e) => { setDisplayName(e.target.value); setSaved(false); }}
                placeholder="Your name"
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            {saved && <p className="success">Saved.</p>}
            <button type="submit" className="btn-primary" disabled={saving || !displayName.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
