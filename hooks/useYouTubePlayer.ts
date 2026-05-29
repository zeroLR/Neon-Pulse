import React, { useRef, useCallback, useEffect } from 'react';

export interface UseYouTubePlayerReturn {
  youtubePlayerRef: React.RefObject<HTMLIFrameElement>;
  pauseYouTube: () => void;
  playYouTube: () => void;
  restartYouTube: () => void;
  seekTo: (seconds: number) => void;
  /**
   * Best-effort estimate of the YouTube player's current playback position (seconds).
   * Returns null if no recent position has been reported (e.g. before playback or
   * while paused/stalled). The value is extrapolated from the last reported position
   * assuming 1x playback, since YouTube only emits position updates ~1x/second.
   */
  getEstimatedTime: () => number | null;
}

export const useYouTubePlayer = (): UseYouTubePlayerReturn => {
  const youtubePlayerRef = useRef<HTMLIFrameElement>(null);

  // Last playback position reported by the YouTube iframe, with the local
  // timestamp at which we received it (used to extrapolate between updates).
  const lastPosition = useRef<{ time: number; at: number } | null>(null);

  // Listen for the iframe's `infoDelivery` messages, which carry currentTime.
  // The iframe (loaded with enablejsapi=1) starts emitting these once it has
  // received a command/handshake from this window.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      if (!event.origin.includes('youtube.com')) return;
      let data: any;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (data?.event === 'infoDelivery' && typeof data.info?.currentTime === 'number') {
        lastPosition.current = { time: data.info.currentTime, at: performance.now() };
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const getEstimatedTime = useCallback((): number | null => {
    const snap = lastPosition.current;
    if (!snap) return null;
    const elapsed = (performance.now() - snap.at) / 1000;
    // If no update for a while, the player is likely paused/stalled - treat as stale.
    if (elapsed > 5) return null;
    return snap.time + elapsed;
  }, []);

  // Ask the iframe to start streaming state updates (infoDelivery) back to us.
  const startListening = useCallback(() => {
    youtubePlayerRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'listening', id: 'youtube-player', channel: 'widget' }), '*'
    );
  }, []);

  const pauseYouTube = useCallback(() => {
    if (youtubePlayerRef.current?.contentWindow) {
      youtubePlayerRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo' }), '*'
      );
    }
  }, []);

  const playYouTube = useCallback(() => {
    if (youtubePlayerRef.current?.contentWindow) {
      // Register for state updates so getEstimatedTime() starts receiving positions.
      startListening();
      youtubePlayerRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'playVideo' }), '*'
      );
    }
  }, [startListening]);

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
    getEstimatedTime,
  };
};
