import React from 'react';
import './GameFinished.css';

interface GameFinishedProps {
  winner?: string | null;
  isDraw: boolean;
  botWon?: boolean;
  onPlayAgain: () => void;
  onExit: () => void;
  isLoading?: boolean;
}

const GameFinished: React.FC<GameFinishedProps> = ({
  winner,
  isDraw,
  botWon,
  onPlayAgain,
  onExit,
  isLoading = false,
}) => {
  return (
    <div className="game-finished-overlay">
      <div className="game-finished-modal">
        <div className="game-finished-content">
          <h2 className="game-finished-title">Game Over!</h2>
          
          <div className="game-finished-result">
            {isDraw ? (
              <>
                <div className="result-icon draw-icon">🤝</div>
                <p className="result-text">It's a Draw!</p>
              </>
            ) : botWon ? (
              <>
                <div className="result-icon loss-icon">🤖</div>
                <p className="result-text">Bot Wins!</p>
              </>
            ) : winner ? (
              <>
                <div className="result-icon win-icon">🎉</div>
                <p className="result-text"><strong>{winner}</strong> Wins!</p>
              </>
            ) : (
              <>
                <div className="result-icon draw-icon">⏸</div>
                <p className="result-text">Game Finished</p>
              </>
            )}
          </div>

          <div className="game-finished-actions">
            <button
              className="btn-play-again"
              onClick={onPlayAgain}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : '🔄 Play Again'}
            </button>
            <button
              className="btn-exit"
              onClick={onExit}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : '❌ Exit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameFinished;
