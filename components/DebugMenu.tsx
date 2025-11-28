
import React from 'react';
import { Settings, Shield, Activity, Box, RefreshCw, Square, User, Sliders } from 'lucide-react';
import { DebugConfig } from '../types';

interface DebugMenuProps {
  config: DebugConfig;
  onConfigChange: (newConfig: DebugConfig) => void;
  onRecalibrate: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const DebugMenu: React.FC<DebugMenuProps> = ({ config, onConfigChange, onRecalibrate, isOpen, setIsOpen }) => {
  const toggle = (key: keyof DebugConfig) => {
    onConfigChange({ ...config, [key]: !config[key] });
  };

  const handleSliderChange = (key: keyof DebugConfig, value: number) => {
    onConfigChange({ ...config, [key]: value });
  };

  return (
    <div className="absolute top-4 left-4 z-50 flex flex-col items-start gap-2">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 bg-gray-900/80 border border-gray-700 rounded text-white hover:bg-gray-800 hover:text-[#00f3ff] transition-colors"
      >
        <Settings size={20} />
      </button>

      {isOpen && (
        <div className="p-4 bg-gray-900/95 border border-gray-700 rounded-lg backdrop-blur-md shadow-xl w-72 space-y-4 animate-fade-in-down h-[80vh] overflow-y-auto">
            <h3 className="text-xs font-mono uppercase text-gray-500 tracking-widest mb-2">Game Settings</h3>

            <button 
                onClick={() => toggle('showAvatar')}
                className={`flex items-center justify-between w-full p-2 rounded text-sm ${config.showAvatar ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:bg-white/5'}`}
            >
                <span className="flex items-center gap-2"><User size={14} /> Avatar Visibility</span>
                <span className="text-[10px] font-mono">{config.showAvatar ? 'VISIBLE' : 'HIDDEN'}</span>
            </button>

            <div className="space-y-1 p-2 bg-white/5 rounded">
                <div className="flex justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-2"><Sliders size={12}/> Saber Size</span>
                    <span>{config.saberScale.toFixed(1)}x</span>
                </div>
                <input 
                    type="range" 
                    min="1" max="3" step="0.1"
                    value={config.saberScale}
                    onChange={(e) => handleSliderChange('saberScale', parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#00f3ff]"
                />
            </div>

            <div className="space-y-1 p-2 bg-white/5 rounded">
                <div className="flex justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-2"><Sliders size={12}/> Block Size</span>
                    <span>{config.blockScale.toFixed(1)}x</span>
                </div>
                <input 
                    type="range" 
                    min="0.5" max="2" step="0.1"
                    value={config.blockScale}
                    onChange={(e) => handleSliderChange('blockScale', parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#ff00ff]"
                />
            </div>

            <div className="h-px bg-gray-700 my-2"></div>
            <h3 className="text-xs font-mono uppercase text-gray-500 tracking-widest mb-2">Dev Tools</h3>
            
            <button 
                onClick={() => toggle('godMode')}
                className={`flex items-center justify-between w-full p-2 rounded text-sm ${config.godMode ? 'bg-[#00f3ff]/20 text-[#00f3ff]' : 'text-gray-400 hover:bg-white/5'}`}
            >
                <span className="flex items-center gap-2"><Shield size={14} /> God Mode</span>
                <span className="text-[10px] font-mono">{config.godMode ? 'ON' : 'OFF'}</span>
            </button>

            <button 
                onClick={() => toggle('showNodes')}
                className={`flex items-center justify-between w-full p-2 rounded text-sm ${config.showNodes ? 'bg-[#ff00ff]/20 text-[#ff00ff]' : 'text-gray-400 hover:bg-white/5'}`}
            >
                <span className="flex items-center gap-2"><Activity size={14} /> Show Nodes</span>
                <span className="text-[10px] font-mono">{config.showNodes ? 'ON' : 'OFF'}</span>
            </button>

            <button 
                onClick={() => toggle('showHitboxes')}
                className={`flex items-center justify-between w-full p-2 rounded text-sm ${config.showHitboxes ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-400 hover:bg-white/5'}`}
            >
                <span className="flex items-center gap-2"><Box size={14} /> Saber Hitboxes</span>
                <span className="text-[10px] font-mono">{config.showHitboxes ? 'ON' : 'OFF'}</span>
            </button>

            <button 
                onClick={() => toggle('showBlockHitboxes')}
                className={`flex items-center justify-between w-full p-2 rounded text-sm ${config.showBlockHitboxes ? 'bg-green-500/20 text-green-400' : 'text-gray-400 hover:bg-white/5'}`}
            >
                <span className="flex items-center gap-2"><Square size={14} /> Block Hitboxes</span>
                <span className="text-[10px] font-mono">{config.showBlockHitboxes ? 'ON' : 'OFF'}</span>
            </button>

            <div className="h-px bg-gray-700 my-2"></div>

            <button 
                onClick={onRecalibrate}
                className="flex items-center justify-center gap-2 w-full p-2 rounded text-sm bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
                <RefreshCw size={14} /> Recalibrate Hand
            </button>
        </div>
      )}
    </div>
  );
};

export default DebugMenu;