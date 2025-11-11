import React, { useState, useEffect, useCallback, useRef } from 'react';
import './GameBoard.css';
import { saveGameState, loadGameState, clearGameState, StoredGameState, loadGameMode, clearGameMode, saveGameMode } from '../../utils/localStorage';
import WaitingOverlay from './WaitingOverlay';
import GameFinished from '../GameFinished/GameFinished';

interface GameState {
  board: number[][];
  currentTurn: number;
  status: 'waiting' | 'in_progress' | 'completed' | 'draw';
  winner?: {
    username: string;
    id?: string;
    isBot?: boolean;
  };
  player1?: {
    username: string;
    id?: string;
    isBot?: boolean;
  };
  player2?: {
    username: string;
    id?: string;
    isBot?: boolean;
  };
  lastMove?: {
    row: number;
    column: number;
    player: number;
  };
}

interface GameBoardProps {
  websocket: WebSocket;
  username: string;
}

const GameBoard: React.FC<GameBoardProps> = ({ websocket, username }) => {
  // Load initial state from session storage if available
  const getInitialState = (): GameState => {
    const stored = loadGameState();
    if (stored && stored.player1 && stored.player2) {
  // Only restore if we have complete player information
  // restored from session storage
      return {
        board: stored.board || Array(6).fill(null).map(() => Array(7).fill(0)),
        currentTurn: stored.currentTurn || 1,
        status: stored.status || 'waiting',
        player1: stored.player1,
        player2: stored.player2,
        winner: stored.winner,
        lastMove: stored.lastMove,
      };
    } else if (stored) {
      // Stored state found but missing player info; starting fresh
    }
    // Start with empty state - will be populated by gameStart message
    return {
      board: Array(6).fill(null).map(() => Array(7).fill(0)),
      currentTurn: 1,
      status: 'waiting'
    };
  };

  const [gameState, setGameState] = useState<GameState>(getInitialState);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [pendingMove, setPendingMove] = useState<{row: number, col: number, player: number} | null>(null);
  const [gameFinished, setGameFinished] = useState(false);
  const [finishedData, setFinishedData] = useState<{
    winner?: string | null;
    isDraw: boolean;
    botWon?: boolean;
  } | null>(null);
  const [isLoadingRematch, setIsLoadingRematch] = useState(false);
  // Refs to avoid stale closures in WebSocket handlers and manage timeouts
  const usernameRef = useRef<string>(username);
  const pendingMoveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const friendWaitingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper: Get effective status - if both players present but status is waiting, treat as in_progress
  // This fixes the issue where computer mode shows "waiting" when game has actually started
  const getEffectiveStatus = useCallback((): 'waiting' | 'in_progress' | 'completed' | 'draw' => {
    if (gameState.player1 && gameState.player2 && gameState.status === 'waiting') {
      return 'in_progress';
    }
    return gameState.status;
  }, [gameState.player1, gameState.player2, gameState.status]);

  // Keep usernameRef current to avoid stale closures in handlers
  useEffect(() => { usernameRef.current = username; }, [username]);

  // Timeouts/constants
  const PENDING_MOVE_TIMEOUT_MS = 2000;
  const FRIEND_WAITING_TIMEOUT_MS = 10000; // 10 seconds as per assignment requirement


  // Save game state to local storage whenever it changes
  useEffect(() => {
    if (gameState.status !== 'waiting' || (gameState.player1 && gameState.player2)) {
      const stateToSave: StoredGameState = {
        board: gameState.board,
        currentTurn: gameState.currentTurn,
        status: gameState.status,
        player1: gameState.player1,
        player2: gameState.player2,
        winner: gameState.winner,
        lastMove: gameState.lastMove,
      };
      saveGameState(stateToSave);
    }
  }, [gameState]);

  // Clear game state from local storage when game ends and trigger leaderboard update
  useEffect(() => {
    if (gameState.status === 'completed' || gameState.status === 'draw') {
      // Clear after a short delay to allow final state to be saved
      const timer = setTimeout(() => {
        // Keep final state briefly but do not auto-clear here; modal will offer actions
      }, 5000); // Legacy delay kept for compatibility

      // Dispatch leaderboard update event
      const updateEvent = new CustomEvent('leaderboard:update', {
        detail: { gameStatus: gameState.status, winner: gameState.winner }
      });
      window.dispatchEvent(updateEvent);
      
      return () => clearTimeout(timer);
    }
  }, [gameState.status, gameState.winner]);

  // Note: Local storage clearing is handled in App.tsx on beforeunload

  useEffect(() => {
    if (!websocket) {
      return;
    }
    
    // Don't set up handlers if WebSocket is already closed or closing
    if (websocket.readyState === WebSocket.CLOSED || websocket.readyState === WebSocket.CLOSING) {
      console.warn('[8] GameBoard: WebSocket is closed/closing, skipping handler setup');
      return;
    }
    
  // Setting up WebSocket message handler (debug logs removed)
    
    let gameStartTimeout: NodeJS.Timeout | null = null;
    let messageReceived = false;
    let handlerSetupTime = Date.now();
    
    // Set up a timeout to check if gameStart message is received
    // Only start timeout if websocket is already open
    if (websocket.readyState === WebSocket.OPEN) {
      gameStartTimeout = setTimeout(() => {
        if (!messageReceived && websocket.readyState === WebSocket.OPEN) {
          const elapsed = Date.now() - handlerSetupTime;
          console.error('🚨 [8] GameBoard: CRITICAL ERROR - No gameStart message received!');
          console.error(`[8] GameBoard: Time elapsed since handler setup: ${elapsed}ms`);
          console.error('[8] GameBoard: WebSocket readyState:', websocket.readyState);
          console.error('[8] GameBoard: WebSocket URL:', websocket.url);
          console.error('[8] GameBoard: Possible causes:');
          console.error('  1. Backend is not running - Run: cd connect4/backend/cmd/server && go run main.go');
          console.error('  2. Backend is not receiving join message - Check backend terminal for [BACKEND-6] logs');
          console.error('  3. Backend is not sending gameStart message - Check backend terminal for [BACKEND-20] logs');
          console.error('  4. WebSocket connection issue - Verify backend is accessible at ws://localhost:8080/ws');
          console.error('[8] GameBoard: ACTION REQUIRED: Check backend terminal for logs starting with [BACKEND-]');
          console.error('[8] GameBoard: If backend is running, you should see [BACKEND-1] through [BACKEND-20] logs');
        }
      }, 5000); // 5 seconds timeout
    } else {
      // WebSocket not yet open; will set up handler when it opens (debug log removed)
    }
    
    // Set up message handler
      const messageHandler = (event: MessageEvent) => {
      messageReceived = true;
      if (gameStartTimeout !== null) {
        clearTimeout(gameStartTimeout);
        gameStartTimeout = null;
      }
  // Raw WebSocket message received (debug logging removed)
        try {
  const data = JSON.parse(event.data);

        // Handle server broadcast for leaderboard updates - dispatch a window event
        if (data.type === 'leaderboardUpdate') {
          try {
            const detail = data.payload || {};
            window.dispatchEvent(new CustomEvent('leaderboard:update', { detail }));
          } catch (err) {
            console.error('[9] GameBoard: Failed to dispatch leaderboard:update event from server broadcast', err);
          }
          return;
        }

        // Handle gameFinished message - show popup with Play Again / Exit buttons
        if (data.type === 'gameFinished') {
          const payload = data.payload || {};
          setFinishedData({
            winner: payload.winner || null,
            isDraw: payload.isDraw || false,
            botWon: payload.botWon || false,
          });
          setGameFinished(true);
          return;
        }

        // Handle playAgainUpdate - shows who has requested play again
        if (data.type === 'playAgainUpdate') {
          const payload = data.payload || {};
          console.log('[GameBoard] Play again update:', payload.playAgainRequests);
          // Could update UI to show who wants to play again, but for now just log
          return;
        }

        // Handle opponentExited - opponent left the game
        if (data.type === 'opponentExited') {
          const payload = data.payload || {};
          console.log('[GameBoard] Opponent exited:', payload.message);
          // Could show a message to the user that opponent exited
          // For now, end the game and show the popup
          setGameFinished(true);
          setFinishedData({
            winner: null,
            isDraw: false,
            botWon: false,
          });
          return;
        }

        // Log success if we receive gameStart
        if (data.type === 'gameStart') {
          // gameStart received - dispatch event to update active users
          window.dispatchEvent(new CustomEvent('game:start'));
        }
        
        if (data.type === 'gameState' || data.type === 'gameStart') {
          // Processing gameState/gameStart message (debug logs removed)
          
          // Ensure board is always an array
          const payload = data.payload || {};          // Safely get board from payload, ensuring it's a valid 2D array
          let board = payload.board;
          if (!board || !Array.isArray(board) || board.length === 0) {
            // Create default empty board
            board = Array(6).fill(null).map(() => Array(7).fill(0));
          } else {
            // Ensure each row is an array
            board = board.map((row: any) => {
              if (!Array.isArray(row)) {
                return Array(7).fill(0);
              }
              return row.length === 7 ? row : [...row, ...Array(7 - row.length).fill(0)];
            });
            // Ensure we have 6 rows
            while (board.length < 6) {
              board.push(Array(7).fill(0));
            }
            board = board.slice(0, 6);
          }
          
          // Normalize player objects - backend sends Player1/Player2 (capital P) with ID, Username, IsBot (all capitals)
          // Go JSON serialization uses field names as-is when no JSON tags are present
          const normalizePlayer = (player: any) => {
            // Check if player is null, undefined, or an empty object
            if (!player || (typeof player === 'object' && Object.keys(player).length === 0)) {
              return undefined;
            }
            
            // Handle both lowercase and uppercase field names
            // Go sends: ID, Username, IsBot (capital letters) - NO JSON tags, so exact field names
            const username = player.Username || player.username || player.ID || player.id;
            const id = player.ID || player.id || player.Username || player.username;
            const isBot = player.IsBot !== undefined ? player.IsBot : (player.isBot !== undefined ? player.isBot : false);
            
            // Only return normalized player if we have at least a username or id
            if (!username && !id) {
              return undefined;
            }
            
            const normalized = {
              username: username || id || '',
              id: id || username || '',
              isBot: isBot
            };
            
            // normalized player
            return normalized;
          };
          
          setGameState((prevState) => {
            // Check for both player1/player2 (lowercase) and Player1/Player2 (capital P)
            // Backend sends Player1 and Player2 (capital P) in the GameState struct
            // Also check for nested structures or alternative field names
            const player1FromPayload = payload.Player1 || payload.player1 || 
                                      (payload as any).Player1 || (payload as any).player1;
            const player2FromPayload = payload.Player2 || payload.player2 || 
                                      (payload as any).Player2 || (payload as any).player2;
            
            // Player extraction debug omitted
            
            // For gameStart messages, we MUST extract players - don't keep previous state
            const isGameStart = data.type === 'gameStart';
            let normalizedPlayer1 = isGameStart ? undefined : prevState.player1;
            let normalizedPlayer2 = isGameStart ? undefined : prevState.player2;
            
            if (player1FromPayload) {
              const normalized = normalizePlayer(player1FromPayload);
              if (normalized) {
                normalizedPlayer1 = normalized;
              } else {
                console.error('✗ Failed to normalize player1 from payload:', player1FromPayload);
                // For gameStart, we need players - don't keep undefined
                if (!isGameStart) {
                  normalizedPlayer1 = prevState.player1;
                }
              }
            } else {
              console.warn('⚠ No player1 in payload');
              if (!isGameStart) {
                // Keeping previous player1
              } else {
                console.error('✗ gameStart message missing player1!');
              }
            }
            
            if (player2FromPayload) {
              const normalized = normalizePlayer(player2FromPayload);
              if (normalized) {
                normalizedPlayer2 = normalized;
              } else {
                console.error('✗ Failed to normalize player2 from payload:', player2FromPayload);
                // For gameStart, we need players - don't keep undefined
                if (!isGameStart) {
                  normalizedPlayer2 = prevState.player2;
                }
              }
            } else {
              console.warn('⚠ No player2 in payload');
              if (!isGameStart) {
                // Keeping previous player2
              } else {
                console.error('✗ gameStart message missing player2!');
              }
            }
            
            // Critical check: if gameStart but no players, log error
            if (isGameStart && (!normalizedPlayer1 || !normalizedPlayer2)) {
              console.error('🚨 CRITICAL: gameStart message received but players are missing!');
              console.error('  Player1:', normalizedPlayer1);
              console.error('  Player2:', normalizedPlayer2);
              console.error('  Full payload:', JSON.stringify(payload, null, 2));
            }
            
            // Handle status - backend sends Status (capital S) in GameState struct
            const statusFromPayload = payload.Status || payload.status;
            const normalizedStatus = statusFromPayload || prevState.status || 'waiting';
            
            // CRITICAL: If we have both players (especially for computer mode), game MUST be in_progress
            // This ensures computer mode never shows "waiting" when game has started
            let finalStatus: 'waiting' | 'in_progress' | 'completed' | 'draw' = 'waiting';
            
            // PRIORITY 1: If we have both players, game is definitely in progress (especially for gameStart)
            if (normalizedPlayer1 && normalizedPlayer2) {
              // For gameStart messages with both players, ALWAYS set to in_progress
              if (data.type === 'gameStart') {
                finalStatus = 'in_progress';
                // gameStart with both players - forcing in_progress
              } else if (normalizedStatus === 'completed' || normalizedStatus === 'finished') {
                finalStatus = 'completed';
              } else if (normalizedStatus === 'draw' || normalizedStatus === 'tie') {
                finalStatus = 'draw';
              } else {
                // If we have both players, game must be in progress (not waiting)
                finalStatus = 'in_progress';
                // Both players present - setting status to in_progress
              }
            } else {
              // PRIORITY 2: No both players yet - use status from payload or default to waiting
              if (normalizedStatus === 'in_progress' || normalizedStatus === 'in-progress' || normalizedStatus === 'inProgress') {
                finalStatus = 'in_progress';
              } else if (normalizedStatus === 'completed' || normalizedStatus === 'finished') {
                finalStatus = 'completed';
              } else if (normalizedStatus === 'draw' || normalizedStatus === 'tie') {
                finalStatus = 'draw';
              } else {
                finalStatus = 'waiting';
              }
            }
            
            // Status handling summarized
            
            const newState: GameState = {
              board: board,
              currentTurn: payload.currentTurn ?? prevState.currentTurn ?? 1,
              status: finalStatus,
              winner: payload.winner ? normalizePlayer(payload.winner) : prevState.winner,
              player1: normalizedPlayer1,
              player2: normalizedPlayer2,
              lastMove: payload.lastMove ?? prevState.lastMove,
            };
            
            // Game state updated (detailed debug logs removed)
            
            // Clear pending move when we receive server update
            setPendingMove(null);
            return newState;
          });
        } else if (data.type === 'error') {
          console.error('Game error:', data.payload);
          // You could show an error message to the user here
        }
      } catch (error) {
        console.error('[9] GameBoard: Error parsing WebSocket message:', error);
        console.error('[9] GameBoard: Raw message data:', event.data);
      }
    };
    
    // Attach the message handler using onmessage (this is the standard way)
    // If handler already exists (from React StrictMode double mount), replace it
    // since we want GameBoard's handler to be the primary one
  const existingHandler = websocket.onmessage;
    websocket.onmessage = (event) => {
      // Call existing handler first if it exists (for chaining)
      if (existingHandler) {
        existingHandler.call(websocket, event);
      }
      // Then call our handler
      messageHandler(event);
    };
  // Message handler attached to WebSocket (debug log removed)
    
    // Don't override onopen/onclose/onerror - let App.tsx handle those
    // Just log when they fire for debugging
    const originalOnOpen = websocket.onopen;
    if (originalOnOpen) {
      websocket.onopen = (event) => {
        // If websocket opens after handler setup, start the timeout
        if (gameStartTimeout === null && websocket.readyState === WebSocket.OPEN) {
          gameStartTimeout = setTimeout(() => {
            if (!messageReceived && websocket.readyState === WebSocket.OPEN) {
              console.error('🚨 [8] GameBoard: CRITICAL ERROR - No gameStart message received!');
              console.error('[8] GameBoard: WebSocket readyState:', websocket.readyState);
              console.error('[8] GameBoard: Backend may not be running or not responding');
            }
          }, 5000);
        }
        originalOnOpen.call(websocket, event);
      };
    }
    
    const originalOnError = websocket.onerror;
    if (originalOnError) {
      websocket.onerror = (error) => {
        console.error('[8] GameBoard: WebSocket error in GameBoard:', error);
        originalOnError.call(websocket, error);
      };
    }
    
    const originalOnClose = websocket.onclose;
    if (originalOnClose) {
      websocket.onclose = (event) => {
        // WebSocket closed in GameBoard (debug log removed)
        originalOnClose.call(websocket, event);
      };
    }
    
    return () => {
      // Cleaning up WebSocket message handler (debug log removed)
      if (gameStartTimeout !== null) {
        clearTimeout(gameStartTimeout);
        gameStartTimeout = null;
      }
      // Don't remove onmessage handler here - App.tsx manages the WebSocket lifecycle
      // Removing it would break the connection
    };
  }, [websocket, username]); // Include username to avoid stale closure

  // Notify leaderboard when game ends
  useEffect(() => {
    const gameEnded = gameState.status === 'completed' || gameState.status === 'draw';
    
    if (gameEnded) {
      // Notify leaderboard to refresh immediately when game ends
      try {
        // Dispatch a CustomEvent with details so listeners can optimistically
        // update UI if desired, then refetch authoritative data.
        const detail = { winner: gameState.winner?.username, isDraw: gameState.status === 'draw' };
        window.dispatchEvent(new CustomEvent('leaderboard:update', { detail }));
      } catch (err) {
        console.error('Failed to dispatch leaderboard update event:', err);
      }
    }
  }, [gameState.status, gameState.winner?.username]);

  const handleExit = useCallback(() => {
    // Exit to mode selection: clear only game state and game mode, keep username
    try {
      clearGameState();
      clearGameMode();
      // reload so App will re-read gameMode and show selection
      window.location.reload();
    } catch (err) {
      console.error('Exit failed:', err);
    }
  }, []);

  const handleGameFinishedPlayAgain = useCallback(() => {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not ready');
      return;
    }
    setIsLoadingRematch(true);
    try {
      websocket.send(JSON.stringify({ type: 'playAgain', payload: {} }));
      // Keep popup visible while waiting for server to create new game
    } catch (err) {
      console.error('Play again failed:', err);
      setIsLoadingRematch(false);
    }
  }, [websocket]);

  const handleGameFinishedExit = useCallback(() => {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not ready');
      return;
    }
    setIsLoadingRematch(true);
    try {
      websocket.send(JSON.stringify({ type: 'exitGame', payload: {} }));
      // Clear game state and return to mode selection
      clearGameState();
      clearGameMode();
      window.location.reload();
    } catch (err) {
      console.error('Exit game failed:', err);
      setIsLoadingRematch(false);
    }
  }, [websocket]);

  useEffect(() => {
    // Turn check triggered (debug log removed)
    // Check if it's the user's turn
    // Player objects are now normalized to have lowercase 'username'
    const player1Username = gameState.player1?.username;
    const player2Username = gameState.player2?.username;
    
    const isPlayer1 = username === player1Username;
    const isPlayer2 = username === player2Username;
    
    // Use effective status (if both players present but status is waiting, treat as in_progress)
    const effectiveStatus = getEffectiveStatus();
    
    const myTurn = effectiveStatus === 'in_progress' &&
      ((gameState.currentTurn === 1 && isPlayer1) ||
       (gameState.currentTurn === 2 && isPlayer2));
    
    // Turn check result computed (debug log removed)
    
    setIsMyTurn(myTurn);
  }, [gameState, username, getEffectiveStatus]);

  const handleColumnClick = useCallback((col: number) => {
    // Use effective status - if both players present, treat as in_progress even if status says waiting
    const effectiveStatus = getEffectiveStatus();
    
    if (!isMyTurn || effectiveStatus !== 'in_progress') {
      // Move blocked (not player's turn or not in progress)
      return;
    }

    // Find the lowest empty row in the column
    let row = 5;
    while (row >= 0 && gameState.board[row] && gameState.board[row][col] !== 0) {
      row--;
    }

    // If column is full, don't do anything
    if (row < 0) {
      return;
    }

    // Determine which player is making the move
    const player1Username = gameState.player1?.username;
    const isPlayer1 = username === player1Username;
    const currentPlayer = isPlayer1 ? 1 : 2;
    // If WebSocket is not open, don't optimistically update - avoid showing a
    // move that the server never receives.
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      console.error('[GameBoard.handleColumnClick] Cannot send move - WebSocket not open');
      return;
    }

    // Capture previous board in case we need to revert optimistic update
    const prevBoard = gameState.board.map((r) => [...r]);
    const prevLastMove = gameState.lastMove;
    const prevCurrentTurn = gameState.currentTurn;

    // Optimistic update - apply immediately
    setGameState((prev) => {
      try {
        const newBoard = prev.board.map((r) => [...r]);
        if (newBoard[row] && newBoard[row][col] === 0) {
          newBoard[row][col] = currentPlayer;
        }
        return {
          ...prev,
          board: newBoard,
          lastMove: { row, column: col, player: currentPlayer },
          currentTurn: 3 - currentPlayer,
        } as GameState;
      } catch (err) {
        console.error('Error applying optimistic move:', err);
        return prev;
      }
    });

    // Keep a pending move for animation / fallback UI and start timeout
    if (pendingMoveTimeoutRef.current) {
      clearTimeout(pendingMoveTimeoutRef.current);
      pendingMoveTimeoutRef.current = null;
    }
    setPendingMove({ row, col, player: currentPlayer });

    // Send move to server and revert optimistic update on failure
    try {
      websocket.send(JSON.stringify({ type: 'move', payload: { column: col } }));
      // Log the move action for debugging/play tracing
      console.log(`[GameBoard] Move sent: column=${col}, player=${currentPlayer}`);
    } catch (err) {
      console.error('WebSocket send error:', err);
      // Revert optimistic update
      setGameState((prev) => ({
        ...prev,
        board: prevBoard,
        lastMove: prevLastMove,
        currentTurn: prevCurrentTurn,
      } as GameState));
      setPendingMove(null);
      return;
    }

    // Clear pending move after a short delay (in case server response is slow).
    // The onmessage handler will also clear pendingMove when it processes the
    // server-sent gameState.
    pendingMoveTimeoutRef.current = setTimeout(() => {
      setPendingMove(null);
      pendingMoveTimeoutRef.current = null;
    }, PENDING_MOVE_TIMEOUT_MS);
  }, [isMyTurn, gameState, username, websocket, getEffectiveStatus]);

  // Ensure board is always an array - defensive check
  const board: number[][] = (gameState.board && Array.isArray(gameState.board) && gameState.board.length > 0)
    ? gameState.board
    : Array(6).fill(null).map(() => Array(7).fill(0));

  // renderCell was removed in favor of inline rendering to avoid duplication

  const renderGameStatus = () => {
    // CRITICAL FIX: If we have both players but status is waiting, treat as in_progress
    // This prevents "Waiting for opponent" from showing in computer mode
    const effectiveStatus = getEffectiveStatus();
    
    switch (effectiveStatus) {
      case 'waiting':
        return <div className="status">Waiting for opponent...</div>;
      case 'in_progress':
        return (
          <div className="status">
            {isMyTurn ? "Your turn" : (
              // If opponent is a bot, show 'Bot's turn' for clarity
              (gameState.player1?.isBot || gameState.player2?.isBot) ? "Bot's turn" : "Opponent's turn"
            )}
          </div>
        );
      case 'completed':
        return (
          <div className="status">
            {gameState.winner?.username === username ? "You won!" : "You lost!"}
          </div>
        );
      case 'draw':
        return <div className="status">Game ended in a draw!</div>;
      default:
        return null;
    }
  };

  // Final safety check - ensure board is valid before rendering
  const safeBoard: number[][] = (board && Array.isArray(board) && board.length === 6)
    ? board
    : Array(6).fill(null).map(() => Array(7).fill(0));

  const handleCancelWaiting = useCallback(() => {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      const message = {
        type: 'cancelWaiting',
        payload: {}
      };
      websocket.send(JSON.stringify(message));
    }
    handleExit();
  }, [websocket, handleExit]);

  // 10-second timeout: If playing with friend and still waiting after 10 seconds, switch to bot
  useEffect(() => {
    // Clear any existing timeout
    if (friendWaitingTimeoutRef.current) {
      clearTimeout(friendWaitingTimeoutRef.current);
      friendWaitingTimeoutRef.current = null;
    }

    const currentMode = loadGameMode();
    const isWaitingForFriend = gameState.status === 'waiting' && 
                               currentMode === 'friend' && 
                               (!gameState.player1 || !gameState.player2);
    
    if (!isWaitingForFriend) {
      return;
    }

    // Set up 10-second timeout to switch to bot mode
    friendWaitingTimeoutRef.current = setTimeout(() => {
      friendWaitingTimeoutRef.current = null;
      
      // Check current state (not stale closure)
      const currentState = loadGameState();
      const stillInFriendMode = loadGameMode() === 'friend';
      
      // Check if still waiting (no friend joined) - use current state
      const stillWaiting = (!currentState || 
                           currentState.status === 'waiting') &&
                          stillInFriendMode &&
                          (!currentState?.player1 || !currentState?.player2);
      
      if (stillWaiting && websocket && websocket.readyState === WebSocket.OPEN) {
        console.log('[GameBoard] 10-second timeout expired - switching to bot mode');
        
        // Switch to computer mode
        saveGameMode('computer');
        
        // Send cancelWaiting message to backend
        if (websocket.readyState === WebSocket.OPEN) {
          websocket.send(JSON.stringify({ type: 'cancelWaiting', payload: {} }));
        }
        
        // Wait a moment then rejoin with computer mode
        setTimeout(() => {
          if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({ 
              type: 'join', 
              payload: { username: usernameRef.current, gameMode: 'computer' } 
            }));
            // Dispatch event to update active users immediately
            window.dispatchEvent(new CustomEvent('game:join'));
          }
        }, 100);
      }
    }, FRIEND_WAITING_TIMEOUT_MS);

    return () => {
      if (friendWaitingTimeoutRef.current) {
        clearTimeout(friendWaitingTimeoutRef.current);
        friendWaitingTimeoutRef.current = null;
      }
    };
  }, [gameState.status, gameState.player1, gameState.player2, websocket]);

  return (
    <div className="game-board" role="region" aria-label="Connect 4 Game Board">
      {gameFinished && finishedData && (
        <GameFinished
          winner={finishedData.winner}
          isDraw={finishedData.isDraw}
          botWon={finishedData.botWon}
          onPlayAgain={handleGameFinishedPlayAgain}
          onExit={handleGameFinishedExit}
          isLoading={isLoadingRematch}
        />
      )}
      {renderGameStatus()}
      {gameState.status === 'waiting' && loadGameMode() === 'friend' && (
        <WaitingOverlay onCancel={handleCancelWaiting} />
      )}
      <div 
        className="board" 
        role="grid" 
        aria-label="Game grid"
        aria-readonly={!isMyTurn}
      >
        {safeBoard.map((row, rowIndex) => {
          const safeRow = (row && Array.isArray(row) && row.length === 7) ? row : Array(7).fill(0);
          return (
            <div key={rowIndex} className="row" role="row">
              {safeRow.map((_, colIndex) => {
                // Check if this cell has a pending move (optimistic update)
                const hasPendingMove = pendingMove && pendingMove.row === rowIndex && pendingMove.col === colIndex;
                const cellValue = hasPendingMove ? pendingMove.player : safeRow[colIndex];
                const isLastMove = gameState.lastMove && 
                  gameState.lastMove.row === rowIndex && 
                  gameState.lastMove.column === colIndex;
                
                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    role="gridcell"
                    aria-label={`Row ${rowIndex + 1}, Column ${colIndex + 1}`}
                    aria-disabled={!isMyTurn}
                    onClick={() => handleColumnClick(colIndex)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleColumnClick(colIndex);
                      }
                    }}
                    tabIndex={isMyTurn ? 0 : -1}
                    className={`cell ${cellValue === 1 ? 'player1' : cellValue === 2 ? 'player2' : ''} ${isLastMove ? 'last-move' : ''} ${hasPendingMove ? 'pending-move' : ''}`}
                    style={{ cursor: (isMyTurn && getEffectiveStatus() === 'in_progress') ? 'pointer' : 'default' }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GameBoard;