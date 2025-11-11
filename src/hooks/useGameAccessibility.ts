import { useCallback, useEffect } from 'react';

interface UseGameAccessibilityProps {
  isMyTurn: boolean;
  onMove: (column: number) => void;
  gameStatus: string;
  currentPlayer: number;
}

export const useGameAccessibility = ({
  isMyTurn,
  onMove,
  gameStatus,
  currentPlayer
}: UseGameAccessibilityProps) => {
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (!isMyTurn) return;

    // Number keys 1-7 for column selection
    const column = parseInt(e.key) - 1;
    if (column >= 0 && column < 7) {
      onMove(column);
    }
  }, [isMyTurn, onMove]);

  useEffect(() => {
    document.addEventListener('keypress', handleKeyPress);
    return () => {
      document.removeEventListener('keypress', handleKeyPress);
    };
  }, [handleKeyPress]);

  const getAriaLabel = (row: number, col: number, value: number) => {
    const position = `Row ${row + 1}, Column ${col + 1}`;
    const state = value === 0 ? 'empty' : `occupied by Player ${value}`;
    const turnInfo = isMyTurn ? "Your turn" : "Opponent's turn";
    return `${position}. Cell is ${state}. ${gameStatus}. ${turnInfo}`;
  };

  return {
    getAriaLabel
  };
};