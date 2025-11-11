import React, { useState } from 'react';
import './Login.css';

interface LoginProps {
  onLogin: (username: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    if (username.length < 3 || username.length > 20) {
      setError('Username must be between 3 and 20 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setError('Username can only contain letters, numbers, underscores, and hyphens');
      return;
    }

    onLogin(username);
  };

  return (
    <div className="login">
      <div className="login-container">
        <div className="login-icon">🎮</div>
        <h1>Connect 4</h1>
        <p className="login-subtitle">Challenge friends or test your skills against AI</p>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              placeholder="Enter your username..."
              maxLength={20}
              autoFocus
            />
            {error && (
              <div className="error">
                <span>⚠️</span>
                {error}
              </div>
            )}
          </div>
          <button type="submit" className="login-button">
            <span>▶</span> Start Playing
          </button>
        </form>
        <div className="login-footer">
          <p>3-20 characters • Letters, numbers, underscores & hyphens only</p>
        </div>
      </div>
    </div>
  );
};

export default Login;