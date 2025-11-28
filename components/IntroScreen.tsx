import React from 'react';
import { Play, Activity } from 'lucide-react';

interface IntroScreenProps {
  onStart: () => void;
  isLoading: boolean;
}

const IntroScreen: React.FC<IntroScreenProps> = ({ onStart, isLoading }) => {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 text-white backdrop-blur-sm">
      <div className="relative mb-8 group">
        <div className="absolute -inset-1 bg-gradient-to-r from-[#00f3ff] to-[#ff00ff] rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
        <div className="relative px-7 py-4 bg-black rounded-lg leading-none flex items-center">
          <Activity className="w-12 h-12 text-[#00f3ff] mr-4" />
          <span className="text-6xl font-black tracking-tighter italic">
            <span className="text-[#00f3ff]">NEON</span>
            <span className="text-white mx-2">/</span>
            <span className="text-[#ff00ff]">PULSE</span>
          </span>
        </div>
      </div>

      <div className="max-w-md text-center space-y-6">
        <p className="text-gray-400 font-mono text-sm uppercase tracking-widest">
          Cyber-Minimalism Rhythm Action
        </p>

        <div className="grid grid-cols-2 gap-4 text-left p-6 border border-gray-800 rounded bg-gray-900/50">
          <div className="space-y-2">
            <h3 className="text-[#00f3ff] font-bold">LEFT HAND</h3>
            <p className="text-xs text-gray-400">Smash Cyan Blocks</p>
          </div>
          <div className="space-y-2 text-right">
            <h3 className="text-[#ff00ff] font-bold">RIGHT HAND</h3>
            <p className="text-xs text-gray-400">Smash Magenta Blocks</p>
          </div>
          <div className="col-span-2 text-center pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-500">Stand back ~1.5 meters. Ensure good lighting.</p>
          </div>
        </div>

        <button
          onClick={onStart}
          disabled={isLoading}
          className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-transparent font-mono uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Initializing Systems...
            </span>
          ) : (
            <>
              <span className="absolute inset-0 w-full h-full -mt-1 rounded-lg opacity-30 bg-gradient-to-r from-[#00f3ff] via-transparent to-[#ff00ff]"></span>
              <span className="relative flex items-center gap-3">
                Initialize Sequence <Play size={18} fill="currentColor" />
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default IntroScreen;