import React from 'react';
import { Volume2, VolumeX, Pause } from 'lucide-react';

interface ControlButtonsProps {
  gameStatus: string;
  isPaused: boolean;
  isMuted: boolean;
  onPause: () => void;
  onToggleMute: () => void;
}

const ControlButtons: React.FC<ControlButtonsProps> = ({
  gameStatus,
  isPaused,
  isMuted,
  onPause,
  onToggleMute,
}) => {
  return (
    <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
      {/* Pause Button */}
      {gameStatus === 'playing' && !isPaused && (
        <button
          onClick={onPause}
          className="p-2 bg-gray-900/50 border border-gray-700 rounded-full text-white/50 hover:text-white hover:bg-white hover:text-black transition-all hover:scale-110"
        >
          <Pause size={20} fill="currentColor" />
        </button>
      )}

      {/* Mute Button */}
      <button onClick={onToggleMute} className="text-white/50 hover:text-white transition-colors">
        {isMuted ? <VolumeX /> : <Volume2 />}
      </button>
    </div>
  );
};

export default ControlButtons;
