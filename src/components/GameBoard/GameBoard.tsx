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
  // Load initial state
  const getInitialState = (): GameState => {
    const stored = loadGameState();
    if (stored && stored.player1 && stored.player2) {
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

  const getEffectiveStatus = useCallback((): 'waiting' | 'in_progress' | 'completed' | 'draw' => {
    if (gameState.player1 && gameState.player2 && gameState.status === 'waiting') return 'in_progress';
    return gameState.status;
  }, [gameState.player1, gameState.player2, gameState.status]);

  useEffect(() => { usernameRef.current = username; }, [username]);

  const PENDING_MOVE_TIMEOUT_MS = 2000;

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

  useEffect(() => {
    if (gameState.status === 'completed' || gameState.status === 'draw') {
      const timer = setTimeout(() => {}, 5000);
      const updateEvent = new CustomEvent('leaderboard:update', {
        detail: { gameStatus: gameState.status, winner: gameState.winner }
      });
      window.dispatchEvent(updateEvent);
      return () => clearTimeout(timer);
    }
  }, [gameState.status, gameState.winner]);

  useEffect(() => {
    if (!websocket || websocket.readyState === WebSocket.CLOSED || websocket.readyState === WebSocket.CLOSING) return;

    let gameStartTimeout: NodeJS.Timeout | null = null;
    let messageReceived = false;

    if (websocket.readyState === WebSocket.OPEN) {
      gameStartTimeout = setTimeout(() => {
        if (!messageReceived && websocket.readyState === WebSocket.OPEN) {
          // No gameStart received within timeout - continue silently
        }
      }, 5000);
    }

    const messageHandler = (event: MessageEvent) => {
      messageReceived = true;
      if (gameStartTimeout) {
        clearTimeout(gameStartTimeout);
        gameStartTimeout = null;
      }

      try {
        const data = JSON.parse(event.data);

        if (data.type === 'leaderboardUpdate') {
          window.dispatchEvent(new CustomEvent('leaderboard:update', { detail: data.payload || {} }));
          return;
        }

        if (data.type === 'gameFinished') {
          setFinishedData({
            winner: data.payload?.winner || null,
            isDraw: data.payload?.isDraw || false,
            botWon: data.payload?.botWon || false,
          });
          setGameFinished(true);
          return;
        }

        if (data.type === 'rematchTimeout') {
          setFinishedData((prev: any) => prev ? {
            ...prev,
            timedOut: true,
            timeoutMessage: data.payload?.message
          } : null);
          return;
        }

        if (data.type === 'opponentExited') {
          setGameFinished(true);
          setFinishedData({
            winner: null,
            isDraw: false,
            botWon: false,
            opponentExited: true,
          });
          return;
        }

        if (data.type === 'gameStart' || data.type === 'gameState') {
          const payload = data.payload || {};
          let board = payload.board;
          if (!Array.isArray(board)) board = Array(6).fill(null).map(() => Array(7).fill(0));

          const normalizePlayer = (player: any) => {
            if (!player) return undefined;
            const username = player.Username || player.username;
            const id = player.ID || player.id;
            const isBot = player.IsBot || player.isBot || false;
            if (!username && !id) return undefined;
            return { username: username || id, id: id || username, isBot };
          };

          setGameState((prev) => ({
            board: board,
            currentTurn: payload.currentTurn ?? prev.currentTurn ?? 1,
            status: payload.Status || payload.status || 'waiting',
            winner: payload.winner ? normalizePlayer(payload.winner) : prev.winner,
            player1: normalizePlayer(payload.Player1 || payload.player1) || prev.player1,
            player2: normalizePlayer(payload.Player2 || payload.player2) || prev.player2,
            lastMove: payload.lastMove ?? prev.lastMove,
          }));

          setPendingMove(null);
          if (payload.Status === 'in_progress') {
            setGameFinished(false);
            setFinishedData(null);
            setIsLoadingRematch(false);
          }
        }
      } catch {
        // ignore parsing errors
      }
    };

    websocket.onmessage = messageHandler;

    return () => {
      if (gameStartTimeout) clearTimeout(gameStartTimeout);
    };
  }, [websocket, username]);

  useEffect(() => {
    const gameEnded = gameState.status === 'completed' || gameState.status === 'draw';
    if (gameEnded) {
      const detail = { winner: gameState.winner?.username, isDraw: gameState.status === 'draw' };
      window.dispatchEvent(new CustomEvent('leaderboard:update', { detail }));
    }
  }, [gameState.status, gameState.winner?.username]);

  const handleExit = useCallback(() => {
    clearGameState();
    clearGameMode();
    window.location.reload();
  }, []);

  const handleGameFinishedPlayAgain = useCallback(() => {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
    setIsLoadingRematch(true);
    websocket.send(JSON.stringify({ type: 'playAgain', payload: {} }));
  }, [websocket]);

  const handleGameFinishedExit = useCallback(() => {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
    setIsLoadingRematch(true);
    websocket.send(JSON.stringify({ type: 'exitGame', payload: {} }));
    clearGameState();
    clearGameMode();
    window.location.reload();
  }, [websocket]);

  useEffect(() => {
    const player1Username = gameState.player1?.username;
    const player2Username = gameState.player2?.username;
    const isPlayer1 = username === player1Username;
    const isPlayer2 = username === player2Username;

    const effectiveStatus = getEffectiveStatus();
    const myTurn = effectiveStatus === 'in_progress' &&
      ((gameState.currentTurn === 1 && isPlayer1) || (gameState.currentTurn === 2 && isPlayer2));

    setIsMyTurn(myTurn);
  }, [gameState, username, getEffectiveStatus]);

  const handleColumnClick = useCallback((col: number) => {
    const effectiveStatus = getEffectiveStatus();
    if (!isMyTurn || effectiveStatus !== 'in_progress') return;

    let row = 5;
    while (row >= 0 && gameState.board[row][col] !== 0) row--;
    if (row < 0) return;

    const isPlayer1 = username === gameState.player1?.username;
    const currentPlayer = isPlayer1 ? 1 : 2;
    if (!websocket || websocket.readyState !== WebSocket.OPEN) return;

    const prevBoard = gameState.board.map(r => [...r]);
    const prevLastMove = gameState.lastMove;
    const prevCurrentTurn = gameState.currentTurn;

    setGameState(prev => {
      const newBoard = prev.board.map(r => [...r]);
      newBoard[row][col] = currentPlayer;
      return {
        ...prev,
        board: newBoard,
        lastMove: { row, column: col, player: currentPlayer },
        currentTurn: 3 - currentPlayer,
      };
    });

    setPendingMove({ row, col, player: currentPlayer });
    try {
      websocket.send(JSON.stringify({ type: 'move', payload: { column: col } }));
    } catch {
      setGameState({
        ...gameState,
        board: prevBoard,
        lastMove: prevLastMove,
        currentTurn: prevCurrentTurn,
      });
    }

    pendingMoveTimeoutRef.current = setTimeout(() => {
      setPendingMove(null);
    }, PENDING_MOVE_TIMEOUT_MS);
  }, [isMyTurn, gameState, username, websocket, getEffectiveStatus]);

  const board = gameState.board && Array.isArray(gameState.board) ? gameState.board : Array(6).fill(null).map(() => Array(7).fill(0));

  const renderGameStatus = () => {
    const effectiveStatus = getEffectiveStatus();
    switch (effectiveStatus) {
      case 'waiting': return <div className="status">Waiting for opponent...</div>;
      case 'in_progress': return (
        <div className="status">
          {isMyTurn ? "Your turn" : ((gameState.player1?.isBot || gameState.player2?.isBot) ? "Bot's turn" : "Opponent's turn")}
        </div>
      );
      case 'completed': return <div className="status">{gameState.winner?.username === username ? "You won!" : "You lost!"}</div>;
      case 'draw': return <div className="status">Game ended in a draw!</div>;
      default: return null;
    }
  };

  const handleCancelWaiting = useCallback(() => {
    if (websocket && websocket.readyState === WebSocket.OPEN)
      websocket.send(JSON.stringify({ type: 'cancelWaiting', payload: {} }));
    handleExit();
  }, [websocket, handleExit]);

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
      <div className="board" role="grid">
        {board.map((row, rIdx) => (
          <div key={rIdx} className="row" role="row">
            {row.map((_, cIdx) => {
              const hasPendingMove = pendingMove && pendingMove.row === rIdx && pendingMove.col === cIdx;
              const cellValue = hasPendingMove ? pendingMove.player : row[cIdx];
              return (
                <div
                  key={`${rIdx}-${cIdx}`}
                  role="gridcell"
                  onClick={() => handleColumnClick(cIdx)}
                  tabIndex={isMyTurn ? 0 : -1}
                  className={`cell ${cellValue === 1 ? 'player1' : cellValue === 2 ? 'player2' : ''}`}
                  style={{ cursor: (isMyTurn && getEffectiveStatus() === 'in_progress') ? 'pointer' : 'default' }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GameBoard;
