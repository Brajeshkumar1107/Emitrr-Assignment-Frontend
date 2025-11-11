import React from 'react';
import './GameModeSelection.css';

interface GameModeSelectionProps {
  onSelectMode: (mode: 'friend' | 'computer') => void;
}

const GameModeSelection: React.FC<GameModeSelectionProps> = ({ onSelectMode }) => {
  return (
    <div className="game-mode-selection">
      <div className="mode-selection-container">
        <h1>Connect 4</h1>
        <h2>Choose your opponent</h2>
        <div className="mode-options">
          <button 
            className="mode-button computer-mode"
            onClick={() => {
              console.log('🔴 [1] GameModeSelection: User clicked "Play with Computer"');
              onSelectMode('computer');
            }}
          >
            <div className="mode-icon">🤖</div>
            <div className="mode-title">Play with Computer</div>
            <div className="mode-description">Challenge the AI opponent</div>
          </button>
          <button 
            className="mode-button friend-mode"
            onClick={() => {
              console.log('🟢 [1] GameModeSelection: User clicked "Play with Friend"');
              onSelectMode('friend');
            }}
          >
            <div className="mode-icon">👥</div>
            <div className="mode-title">Play with Friend</div>
            <div className="mode-description">Wait for another player to join</div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameModeSelection;

