import React, { useState, useEffect, useCallback, useRef } from 'react';
import './GameBoard.css';
import {
  saveGameState,
  loadGameState,
  clearGameState,
  StoredGameState,
  clearGameMode
} from '../../utils/localStorage'; // removed loadGameMode (unused)
import GameFinished from '../GameFinished/GameFinished'; // removed WaitingOverlay (unused)

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
  const debug = (...args: any[]) => console.log('[GameBoard]', ...args);

  const getInitialState = (): GameState => {
    const stored = loadGameState();
    if (stored && stored.player1 && stored.player2) {
      debug('Restoring saved game state:', stored);
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
      status: 'waiting',
    };
  };

  const [gameState, setGameState] = useState<GameState>(getInitialState);
  const [gameFinished, setGameFinished] = useState(false);
  const [finishedData, setFinishedData] = useState<any>(null);
  const [isLoadingRematch, setIsLoadingRematch] = useState(false);

  const usernameRef = useRef<string>(username);
  useEffect(() => { usernameRef.current = username; }, [username]);

  // Save state
  useEffect(() => {
    if (gameState.status !== 'waiting' || (gameState.player1 && gameState.player2)) {
      saveGameState({
        board: gameState.board,
        currentTurn: gameState.currentTurn,
        status: gameState.status,
        player1: gameState.player1,
        player2: gameState.player2,
        winner: gameState.winner,
        lastMove: gameState.lastMove,
      });
    }
  }, [gameState]);

  // WebSocket message handling
  useEffect(() => {
    if (!websocket) return;
    debug('WebSocket effect mounted.');

    const messageHandler = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      debug('🔵 WS Received:', data.type, data.payload);

      switch (data.type) {
        case 'gameFinished':
          debug('🏁 Game finished:', data.payload);
          setFinishedData({
            winner: data.payload?.winner || null,
            isDraw: data.payload?.isDraw || false,
            botWon: data.payload?.botWon || false,
          });
          setGameFinished(true);
          break;

        case 'gameStart':
        case 'gameState': {
          const payload = data.payload || {};
          let board = payload.board;
          if (!Array.isArray(board)) board = Array(6).fill(null).map(() => Array(7).fill(0));

          const normalizePlayer = (p: any) => {
            if (!p) return undefined;
            return {
              username: p.Username || p.username,
              id: p.ID || p.id,
              isBot: p.IsBot || p.isBot || false,
            };
          };

          setGameState({
            board,
            currentTurn: payload.currentTurn ?? 1,
            status: payload.Status || payload.status || 'waiting',
            winner: payload.winner ? normalizePlayer(payload.winner) : undefined,
            player1: normalizePlayer(payload.Player1 || payload.player1),
            player2: normalizePlayer(payload.Player2 || payload.player2),
            lastMove: payload.lastMove,
          });

          debug('🟢 Updated game state:', payload);
          setGameFinished(false);
          setFinishedData(null);
          setIsLoadingRematch(false);
          break;
        }

        default:
          debug('⚪ Unknown WS type:', data.type);
      }
    };

    websocket.onmessage = messageHandler;
    websocket.onopen = () => debug('✅ WebSocket connected.');
    websocket.onclose = () => debug('❌ WebSocket closed.');
    websocket.onerror = (err) => debug('⚠️ WebSocket error:', err);

    return () => {
      websocket.onmessage = null;
      websocket.onclose = null;
      websocket.onerror = null;
      debug('🧹 WS listeners cleaned up.');
    };
  }, [websocket]);

  const handleGameFinishedPlayAgain = useCallback(() => {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      debug('❌ WS not open for playAgain');
      return;
    }
    debug('🔁 Sending playAgain...');
    setIsLoadingRematch(true);
    websocket.send(JSON.stringify({ type: 'playAgain', payload: {} }));
  }, [websocket]);

  const handleGameFinishedExit = useCallback(() => {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      debug('❌ WS not open for exitGame');
      return;
    }
    debug('🚪 Sending exitGame...');
    setIsLoadingRematch(true);
    websocket.send(JSON.stringify({ type: 'exitGame', payload: {} }));
    clearGameState();
    clearGameMode();
    window.location.reload();
  }, [websocket]);

  const handleColumnClick = useCallback((col: number) => {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
    debug('🟡 Move clicked, sending column:', col);
    websocket.send(JSON.stringify({ type: 'move', payload: { column: col } }));
  }, [websocket]);

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
        {gameState.status === 'in_progress' && "Game in progress..."}
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
