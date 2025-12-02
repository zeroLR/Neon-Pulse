import React from 'react';
import { RotateCcw, ListMusic } from 'lucide-react';
import { Beatmap } from '../types';

interface GameOverScreenProps {
  score: number;
  beatmap?: Beatmap;
  onRestart: () => void;
  onBackToMenu: () => void;
}

const GameOverScreen: React.FC<GameOverScreenProps> = ({ score, beatmap, onRestart, onBackToMenu }) => {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md text-white animate-fade-in">
      <h2 className="text-5xl font-black italic tracking-tighter mb-2 text-transparent bg-clip-text bg-gradient-to-r from-[#00f3ff] to-[#ff00ff]">
        SESSION COMPLETE
      </h2>
      
      {/* Beatmap info */}
      {beatmap && (
        <div className="text-center mb-4">
          <p className="text-lg font-bold text-white">{beatmap.title}</p>
          <p className="text-sm text-gray-400">{beatmap.artist}</p>
        </div>
      )}
      
      <div className="my-8 text-center">
        <p className="text-gray-500 font-mono text-sm uppercase tracking-widest mb-2">Final Score</p>
        <p className="text-7xl font-mono font-bold text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
          {score.toLocaleString()}
        </p>
      </div>

      <div className="flex gap-4">
        {/* Restart button */}
        <button
          onClick={onRestart}
          className="group flex items-center gap-3 px-8 py-4 bg-white text-black font-bold uppercase tracking-widest hover:bg-[#00f3ff] hover:text-black transition-all duration-300 clip-path-polygon"
          style={{ clipPath: 'polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%)' }}
        >
          <RotateCcw size={20} />
          Retry
        </button>

        {/* Back to menu button */}
        <button
          onClick={onBackToMenu}
          className="group flex items-center gap-3 px-8 py-4 bg-transparent border-2 border-white text-white font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all duration-300 clip-path-polygon"
          style={{ clipPath: 'polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%)' }}
        >
          <ListMusic size={20} />
          Beatmaps
        </button>
      </div>
    </div>
  );
};

export default GameOverScreen;