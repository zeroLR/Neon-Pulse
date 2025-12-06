
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

// A group of notes that appear simultaneously (at the exact same time)
export interface NoteGroup {
  notes: (string | BlockNote)[];  // All notes in this group appear at the same time
}

// Helper type for a single note item (string or BlockNote)
export type SingleNote = string | BlockNote;

// Helper type for items within a beat (can be single note, note group, or legacy array)
export type BeatItem = SingleNote | NoteGroup;

// Beatmap beat data types
// Structure:
//   null                    -> Rest (no block)
//   "L1"                    -> Single note (legacy)
//   { track: "L1", ... }    -> Single note with options (legacy)
//   { notes: ["L1", "R1"] } -> A group of notes appearing simultaneously
//   [item1, item2, ...]     -> Multiple items in one beat, spaced as sub-beats (1/n)
export type BeatData = 
  | null                   // Rest (no block)
  | SingleNote             // Single note (string or BlockNote)
  | NoteGroup              // A group of simultaneous notes
  | BeatItem[];            // Multiple items (notes or groups) spread across sub-beats

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