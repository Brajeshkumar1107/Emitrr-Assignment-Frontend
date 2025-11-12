// Session storage utilities for game state persistence
// Uses sessionStorage which automatically clears when the browser tab is closed

const STORAGE_KEYS = {
  GAME_STATE: 'connect4_gameState',
  USERNAME: 'connect4_username',
  GAME_MODE: 'connect4_gameMode',
  LAST_UPDATED: 'connect4_lastUpdated',
};

// Helper to get storage (sessionStorage for session-only persistence)
const getStorage = () => sessionStorage;

export interface StoredGameState {
  board: number[][];
  currentTurn: number;
  status: 'waiting' | 'in_progress' | 'completed' | 'draw';
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
  winner?: {
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

// Save game state to session storage
export const saveGameState = (gameState: StoredGameState): void => {
  try {
    const storage = getStorage();
    storage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify(gameState));
    storage.setItem(STORAGE_KEYS.LAST_UPDATED, Date.now().toString());
  } catch (error) {
    // ignore storage save errors
  }
};

// Load game state from session storage
export const loadGameState = (): StoredGameState | null => {
  try {
    const storage = getStorage();
    const stored = storage.getItem(STORAGE_KEYS.GAME_STATE);
    if (stored) {
      const gameState = JSON.parse(stored);
      return gameState;
    }
  } catch (error) {
    // ignore load errors
  }
  return null;
};

// Save username to session storage
export const saveUsername = (username: string): void => {
  try {
    const storage = getStorage();
    storage.setItem(STORAGE_KEYS.USERNAME, username);
    // Update last-updated timestamp so stored data is considered valid
    storage.setItem(STORAGE_KEYS.LAST_UPDATED, Date.now().toString());
  } catch (error) {
    // ignore
  }
};

// Load username from session storage
export const loadUsername = (): string | null => {
  try {
    const storage = getStorage();
    // Only return stored username if stored data is still considered valid
    if (!isStoredDataValid()) return null;
    return storage.getItem(STORAGE_KEYS.USERNAME);
  } catch (error) {
    // ignore
    return null;
  }
};

// Save game mode to session storage
export const saveGameMode = (gameMode: 'friend' | 'computer'): void => {
  try {
    const storage = getStorage();
    storage.setItem(STORAGE_KEYS.GAME_MODE, gameMode);
    // Update last-updated timestamp so stored data is considered valid
    storage.setItem(STORAGE_KEYS.LAST_UPDATED, Date.now().toString());
  } catch (error) {
    // ignore
  }
};

// Load game mode from session storage
export const loadGameMode = (): 'friend' | 'computer' | null => {
  try {
    const storage = getStorage();
    const mode = storage.getItem(STORAGE_KEYS.GAME_MODE);
    if (mode === 'friend' || mode === 'computer') {
      return mode;
    }
    return null;
  } catch (error) {
    // ignore
    return null;
  }
};

// Clear all game data from session storage
export const clearGameData = (): void => {
  try {
    const storage = getStorage();
    storage.removeItem(STORAGE_KEYS.GAME_STATE);
    storage.removeItem(STORAGE_KEYS.USERNAME);
    storage.removeItem(STORAGE_KEYS.GAME_MODE);
    storage.removeItem(STORAGE_KEYS.LAST_UPDATED);
  } catch (error) {
    // ignore
  }
};

// Clear only game state (keep username and mode)
export const clearGameState = (): void => {
  try {
    const storage = getStorage();
    storage.removeItem(STORAGE_KEYS.GAME_STATE);
    storage.removeItem(STORAGE_KEYS.LAST_UPDATED);
  } catch (error) {
    // ignore
  }
};

// Clear only game mode (keep username)
export const clearGameMode = (): void => {
  try {
    const storage = getStorage();
    storage.removeItem(STORAGE_KEYS.GAME_MODE);
    storage.removeItem(STORAGE_KEYS.LAST_UPDATED);
  } catch (error) {
    // ignore
  }
};

// Check if stored data is still valid (not too old - e.g., 24 hours)
export const isStoredDataValid = (): boolean => {
  try {
    const storage = getStorage();
    const lastUpdated = storage.getItem(STORAGE_KEYS.LAST_UPDATED);
    if (!lastUpdated) return false;
    
    const timestamp = parseInt(lastUpdated, 10);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    return (now - timestamp) < maxAge;
  } catch (error) {
    return false;
  }
};

