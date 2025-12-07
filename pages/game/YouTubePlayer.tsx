import React from 'react';
import { Beatmap } from '../../types';

interface YouTubePlayerProps {
  beatmap: Beatmap;
  youtubePlayerRef: React.RefObject<HTMLIFrameElement>;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ beatmap, youtubePlayerRef }) => {
  if (!beatmap.youtubeId) return null;

  return (
    <div className="absolute bottom-4 left-4 z-40 rounded-lg overflow-hidden border-2 border-gray-700 shadow-xl bg-black">
      <div className="relative">
        <iframe
          ref={youtubePlayerRef}
          id="youtube-player"
          width="280"
          height="158"
          src={`https://www.youtube.com/embed/${beatmap.youtubeId}?playsinline=1&rel=0&modestbranding=1&enablejsapi=1`}
          title={beatmap.title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="block"
        />
      </div>
      <div className="px-3 py-2 bg-gradient-to-r from-gray-900 to-black">
        <div className="text-xs font-bold text-white truncate">♫ {beatmap.title}</div>
        <div className="text-[10px] text-gray-400 truncate">{beatmap.artist}</div>
      </div>
    </div>
  );
};

export default YouTubePlayer;
