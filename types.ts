
export type HandType = 'left' | 'right';
export type BlockType = 'left' | 'right' | 'both';
export type GameStatus = 'menu' | 'loading' | 'calibration' | 'playing' | 'gameover';

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