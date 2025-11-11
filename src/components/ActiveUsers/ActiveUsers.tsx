import React, { useState, useEffect } from 'react';
import './ActiveUsers.css';

interface ActiveUser {
  username: string;
  status: 'waiting' | 'in_game';
}

const ActiveUsers: React.FC = () => {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActiveUsers = async () => {
      try {
        const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:8080';
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/active-users`);
        if (!response.ok) {
          throw new Error('Failed to fetch active users');
        }
        const data = await response.json();
        setActiveUsers(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching active users:', err);
        setError('Failed to load active users');
      } finally {
        setLoading(false);
      }
    };

    fetchActiveUsers();
    // Refresh every 2 seconds for immediate updates when players join
    const interval = setInterval(fetchActiveUsers, 2000);

    // Also listen for game events to refresh immediately
    const handleGameEvent = () => {
      fetchActiveUsers();
    };
    window.addEventListener('game:start', handleGameEvent);
    window.addEventListener('game:join', handleGameEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('game:start', handleGameEvent);
      window.removeEventListener('game:join', handleGameEvent);
    };
  }, []);

  if (loading) {
    return <div className="active-users-loading">Loading active users...</div>;
  }

  if (error) {
    return <div className="active-users-error">{error}</div>;
  }

  return (
    <div className="active-users">
      <h3>Active Players</h3>
      <div className="active-users-count">
        <div className="count-display">
          <span className="count-number">{activeUsers.length}</span>
          <span className="count-label">
            {activeUsers.length === 1 ? 'Player' : 'Players'}
          </span>
        </div>
        {activeUsers.length === 0 && (
          <div className="no-users">No active players</div>
        )}
      </div>
    </div>
  );
};

export default ActiveUsers;