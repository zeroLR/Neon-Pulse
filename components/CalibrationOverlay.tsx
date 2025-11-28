import React from 'react';
import { Scan } from 'lucide-react';

interface CalibrationOverlayProps {
  leftProgress: number;
  rightProgress: number;
  isComplete: boolean;
}

const CalibrationOverlay: React.FC<CalibrationOverlayProps> = ({ leftProgress, rightProgress, isComplete }) => {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none">
      
      {/* Silhouette Guide */}
      <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="0.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Head */}
        <circle cx="50" cy="30" r="6" stroke="white" strokeWidth="0.3" fill="none" strokeDasharray="1 1" filter="url(#glow)" />
        
        {/* Torso */}
        <line x1="50" y1="36" x2="50" y2="100" stroke="white" strokeWidth="0.3" strokeDasharray="1 1" filter="url(#glow)" />
        
        {/* Shoulders */}
        <line x1="42" y1="40" x2="58" y2="40" stroke="white" strokeWidth="0.3" strokeDasharray="1 1" filter="url(#glow)" />
        
        {/* Arm Lines connecting to Targets */}
        {/* Left Arm to Left Target (20% x, 50% y) */}
        <path d="M 42 40 Q 35 40 20 50" stroke="white" strokeWidth="0.3" fill="none" strokeDasharray="1 1" opacity="0.5" />
        
        {/* Right Arm to Right Target (80% x, 50% y) */}
        <path d="M 58 40 Q 65 40 80 50" stroke="white" strokeWidth="0.3" fill="none" strokeDasharray="1 1" opacity="0.5" />
      </svg>

      <div className="absolute top-1/4 text-center space-y-2 animate-pulse z-10">
        <Scan className="w-12 h-12 text-[#00f3ff] mx-auto mb-2" />
        <h2 className="text-3xl font-bold text-white tracking-widest uppercase">System Calibration</h2>
        <p className="text-gray-400 font-mono text-sm">Stand back & match the silhouette</p>
      </div>

      {/* Targets Container */}
      <div className="relative w-full h-full max-w-4xl mx-auto z-10">
        
        {/* Left Target (Visual Left - Screen 20%) */}
        <div className="absolute top-1/2 left-[20%] transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-4">
          <div className={`relative w-32 h-32 rounded-full border-4 transition-all duration-300 flex items-center justify-center backdrop-blur-sm
            ${leftProgress > 0 ? 'border-[#00f3ff] scale-110' : 'border-gray-600 border-dashed opacity-50'}
            ${isComplete ? 'bg-[#00f3ff]/20' : ''}
          `}>
             <div className="absolute inset-0 rounded-full border-4 border-[#00f3ff] transition-all duration-100"
                  style={{ clipPath: `circle(${leftProgress}% at 50% 50%)` }}></div>
             <span className="font-mono text-[#00f3ff] font-bold text-xl">L</span>
          </div>
        </div>

        {/* Right Target (Visual Right - Screen 80%) */}
        <div className="absolute top-1/2 right-[20%] transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-4">
          <div className={`relative w-32 h-32 rounded-full border-4 transition-all duration-300 flex items-center justify-center backdrop-blur-sm
            ${rightProgress > 0 ? 'border-[#ff00ff] scale-110' : 'border-gray-600 border-dashed opacity-50'}
            ${isComplete ? 'bg-[#ff00ff]/20' : ''}
          `}>
             <div className="absolute inset-0 rounded-full border-4 border-[#ff00ff] transition-all duration-100"
                  style={{ clipPath: `circle(${rightProgress}% at 50% 50%)` }}></div>
             <span className="font-mono text-[#ff00ff] font-bold text-xl">R</span>
          </div>
        </div>

      </div>

      {isComplete && (
        <div className="absolute bottom-1/4 text-[#00f3ff] font-bold text-2xl tracking-widest uppercase animate-bounce z-10">
          Calibration Complete
        </div>
      )}
    </div>
  );
};

export default CalibrationOverlay;