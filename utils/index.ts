// Three.js helpers
export { 
  createBlockMesh, 
  createSaberMesh, 
  createTrailMesh,
  updateTrail,
  createAvatarMesh,
  mapTo3D,
  TRAIL_LENGTH
} from './threeHelpers';

// Collision detection
export { 
  getSaberBladePoints, 
  checkSaberIntersection, 
  checkBlockCollision 
} from './collision';

// Visual effects
export { 
  createExplosion, 
  createSlashEffect, 
  createDebris,
  updateParticles,
  updateShockwaves,
  updateSlashEffects,
  updateDebris
} from './effects';
export type { EffectRefs } from './effects';
