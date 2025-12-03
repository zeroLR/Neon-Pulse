import React from 'react';
import { GameStats } from '../types';
import { ScoreDisplay, ComboDisplay, HealthBar } from './HUD';

interface GameHUDProps {
  statsRef: React.MutableRefObject<GameStats>;
}

const GameHUD: React.FC<GameHUDProps> = ({ statsRef }) => {
  return (
    <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-start z-20 pointer-events-none">
      {/* Spacer for Debug Menu on Left */}
      <div className="w-16"></div>

      <div className="flex flex-col items-center">
        <span className="text-gray-400 text-xs font-mono uppercase tracking-widest">Score</span>
        <span
          className="text-4xl font-black text-white italic tracking-tighter"
          style={{ textShadow: '0 0 20px rgba(255,255,255,0.5)' }}
        >
          <ScoreDisplay statsRef={statsRef} />
        </span>
      </div>

      <div className="flex flex-col items-end">
        <span className="text-gray-400 text-xs font-mono uppercase tracking-widest">Combo</span>
        <span
          className="text-6xl font-black text-[#00f3ff] italic"
          style={{ textShadow: '0 0 20px cyan' }}
        >
          <ComboDisplay statsRef={statsRef} />
        </span>
      </div>

      {/* Health Bar */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 w-1/2 h-1 bg-gray-800 rounded overflow-hidden">
        <HealthBar statsRef={statsRef} />
      </div>
    </div>
  );
};

export default GameHUD;
