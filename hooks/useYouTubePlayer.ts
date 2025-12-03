import React, { useRef, useCallback } from 'react';

export interface UseYouTubePlayerReturn {
  youtubePlayerRef: React.RefObject<HTMLIFrameElement>;
  pauseYouTube: () => void;
  playYouTube: () => void;
  restartYouTube: () => void;
  seekTo: (seconds: number) => void;
}

export const useYouTubePlayer = (): UseYouTubePlayerReturn => {
  const youtubePlayerRef = useRef<HTMLIFrameElement>(null);

  const pauseYouTube = useCallback(() => {
    if (youtubePlayerRef.current?.contentWindow) {
      youtubePlayerRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo' }), '*'
      );
    }
  }, []);

  const playYouTube = useCallback(() => {
    if (youtubePlayerRef.current?.contentWindow) {
      youtubePlayerRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'playVideo' }), '*'
      );
    }
  }, []);

  const seekTo = useCallback((seconds: number) => {
    if (youtubePlayerRef.current?.contentWindow) {
      youtubePlayerRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }), '*'
      );
    }
  }, []);

  const restartYouTube = useCallback(() => {
    if (youtubePlayerRef.current?.contentWindow) {
      // Seek to beginning and pause, will auto-play when countdown ends
      youtubePlayerRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'seekTo', args: [0, true] }), '*'
      );
      youtubePlayerRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo' }), '*'
      );
    }
  }, []);

  return {
    youtubePlayerRef,
    pauseYouTube,
    playYouTube,
    restartYouTube,
    seekTo,
  };
};
