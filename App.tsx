import React, { useState, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import IntroScreen from './components/IntroScreen';
import GameOverScreen from './components/GameOverScreen';
import { GameStatus } from './types';

const App: React.FC = () => {
  const [gameStatus, setGameStatus] = useState<GameStatus>('loading');
  const [finalScore, setFinalScore] = useState(0);
  
  // Track if user has calibrated in this session (for manual recalibration)
  const hasCalibrated = useRef(false);

  const handleStart = () => {
    // Skip calibration check, go directly to playing
    setGameStatus('playing');
  };

  const handleCalibrationComplete = () => {
      hasCalibrated.current = true;
      setGameStatus('playing');
  };

  const handleGameOver = (score: number) => {
    setFinalScore(score);
  };

  const handleRestart = () => {
    // Skip calibration on restart
    setGameStatus('playing');
  };

  const handleRecalibrate = () => {
      hasCalibrated.current = false;
      setGameStatus('calibration');
  }

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative selection:bg-[#00f3ff] selection:text-black">
      <GameCanvas 
        gameStatus={gameStatus} 
        setGameStatus={setGameStatus}
        onGameOver={handleGameOver}
        onCalibrationComplete={handleCalibrationComplete}
        onRecalibrateRequest={handleRecalibrate}
      />

      {(gameStatus === 'loading' || gameStatus === 'menu') && (
        <IntroScreen 
          isLoading={gameStatus === 'loading'} 
          onStart={handleStart} 
        />
      )}

      {gameStatus === 'gameover' && (
        <GameOverScreen 
          score={finalScore} 
          onRestart={handleRestart} 
        />
      )}
      
      {/* Decorative Vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]"></div>
    </div>
  );
};

export default App;