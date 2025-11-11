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
    console.log('Game state saved to session storage');
  } catch (error) {
    console.error('Error saving game state to session storage:', error);
  }
};

// Load game state from session storage
export const loadGameState = (): StoredGameState | null => {
  try {
    const storage = getStorage();
    const stored = storage.getItem(STORAGE_KEYS.GAME_STATE);
    if (stored) {
      const gameState = JSON.parse(stored);
      console.log('Game state loaded from session storage');
      return gameState;
    }
  } catch (error) {
    console.error('Error loading game state from session storage:', error);
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
    console.error('Error saving username to session storage:', error);
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
    console.error('Error loading username from session storage:', error);
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
    console.error('Error saving game mode to session storage:', error);
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
    console.error('Error loading game mode from session storage:', error);
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
    console.log('Game data cleared from session storage');
  } catch (error) {
    console.error('Error clearing game data from session storage:', error);
  }
};

// Clear only game state (keep username and mode)
export const clearGameState = (): void => {
  try {
    const storage = getStorage();
    storage.removeItem(STORAGE_KEYS.GAME_STATE);
    storage.removeItem(STORAGE_KEYS.LAST_UPDATED);
    console.log('Game state cleared from session storage');
  } catch (error) {
    console.error('Error clearing game state from session storage:', error);
  }
};

// Clear only game mode (keep username)
export const clearGameMode = (): void => {
  try {
    const storage = getStorage();
    storage.removeItem(STORAGE_KEYS.GAME_MODE);
    storage.removeItem(STORAGE_KEYS.LAST_UPDATED);
    console.log('Game mode cleared from session storage');
  } catch (error) {
    console.error('Error clearing game mode from session storage:', error);
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

