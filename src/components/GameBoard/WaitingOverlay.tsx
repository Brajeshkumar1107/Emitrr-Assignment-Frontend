import React, { useState, useEffect } from 'react';
import './WaitingOverlay.css';

interface WaitingOverlayProps {
  onCancel: () => void;
}

const WaitingOverlay: React.FC<WaitingOverlayProps> = ({ onCancel }) => {
  const [timeRemaining, setTimeRemaining] = useState(10);

  useEffect(() => {
    // Start countdown from 10 seconds
    setTimeRemaining(10);
    
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="waiting-overlay">
      <div className="waiting-content">
        <h2>Waiting for Opponent</h2>
        <div className="waiting-spinner"></div>
        <p className="waiting-message">
          Please wait while we find another player...
        </p>
        <p className="countdown-message">
          {timeRemaining > 0 
            ? `If no opponent joins in ${timeRemaining} second${timeRemaining !== 1 ? 's' : ''}, you'll play with a bot.`
            : 'Switching to bot mode...'
          }
        </p>
        <p>
          Share this game with your friends to play together!
        </p>
        <button className="cancel-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default WaitingOverlay;