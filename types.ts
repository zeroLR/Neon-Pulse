
export type HandType = 'left' | 'right';
export type BlockType = 'left' | 'right' | 'both';
export type GameStatus = 'menu' | 'loading' | 'calibration' | 'beatmap-select' | 'beatmap-editor' | 'playing' | 'gameover';

// Beatmap difficulty levels
export type BeatmapDifficulty = 'easy' | 'normal' | 'hard' | 'expert';

// Beatmap metadata and data
export interface Beatmap {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  difficulty: BeatmapDifficulty;
  difficultyRating: number; // 1-10 scale
  duration: string; // e.g., "2:30"
  noteCount: number;
  data: BeatData[][];
  youtubeId?: string; // Optional YouTube video ID for music source
  startDelay?: number; // Optional delay in ms before first beat (for YouTube sync)
}

// Slash direction for blocks - indicates the direction player should slash
export type SlashDirection = 
  | 'up'       // Slash upward ↑
  | 'down'     // Slash downward ↓
  | 'left'     // Slash left ←
  | 'right'    // Slash right →
  | 'up-left'  // Slash diagonal ↖
  | 'up-right' // Slash diagonal ↗
  | 'down-left'  // Slash diagonal ↙
  | 'down-right' // Slash diagonal ↘
  | 'any';     // Any direction (dot block)

// Extended block note for beatmap - supports direction and color override
export interface BlockNote {
  track: string;           // Track label (e.g., 'L1', 'R2', 'T1')
  direction?: SlashDirection; // Required slash direction (default: 'any')
  color?: BlockType;       // Override color (default: derived from track)
}

// Beatmap beat data types
export type BeatData = 
  | null                   // Rest (no block)
  | string                 // Simple track label
  | BlockNote              // Single block with options
  | (string | BlockNote)[]; // Multiple blocks

export interface Point {
  x: number;
  y: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Block {
  id: string;
  type: BlockType;
  direction: SlashDirection; // Required slash direction
  spawnTime: number; 
  targetPos: Point; 
  position: Vector3D; 
  hit: boolean;
  missed: boolean;
  trackIndex: number;
}

export interface HandData {
  x: number;
  y: number;
  z: number;
}

// --- MediaPipe Types ---

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface Results {
  poseLandmarks: NormalizedLandmark[];
  poseWorldLandmarks?: NormalizedLandmark[];
  image: any;
}

export interface PoseOptions {
  modelComplexity?: number;
  smoothLandmarks?: boolean;
  enableSegmentation?: boolean;
  minDetectionConfidence?: number;
  minTrackingConfidence?: number;
  selfieMode?: boolean;
}

export interface Pose {
  setOptions(options: PoseOptions): void;
  onResults(callback: (results: Results) => void): void;
  send(input: { image: HTMLVideoElement }): Promise<void>;
  close(): Promise<void>;
}

export interface GameStats {
  score: number;
  combo: number;
  maxCombo: number;
  health: number;
}

export interface DebugConfig {
  godMode: boolean;
  showNodes: boolean;
  showHitboxes: boolean;
  showBlockHitboxes: boolean;
  saberScale: number;
  blockScale: number;
  showAvatar: boolean;
  showTrail: boolean;
  showCameraPreview: boolean;
}