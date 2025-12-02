import * as THREE from 'three';
import { GAME_CONFIG } from '../constants';

export interface EffectRefs {
  particleMeshes: THREE.Group;
  debrisMeshes: THREE.Group;
  shockwaveMeshes: THREE.Group;
  slashEffects: THREE.Group;
  camera: THREE.PerspectiveCamera | null;
}

/**
 * Create particle explosion at position
 */
export const createExplosion = (
  pos: THREE.Vector3, 
  color: number,
  refs: EffectRefs
): void => {
  if (!refs.particleMeshes) return;
  
  // 1. Particles
  const count = 16;
  const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const material = new THREE.MeshBasicMaterial({ color: color });

  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(pos);
    
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 12
    );
    
    mesh.userData = { velocity, life: 1.0 };
    refs.particleMeshes.add(mesh);
  }

  // 2. Shockwave (Expanding Ring)
  if (refs.shockwaveMeshes) {
    const ringGeo = new THREE.RingGeometry(0.5, 0.8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ 
      color: color, 
      transparent: true, 
      opacity: 0.8, 
      side: THREE.DoubleSide 
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos);
    if (refs.camera) ring.lookAt(refs.camera.position);
    
    ring.userData = { life: 0.5, maxScale: 4.0 };
    refs.shockwaveMeshes.add(ring);
  }
};

/**
 * Create slash effect (diamond shape along slash direction)
 */
export const createSlashEffect = (
  pos: THREE.Vector3, 
  color: number, 
  saberVelocity: THREE.Vector3,
  refs: EffectRefs
): void => {
  if (!refs.slashEffects) return;
  
  // Calculate slash angle from saber velocity
  const angle = Math.atan2(saberVelocity.y, saberVelocity.x);
  
  // Create rounded diamond shape (smaller size)
  const slashLength = GAME_CONFIG.BLOCK_SIZE * 1.5;
  const slashWidth = 0.12;
  const cornerRadius = 0.06;
  
  // Create diamond shape with rounded corners
  const shape = new THREE.Shape();
  const hw = slashWidth;
  const hl = slashLength;
  const r = cornerRadius;
  
  shape.moveTo(hl - r, 0);
  shape.quadraticCurveTo(hl, 0, hl - r * 0.3, hw * 0.3);
  shape.lineTo(r * 0.3, hw - r * 0.3);
  shape.quadraticCurveTo(0, hw, -r * 0.3, hw - r * 0.3);
  shape.lineTo(-hl + r * 0.3, hw * 0.3);
  shape.quadraticCurveTo(-hl, 0, -hl + r * 0.3, -hw * 0.3);
  shape.lineTo(-r * 0.3, -hw + r * 0.3);
  shape.quadraticCurveTo(0, -hw, r * 0.3, -hw + r * 0.3);
  shape.lineTo(hl - r * 0.3, -hw * 0.3);
  shape.quadraticCurveTo(hl, 0, hl - r, 0);
  
  const geometry = new THREE.ShapeGeometry(shape);
  
  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 1.0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  
  const slash = new THREE.Mesh(geometry, material);
  slash.position.copy(pos);
  
  if (refs.camera) {
    slash.lookAt(refs.camera.position);
    slash.rotateZ(angle);
  }
  
  slash.userData = {
    life: 0.35,
    maxLife: 0.35,
    initialScale: 1.0,
    maxScale: 2.5,
  };
  
  refs.slashEffects.add(slash);
  
  // Create secondary glow slash
  const glowShape = new THREE.Shape();
  const ghw = slashWidth * 2;
  const ghl = slashLength * 1.1;
  const gr = cornerRadius * 1.5;
  
  glowShape.moveTo(ghl - gr, 0);
  glowShape.quadraticCurveTo(ghl, 0, ghl - gr * 0.3, ghw * 0.3);
  glowShape.lineTo(gr * 0.3, ghw - gr * 0.3);
  glowShape.quadraticCurveTo(0, ghw, -gr * 0.3, ghw - gr * 0.3);
  glowShape.lineTo(-ghl + gr * 0.3, ghw * 0.3);
  glowShape.quadraticCurveTo(-ghl, 0, -ghl + gr * 0.3, -ghw * 0.3);
  glowShape.lineTo(-gr * 0.3, -ghw + gr * 0.3);
  glowShape.quadraticCurveTo(0, -ghw, gr * 0.3, -ghw + gr * 0.3);
  glowShape.lineTo(ghl - gr * 0.3, -ghw * 0.3);
  glowShape.quadraticCurveTo(ghl, 0, ghl - gr, 0);
  
  const glowGeometry = new THREE.ShapeGeometry(glowShape);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  glow.position.copy(pos);
  
  if (refs.camera) {
    glow.lookAt(refs.camera.position);
    glow.rotateZ(angle);
  }
  
  glow.userData = {
    life: 0.25,
    maxLife: 0.25,
    initialScale: 1.0,
    maxScale: 3.0,
  };
  
  refs.slashEffects.add(glow);
};

/**
 * Create debris (block halves) when block is sliced
 */
