import React, { useState, useRef } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import GameCanvas from './components/GameCanvas';
import IntroScreen from './components/IntroScreen';
import GameOverScreen from './components/GameOverScreen';
import BeatmapSelectScreen from './components/BeatmapSelectScreen';
import BeatmapEditor from './components/BeatmapEditor';
import { GameStatus, Beatmap } from './types';
import { DEFAULT_BEATMAP } from './constants';
import { useBeatmaps } from './hooks/useBeatmaps';

// Main game component that handles gameplay
const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const { beatmaps } = useBeatmaps();
  
  // Get beatmap ID from URL params
  const { beatmapId } = useParams<{ beatmapId: string }>();
  
  // Find the selected beatmap
  const selectedBeatmap = beatmaps.find(b => b.id === beatmapId) || DEFAULT_BEATMAP;
  
  const [gameStatus, setGameStatus] = useState<GameStatus>('playing');
  const [finalScore, setFinalScore] = useState(0);
  const hasCalibrated = useRef(false);

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

  const handleBackToBeatmapSelect = () => {
    navigate('/select');
  };

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative selection:bg-[#00f3ff] selection:text-black">
      <GameCanvas 
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

// Menu/Intro page
const MenuPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  // Simulate loading
  React.useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleStart = () => {
    navigate('/select');
  };

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative selection:bg-[#00f3ff] selection:text-black">
      <IntroScreen 
        isLoading={isLoading} 
        onStart={handleStart} 
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]"></div>
    </div>
  );
};

// Beatmap selection page
const SelectPage: React.FC = () => {
  const navigate = useNavigate();

  const handleBeatmapSelect = (beatmap: Beatmap) => {
    navigate(`/play/${beatmap.id}`);
  };

  const handleBackToMenu = () => {
    navigate('/');
  };

  const handleOpenEditor = (beatmap?: Beatmap) => {
    if (beatmap) {
      navigate(`/editor/${beatmap.id}`);
    } else {
      navigate('/editor');
    }
  };

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative selection:bg-[#00f3ff] selection:text-black">
      <BeatmapSelectScreen
        onSelect={handleBeatmapSelect}
        onBack={handleBackToMenu}
        onOpenEditor={handleOpenEditor}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]"></div>
    </div>
  );
};

// Editor page
const EditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { beatmapId } = useParams<{ beatmapId: string }>();
  const { beatmaps, isLoading } = useBeatmaps();
  
  // Find the beatmap to edit (if editing existing)
  const editingBeatmap = beatmapId ? beatmaps.find(b => b.id === beatmapId) : undefined;

  const handleCloseEditor = () => {
    navigate('/select');
  };

  // Show loading while beatmaps are being fetched (only if we need a beatmap)
  if (beatmapId && isLoading) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="text-cyan-400 text-xl animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative selection:bg-[#00f3ff] selection:text-black">
      <BeatmapEditor
        onBack={handleCloseEditor}
        initialBeatmap={editingBeatmap}
      />
    </div>
  );
};

// Main App with Routes
const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<MenuPage />} />
      <Route path="/select" element={<SelectPage />} />
      <Route path="/play/:beatmapId" element={<GamePage />} />
      <Route path="/editor" element={<EditorPage />} />
      <Route path="/editor/:beatmapId" element={<EditorPage />} />
    </Routes>
  );
};

export default App;