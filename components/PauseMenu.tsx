import React from 'react';
import { Play, Home, RotateCcw } from 'lucide-react';

interface PauseMenuProps {
  onResume: () => void;
  onRetry: () => void;
  onExit: () => void;
}

const PauseMenu: React.FC<PauseMenuProps> = ({ onResume, onRetry, onExit }) => {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="flex flex-col gap-4 min-w-[300px]">
        <h2 className="text-3xl font-black text-center text-white italic mb-4">PAUSED</h2>

        <button
          onClick={onResume}
          className="flex items-center justify-center gap-2 px-6 py-4 bg-[#00f3ff] text-black font-bold uppercase hover:bg-white transition-colors"
        >
          <Play size={20} fill="currentColor" /> Resume
        </button>

        <button
          onClick={onRetry}
          className="flex items-center justify-center gap-2 px-6 py-4 border border-[#00f3ff] text-[#00f3ff] font-bold uppercase hover:bg-[#00f3ff]/20 transition-colors"
        >
          <RotateCcw size={20} /> Retry
        </button>

        <button
          onClick={onExit}
          className="flex items-center justify-center gap-2 px-6 py-4 border border-gray-600 text-gray-300 font-bold uppercase hover:bg-white/10 transition-colors"
        >
          <Home size={20} /> Exit to Menu
        </button>
      </div>
    </div>
  );
};

export default PauseMenu;
