import { useState } from 'react';

export default function TableSetupModal({ onConfirm, onClose, onStartNewRound, currentUser }) {
  const [players, setPlayers] = useState([
    { name: currentUser?.displayName || '', uid: currentUser?.uid || null },
    { name: '', uid: null },
    { name: '', uid: null },
    { name: '', uid: null },
  ]);

  function setName(i, val) {
    setPlayers((prev) => prev.map((p, idx) => idx === i ? { ...p, name: val } : p));
  }

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!players.some((p) => p.name.trim())) return;
    setSaving(true);
    setError('');
    try {
      await onConfirm(players.map((p) => ({ name: p.name.trim(), uid: p.uid || null })));
    } catch (err) {
      setError(err.message || 'Failed to create table.');
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Set up table</h2>
        <p className="muted">Enter player names. Leave a slot blank to create a ghost player.</p>
        <form onSubmit={handleSubmit}>
          {players.map((p, i) => (
            <label key={i}>
              Player {i + 1}
              <input
                value={p.name}
                onChange={(e) => setName(i, e.target.value)}
                placeholder={i === 0 ? 'You' : ''}
              />
            </label>
          ))}
          {error && (
            <div>
              <p className="error">{error}</p>
              {onStartNewRound && (
                <button
                  type="button"
                  className="btn-primary mt"
                  onClick={onStartNewRound}
                  disabled={saving}
                >
                  Yes, start a new round
                </button>
              )}
            </div>
          )}
          <div className="btn-group mt">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            {!onStartNewRound && (
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Creating…' : 'Start table'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
