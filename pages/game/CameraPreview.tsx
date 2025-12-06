import React from 'react';
import { GAME_CONFIG } from '../../constants';

interface CameraPreviewProps {
  cameraPreviewRef: React.RefObject<HTMLCanvasElement>;
}

const CameraPreview: React.FC<CameraPreviewProps> = ({ cameraPreviewRef }) => {
  return (
    <div className="absolute bottom-4 right-4 z-40 rounded-lg overflow-hidden border-2 border-gray-700 shadow-xl bg-black">
      <div className="relative">
        <canvas
          ref={cameraPreviewRef}
          width={GAME_CONFIG.CAMERA_PREVIEW.WIDTH}
          height={GAME_CONFIG.CAMERA_PREVIEW.HEIGHT}
          className="block"
        />
        <div className="absolute top-1 left-1 px-2 py-0.5 bg-black/70 rounded text-[10px] font-mono text-gray-400 uppercase">
          Camera
        </div>
        <div className="absolute bottom-1 left-1 flex gap-2">
          <span className="px-1.5 py-0.5 bg-[#00f3ff]/30 rounded text-[8px] font-mono text-[#00f3ff]">L</span>
          <span className="px-1.5 py-0.5 bg-[#ff00ff]/30 rounded text-[8px] font-mono text-[#ff00ff]">R</span>
        </div>
      </div>
    </div>
  );
};

export default CameraPreview;
