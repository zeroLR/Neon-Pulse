import { useRef, useState, useCallback, MutableRefObject, Dispatch, SetStateAction } from 'react';
import { GameStats, DebugConfig } from '../types';
import { GAME_CONFIG } from '../constants';

export interface GameStateAPI {
  // Game stats
  stats: MutableRefObject<GameStats>;
  resetStats: () => void;
  addScore: (points: number) => void;
  incrementCombo: () => void;
  breakCombo: () => void;
  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  
  // Pause state
  isPaused: boolean;
  setIsPaused: Dispatch<SetStateAction<boolean>>;
  
  // Countdown
  countdown: number | null;
  isGameActive: MutableRefObject<boolean>;
  startCountdown: () => void;
  
  // Beatmap tracking
  currentMeasure: MutableRefObject<number>;
  currentBeat: MutableRefObject<number>;
  resetBeatmap: () => void;
  
  // Debug config
  debugConfig: DebugConfig;
  setDebugConfig: Dispatch<SetStateAction<DebugConfig>>;
  isDebugOpen: boolean;
  setIsDebugOpen: Dispatch<SetStateAction<boolean>>;
}

export const useGameState = (): GameStateAPI => {
  // Game Stats
  const stats = useRef<GameStats>({ 
    score: 0, 
    combo: 0, 
    maxCombo: 0, 
    health: 100 
  });
  
  // Pause state
  const [isPaused, setIsPaused] = useState(false);
  
  // Countdown state
  const [countdown, setCountdown] = useState<number | null>(null);
  const isGameActive = useRef(false);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Beatmap tracking
  const currentMeasure = useRef<number>(0);
  const currentBeat = useRef<number>(0);
  
  // Debug Configuration
  const [debugConfig, setDebugConfig] = useState<DebugConfig>({
    godMode: false,
    showNodes: false,
    showHitboxes: false,
    showBlockHitboxes: false,
    saberScale: GAME_CONFIG.DEFAULT_SABER_SCALE,
    blockScale: 1.0,
    showAvatar: false,
    showTrail: GAME_CONFIG.DEFAULT_SHOW_TRAIL,
    showCameraPreview: GAME_CONFIG.DEFAULT_SHOW_CAMERA_PREVIEW
  });
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  // Reset stats
  const resetStats = useCallback(() => {
    stats.current = { score: 0, combo: 0, maxCombo: 0, health: 100 };
  }, []);

  // Add score
  const addScore = useCallback((points: number) => {
    stats.current.score += points;
  }, []);

  // Increment combo
  const incrementCombo = useCallback(() => {
    stats.current.combo++;
    stats.current.maxCombo = Math.max(stats.current.maxCombo, stats.current.combo);
  }, []);

  // Break combo
  const breakCombo = useCallback(() => {
    stats.current.combo = 0;
  }, []);

  // Take damage
  const takeDamage = useCallback((amount: number) => {
    stats.current.health = Math.max(0, stats.current.health - amount);
  }, []);

  // Heal
  const heal = useCallback((amount: number) => {
    stats.current.health = Math.min(100, stats.current.health + amount);
  }, []);

  // Start countdown
  const startCountdown = useCallback(() => {
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    isGameActive.current = false;
    setCountdown(3);
    
    let count = 3;
    countdownTimer.current = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        setCountdown(null);
        isGameActive.current = true;
        if (countdownTimer.current) clearInterval(countdownTimer.current);
      }
    }, 1000);
  }, []);

  // Reset beatmap position
  const resetBeatmap = useCallback(() => {
    currentMeasure.current = 0;
    currentBeat.current = 0;
  }, []);

  return {
    stats,
    resetStats,
    addScore,
    incrementCombo,
    breakCombo,
    takeDamage,
    heal,
    isPaused,
    setIsPaused,
    countdown,
    isGameActive,
    startCountdown,
    currentMeasure,
    currentBeat,
    resetBeatmap,
    debugConfig,
    setDebugConfig,
    isDebugOpen,
    setIsDebugOpen,
  };
};
