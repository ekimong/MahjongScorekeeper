import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      console.error('login error:', err);
      setError(err.message || 'Sign-in failed.');
    }
  }

  async function handleResetPassword() {
    if (!email) {
      setError('Enter your email above first, then click Forgot password.');
      return;
    }
    setResetting(true);
    setError('');
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setResetting(false);
    }
  }

  async function handleGoogle() {
    setError('');
    try {
      await loginWithGoogle();
      navigate('/');
    } catch {
      setError('Google sign-in failed.');
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">🀄 Mahjong Scorekeeper</h1>
        <h2>Sign in</h2>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button type="submit" className="btn-primary">Sign in</button>
        </form>
        {resetSent
          ? <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>Password reset email sent to <strong>{email}</strong>.</p>
          : <button type="button" className="link-btn" onClick={handleResetPassword} disabled={resetting}>
              {resetting ? 'Sending…' : 'Forgot password?'}
            </button>
        }
        <button onClick={handleGoogle} className="btn-google">Sign in with Google</button>
        <p className="auth-switch">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
