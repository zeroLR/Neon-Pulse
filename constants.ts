
export const GAME_CONFIG = {
  ASPECT_RATIO: 16 / 9,
  // 3D World Constants
  CAMERA_Z: 12, // Moved back for TPS
  SPAWN_Z: -50, // Deeper spawn for perspective
  HIT_Z: 0, 
  DESPAWN_Z: 10, 
  
  // Gameplay
  BLOCK_SPEED: 30, // Faster to cover distance
  HIT_THRESHOLD: 2.0, // Legacy radius check
  VELOCITY_THRESHOLD: 0.1, // Reduced threshold for 3D velocity
  
  // Visuals & Hitbox
  BLOCK_SIZE: 1.5, // Visual size (increased from 1.0)
  BLOCK_HITBOX_SIZE: 2.5, // Physical collision size (Increased from 1.6)
  
  // Physics (Debris)
  GRAVITY: 25.0,
  DEBRIS_LIFE: 0.8, // Seconds
  DEBRIS_EXPLOSION_FORCE: 5.0,

  // Visual Cues
  APPROACH_RING_START_SCALE: 2.5, // The ring starts 2.5x larger than the block
  
  // Saber Hitbox (Local Dimensions)
  SABER_HITBOX_CONFIG: {
      WIDTH: 1.0,  // Width of the cut zone
      HEIGHT: 1.0, // Height of the cut zone
      LENGTH: 5.5, // Length of the blade coverage
      OFFSET_Z: 2.0 // Shift forward to cover blade
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

// 6-Track System Layout (Normalized Screen Coordinates: 0,0 is Top-Left)
export const TRACK_LAYOUT = [
  { id: 0, label: 'Top-Left', x: 0.25, y: 0.25 },    // Moved from 0.2 to 0.25
  { id: 1, label: 'Top-Mid', x: 0.5, y: 0.25 },
  { id: 2, label: 'Top-Right', x: 0.75, y: 0.25 },   // Moved from 0.8 to 0.75
  { id: 3, label: 'Bottom-Left', x: 0.25, y: 0.75 }, // Moved from 0.2 to 0.25
  { id: 4, label: 'Bottom-Mid', x: 0.5, y: 0.75 },
  { id: 5, label: 'Bottom-Right', x: 0.75, y: 0.75 }, // Moved from 0.8 to 0.75
];

// Procedural Beat Patterns (simplified for demo)
export const BEAT_PATTERNS = [
  ['left', null, 'right', null],
  ['left', 'left', 'right', 'right'],
  ['both', null, 'both', null],
  ['left', 'right', 'left', 'right'],
  ['left', null, 'left', 'right', null, 'right'],
];
