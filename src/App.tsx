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
  // Load username and game mode from local storage on mount
  // In test environment we avoid restoring from sessionStorage to keep tests isolated
  const isTestEnv = process.env.NODE_ENV === 'test';
  const [username, setUsername] = useState<string | null>(isTestEnv ? null : loadUsername());
  const [gameMode, setGameMode] = useState<GameMode>(isTestEnv ? null : loadGameMode());
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const activeWsRef = React.useRef<WebSocket | null>(null);
  const isUnloadingRef = React.useRef(false);
  const didAutoReconnect = React.useRef(false);

  // Save username to local storage whenever it changes
  useEffect(() => {
    if (username) {
      saveUsername(username);
    }
  }, [username]);

  // Save game mode to local storage whenever it changes
  useEffect(() => {
    if (gameMode) {
      saveGameMode(gameMode);
    }
  }, [gameMode]);

  // Note: Using sessionStorage which automatically clears when the browser tab is closed
  // No need to manually clear on beforeunload - sessionStorage handles it automatically

  const connectWebSocket = useCallback((username: string, mode: 'friend' | 'computer') => {
    console.log(`[4] App.connectWebSocket: Starting connection for username="${username}", mode="${mode}"`);
    const MAX_RETRIES = 5;
    const INITIAL_RETRY_DELAY = 1000;
    let retryCount = 0;
    let retryDelay = INITIAL_RETRY_DELAY;

  let createdWs: WebSocket | null = null;

  const connect = () => {
      // If we're unloading (page refresh/close), don't attempt to connect
      if (isUnloadingRef.current) {
        console.log('[App.connectWebSocket] Aborting connect because page is unloading');
        return;
      }

      // If there's already an active or connecting socket, don't create another
      if (activeWsRef.current) {
        const state = activeWsRef.current.readyState;
        if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
          console.log('[App.connectWebSocket] Active WebSocket already present (OPEN or CONNECTING). Skipping new connection.');
          return;
        }

        // If the socket is CLOSING or CLOSED, clear it and proceed to create a new one
        try {
          if (state === WebSocket.CLOSING) {
            // Attempt to close gracefully; if it doesn't close, we'll create a new socket anyway
            activeWsRef.current.close();
          }
        } catch (e) {
          // ignore
        }
        activeWsRef.current = null;
      }

  // Get WebSocket URL from environment variable or fallback to default (local dev)
  // Use ws:// for local development; production should set REACT_APP_WS_URL to a wss:// URL
  const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8080/ws';
      console.log(`[5] App.connectWebSocket: Creating WebSocket connection to "${wsUrl}"`);
  const ws = new WebSocket(wsUrl);
  createdWs = ws;
      // Track this ws as the active one
      activeWsRef.current = ws;

      ws.onopen = () => {
        console.log(`[6] App.connectWebSocket: WebSocket connection opened`);
        console.log(`[6] App.connectWebSocket: WebSocket readyState:`, ws.readyState);
        // Only treat this socket as the active connection if it matches our tracked ref
        if (activeWsRef.current !== ws) {
          console.warn('[6] App.connectWebSocket: onopen called for a stale socket, ignoring');
          return;
        }
        setIsConnected(true);
        retryCount = 0;
        retryDelay = INITIAL_RETRY_DELAY;
        
        // Set websocket state first so GameBoard can mount and attach its message handler
        // Then send the join message after a short delay to avoid a race where the
        // server responds before GameBoard has attached its onmessage handler.
        setWebsocket(ws);

        // Prepare join message
        const joinMessage = {
          type: 'join',
          payload: {
            username: username,
            gameMode: mode
          }
        };

        console.log(`[7] App.connectWebSocket: Scheduling join message send (delayed)`);
        // Small delay to let React render GameBoard and attach handlers
        setTimeout(() => {
          console.log(`[7] App.connectWebSocket: Sending join message:`, joinMessage);
          console.log(`[7] App.connectWebSocket: WebSocket readyState before send:`, ws.readyState);

          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify(joinMessage));
              console.log(`[7.5] App.connectWebSocket: ✓ Join message sent successfully`);
              console.log(`[7.5] App.connectWebSocket: Backend should respond with gameStart message`);
              console.log(`[7.5] App.connectWebSocket: If no response, check backend terminal for [BACKEND-] logs`);
              // Dispatch event to update active users immediately
              window.dispatchEvent(new CustomEvent('game:join'));
            } catch (error) {
              console.error(`[7] App.connectWebSocket: Error sending join message:`, error);
            }
          } else {
            console.error(`[7] App.connectWebSocket: Cannot send - WebSocket not open (state: ${ws.readyState})`);
          }
        }, 50);
        
        // Note: websocket state already set above

      };

      // Note: Message handling is done in GameBoard component
      // Don't set onmessage here to avoid overriding GameBoard's handler

      ws.onclose = (event) => {
        console.log(`[App.connectWebSocket] WebSocket connection closed (retryCount=${retryCount}) code=${event?.code}`);
        // If this was a close triggered by page unload, do not attempt reconnects
        if (isUnloadingRef.current) {
          console.log('[App.connectWebSocket] Not reconnecting because page is unloading');
          return;
        }

        // Only react to close events for the active socket
        if (activeWsRef.current !== ws) {
          console.log('[App.connectWebSocket] Closed socket is not active socket, ignoring');
          return;
        }

        setIsConnected(false);
        setWebsocket(null); // Clear websocket state on close
        activeWsRef.current = null;
        // Implement exponential backoff for reconnection
        if (retryCount < MAX_RETRIES) {
          setTimeout(() => {
            // If user started unloading in the meantime, don't reconnect
            if (isUnloadingRef.current) return;
            retryCount++;
            retryDelay *= 2; // Exponential backoff
            console.log(`[App.connectWebSocket] Retrying connection (attempt ${retryCount}/${MAX_RETRIES})`);
            connect();
          }, retryDelay);
        } else {
          // Show error message to user after max retries
          console.error('[App.connectWebSocket] Max retries reached, giving up');
          alert('Unable to connect to game server. Please try again later.');
        }
      };

      ws.onerror = (error) => {
        console.error('[App.connectWebSocket] WebSocket error:', error);
        setIsConnected(false);
      };

      console.log(`[5.5] App.connectWebSocket: WebSocket created, waiting for connection...`);
    };

    connect(); // Initial connection

    // Only close the socket we created when the caller unmounts this callback's scope.
    return () => {
      try {
        // Only close if the active tracked socket is the same instance we created.
        if (activeWsRef.current === createdWs) {
          activeWsRef.current!.close();
          activeWsRef.current = null;
        }
      } catch (e) {}
    };
  }, [setWebsocket]); // websocket removed as it's not needed

  useEffect(() => {
    return () => {
      // Only close if the active socket matches the websocket state variable.
      // This avoids closing a socket created by a newer connectWebSocket call.
      if (activeWsRef.current && activeWsRef.current === websocket) {
        try { activeWsRef.current.close(); } catch (e) {}
        activeWsRef.current = null;
      }
    };
  }, [websocket]);

  // Close the websocket gracefully on page refresh/unload and avoid reconnect attempts
  useEffect(() => {
    const handleBeforeUnload = () => {
      isUnloadingRef.current = true;
      try {
        if (activeWsRef.current && activeWsRef.current.readyState === WebSocket.OPEN) {
          try { activeWsRef.current.close(1000, 'page unload'); } catch (e) { /* ignore */ }
        }
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleLogin = (username: string) => {
    setUsername(username);
  };

  const handleModeSelection = (mode: 'friend' | 'computer') => {
    console.log(`[2] App.handleModeSelection: Called with mode="${mode}"`);
    console.log(`[2] App.handleModeSelection: Current username="${username}"`);
    setGameMode(mode);
    if (username) {
      console.log(`[3] App.handleModeSelection: Calling connectWebSocket(username="${username}", mode="${mode}")`);
      connectWebSocket(username, mode);
    } else {
      console.warn('[2] App.handleModeSelection: No username available, cannot connect');
    }
  };

  // Auto-reconnect if username and gameMode are loaded from local storage
  // Only reconnect if we don't have an active connection
  useEffect(() => {
    if (didAutoReconnect.current) return;
    didAutoReconnect.current = true;
    if (username && gameMode && !websocket && !isConnected) {
      console.log('[App] Auto-reconnecting with saved username and game mode');
      connectWebSocket(username, gameMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount, not on every username/gameMode change

  if (!username) {
    return <Login onLogin={handleLogin} />;
  }

  if (!gameMode) {
    return <GameModeSelection onSelectMode={handleModeSelection} />;
  }

  if (!websocket) {
    return <div className="app"><div className="game-container">Connecting...</div></div>;
  }

  return (
    <div className="app">
      <div className="game-container">
        <header>
          <h1>Connect 4</h1>
          <div className="connection-status">
            {isConnected ? (
              <span className="connected">Connected</span>
            ) : (
              <span className="disconnected">Disconnected</span>
            )}
          </div>
        </header>
        <main>
          {websocket ? (
            websocket.readyState === WebSocket.OPEN ? (
              <>
                <div className="game-section">
                  <GameBoard websocket={websocket} username={username} />
                  <div className="side-panel">
                    <ActiveUsers />
                    <Leaderboard />
                  </div>
                </div>
              </>
            ) : websocket.readyState === WebSocket.CONNECTING ? (
              <div className="game-container">Connecting to server...</div>
            ) : (
              <div className="game-container">WebSocket not ready (state: {websocket.readyState})</div>
            )
          ) : (
            <div className="game-container">Initializing connection...</div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
