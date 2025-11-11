// types.ts
export interface GameState {
  board: number[][];
  currentTurn: number;
  status: 'waiting' | 'in_progress' | 'completed' | 'draw';
  winner?: Player;
  player1?: Player;
  player2?: Player;
  lastMove?: Move;
}

export interface Player {
  id: string;
  username: string;
  isBot?: boolean;
}

export interface Move {
  row: number;
  column: number;
  player: number;
}

export interface PlayerStats {
  username: string;
  gamesPlayed: number;
  gamesWon: number;
  winPercentage: number;
}

export interface WebSocketMessage {
  type: 'join' | 'move' | 'gameState' | 'gameStart' | 'error';
  gameId?: string;
  payload: any;
}