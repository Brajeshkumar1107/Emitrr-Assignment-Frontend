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
      console.log(`[4] App.connectWebSocket: Starting connection for username="${username}", mode="${mode}"`);

      const MAX_RETRIES = 5;
      const INITIAL_RETRY_DELAY = 1000;
      let retryCount = 0;
      let retryDelay = INITIAL_RETRY_DELAY;
      let createdWs: WebSocket | null = null;

      const connect = () => {
        if (isUnloadingRef.current) {
          console.log('[App.connectWebSocket] Page is unloading, aborting connect.');
          return;
        }

        // Close existing socket if necessary
        if (activeWsRef.current) {
          const state = activeWsRef.current.readyState;
          if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
            console.log('[App.connectWebSocket] Active WebSocket already exists, skipping new connection.');
            return;
          }
          try {
            activeWsRef.current?.close();
          } catch (e) {}
          activeWsRef.current = null;
        }

        // ✅ Determine WebSocket URL
        const envWs = process.env.REACT_APP_WS_URL;
        let wsUrl = envWs || '';
        const host = window.location.hostname;
        // If no env provided, choose based on host
        if (!wsUrl) {
          if (host && host !== 'localhost' && host !== '127.0.0.1') {
            wsUrl = 'wss://emitrr-assignment-backend-production.up.railway.app/ws';
          } else {
            wsUrl = 'ws://localhost:8080/ws';
          }
        } else {
          // If env var was provided but points to localhost (e.g. left default at build time)
          // and we're running on a production host, prefer the deployed backend instead.
          if (host && host !== 'localhost' && host !== '127.0.0.1' && envWs && envWs.includes('localhost')) {
            wsUrl = 'wss://emitrr-assignment-backend-production.up.railway.app/ws';
          }
        }

        console.log(`[5] App.connectWebSocket: Creating WebSocket connection to "${wsUrl}"`);
        const ws = new WebSocket(wsUrl);
        createdWs = ws;
        activeWsRef.current = ws;

        ws.onopen = () => {
          console.log(`[6] WebSocket connection opened to ${wsUrl}`);
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
              console.log('[7] Join message sent:', joinMessage);
              window.dispatchEvent(new CustomEvent('game:join'));
            } else {
              console.warn('[7] WebSocket not open, skipping join message.');
            }
          }, 100);
        };

        ws.onerror = (error) => {
          console.error('[App.connectWebSocket] WebSocket error:', error);
          setIsConnected(false);
        };

        ws.onclose = (event) => {
          console.warn(`[App.connectWebSocket] Connection closed (code=${event?.code}, retry=${retryCount})`);

          if (isUnloadingRef.current) {
            console.log('[App.connectWebSocket] Page unloading, no reconnect.');
            return;
          }

          if (activeWsRef.current !== ws) {
            console.log('[App.connectWebSocket] Closed socket is stale, ignoring.');
            return;
          }

          setIsConnected(false);
          setWebsocket(null);
          activeWsRef.current = null;

          if (retryCount < MAX_RETRIES) {
            retryCount++;
            retryDelay *= 2;
            console.log(`[App.connectWebSocket] Retrying in ${retryDelay}ms (attempt ${retryCount}/${MAX_RETRIES})`);
            setTimeout(connect, retryDelay);
          } else {
            console.error('[App.connectWebSocket] Max retries reached. Giving up.');
            alert('Unable to connect to game server. Please try again later.');
          }
        };

        console.log(`[5.5] App.connectWebSocket: WebSocket created, waiting for open...`);
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
    console.log(`[2] handleModeSelection: mode="${mode}" username="${username}"`);
    setGameMode(mode);
    if (username) connectWebSocket(username, mode);
  };

  // ✅ Auto reconnect using saved username + mode
  useEffect(() => {
    if (didAutoReconnect.current) return;
    didAutoReconnect.current = true;
    if (username && gameMode && !websocket && !isConnected) {
      console.log('[App] Auto-reconnecting with saved username and game mode');
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
