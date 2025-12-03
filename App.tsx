import React, { useState, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import IntroScreen from './components/IntroScreen';
import GameOverScreen from './components/GameOverScreen';
import BeatmapSelectScreen from './components/BeatmapSelectScreen';
import BeatmapEditor from './components/BeatmapEditor';
import { GameStatus, Beatmap } from './types';
import { DEFAULT_BEATMAP } from './constants';

const App: React.FC = () => {
  const [gameStatus, setGameStatus] = useState<GameStatus>('loading');
  const [finalScore, setFinalScore] = useState(0);
  const [selectedBeatmap, setSelectedBeatmap] = useState<Beatmap>(DEFAULT_BEATMAP);
  const [editingBeatmap, setEditingBeatmap] = useState<Beatmap | undefined>(undefined);
  
  // Track if user has calibrated in this session (for manual recalibration)
  const hasCalibrated = useRef(false);

  const handleStart = () => {
    // Go to beatmap selection
    setGameStatus('beatmap-select');
  };

  const handleBeatmapSelect = (beatmap: Beatmap) => {
    setSelectedBeatmap(beatmap);
    setGameStatus('playing');
  };

  const handleBackToMenu = () => {
    setGameStatus('menu');
  };

  const handleBackToBeatmapSelect = () => {
    setGameStatus('beatmap-select');
  };

  const handleOpenEditor = (beatmap?: Beatmap) => {
    setEditingBeatmap(beatmap);
    setGameStatus('beatmap-editor');
  };

  const handleCloseEditor = () => {
    setEditingBeatmap(undefined);
    setGameStatus('beatmap-select');
  };

  const handleCalibrationComplete = () => {
      hasCalibrated.current = true;
      setGameStatus('playing');
  };

  const handleGameOver = (score: number) => {
    setFinalScore(score);
  };

  const handleRestart = () => {
    // Restart the same beatmap
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
        beatmap={selectedBeatmap}
      />

      {(gameStatus === 'loading' || gameStatus === 'menu') && (
        <IntroScreen 
          isLoading={gameStatus === 'loading'} 
          onStart={handleStart} 
        />
      )}

      {gameStatus === 'beatmap-select' && (
        <BeatmapSelectScreen
          onSelect={handleBeatmapSelect}
          onBack={handleBackToMenu}
          onOpenEditor={handleOpenEditor}
        />
      )}

      {gameStatus === 'beatmap-editor' && (
        <BeatmapEditor
          onBack={handleCloseEditor}
          initialBeatmap={editingBeatmap}
        />
      )}

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

export default App;