
import { BlockNote, BlockType, SlashDirection, BeatData, Beatmap } from './types';

export const GAME_CONFIG = {
  ASPECT_RATIO: 16 / 9,
  
  // 3D World Constants
  CAMERA_Z: 12, // Moved back for TPS
  SPAWN_Z: -50, // Much deeper spawn for more immersion
  HIT_Z: 0, 
  DESPAWN_Z: 10, 
  
  // Camera Settings
  CAMERA: {
    FOV: 60,
    NEAR: 0.1,
    FAR: 1000, // Extended to see lookahead blocks
    POSITION_Y: 2,
    LOOK_AT_Z: -20,
  },
  
  // Grid (Floor) Settings
  GRID: {
    SIZE: 200, // Extended for longer view
    DIVISIONS: 100,
    POSITION_Y: -6,
    POSITION_Z: -80,
    COLOR_CENTER: 0x333344, // Brighter center
    COLOR_GRID: 0x111122, // Subtle grid lines
  },
  
  // Lighting
  LIGHTS: {
    AMBIENT_INTENSITY: 0.5,
    POINT_INTENSITY: 1,
    POINT_DISTANCE: 100,
    POINT_POSITION: { x: 0, y: 10, z: 10 },
  },
  
  // Gameplay
  BLOCK_SPEED: 50, // Faster to cover the longer distance
  HIT_THRESHOLD: 2.0, // Legacy radius check
  VELOCITY_THRESHOLD: 0.1, // Reduced threshold for 3D velocity
  INITIAL_SPAWN_DELAY: 2000, // ms before first block spawns
  
  // Hit Detection Zone
  HIT_ZONE: {
    MIN_Z: -5,
    MAX_Z: 5,
    FILL_START_OFFSET: -3.5, // Relative to HIT_Z
  },
  
  // Block Spawn
  SPAWN: {
    SPREAD_FACTOR: 1.3, // How much blocks spread out at spawn
    TRACK_FLASH_DURATION: 500, // ms
    LOOKAHEAD_BEATS: 8, // How many beats ahead to spawn blocks
  },
  
  // Visuals & Hitbox
  BLOCK_SIZE: 3, // Visual size (increased from 1.0)
  BLOCK_HITBOX_SIZE: 2.5, // Physical collision size (Increased from 1.6)
  
  // Physics (Debris)
  GRAVITY: 25.0,
  DEBRIS_LIFE: 0.8, // Seconds
  DEBRIS_EXPLOSION_FORCE: 5.0,

  // Visual Cues
  APPROACH_RING_START_SCALE: 2.5, // The ring starts 2.5x larger than the block
  
  // Saber Hitbox (Local Dimensions)
  SABER_HITBOX_CONFIG: {
    WIDTH: 1.3,  // Width of the cut zone (Increased to catch corners)
    HEIGHT: 1.3, // Height of the cut zone
    LENGTH: 8.0, // Length of the blade coverage (Increased)
    OFFSET_Z: 2.5 // Shift forward to center box on blade
  },
  
  // Default Saber Scale
  DEFAULT_SABER_SCALE: 2,
  
  // Default Trail Visibility
  DEFAULT_SHOW_TRAIL: true,
  
  // Default Camera Preview
  DEFAULT_SHOW_CAMERA_PREVIEW: false,
  
  // Camera Shake
  CAMERA_SHAKE: {
    INITIAL_INTENSITY: 0.4,
    DECAY_RATE: 0.9,
    THRESHOLD: 0.01,
  },
  
  // Screen Flash
  SCREEN_FLASH: {
    OPACITY: 0.3,
    DURATION: 80, // ms
  },
  
  // Camera Preview Window
  CAMERA_PREVIEW: {
    WIDTH: 240,
    HEIGHT: 180,
  },

  COLORS: {
    CYAN: 0x00f3ff,
    MAGENTA: 0xff00ff,
    WHITE: 0xffffff,
    GRAY: 0x333333,
    TRACK_FLASH: 0x555555,
  },
  BPM: 128,
  MAX_HEALTH: 100,
  DAMAGE_PER_MISS: 10,
  HEAL_PER_HIT: 5,
};

// Calibration Settings
export const CALIBRATION_CONFIG = {
  TOLERANCE: 0.15,
  PROGRESS_RATE: 100, // Units per second when in zone
  DECAY_RATE: 200, // Units per second when out of zone
  COMPLETION_DELAY: 1500, // ms before transitioning after complete
  LEFT_ZONE: { x: 0.8, y: 0.5 },
  RIGHT_ZONE: { x: 0.2, y: 0.5 },
};

