import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserHistory } from '../lib/firestore';

export default function History() {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserHistory(user.uid).then((h) => {
      setHistory(h);
      setLoading(false);
    });
  }, [user.uid]);

  const totalWins = history.length;
  const totalPoints = history.reduce((sum, h) => sum + (h.points || 0), 0);

  // Frequency by hand name
  const handCounts = {};
  history.forEach((h) => {
    if (h.handName) {
      handCounts[h.handName] = (handCounts[h.handName] || 0) + 1;
    }
  });
  const topHands = Object.entries(handCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/" className="back-link">← Dashboard</Link>
          <h1>My hand history</h1>
        </div>
      </header>

      <main className="page-main">
        <section className="card stats-row">
          <div className="stat">
            <span className="stat-value">{totalWins}</span>
            <span className="stat-label">Wins tracked</span>
          </div>
          <div className="stat">
            <span className={`stat-value ${totalPoints >= 0 ? 'positive' : 'negative'}`}>
              {totalPoints}
            </span>
            <span className="stat-label">Total points won</span>
          </div>
        </section>

        {topHands.length > 0 && (
          <section className="card">
            <h2>Top hands</h2>
            <ul className="top-hands">
              {topHands.map(([name, count]) => (
                <li key={name}>
                  <span>{name}</span>
                  <span className="muted">{count}×</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card">
          <h2>Win history</h2>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : history.length === 0 ? (
            <p className="muted">No wins recorded yet. Start playing!</p>
          ) : (
            <ul className="history-list">
              {history.map((h) => (
                <li key={h.id} className="history-item">
                  <div>
                    <span className="history-hand">{h.handName || 'Unknown hand'}</span>
                    <span className="muted small"> · {h.eventName}</span>
                  </div>
                  <span className="positive">{h.points}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
