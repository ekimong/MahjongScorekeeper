import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getEventByToken, getTables, getRounds, getGames } from '../lib/firestore';
import Scoreboard from '../components/Scoreboard';

export default function GuestView() {
  const { token } = useParams();
  const [event, setEvent] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      const evt = await getEventByToken(token);
      if (!evt) { setNotFound(true); setLoading(false); return; }
      setEvent(evt);

      const tables = await getTables(evt.id);
      const enriched = await Promise.all(
        tables.map(async (table) => {
          const rounds = await getRounds(evt.id, table.id);
          const roundsWithGames = await Promise.all(
            rounds.map(async (round) => ({
              ...round,
              games: await getGames(evt.id, table.id, round.id),
            }))
          );
          return { ...table, rounds: roundsWithGames };
        })
      );
      setTableData(enriched);
      setLoading(false);
    }
    load();
  }, [token]);

  if (loading) return <div className="loading">Loading…</div>;
  if (notFound) return <div className="page"><p>Event not found or link is invalid.</p></div>;

  return (
    <div className="page">
      <header className="page-header">
        <h1>🀄 {event.name}</h1>
        <span className="badge">Live scoreboard</span>
      </header>
      <main className="page-main">
        {tableData.length === 0 && <p className="muted">No tables yet.</p>}
        {tableData.map((table, tIdx) => (
          <section key={table.id} className="card">
            <div className="card-header">
              <h2>Table {tIdx + 1}</h2>
              <div className="players-chips">
                {table.players?.map((p, i) => (
                  <span key={i} className="chip">{p.name}</span>
                ))}
              </div>
            </div>

            {table.rounds.map((round, rIdx) => {
              const allGames = round.games || [];
              return (
                <div key={round.id} className="guest-round">
                  <div className="guest-round-header">
                    <span className="section-label" style={{ margin: 0 }}>Round {rIdx + 1}</span>
                    <span className={`badge ${round.status === 'open' ? 'badge-open' : ''}`}>
                      {round.status === 'open' ? 'Open' : 'Complete'}
                    </span>
                  </div>
                  <Scoreboard players={table.players || []} games={allGames} />
                </div>
              );
            })}
          </section>
        ))}
      </main>
    </div>
  );
}
