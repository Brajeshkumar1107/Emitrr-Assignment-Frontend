import React, { useState, useEffect, useCallback } from 'react';
import GameBoard from './components/GameBoard/GameBoard';
import Leaderboard from './components/Leaderboard/Leaderboard';
import Login from './components/Login/Login';
import GameModeSelection from './components/GameModeSelection/GameModeSelection';
import ActiveUsers from './components/ActiveUsers/ActiveUsers';
import { saveUsername, loadUsername, saveGameMode, loadGameMode } from './utils/localStorage';
import './App.css';

type GameMode = 'friend' | 'computer' | null;

const App: React.FC = () => {
  const isTestEnv = process.env.NODE_ENV === 'test';
  const [username, setUsername] = useState<string | null>(isTestEnv ? null : loadUsername());
  const [gameMode, setGameMode] = useState<GameMode>(isTestEnv ? null : loadGameMode());
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const activeWsRef = React.useRef<WebSocket | null>(null);
  const isUnloadingRef = React.useRef(false);
  const didAutoReconnect = React.useRef(false);

  // Save username to local storage
  useEffect(() => {
    if (username) saveUsername(username);
  }, [username]);

  // Save game mode to local storage
  useEffect(() => {
    if (gameMode) saveGameMode(gameMode);
  }, [gameMode]);

  /**
   * ✅ WebSocket connection logic with production-safe URL handling
   */
  const connectWebSocket = useCallback(
    (username: string, mode: 'friend' | 'computer') => {

      const MAX_RETRIES = 5;
      const INITIAL_RETRY_DELAY = 1000;
      let retryCount = 0;
      let retryDelay = INITIAL_RETRY_DELAY;
      let createdWs: WebSocket | null = null;

      const connect = () => {
        if (isUnloadingRef.current) return;

        // Close existing socket if necessary
        if (activeWsRef.current) {
          const state = activeWsRef.current.readyState;
          if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;
          try {
            activeWsRef.current?.close();
          } catch (e) {}
          activeWsRef.current = null;
        }

        // ✅ Determine candidate WebSocket URLs (try sequentially on retries)
        const envWs = process.env.REACT_APP_WS_URL;
        const host = window.location.hostname;

        const candidates: string[] = [];
        if (envWs) candidates.push(envWs);

        // Primary deployed backend (Railway)
        candidates.push('wss://emitrr-assignment-backend-production.up.railway.app/ws');

        // If frontend is served from same host (proxy), try same origin wss
        if (host && host !== 'localhost' && host !== '127.0.0.1') {
          candidates.push(`wss://${host}/ws`);
        }

        // Local dev fallback
        candidates.push('ws://localhost:8080/ws');

        // Choose a candidate based on current retry count so subsequent retries try next candidate
        const candidateIndex = retryCount % candidates.length;
  const wsUrl = candidates[candidateIndex];
        const ws = new WebSocket(wsUrl);
        createdWs = ws;
        activeWsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          setWebsocket(ws);
          retryCount = 0;
          retryDelay = INITIAL_RETRY_DELAY;

          const joinMessage = {
            type: 'join',
            payload: { username, gameMode: mode },
          };

          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(joinMessage));
              window.dispatchEvent(new CustomEvent('game:join'));
            }
          }, 100);
        };
        ws.onerror = () => {
          setIsConnected(false);
        };

        ws.onclose = (event) => {
          if (isUnloadingRef.current) return;
          if (activeWsRef.current !== ws) return;

          setIsConnected(false);
          setWebsocket(null);
          activeWsRef.current = null;

          if (retryCount < MAX_RETRIES) {
            retryCount++;
            retryDelay *= 2;
            // Small delay before next attempt - the connect() function will pick the next candidateURL
            setTimeout(connect, retryDelay);
          } else {
            alert('Unable to connect to game server. Please try again later.');
          }
        };
      };

      connect();

      // Cleanup handler
      return () => {
        if (activeWsRef.current === createdWs) {
          try {
            activeWsRef.current?.close();
          } catch (e) {}
          activeWsRef.current = null;
        }
      };
    },
    []
  );

  // ✅ Cleanup WebSocket on component unmount
  useEffect(() => {
    return () => {
      if (activeWsRef.current && activeWsRef.current === websocket) {
        try {
          activeWsRef.current?.close();
        } catch (e) {}
        activeWsRef.current = null;
      }
    };
  }, [websocket]);

  // ✅ Close WebSocket before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      isUnloadingRef.current = true;
      if (activeWsRef.current && activeWsRef.current.readyState === WebSocket.OPEN) {
        try {
          activeWsRef.current?.close(1000, 'page unload');
        } catch (e) {}
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // ✅ Handlers for login and game mode selection
  const handleLogin = (name: string) => setUsername(name);

  const handleModeSelection = (mode: 'friend' | 'computer') => {
    setGameMode(mode);
    if (username) connectWebSocket(username, mode);
  };

  // ✅ Auto reconnect using saved username + mode
  useEffect(() => {
    if (didAutoReconnect.current) return;
    didAutoReconnect.current = true;
    if (username && gameMode && !websocket && !isConnected) {
      connectWebSocket(username, gameMode);
    }
  }, [username, gameMode, websocket, isConnected, connectWebSocket]);

  // ✅ UI rendering
  if (!username) return <Login onLogin={handleLogin} />;
  if (!gameMode) return <GameModeSelection onSelectMode={handleModeSelection} />;
  if (!websocket) return <div className="app"><div className="game-container">Connecting...</div></div>;

  return (
    <div className="app">
      <div className="game-container">
        <header>
          <h1>Connect 4</h1>
          <div className="connection-status">
            {isConnected ? <span className="connected">Connected</span> : <span className="disconnected">Disconnected</span>}
          </div>
        </header>
        <main>
          {websocket.readyState === WebSocket.OPEN ? (
            <div className="game-section">
              <GameBoard websocket={websocket} username={username} />
              <div className="side-panel">
                <ActiveUsers />
                <Leaderboard />
              </div>
            </div>
          ) : websocket.readyState === WebSocket.CONNECTING ? (
            <div className="game-container">Connecting to server...</div>
          ) : (
            <div className="game-container">WebSocket not ready (state: {websocket.readyState})</div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
