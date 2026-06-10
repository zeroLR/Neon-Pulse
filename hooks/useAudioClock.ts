import { useRef, useCallback, useState, useEffect } from 'react';

/**
 * Web Audio playback layer that doubles as the game's master clock.
 *
 * The whole point: an AudioBufferSourceNode is driven by the audio hardware's
 * own steady oscillator, so `audioContext.currentTime` is a rock-solid time
 * source that does NOT drift with frame rate, tab throttling, or main-thread
 * jank. Deriving the song position from it every frame (instead of accumulating
 * per-frame deltas) is what eliminates the timing jitter.
 */
export interface UseAudioClockReturn {
  /** Fetch + decode an audio file into a playable buffer. */
  load: (url: string) => Promise<void>;
  /** Start playback. Defaults to the last paused position if no offset given. */
  play: (offsetSeconds?: number) => void;
  /** Stop playback but remember the current position (for resume). */
  pause: () => void;
  /** Stop playback and rewind to 0. */
  stop: () => void;
  /** Jump to a position (seconds); keeps playing if already playing. */
  seek: (seconds: number) => void;
  /** Current playback position in seconds, read straight from the audio clock. */
  getTime: () => number;
  /** Whether a source is currently playing. */
  isPlaying: () => boolean;
  /** Set output volume (0-1). */
  setVolume: (v: number) => void;
  /** True once a buffer has been decoded and is ready to play. */
  isLoaded: boolean;
  /** Decoded buffer duration in seconds (0 until loaded). */
  duration: number;
}

export const useAudioClock = (): UseAudioClockReturn => {
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  // ctx.currentTime that corresponds to song position 0 (set on each play()).
  const startCtxTime = useRef<number>(0);
  // Song position to report while not playing (paused/stopped).
  const pausedAt = useRef<number>(0);
  const playingRef = useRef<boolean>(false);
  const volumeRef = useRef<number>(1);

  const [isLoaded, setIsLoaded] = useState(false);
  const [duration, setDuration] = useState(0);

  const getCtx = useCallback((): AudioContext => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const gain = ctxRef.current.createGain();
      gain.gain.value = volumeRef.current;
      gain.connect(ctxRef.current.destination);
      gainRef.current = gain;
    }
    return ctxRef.current;
  }, []);

  const stopSource = useCallback(() => {
    const src = sourceRef.current;
    if (src) {
      src.onended = null;
      try { src.stop(); } catch { /* already stopped */ }
      try { src.disconnect(); } catch { /* noop */ }
      sourceRef.current = null;
    }
  }, []);

  const load = useCallback(async (url: string) => {
    const ctx = getCtx();
    setIsLoaded(false);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    // decodeAudioData sniffs the container by content, so a renamed Ogg (e.g.
    // BeatSaver's .egg) decodes fine regardless of the URL's extension.
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    bufferRef.current = decoded;
    pausedAt.current = 0;
    playingRef.current = false;
    setDuration(decoded.duration);
    setIsLoaded(true);
  }, [getCtx]);

  const getTime = useCallback((): number => {
    const ctx = ctxRef.current;
    if (!ctx || !playingRef.current) return pausedAt.current;
    const t = ctx.currentTime - startCtxTime.current;
    const dur = bufferRef.current?.duration ?? Infinity;
    return Math.min(Math.max(0, t), dur);
  }, []);

  const play = useCallback((offsetSeconds?: number) => {
    const buffer = bufferRef.current;
    if (!buffer) return;
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const offset = Math.max(0, offsetSeconds ?? pausedAt.current);
    stopSource();

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(gainRef.current!);
    src.onended = () => {
      // Only flip state for a natural end-of-track, not a manual stop/replace.
      if (sourceRef.current === src) {
        playingRef.current = false;
        pausedAt.current = buffer.duration;
      }
    };
    startCtxTime.current = ctx.currentTime - offset;
    src.start(0, offset);
    sourceRef.current = src;
    playingRef.current = true;
  }, [getCtx, stopSource]);

  const pause = useCallback(() => {
    if (!playingRef.current) return;
    pausedAt.current = getTime();
    playingRef.current = false;
    stopSource();
  }, [getTime, stopSource]);

  const stop = useCallback(() => {
    stopSource();
    playingRef.current = false;
    pausedAt.current = 0;
  }, [stopSource]);

  const seek = useCallback((seconds: number) => {
    const pos = Math.max(0, seconds);
    if (playingRef.current) {
      play(pos);
    } else {
      pausedAt.current = pos;
    }
  }, [play]);

  const isPlaying = useCallback(() => playingRef.current, []);

  const setVolume = useCallback((v: number) => {
    volumeRef.current = v;
    if (gainRef.current) gainRef.current.gain.value = v;
  }, []);

  // Tear down the audio context on unmount.
  useEffect(() => {
    return () => {
      stopSource();
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => { /* noop */ });
        ctxRef.current = null;
      }
    };
  }, [stopSource]);

  return { load, play, pause, stop, seek, getTime, isPlaying, setVolume, isLoaded, duration };
};
