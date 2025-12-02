
import { BlockNote, BlockType, SlashDirection, BeatData } from './types';

export const GAME_CONFIG = {
  ASPECT_RATIO: 16 / 9,
  
  // 3D World Constants
  CAMERA_Z: 12, // Moved back for TPS
  SPAWN_Z: -70, // Much deeper spawn for more immersion
  HIT_Z: 0, 
  DESPAWN_Z: 10, 
  
  // Camera Settings
  CAMERA: {
    FOV: 60,
    NEAR: 0.1,
    FAR: 100,
    POSITION_Y: 2,
    LOOK_AT_Z: -20,
  },
  
  // Grid (Floor) Settings
  GRID: {
    SIZE: 60,
    DIVISIONS: 60,
    POSITION_Y: -6,
    POSITION_Z: -20,
    COLOR_CENTER: 0x111111,
    COLOR_GRID: 0x000000,
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

// Demo Beatmap - Extended format with direction support
// Shorthand: just track label = any direction
// Full: { track: 'L1', direction: 'down', color: 'left' }
export const BEAT_MAP: BeatData[][] = [
  // Measure 1: Simple alternating with directions
  [
    { track: 'L2', direction: 'down' },
    null,
    { track: 'R2', direction: 'down' },
    null
  ],
  
  // Measure 2: Top row - slash upward
  [
    { track: 'T1', direction: 'up' },
    null,
    { track: 'T2', direction: 'up' },
    null
  ],
  
  // Measure 3: Wider pattern with diagonal slashes
  [
    { track: 'L1', direction: 'down-right' },
    { track: 'R1', direction: 'down-left' },
    { track: 'L4', direction: 'up-right' },
    { track: 'R4', direction: 'up-left' }
  ],
  
  // Measure 4: Simultaneous blocks
  [
    { track: 'L2', direction: 'right' },
    { track: 'R2', direction: 'left' },
    [{ track: 'T1', direction: 'down' }, { track: 'T2', direction: 'down' }],
    [{ track: 'B1', direction: 'up' }, { track: 'B2', direction: 'up' }]
  ],
  
  // Measure 5: Cross pattern
  [
    { track: 'L1', direction: 'down-right' },
    { track: 'R4', direction: 'up-left' },
    { track: 'L4', direction: 'up-right' },
    { track: 'R1', direction: 'down-left' }
  ],
  
  // Measure 6: Fast middle - horizontal slashes
  [
    [{ track: 'L2', direction: 'right' }, { track: 'R2', direction: 'left' }],
    null,
    [{ track: 'L3', direction: 'right' }, { track: 'R3', direction: 'left' }],
    null
  ],
  
  // Measure 7: Escalating down the left side
  [
    { track: 'L1', direction: 'down' },
    { track: 'L2', direction: 'down' },
    { track: 'L3', direction: 'down' },
    { track: 'L4', direction: 'down' }
  ],
  
  // Measure 8: Mirror - down the right side
  [
    { track: 'R1', direction: 'down' },
    { track: 'R2', direction: 'down' },
    { track: 'R3', direction: 'down' },
    { track: 'R4', direction: 'down' }
  ],
  
  // Measure 9: All corners with diagonals
  [
    [{ track: 'L1', direction: 'down-right' }, { track: 'R1', direction: 'down-left' }],
    null,
    [{ track: 'L4', direction: 'up-right' }, { track: 'R4', direction: 'up-left' }],
    null
  ],
  
  // Measure 10: Zigzag with alternating directions
  [
    { track: 'L1', direction: 'right' },
    { track: 'R2', direction: 'left' },
    { track: 'L3', direction: 'right' },
    { track: 'R4', direction: 'left' }
  ],
  
  // Measure 11: Bottom focus - upward slashes
  [
    { track: 'B1', direction: 'up' },
    { track: 'L4', direction: 'up' },
    { track: 'B2', direction: 'up' },
    { track: 'R4', direction: 'up' }
  ],
  
  // Measure 12: Top focus - downward slashes
  [
    { track: 'T1', direction: 'down' },
    { track: 'L1', direction: 'down' },
    { track: 'T2', direction: 'down' },
    { track: 'R1', direction: 'down' }
  ],
  
  // Measure 13: Dense - alternating horizontal
  [
    [{ track: 'L2', direction: 'right' }, { track: 'R2', direction: 'left' }],
    [{ track: 'L3', direction: 'right' }, { track: 'R3', direction: 'left' }],
    [{ track: 'L2', direction: 'right' }, { track: 'R2', direction: 'left' }],
    [{ track: 'L3', direction: 'right' }, { track: 'R3', direction: 'left' }]
  ],
  
  // Measure 14: Breathing room - any direction (dot blocks)
  [
    { track: 'L2', direction: 'any' },
    null,
    null,
    { track: 'R2', direction: 'any' }
  ],
  
  // Measure 15: Finale buildup
  [
    { track: 'L1', direction: 'down' },
    { track: 'R1', direction: 'down' },
    [{ track: 'L2', direction: 'down' }, { track: 'R2', direction: 'down' }],
    [{ track: 'L3', direction: 'down' }, { track: 'R3', direction: 'down' }]
  ],
  
  // Measure 16: Grand finale - mixed directions
  [
    [{ track: 'L1', direction: 'down-right' }, { track: 'R1', direction: 'down-left' }],
    [{ track: 'T1', direction: 'down' }, { track: 'T2', direction: 'down' }],
    [{ track: 'B1', direction: 'up' }, { track: 'B2', direction: 'up' }],
    [{ track: 'L4', direction: 'up-right' }, { track: 'R4', direction: 'up-left' }]
  ],
];
