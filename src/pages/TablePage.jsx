import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getEvent, getTable, getRounds, getGames, completeRound, createRound, deleteTable, deleteRound } from '../lib/firestore';
import { useEdit } from '../context/EditContext';

export default function TablePage() {
  const { eventId, tableId } = useParams();
  const { user } = useAuth();
  const { canEdit } = useEdit();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [table, setTable] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [gamesByRound, setGamesByRound] = useState({});
  const [loading, setLoading] = useState(true);

  const canScore = !!user || canEdit(eventId);

  useEffect(() => {
    load();
  }, [eventId, tableId]);

  async function load() {
    const [evt, tbl, rds] = await Promise.all([
      getEvent(eventId),
      getTable(eventId, tableId),
      getRounds(eventId, tableId),
    ]);
    setEvent(evt);
    setTable(tbl);
    setRounds(rds);

    const gamesMap = {};
    await Promise.all(
      rds.map(async (round) => {
        gamesMap[round.id] = await getGames(eventId, tableId, round.id);
      })
    );
    setGamesByRound(gamesMap);
    setLoading(false);
  }

  async function handleCompleteRound(roundId) {
    await completeRound(eventId, tableId, roundId);
    load();
  }

  async function handleDeleteTable() {
    if (!window.confirm('Delete this table and all its games? This cannot be undone.')) return;
    try {
      await deleteTable(eventId, tableId);
      navigate(`/event/${eventId}`, { replace: true });
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  }

  async function handleNewRound() {
    const roundId = await createRound(eventId, tableId);
    navigate(`/event/${eventId}/table/${tableId}/round/${roundId}/score`);
  }

  if (loading) return <div className="loading">Loading…</div>;
  if (!table) return <div className="page"><p>Table not found.</p></div>;

  const players = table.players || [];
  const allComplete = rounds.length > 0 && rounds.every((r) => r.status === 'complete');

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to={`/event/${eventId}`} className="back-link">← {event?.name}</Link>
          <h1>Table</h1>
        </div>
        {canScore && (
          <button className="btn-danger btn-sm" onClick={handleDeleteTable}>
            Delete table
          </button>
        )}
      </header>

      <div className="players-chips" style={{ padding: '0 0 16px' }}>
        {players.map((p, i) => (
          <span key={i} className="chip">{p.name}</span>
        ))}
      </div>

      <main className="page-main">
        {rounds.map((round, idx) => {
          const games = gamesByRound[round.id] || [];
          const isOpen = round.status === 'open';

          return (
            <section key={round.id} className="card">
              <div className="card-header">
                <h2>Round {idx + 1}</h2>
                <span className={`badge ${isOpen ? 'badge-open' : ''}`}>
                  {isOpen ? 'Open' : 'Complete'}
                </span>
              </div>

              <RoundScoreGrid players={players} games={games} />

              {canScore && isOpen && (
                <div className="btn-group mt">
                  <button
                    className="btn-primary"
                    onClick={() => navigate(`/event/${eventId}/table/${tableId}/round/${round.id}/score`)}
                  >
                    + Score game
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => handleCompleteRound(round.id)}
                    disabled={games.length === 0}
                  >
                    Complete round
                  </button>
                  {games.length === 0 && rounds.length > 1 && (
                    <button
                      className="btn-danger btn-sm"
                      onClick={async () => {
                        if (!window.confirm('Delete this empty round?')) return;
                        await deleteRound(eventId, tableId, round.id);
                        load();
                      }}
                    >
                      Delete round
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })}

        {canScore && rounds.length === 0 && (
          <section className="card">
            <p className="muted">No rounds yet.</p>
            <button className="btn-primary mt" onClick={handleNewRound}>+ Start round</button>
          </section>
        )}

        {canScore && allComplete && (
          <button className="btn-secondary" onClick={handleNewRound}>
            + Start new round
          </button>
        )}
      </main>
    </div>
  );
}

function RoundScoreGrid({ players, games }) {
  if (games.length === 0) {
    return <p className="muted">No games yet.</p>;
  }

  const realPlayers = players.map((p, i) => ({ ...p, index: i })).filter((p) => p.name);
  const wins = players.map(() => 0);
  const points = players.map(() => 0);
  games.forEach((game) => {
    if (!game.scores) return;
    game.scores.forEach((score, i) => { points[i] += score || 0; });
    if (!game.isWallGame && game.winnerId != null) wins[game.winnerId] += 1;
  });

  return (
    <div className="round-grid-wrap">
      <table className="round-grid">
        <thead>
          <tr>
            <th className="rg-player">Player</th>
            {games.map((game, i) => (
              <th key={game.id} className="rg-game">
                <div>G{i + 1}</div>
                {game.isWallGame
                  ? <div className="rg-tag">Wall</div>
                  : game.handName && <div className="rg-tag">{game.handName}</div>}
              </th>
            ))}
            <th className="rg-total">Wins</th>
            <th className="rg-total">Points</th>
          </tr>
        </thead>
        <tbody>
          {realPlayers.map((p) => (
            <tr key={p.index}>
              <td className="rg-player">{p.name}</td>
              {games.map((game) => {
                const score = game.scores?.[p.index];
                return (
                  <td key={game.id} className={`rg-score ${score > 0 ? 'positive' : score < 0 ? 'negative' : ''}`}>
                    {score == null ? '—' : score}
                  </td>
                );
              })}
              <td className="rg-total">{wins[p.index]}</td>
              <td className={`rg-total ${points[p.index] > 0 ? 'positive' : points[p.index] < 0 ? 'negative' : ''}`}>
                {points[p.index]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
