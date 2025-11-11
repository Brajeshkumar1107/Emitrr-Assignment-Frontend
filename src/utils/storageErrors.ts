// Error types for storage operations
export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

export class StorageQuotaError extends StorageError {
  constructor() {
    super('Storage quota exceeded');
    this.name = 'StorageQuotaError';
  }
}

export class StorageUnavailableError extends StorageError {
  constructor() {
    super('Storage is unavailable');
    this.name = 'StorageUnavailableError';
  }
}

// Event bus for storage errors
type ErrorCallback = (error: StorageError) => void;
const errorListeners: ErrorCallback[] = [];

export const addStorageErrorListener = (callback: ErrorCallback) => {
  errorListeners.push(callback);
};

export const removeStorageErrorListener = (callback: ErrorCallback) => {
  const index = errorListeners.indexOf(callback);
  if (index > -1) {
    errorListeners.splice(index, 1);
  }
};

const notifyError = (error: StorageError) => {
  errorListeners.forEach(listener => listener(error));
};