import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getEvent, getTables, getEventGames, createTable, ensureEditToken } from '../lib/firestore';
import { useEdit } from '../context/EditContext';
import TableSetupModal from '../components/GameSetupModal';

export default function EventPage() {
  const { eventId } = useParams();
  const { user } = useAuth();
  const { canEdit } = useEdit();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [tables, setTables] = useState([]);
  const [totals, setTotals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalsLoading, setTotalsLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);

  const isOrganizer = user && event && event.createdBy === user.uid;
  const isPlayer = tables.some((t) => t.players?.some((p) => p.uid === user?.uid));
  const canScore = isOrganizer || isPlayer || canEdit(eventId);

  const shareUrl = event ? `${window.location.origin}/join/${event.shareToken}` : '';
  const editUrl = event?.editToken ? `${window.location.origin}/edit/${event.editToken}` : '';

  useEffect(() => {
    load();
  }, [eventId]);

  async function load() {
    // Kick off all three fetches simultaneously
    const [evtResult, tbls, allGames] = await Promise.all([
      getEvent(eventId),
      getTables(eventId),
      getEventGames(eventId),
    ]);

    let evt = evtResult;
    if (evt && !evt.editToken) {
      const token = await ensureEditToken(eventId);
      evt = { ...evt, editToken: token };
    }
    setEvent(evt);
    setTables(tbls);
    setLoading(false);

    // Compute totals from already-fetched games — no extra round trips
    computeTotals(tbls, allGames);
  }

  function computeTotals(tbls, allGames) {
    const playersByTable = {};
    tbls.forEach((t) => { playersByTable[t.id] = t.players || []; });

    const scoreMap = {};
    allGames.forEach((game) => {
      if (!game.scores) return;
      const players = playersByTable[game.tableId] || [];
      players.forEach((player, i) => {
        if (!player.name?.trim()) return;
        const key = player.name.trim().toLowerCase();
        if (!scoreMap[key]) scoreMap[key] = { name: player.name, points: 0, wins: 0, games: 0 };
        scoreMap[key].points += game.scores[i] || 0;
        scoreMap[key].games += 1;
        if (!game.isWallGame && game.winnerId === i) scoreMap[key].wins += 1;
      });
    });

    const sorted = Object.values(scoreMap).sort((a, b) => b.points - a.points);
    setTotals(sorted);
    setTotalsLoading(false);
  }

  async function handleTableCreated(players) {
    const { tableId } = await createTable(eventId, players);
    setShowSetup(false);
    navigate(`/event/${eventId}/table/${tableId}`);
  }

  if (loading) return <div className="loading">Loading…</div>;
  if (!event) return <div className="page"><p>Event not found.</p></div>;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/" className="back-link">← Events</Link>
          <h1>{event.name}</h1>
        </div>
        {canScore && (
          <button className="btn-primary" onClick={() => setShowSetup(true)}>
            + Add table
          </button>
        )}
      </header>

      <main className="page-main">
        {isOrganizer && (
          <section className="card">
            <div className="link-row">
              <span className="link-label">View-only link</span>
              <code className="share-link">{shareUrl}</code>
              <button className="btn-secondary btn-sm" onClick={() => navigator.clipboard.writeText(shareUrl)}>Copy</button>
            </div>
            <div className="link-row" style={{ marginTop: 10 }}>
              <span className="link-label">Edit link</span>
              <code className="share-link">{editUrl}</code>
              <button className="btn-secondary btn-sm" onClick={() => navigator.clipboard.writeText(editUrl)}>Copy</button>
            </div>
          </section>
        )}

        {tables.length === 0 ? (
          <section className="card">
            <p className="muted">No tables yet. {canScore ? 'Add a table to get started.' : ''}</p>
          </section>
        ) : (
          <section className="card">
            <h2>Tables</h2>
            <ul className="table-list">
              {tables.map((table, idx) => (
                <li key={table.id}>
                  <Link to={`/event/${eventId}/table/${table.id}`} className="table-link">
                    <div className="table-link-left">
                      <span className="table-num">Table {idx + 1}</span>
                      <span className="table-players">
                        {table.players?.map((p) => p.name).join(', ')}
                      </span>
                    </div>
                    <span className="table-arrow">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(totalsLoading || totals.length > 0) && (
          <section className="card">
            <h2>Total scores</h2>
            {totalsLoading && <p className="muted">Loading scores…</p>}
            {!totalsLoading && <table className="score-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th className="num">Games</th>
                  <th className="num">Wins</th>
                  <th className="num">Points</th>
                </tr>
              </thead>
              <tbody>
                {totals.map((row, i) => (
                  <tr key={i} className={i === 0 ? 'leader' : ''}>
                    <td>{row.name}</td>
                    <td className="num">{row.games}</td>
                    <td className="num">{row.wins}</td>
                    <td className={`num ${row.points > 0 ? 'positive' : row.points < 0 ? 'negative' : ''}`}>
                      {row.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>}
          </section>
        )}
      </main>

      {showSetup && (
        <TableSetupModal
          onConfirm={handleTableCreated}
          onClose={() => setShowSetup(false)}
          currentUser={user}
        />
      )}
    </div>
  );
}
