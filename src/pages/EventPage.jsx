import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getEvent, getTables, getEventGames, createTable, getRounds, completeRound, createRound, getUserDisplayName } from '../lib/firestore';
import TableSetupModal from '../components/GameSetupModal';

export default function EventPage() {
  const { eventId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [tables, setTables] = useState([]);
  const [totals, setTotals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalsLoading, setTotalsLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [duplicateTableId, setDuplicateTableId] = useState(null);
  const [creatorName, setCreatorName] = useState('');

  const isOrganizer = user && event && event.createdBy === user.uid;
  const canScore = !!user;

  const shareUrl = event ? `${window.location.origin}/join/${event.shareToken}` : '';

  useEffect(() => {
    window.scrollTo(0, 0);
    load();
  }, [eventId]);

  async function load() {
    try {
      const [evt, tbls] = await Promise.all([
        getEvent(eventId),
        getTables(eventId),
      ]);

      setEvent(evt);
      setTables(tbls);
      setLoading(false);

      if (evt && evt.createdBy && evt.createdBy !== user?.uid) {
        const name = evt.createdByName || await getUserDisplayName(evt.createdBy);
        setCreatorName(name || '');
      }

      try {
        const allGames = await getEventGames(eventId);
        computeTotals(tbls, allGames);
      } catch (err) {
        console.error('getEventGames error:', err);
        setTotalsLoading(false);
      }
    } catch (err) {
      console.error('EventPage load error:', err);
      setLoading(false);
    }
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
    console.log('handleTableCreated called with players:', players);
    const newNames = players.map((p) => p.name).filter(Boolean).map((n) => n.toLowerCase()).sort().join(',');
    const duplicate = tables.find((t) => {
      const existing = (t.players || []).map((p) => p.name).filter(Boolean).map((n) => n.toLowerCase()).sort().join(',');
      return existing === newNames;
    });
    if (duplicate) {
      console.log('Duplicate table found:', duplicate.id);
      setDuplicateTableId(duplicate.id);
      throw new Error('A table with these players already exists. Would you like to start a new round for that table instead?');
    }
    try {
      console.log('Calling createTable...');
      const { tableId } = await createTable(eventId, players);
      console.log('createTable succeeded:', tableId);
      setShowSetup(false);
      navigate(`/event/${eventId}/table/${tableId}`);
    } catch (err) {
      console.error('createTable threw error:', err.code, err.message);
      console.log('Starting retry loop to check if table was created anyway...');
      // On mobile with long polling, Firestore queues writes offline and retries.
      // Wait and check multiple times if the table was created despite the error,
      // since the write might succeed on retry.
      for (let attempt = 0; attempt < 5; attempt++) {
        console.log('Retry attempt', attempt + 1);
        await new Promise((resolve) => setTimeout(resolve, 400 + attempt * 300));
        const freshTables = await getTables(eventId).catch(() => null);
        if (freshTables) {
          console.log('Fresh tables fetched:', freshTables.length);
          setTables(freshTables);
          const created = freshTables.find((t) => {
            const names = (t.players || []).map((p) => p.name).filter(Boolean).map((n) => n.toLowerCase()).sort().join(',');
            return names === newNames;
          });
          if (created) {
            console.log('Table was created on attempt', attempt + 1);
            setShowSetup(false);
            navigate(`/event/${eventId}/table/${created.id}`);
            return;
          }
        }
      }
      // If we still haven't found it after retries, show the error
      console.log('After 5 retries, table not found. Re-throwing error.');
      throw err;
    }
  }

  async function handleStartNewRoundForDuplicate() {
    const rounds = await getRounds(eventId, duplicateTableId);
    const openRound = rounds.find((r) => r.status === 'open');
    if (openRound) await completeRound(eventId, duplicateTableId, openRound.id);
    await createRound(eventId, duplicateTableId);
    setShowSetup(false);
    setDuplicateTableId(null);
    navigate(`/event/${eventId}/table/${duplicateTableId}`);
  }

  if (loading) return <div className="loading">Loading…</div>;
  if (!event) return <div className="page"><p>Event not found.</p></div>;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/" className="back-link">← Events</Link>
          <h1>{event.name}</h1>
          <p className="event-page-creator">
            {event.createdBy === user?.uid
              ? 'Created by you'
              : `Created by ${creatorName || '…'}`}
          </p>
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
          onClose={() => { setShowSetup(false); setDuplicateTableId(null); }}
          onStartNewRound={duplicateTableId ? handleStartNewRoundForDuplicate : null}
          currentUser={user}
        />
      )}
    </div>
  );
}
