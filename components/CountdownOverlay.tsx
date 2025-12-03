import React from 'react';

interface CountdownOverlayProps {
  countdown: number;
}

const CountdownOverlay: React.FC<CountdownOverlayProps> = ({ countdown }) => {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-black/20">
      <span className="text-[10rem] font-black text-white animate-ping drop-shadow-[0_0_20px_#00f3ff]">
        {countdown}
      </span>
    </div>
  );
};

export default CountdownOverlay;
