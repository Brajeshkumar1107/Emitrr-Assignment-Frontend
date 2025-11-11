import React, { useState, useEffect } from 'react';
import './Leaderboard.css';

interface PlayerStats {
  username: string;
  gamesPlayed: number;
  gamesWon: number;
  winPercentage: number;
}

const Leaderboard: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setError(null);
        const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:8080';
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/leaderboard`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setLeaderboard(data);
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        setError(error instanceof Error ? error.message : 'Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000); // Refresh every 5 seconds for more responsive updates

    // Listen for explicit leaderboard update events (dispatched by GameBoard on game end)
    const onUpdate = (e: Event) => {
      try {
        const custom = e as CustomEvent<any>;
        if (custom && custom.detail) {
          console.log('[Leaderboard] Received leaderboard:update event, detail=', custom.detail);
        } else {
          console.log('[Leaderboard] Received leaderboard:update event');
        }
        // Optimistically update leaderboard when we have a winner (useful when backend DB is disabled)
        try {
          const detail = (custom && custom.detail) || {};
          const winner = detail.winner as string | undefined;
          const isDraw = !!detail.isDraw;
          if (winner && !isDraw) {
            setLeaderboard(prev => {
              // clone
              const next = prev.slice();
              const idx = next.findIndex(p => p.username === winner);
              if (idx >= 0) {
                // update existing
                const updated = { ...next[idx] };
                updated.gamesPlayed = (updated.gamesPlayed || 0) + 1;
                updated.gamesWon = (updated.gamesWon || 0) + 1;
                updated.winPercentage = updated.gamesPlayed > 0 ? (updated.gamesWon / updated.gamesPlayed) * 100 : 0;
                next[idx] = updated;
              } else {
                // add new
                const newEntry = {
                  username: winner,
                  gamesPlayed: 1,
                  gamesWon: 1,
                  winPercentage: 100
                } as PlayerStats;
                next.push(newEntry);
              }
              // sort by gamesWon desc then winPercentage
              next.sort((a, b) => (b.gamesWon - a.gamesWon) || (b.winPercentage - a.winPercentage));
              return next;
            });
          }
        } catch (err) {
          console.error('[Leaderboard] Optimistic update failed', err);
        }
      } catch (err) {
        console.error('[Leaderboard] Error reading event detail', err);
      }
      setLoading(true);
      fetchLeaderboard();
    };
    window.addEventListener('leaderboard:update', onUpdate as EventListener);

    return () => {
      clearInterval(interval);
  window.removeEventListener('leaderboard:update', onUpdate as EventListener);
    };
  }, []);

  if (error) {
    return <div className="leaderboard-error">Error: {error}</div>;
  }

  if (loading) {
    return <div className="leaderboard-loading">Loading leaderboard...</div>;
  }

  if (leaderboard.length === 0) {
    return <div className="leaderboard-empty">No games played yet</div>;
  }

  return (
    <div className="leaderboard">
      <h2>Leaderboard</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Games Won</th>
            <th>Games Played</th>
            <th>Win Rate</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((player, index) => (
            <tr key={player.username}>
              <td>{index + 1}</td>
              <td>{player.username}</td>
              <td>{player.gamesWon}</td>
              <td>{player.gamesPlayed}</td>
              <td>{player.winPercentage.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Leaderboard;