import React, { useState, useEffect, useCallback, useRef } from 'react';
import './GameBoard.css';
import {
  saveGameState,
  loadGameState,
  clearGameState,
  StoredGameState,
  loadGameMode,
  clearGameMode
} from '../../utils/localStorage';
import WaitingOverlay from './WaitingOverlay';
import GameFinished from '../GameFinished/GameFinished';

interface GameState {
  board: number[][];
  currentTurn: number;
  status: 'waiting' | 'in_progress' | 'completed' | 'draw';
  winner?: { username: string; id?: string; isBot?: boolean };
  player1?: { username: string; id?: string; isBot?: boolean };
  player2?: { username: string; id?: string; isBot?: boolean };
  lastMove?: { row: number; column: number; player: number };
}

interface GameBoardProps {
  websocket: WebSocket;
  username: string;
}

const GameBoard: React.FC<GameBoardProps> = ({ websocket, username }) => {
  // --- Debug helper ---
  const debug = (...args: any[]) => console.log('[GameBoard]', ...args);

  const getInitialState = (): GameState => {
    const stored = loadGameState();
    if (stored && stored.player1 && stored.player2) {
      debug('Restoring saved game state from localStorage:', stored);
      return {
        board: stored.board || Array(6).fill(null).map(() => Array(7).fill(0)),
        currentTurn: stored.currentTurn || 1,
        status: stored.status || 'waiting',
        player1: stored.player1,
        player2: stored.player2,
        winner: stored.winner,
        lastMove: stored.lastMove,
      };
    }
    debug('No stored state found. Initializing empty board.');
    return {
      board: Array(6).fill(null).map(() => Array(7).fill(0)),
      currentTurn: 1,
      status: 'waiting'
    };
  };

  const [gameState, setGameState] = useState<GameState>(getInitialState);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [pendingMove, setPendingMove] = useState<{ row: number, col: number, player: number } | null>(null);
  const [gameFinished, setGameFinished] = useState(false);
  const [finishedData, setFinishedData] = useState<any>(null);
  const [isLoadingRematch, setIsLoadingRematch] = useState(false);

  const usernameRef = useRef<string>(username);
  const pendingMoveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PENDING_MOVE_TIMEOUT_MS = 2000;

  useEffect(() => { usernameRef.current = username; }, [username]);

  // --- Save state changes ---
  useEffect(() => {
    if (gameState.status !== 'waiting' || (gameState.player1 && gameState.player2)) {
      debug('Saving game state to localStorage:', gameState);
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

  // --- WebSocket listener ---
  useEffect(() => {
    if (!websocket) return;
    debug('WebSocket effect mounted. ReadyState:', websocket.readyState);

    const messageHandler = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      debug('🔵 WS Received:', data.type, data.payload);

      switch (data.type) {
        case 'leaderboardUpdate':
          debug('📊 Leaderboard update received:', data.payload);
          break;

        case 'gameFinished':
          debug('🏁 Game finished. Winner:', data.payload?.winner);
          setFinishedData({
            winner: data.payload?.winner || null,
            isDraw: data.payload?.isDraw || false,
            botWon: data.payload?.botWon || false,
          });
          setGameFinished(true);
          break;

        case 'rematchTimeout':
          debug('⏳ Rematch timeout received:', data.payload);
          setFinishedData((prev: any) => prev ? { ...prev, timedOut: true, timeoutMessage: data.payload?.message } : null);
          break;

        case 'opponentExited':
          debug('🚪 Opponent exited. Returning to main menu.');
          setGameFinished(true);
          setFinishedData({
            winner: null,
            isDraw: false,
            botWon: false,
            opponentExited: true,
          });
          break;

        case 'gameStart':
        case 'gameState': {
          debug('🎮 Game update received (type:', data.type, ')');
          const payload = data.payload || {};
          let board = payload.board;
          if (!Array.isArray(board)) board = Array(6).fill(null).map(() => Array(7).fill(0));

          const normalizePlayer = (player: any) => {
            if (!player) return undefined;
            const username = player.Username || player.username;
            const id = player.ID || player.id;
            const isBot = player.IsBot || player.isBot || false;
            return { username, id, isBot };
          };

          setGameState((prev) => ({
            board,
            currentTurn: payload.currentTurn ?? prev.currentTurn ?? 1,
            status: payload.Status || payload.status || 'waiting',
            winner: payload.winner ? normalizePlayer(payload.winner) : prev.winner,
            player1: normalizePlayer(payload.Player1 || payload.player1) || prev.player1,
            player2: normalizePlayer(payload.Player2 || payload.player2) || prev.player2,
            lastMove: payload.lastMove ?? prev.lastMove,
          }));

          debug('🟢 Game state updated:', payload);
          setPendingMove(null);
          if (payload.Status === 'in_progress') {
            setGameFinished(false);
            setFinishedData(null);
            setIsLoadingRematch(false);
          }
          break;
        }

        default:
          debug('⚪ Unknown message type received:', data.type);
      }
    };

    websocket.onmessage = messageHandler;

    websocket.onopen = () => debug('✅ WebSocket connection established.');
    websocket.onclose = (e) => debug('❌ WebSocket closed:', e.reason || e.code);
    websocket.onerror = (err) => debug('⚠️ WebSocket error:', err);

    return () => {
      debug('🧹 Cleaning up WebSocket listeners.');
      websocket.onmessage = null;
      websocket.onclose = null;
      websocket.onerror = null;
    };
  }, [websocket]);

  // --- Play again handlers ---
  const handleGameFinishedPlayAgain = useCallback(() => {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      debug('❌ Cannot send playAgain — WebSocket not open');
      return;
    }
    debug('🔁 Sending playAgain request...');
    setIsLoadingRematch(true);
    websocket.send(JSON.stringify({ type: 'playAgain', payload: {} }));
  }, [websocket]);

  const handleGameFinishedExit = useCallback(() => {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      debug('❌ Cannot send exitGame — WebSocket not open');
      return;
    }
    debug('🚪 Exiting game session...');
    setIsLoadingRematch(true);
    websocket.send(JSON.stringify({ type: 'exitGame', payload: {} }));
    clearGameState();
    clearGameMode();
    window.location.reload();
  }, [websocket]);

  // --- Move click handler ---
  const handleColumnClick = useCallback((col: number) => {
    const effectiveStatus = gameState.status;
    if (!isMyTurn || effectiveStatus !== 'in_progress') return;
    debug('🟡 Player clicked column', col);

    let row = 5;
    while (row >= 0 && gameState.board[row][col] !== 0) row--;
    if (row < 0) return;

    const isPlayer1 = username === gameState.player1?.username;
    const currentPlayer = isPlayer1 ? 1 : 2;
    if (!websocket || websocket.readyState !== WebSocket.OPEN) return;

    websocket.send(JSON.stringify({ type: 'move', payload: { column: col } }));
    debug('📤 Sent move to backend: column', col);
  }, [isMyTurn, gameState, username, websocket]);

  // --- Exit ---
  const handleExit = useCallback(() => {
    debug('🚪 Exiting game. Clearing state.');
    clearGameState();
    clearGameMode();
    window.location.reload();
  }, []);

  // --- Render ---
  return (
    <div className="game-board">
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
      <div className="status">
        {gameState.status === 'waiting' && 'Waiting for opponent...'}
        {gameState.status === 'in_progress' && (isMyTurn ? 'Your turn' : "Opponent's turn")}
        {gameState.status === 'completed' && (gameState.winner?.username === username ? 'You won!' : 'You lost!')}
      </div>
      <div className="board">
        {gameState.board.map((row, rIdx) => (
          <div key={rIdx} className="row">
            {row.map((cell, cIdx) => (
              <div
                key={`${rIdx}-${cIdx}`}
                className={`cell ${cell === 1 ? 'player1' : cell === 2 ? 'player2' : ''}`}
                onClick={() => handleColumnClick(cIdx)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GameBoard;
