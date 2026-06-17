export default function Scoreboard({ players, games }) {
  const totals = players.map((p) => ({ name: p.name, total: 0, wins: 0 }));

  games.forEach((game) => {
    if (!game.scores) return;
    game.scores.forEach((score, i) => {
      if (!totals[i]) return;
      totals[i].total += score || 0;
      if (!game.isWallGame && game.winnerId === i) totals[i].wins += 1;
    });
  });

  const sorted = [...totals].sort((a, b) => b.total - a.total);

  return (
    <>
      {sorted.some((r) => r.total !== 0 || r.wins > 0) && (
        <table className="score-table">
          <thead>
            <tr>
              <th>Player</th>
              <th className="num">Wins</th>
              <th className="num">Points</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} className={i === 0 && row.total > 0 ? 'leader' : ''}>
                <td>{row.name}</td>
                <td className="num">{row.wins}</td>
                <td className={`num ${row.total > 0 ? 'positive' : row.total < 0 ? 'negative' : ''}`}>
                  {row.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
