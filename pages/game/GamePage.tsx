import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GameStatus, Beatmap } from '../../types';
import { DEFAULT_BEATMAP } from '../../constants';
import { useBeatmaps } from '../../hooks/useBeatmaps';
import GameCanvas, { GameCanvasHandle } from './GameCanvas';
import GameOverScreen from './GameOverScreen';

const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const { beatmaps, isLoading } = useBeatmaps();
  
  // Get beatmap ID from URL params
  const { beatmapId } = useParams<{ beatmapId: string }>();
  
  // Find the selected beatmap (only after loading is complete)
  const selectedBeatmap = !isLoading && beatmaps.length > 0 
    ? (beatmaps.find(b => b.id === beatmapId) || DEFAULT_BEATMAP)
    : null;
  
  const [gameStatus, setGameStatus] = useState<GameStatus>('playing');
  const [finalScore, setFinalScore] = useState(0);
  const hasCalibrated = useRef(false);
  const gameCanvasRef = useRef<GameCanvasHandle>(null);

  const handleCalibrationComplete = () => {
    hasCalibrated.current = true;
    setGameStatus('playing');
  };

  const handleGameOver = (score: number) => {
    setFinalScore(score);
  };

  const handleRestart = () => {
    setGameStatus('playing');
  };

  const handleRecalibrate = () => {
    hasCalibrated.current = false;
    setGameStatus('calibration');
  };

  const handleBackToBeatmapSelect = useCallback(() => {
    // Stop pose detection before navigating
    gameCanvasRef.current?.stopPoseDetection();
    navigate('/select');
  }, [navigate]);

  // Show loading screen while beatmaps are being fetched
  if (isLoading || !selectedBeatmap) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#00f3ff] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#00f3ff] font-mono text-lg">Loading Beatmap...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative selection:bg-[#00f3ff] selection:text-black">
      <GameCanvas 
        ref={gameCanvasRef}
        gameStatus={gameStatus} 
        setGameStatus={setGameStatus}
        onGameOver={handleGameOver}
        onCalibrationComplete={handleCalibrationComplete}
        onRecalibrateRequest={handleRecalibrate}
        onExit={handleBackToBeatmapSelect}
        beatmap={selectedBeatmap}
      />

      {gameStatus === 'gameover' && (
        <GameOverScreen 
          score={finalScore}
          beatmap={selectedBeatmap}
          onRestart={handleRestart}
          onBackToMenu={handleBackToBeatmapSelect}
        />
      )}
      
      {/* Decorative Vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]"></div>
    </div>
  );
};

export default GamePage;