// 12-Track Rectangular Frame Layout (Centric)
// X range: 0.35 (Left) to 0.65 (Right) -> Closer to center
// Y range: 0.25 (Top) to 0.75 (Bottom)
export const TRACK_LAYOUT = [
  // Left Column
  { id: 0, label: 'L1', x: 0.35, y: 0.25 },
  { id: 1, label: 'L2', x: 0.35, y: 0.42 },
  { id: 2, label: 'L3', x: 0.35, y: 0.58 },
  { id: 3, label: 'L4', x: 0.35, y: 0.75 },
  
  // Right Column
  { id: 4, label: 'R1', x: 0.65, y: 0.25 },
  { id: 5, label: 'R2', x: 0.65, y: 0.42 },
  { id: 6, label: 'R3', x: 0.65, y: 0.58 },
  { id: 7, label: 'R4', x: 0.65, y: 0.75 },
  
  // Top Row (Middle 2)
  { id: 8, label: 'T1', x: 0.45, y: 0.25 },
  { id: 9, label: 'T2', x: 0.55, y: 0.25 },
  
  // Bottom Row (Middle 2)
  { id: 10, label: 'B1', x: 0.45, y: 0.75 },
  { id: 11, label: 'B2', x: 0.55, y: 0.75 },
];

// Beatmap Definition (Extended Format)
// Each row = one measure (4 beats at BPM)
// Each beat can be:
//   - null: no block (rest)
//   - string: simple track label (e.g., 'L1', 'R2') - direction defaults to 'any'
//   - BlockNote object: { track: 'L1', direction: 'down', color: 'left' }
//   - array: multiple blocks spawn simultaneously
//
// Track labels: L1-L4 (left column), R1-R4 (right column), T1-T2 (top), B1-B2 (bottom)
// Directions: 'up', 'down', 'left', 'right', 'up-left', 'up-right', 'down-left', 'down-right', 'any'
// Colors: 'left' (cyan), 'right' (magenta), 'both' (white)

// Helper to get track type (left/right/both) based on track label
export const getTrackType = (label: string): BlockType => {
  if (label.startsWith('L')) return 'left';
  if (label.startsWith('R')) return 'right';
  // T and B tracks can be hit by either hand
  return 'both';
};

// Helper to get track index from label
export const getTrackIndexByLabel = (label: string): number => {
  const track = TRACK_LAYOUT.find(t => t.label === label);
  return track ? track.id : 0;
};

// Helper to parse beat data into normalized BlockNote format
export const parseBeatNote = (data: string | BlockNote): BlockNote => {
  if (typeof data === 'string') {
    return {
      track: data,
      direction: 'any',
      color: getTrackType(data)
    };
  }
  return {
    track: data.track,
    direction: data.direction || 'any',
    color: data.color || getTrackType(data.track)
  };
};

// Direction arrow mapping for UI display
export const DIRECTION_ARROWS: Record<SlashDirection, string> = {
  'up': '↑',
  'down': '↓',
  'left': '←',
  'right': '→',
  'up-left': '↖',
  'up-right': '↗',
  'down-left': '↙',
  'down-right': '↘',
  'any': '●'
};

// Direction to angle mapping (radians, 0 = right, counterclockwise)
export const DIRECTION_ANGLES: Record<SlashDirection, number> = {
  'right': 0,
  'up-right': Math.PI / 4,
  'up': Math.PI / 2,
  'up-left': (3 * Math.PI) / 4,
  'left': Math.PI,
  'down-left': (5 * Math.PI) / 4,
  'down': (3 * Math.PI) / 2,
  'down-right': (7 * Math.PI) / 4,
  'any': 0 // No specific angle for 'any'
};

// Import beatmaps from JSON files
import fadedBeatmap from './beatmaps/faded.json';
import tutorialBeatmap from './beatmaps/tutorial.json';
import neonDreamsBeatmap from './beatmaps/neon-dreams.json';
import zenFlowBeatmap from './beatmaps/zen-flow.json';
import cyberRushBeatmap from './beatmaps/cyber-rush.json';

// Helper to count notes in a beatmap
const countNotes = (data: BeatData[][]): number => {
  let count = 0;
  for (const measure of data) {
    for (const beat of measure) {
      if (beat === null) continue;
      if (Array.isArray(beat)) {
        count += beat.length;
      } else {
        count += 1;
      }
    }
  }
  return count;
};

// Calculate duration based on BPM and measures
const calculateDuration = (measures: number, bpm: number): string => {
  const beatsPerMeasure = 4;
  const totalBeats = measures * beatsPerMeasure;
  const totalSeconds = (totalBeats / bpm) * 60;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Process raw beatmap JSON into full Beatmap type
const processBeatmap = (raw: any): Beatmap => ({
  ...raw,
  duration: calculateDuration(raw.data.length, raw.bpm),
  noteCount: countNotes(raw.data),
});

// Beatmap Collection - loaded from JSON files
export const BEATMAPS: Beatmap[] = [
  processBeatmap(fadedBeatmap),
  processBeatmap(tutorialBeatmap),
  processBeatmap(neonDreamsBeatmap),
  processBeatmap(zenFlowBeatmap),
  processBeatmap(cyberRushBeatmap),
];

// Default beatmap (for backwards compatibility)
export const DEFAULT_BEATMAP = BEATMAPS.find(b => b.id === 'neon-dreams')!;

// Legacy export for compatibility
export const BEAT_MAP = DEFAULT_BEATMAP.data;
