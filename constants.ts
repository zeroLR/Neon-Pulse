
export const GAME_CONFIG = {
  ASPECT_RATIO: 16 / 9,
  // 3D World Constants
  CAMERA_Z: 12, // Moved back for TPS
  SPAWN_Z: -100, // Much deeper spawn for more immersion
  HIT_Z: 0, 
  DESPAWN_Z: 10, 
  
  // Gameplay
  BLOCK_SPEED: 50, // Faster to cover the longer distance
  HIT_THRESHOLD: 2.0, // Legacy radius check
  VELOCITY_THRESHOLD: 0.1, // Reduced threshold for 3D velocity
  
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

// Beatmap Definition
// Each row = one beat (quarter note at BPM)
// Each element can be:
//   - null: no block
//   - string: single block on that track (e.g., 'L1', 'R2', 'T1', 'B2')
//   - array: multiple blocks spawn simultaneously (e.g., ['L1', 'R1'])
// Track labels: L1-L4 (left column), R1-R4 (right column), T1-T2 (top), B1-B2 (bottom)

// Helper to get track type (left/right/both) based on track label
export const getTrackType = (label: string): 'left' | 'right' | 'both' => {
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

// Demo Beatmap - 4 measures with 4 beats each = 16 beats
export const BEAT_MAP: (string | string[] | null)[][] = [
  // Measure 1: Simple alternating
  ['L2', null, 'R2', null],
  
  // Measure 2: Top row
  ['T1', null, 'T2', null],
  
  // Measure 3: Wider pattern
  ['L1', 'R1', 'L4', 'R4'],
  
  // Measure 4: Simultaneous blocks
  ['L2', 'R2', ['T1', 'T2'], ['B1', 'B2']],
  
  // Measure 5: Cross pattern
  ['L1', 'R4', 'L4', 'R1'],
  
  // Measure 6: Fast middle
  [['L2', 'R2'], null, ['L3', 'R3'], null],
  
  // Measure 7: Escalating
  ['L1', 'L2', 'L3', 'L4'],
  
  // Measure 8: Mirror
  ['R1', 'R2', 'R3', 'R4'],
  
  // Measure 9: All corners
  [['L1', 'R1'], null, ['L4', 'R4'], null],
  
  // Measure 10: Zigzag
  ['L1', 'R2', 'L3', 'R4'],
  
  // Measure 11: Bottom focus
  ['B1', 'L4', 'B2', 'R4'],
  
  // Measure 12: Top focus
  ['T1', 'L1', 'T2', 'R1'],
  
  // Measure 13: Dense
  [['L2', 'R2'], ['L3', 'R3'], ['L2', 'R2'], ['L3', 'R3']],
  
  // Measure 14: Breathing room
  ['L2', null, null, 'R2'],
  
  // Measure 15: Finale buildup
  ['L1', 'R1', ['L2', 'R2'], ['L3', 'R3']],
  
  // Measure 16: Grand finale
  [['L1', 'R1'], ['T1', 'T2'], ['B1', 'B2'], ['L4', 'R4']],
];