export const createDebris = (
  pos: THREE.Vector3, 
  color: number, 
  saberVelocity: THREE.Vector3,
  debrisMeshes: THREE.Group
): void => {
  if (!debrisMeshes) return;

  const halfSize = GAME_CONFIG.BLOCK_SIZE / 2;
  const geometry = new THREE.BoxGeometry(GAME_CONFIG.BLOCK_SIZE, halfSize, GAME_CONFIG.BLOCK_SIZE);
  const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 });
  const edges = new THREE.EdgesGeometry(geometry);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });

  // Determine Cut Direction perpendicular to saber velocity
  let separationDir = new THREE.Vector3(-saberVelocity.y, saberVelocity.x, 0).normalize();
  if (separationDir.lengthSq() < 0.1) separationDir.set(0, 1, 0); 

  // Create two halves
  for (let i = -1; i <= 1; i += 2) {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(geometry, material);
    const lines = new THREE.LineSegments(edges, lineMat);
    group.add(mesh);
    group.add(lines);

    group.position.copy(pos);
    
    // Initial rotation to match cut angle
    const angle = Math.atan2(saberVelocity.y, saberVelocity.x);
    group.rotation.z = angle;

    // Velocity: Fling apart
    const force = GAME_CONFIG.DEBRIS_EXPLOSION_FORCE;
    const vel = separationDir.clone().multiplyScalar(i * force);
    vel.z = GAME_CONFIG.BLOCK_SPEED * 0.5; 
    
    group.userData = { 
      velocity: vel, 
      rotVel: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(5),
      life: GAME_CONFIG.DEBRIS_LIFE 
    };
    
    debrisMeshes.add(group);
  }
};

/**
 * Update particles in the scene
 */
export const updateParticles = (
  particleMeshes: THREE.Group, 
  dt: number
): void => {
  for (let i = particleMeshes.children.length - 1; i >= 0; i--) {
    const p = particleMeshes.children[i];
    const u = p.userData as { velocity: THREE.Vector3, life: number };
    
    p.position.add(u.velocity.clone().multiplyScalar(dt));
    u.life -= dt * 2.5; 
    p.scale.setScalar(u.life);
    
    if (u.life <= 0) particleMeshes.remove(p);
  }
};

/**
 * Update shockwave rings
 */
export const updateShockwaves = (
  shockwaveMeshes: THREE.Group, 
  dt: number
): void => {
  for (let i = shockwaveMeshes.children.length - 1; i >= 0; i--) {
    const s = shockwaveMeshes.children[i] as THREE.Mesh;
    const u = s.userData as { life: number, maxScale: number };
    const mat = s.material as THREE.MeshBasicMaterial;

    // Expand
    const scaleSpeed = u.maxScale * dt * 3;
    s.scale.addScalar(scaleSpeed);
    
    // Fade
    u.life -= dt * 3;
    mat.opacity = u.life;
    
    if (u.life <= 0) shockwaveMeshes.remove(s);
  }
};

/**
 * Update slash effects
 */
export const updateSlashEffects = (
  slashEffects: THREE.Group, 
  dt: number
): void => {
  for (let i = slashEffects.children.length - 1; i >= 0; i--) {
    const slash = slashEffects.children[i] as THREE.Mesh;
    const u = slash.userData as { 
      life: number, 
      maxLife: number, 
      initialScale: number, 
      maxScale: number 
    };
    const mat = slash.material as THREE.MeshBasicMaterial;

    u.life -= dt;
    const progress = 1 - (u.life / u.maxLife);
    
    // Expand scale over time (ease out)
    const easeProgress = 1 - Math.pow(1 - progress, 2);
    const currentScale = u.initialScale + (u.maxScale - u.initialScale) * easeProgress;
    slash.scale.setScalar(currentScale);
    
    // Fade out
    mat.opacity = Math.max(0, Math.pow(u.life / u.maxLife, 0.5));
    
    if (u.life <= 0) slashEffects.remove(slash);
  }
};

/**
 * Update debris pieces
 */
export const updateDebris = (
  debrisMeshes: THREE.Group, 
  dt: number
): void => {
  for (let i = debrisMeshes.children.length - 1; i >= 0; i--) {
    const d = debrisMeshes.children[i] as THREE.Group;
    const u = d.userData as { 
      velocity: THREE.Vector3, 
      rotVel: THREE.Vector3, 
      life: number 
    };

    // Apply velocity
    d.position.add(u.velocity.clone().multiplyScalar(dt));
    
    // Apply gravity
    u.velocity.y -= GAME_CONFIG.GRAVITY * dt;
    
    // Apply rotation
    d.rotation.x += u.rotVel.x * dt;
    d.rotation.y += u.rotVel.y * dt;
    d.rotation.z += u.rotVel.z * dt;

    // Fade out
    u.life -= dt;
    d.children.forEach(child => {
      if ((child as THREE.Mesh).material) {
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial | THREE.LineBasicMaterial;
        if (mat.opacity !== undefined) {
          mat.opacity = u.life / GAME_CONFIG.DEBRIS_LIFE;
        }
      }
    });

    if (u.life <= 0) debrisMeshes.remove(d);
  }
};
