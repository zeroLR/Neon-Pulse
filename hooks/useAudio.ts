import { useRef, useCallback, useState } from 'react';

export interface AudioAPI {
  playSlashSound: (pitchMod?: number) => void;
  playSound: (freq: number, type: OscillatorType, duration: number) => void;
  playMissSound: () => void;
  playWrongColorSound: () => void;
  initAudio: () => void;
  toggleMute: () => void;
  isMuted: boolean;
}

export const useAudio = (): AudioAPI => {
  const audioContext = useRef<AudioContext | null>(null);
  const noiseBuffer = useRef<AudioBuffer | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const initNoiseBuffer = useCallback(() => {
    if (!audioContext.current || noiseBuffer.current) return;
    const ctx = audioContext.current;
    const bufferSize = ctx.sampleRate * 2.0; // 2 seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    noiseBuffer.current = buffer;
  }, []);

  const initAudio = useCallback(() => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContext.current?.state === 'suspended') {
      audioContext.current.resume();
    }
    initNoiseBuffer();
  }, [initNoiseBuffer]);

  const playSlashSound = useCallback((pitchMod = 1.0) => {
    // Ensure noise buffer is initialized
    if (!noiseBuffer.current) initNoiseBuffer();
    
    if (isMuted || !audioContext.current || !noiseBuffer.current) return;
    const ctx = audioContext.current;
    const now = ctx.currentTime;
    
    // 1. Noise Layer (Sharp Whoosh/Slash)
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer.current;
    
    const highpassFilter = ctx.createBiquadFilter();
    highpassFilter.type = 'highpass';
    highpassFilter.frequency.value = 2000;
    highpassFilter.Q.value = 0.5;
    
    const lowpassFilter = ctx.createBiquadFilter();
    lowpassFilter.type = 'lowpass';
    lowpassFilter.Q.value = 2;
    
    const noiseGain = ctx.createGain();
    
    noise.connect(highpassFilter);
    highpassFilter.connect(lowpassFilter);
    lowpassFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    
    // Sharp attack, quick decay for slash sound
    lowpassFilter.frequency.setValueAtTime(6000 * pitchMod, now);
    lowpassFilter.frequency.exponentialRampToValueAtTime(500, now + 0.15);
    
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.5, now + 0.01); // Sharp attack
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    
    noise.start(now);
    noise.stop(now + 0.2);

    // 2. Mid-frequency "schwing" oscillator (saber energy sound)
    const schwing = ctx.createOscillator();
    schwing.type = 'sawtooth';
    schwing.frequency.setValueAtTime(800 * pitchMod, now);
    schwing.frequency.exponentialRampToValueAtTime(200 * pitchMod, now + 0.1);
    
    const schwingGain = ctx.createGain();
    schwingGain.gain.setValueAtTime(0.15, now);
    schwingGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    
    const schwingFilter = ctx.createBiquadFilter();
    schwingFilter.type = 'bandpass';
    schwingFilter.frequency.value = 1000 * pitchMod;
    schwingFilter.Q.value = 2;
    
    schwing.connect(schwingFilter);
    schwingFilter.connect(schwingGain);
    schwingGain.connect(ctx.destination);
    
    schwing.start(now);
    schwing.stop(now + 0.12);

    // 3. Low Impact (punch feel)
    const impact = ctx.createOscillator();
    impact.type = 'sine';
    impact.frequency.setValueAtTime(120 * pitchMod, now);
    impact.frequency.exponentialRampToValueAtTime(40, now + 0.08);
    
    const impactGain = ctx.createGain();
    impactGain.gain.setValueAtTime(0.4, now);
    impactGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    
    impact.connect(impactGain);
    impactGain.connect(ctx.destination);
    
    impact.start(now);
    impact.stop(now + 0.12);
    
    // 4. High "zing" for energy release
    const zing = ctx.createOscillator();
    zing.type = 'sine';
    zing.frequency.setValueAtTime(2000 * pitchMod, now);
    zing.frequency.exponentialRampToValueAtTime(800 * pitchMod, now + 0.08);
    
    const zingGain = ctx.createGain();
    zingGain.gain.setValueAtTime(0.1, now);
    zingGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    
    zing.connect(zingGain);
    zingGain.connect(ctx.destination);
    
    zing.start(now);
    zing.stop(now + 0.1);
  }, [isMuted, initNoiseBuffer]);

  const playSound = useCallback((freq: number, type: OscillatorType, duration: number) => {
    if (isMuted || !audioContext.current) return;
    const osc = audioContext.current.createOscillator();
    const gain = audioContext.current.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioContext.current.currentTime);
    gain.gain.setValueAtTime(0.1, audioContext.current.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.current.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioContext.current.destination);
    osc.start();
    osc.stop(audioContext.current.currentTime + duration);
  }, [isMuted]);

  const playMissSound = useCallback(() => {
    playSound(150, 'sawtooth', 0.2);
  }, [playSound]);

  const playWrongColorSound = useCallback(() => {
    playSound(100, 'square', 0.1);
  }, [playSound]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newMuted = !prev;
      if (audioContext.current) {
        if (newMuted) {
          audioContext.current.suspend();
        } else {
          audioContext.current.resume();
        }
      }
      return newMuted;
    });
  }, []);

  return {
    playSlashSound,
    playSound,
    playMissSound,
    playWrongColorSound,
    initAudio,
    toggleMute,
    isMuted,
  };
};
