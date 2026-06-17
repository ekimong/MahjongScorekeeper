import { useState } from 'react';

export default function TableSetupModal({ onConfirm, onClose, currentUser }) {
  const [players, setPlayers] = useState([
    { name: currentUser?.displayName || '', uid: currentUser?.uid || null },
    { name: '', uid: null },
    { name: '', uid: null },
    { name: '', uid: null },
  ]);

  function setName(i, val) {
    setPlayers((prev) => prev.map((p, idx) => idx === i ? { ...p, name: val } : p));
  }

  function handleSubmit(e) {
    e.preventDefault();
    // At least one named player required
    if (!players.some((p) => p.name.trim())) return;
    onConfirm(players.map((p) => ({ name: p.name.trim(), uid: p.uid || null })));
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
                placeholder={i === 0 ? 'You' : 'Ghost (leave blank)'}
              />
            </label>
          ))}
          <div className="btn-group mt">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Start table</button>
          </div>
        </form>
      </div>
    </div>
  );
}
