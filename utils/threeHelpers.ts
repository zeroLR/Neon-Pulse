import * as THREE from 'three';
import { GAME_CONFIG } from '../constants';
import { BlockType } from '../types';

export const TRAIL_LENGTH = 20;

/**
 * Create a block mesh with neon wireframe style
 */
export const createBlockMesh = (type: BlockType, blockScale: number = 1.0): THREE.Group => {
  const group = new THREE.Group();
  const size = GAME_CONFIG.BLOCK_SIZE;
  
  // Geometry
  const geometry = new THREE.BoxGeometry(size, size, size);
  const edges = new THREE.EdgesGeometry(geometry);
  
  // Add lineDistance attribute for dashed material
  const lineDistances = new Float32Array(edges.attributes.position.count);
  for (let i = 0; i < lineDistances.length; i += 2) {
    lineDistances[i] = 0;
    lineDistances[i + 1] = size;
  }
  edges.setAttribute('lineDistance', new THREE.BufferAttribute(lineDistances, 1));

  // Color
  let color = GAME_CONFIG.COLORS.WHITE;
  if (type === 'left') color = GAME_CONFIG.COLORS.CYAN;
  if (type === 'right') color = GAME_CONFIG.COLORS.MAGENTA;

  // 1. Wireframe (The Neon Outline)
  const lineMaterial = new THREE.LineDashedMaterial({ 
    color: 0xffffff,
    linewidth: 3,
    transparent: true, 
    opacity: 1.0,
    dashSize: 0,
    gapSize: size,
    scale: 1.5 
  });
  const wireframe = new THREE.LineSegments(edges, lineMaterial);
  wireframe.name = 'wireframe';
  wireframe.scale.setScalar(1.01); 
  group.add(wireframe);

  // 2. Inner Glow
  const innerMaterial = new THREE.MeshBasicMaterial({ 
    color: color, 
    transparent: true, 
    opacity: 0.1,
    side: THREE.DoubleSide
  });
  const core = new THREE.Mesh(geometry, innerMaterial);
  core.name = 'core';
  group.add(core);

  // 3. Collision Hitbox
  const hbSize = size * 1.1;
  const hbGeo = new THREE.BoxGeometry(hbSize, hbSize, hbSize);
  const hbMat = new THREE.MeshBasicMaterial({ 
    color: 0x00ff00, 
    wireframe: true,
    transparent: true,
    opacity: 0.5
  });
  const hitbox = new THREE.Mesh(hbGeo, hbMat);
  hitbox.name = 'hitbox';
  hitbox.visible = false; 
  group.add(hitbox);

  group.scale.setScalar(blockScale);
  return group;
};

/**
 * Create a saber mesh with handle, blade and hitbox
 */
export const createSaberMesh = (color: number): THREE.Group => {
  const group = new THREE.Group();
  
  // Handle
  const handleGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.3, 16);
  handleGeo.rotateX(Math.PI / 2); 
  handleGeo.translate(0, 0, 0.15);
  const handleMat = new THREE.MeshStandardMaterial({ 
    color: 0x222222, 
    roughness: 0.4, 
    metalness: 0.8 
  });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  group.add(handle);

  // Blade
  const bladeLength = 4.0;
  const bladeGeo = new THREE.CylinderGeometry(0.04, 0.04, bladeLength, 16);
  bladeGeo.rotateX(Math.PI / 2);
  bladeGeo.translate(0, 0, 0.3 + bladeLength / 2);
  const bladeMat = new THREE.MeshStandardMaterial({ 
    color: color, 
    emissive: color, 
    emissiveIntensity: 3.0,
    roughness: 0.0,
    transparent: true,
    opacity: 0.9
  });
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  group.add(blade);
  
  // Hitbox
  const { WIDTH, HEIGHT, LENGTH, OFFSET_Z } = GAME_CONFIG.SABER_HITBOX_CONFIG;
  const hitboxGeo = new THREE.BoxGeometry(WIDTH, HEIGHT, LENGTH);
  const hitboxMat = new THREE.MeshBasicMaterial({ 
    color: color, 
    wireframe: true,
  });
  const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
  hitbox.name = 'hitbox';
  hitbox.position.set(0, 0, OFFSET_Z);
  hitbox.visible = false;
  hitbox.scale.setScalar(1.25);
  group.add(hitbox);

  return group;
};

/**
 * Create trail mesh for saber
 */
export const createTrailMesh = (color: number): THREE.Mesh => {
  const vertexCount = TRAIL_LENGTH * 2;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(vertexCount * 3);
  const alphas = new Float32Array(vertexCount);
  
  const indices = [];
  for (let i = 0; i < TRAIL_LENGTH - 1; i++) {
    const v = i * 2;
    indices.push(v, v + 1, v + 2);
    indices.push(v + 2, v + 1, v + 3);
  }
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(color) }
    },
    vertexShader: `
      attribute float alpha;
      varying float vAlpha;
      void main() {
        vAlpha = alpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      varying float vAlpha;
      void main() {
        gl_FragColor = vec4(color, vAlpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
};

/**
 * Update trail mesh with current positions
 */
export const updateTrail = (
  mesh: THREE.Mesh | null, 
  history: {base: THREE.Vector3, tip: THREE.Vector3}[],
  saberGroup: THREE.Group | null,
  saberScale: number
): void => {
  if (!mesh || !saberGroup) return;

  const handleLength = 0.3 * saberScale; // Handle offset
  const bladeLength = 4.0 * saberScale;
  
  // Trail starts at blade base (after handle), not at saber origin
  const bladeBaseOffset = new THREE.Vector3(0, 0, handleLength).applyQuaternion(saberGroup.quaternion);
  const base = saberGroup.position.clone().add(bladeBaseOffset);
  
  // Trail ends at blade tip
  const bladeTipOffset = new THREE.Vector3(0, 0, handleLength + bladeLength).applyQuaternion(saberGroup.quaternion);
  const tip = saberGroup.position.clone().add(bladeTipOffset);

  history.unshift({ base, tip });
  if (history.length > TRAIL_LENGTH) {
    history.pop();
  }

  const positions = mesh.geometry.attributes.position.array as Float32Array;
  const alphas = mesh.geometry.attributes.alpha.array as Float32Array;

  for (let i = 0; i < TRAIL_LENGTH; i++) {
    const point = history[i] || history[history.length - 1];
    if (!point) continue;

    positions[i * 6 + 0] = point.base.x;
    positions[i * 6 + 1] = point.base.y;
    positions[i * 6 + 2] = point.base.z;
    positions[i * 6 + 3] = point.tip.x;
    positions[i * 6 + 4] = point.tip.y;
    positions[i * 6 + 5] = point.tip.z;

    const alpha = 1.0 - (i / TRAIL_LENGTH);
    alphas[i * 2] = alpha * 0.2;
    alphas[i * 2 + 1] = alpha * 0.2;
  }

  mesh.geometry.attributes.position.needsUpdate = true;
  mesh.geometry.attributes.alpha.needsUpdate = true;
};

/**
 * Create avatar mesh for pose visualization
 */
export const createAvatarMesh = (): {
  group: THREE.Group;
  parts: {
    head: THREE.Mesh;
    spine: THREE.Line;
    shoulders: THREE.Line;
    leftArm: THREE.Line;
    rightArm: THREE.Line;
    hips: THREE.Line;
  };
} => {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({ 
    color: 0xffffff, 
    linewidth: 2, 
    transparent: true, 
    opacity: 0.6 
  });
  const blueMat = new THREE.LineBasicMaterial({ 
    color: GAME_CONFIG.COLORS.CYAN, 
    linewidth: 2 
  });
  const redMat = new THREE.LineBasicMaterial({ 
    color: GAME_CONFIG.COLORS.MAGENTA, 
    linewidth: 2 
  });

  // Head
  const headGeo = new THREE.IcosahedronGeometry(0.8, 1);
  const headMat = new THREE.MeshBasicMaterial({ 
    color: 0xffffff, 
    wireframe: true, 
    transparent: true, 
    opacity: 0.5 
  });
  const head = new THREE.Mesh(headGeo, headMat);
  group.add(head);

  // Helper to create line
  const createLine = (mat: THREE.Material, points = 2) => {
    const geo = new THREE.BufferGeometry().setFromPoints(
      new Array(points).fill(new THREE.Vector3(0, 0, 0))
    );
    const line = new THREE.Line(geo, mat);
    group.add(line);
    return line;
  };

  const spine = createLine(material);
  const shoulders = createLine(material);
  const hips = createLine(material);
  const leftArm = createLine(blueMat, 3);
  const rightArm = createLine(redMat, 3);

  group.visible = false;
  
  return {
    group,
    parts: { head, spine, shoulders, hips, leftArm, rightArm }
  };
};

/**
 * Convert normalized 2D coordinates to 3D world position
 */
export const mapTo3D = (
  normX: number, 
  normY: number, 
  rawZ: number, 
  camera: THREE.PerspectiveCamera | null,
  forceCompute = false
): THREE.Vector3 => {
  let cam = camera;
  if (!cam && forceCompute) {
    const width = window.innerWidth || 1280;
    const height = window.innerHeight || 720;
    const aspect = width / height;
    cam = new THREE.PerspectiveCamera(60, aspect, 0.1, 100);
    cam.position.set(0, 0, GAME_CONFIG.CAMERA_Z);
  }
  
  if (!cam) return new THREE.Vector3(0, 0, 0);

  const zScale = 6.0; 
  const zBias = 0; 
  const safeZ = Number.isFinite(rawZ) ? rawZ : 0;
  const z = (safeZ * zScale) + zBias;

  const distance = cam.position.z - z;
  const vFov = cam.fov * Math.PI / 180;
  const height = 2 * Math.tan(vFov / 2) * distance;
  
  const aspect = Number.isFinite(cam.aspect) ? cam.aspect : GAME_CONFIG.ASPECT_RATIO;
  const width = height * aspect;

  const safeNormX = Number.isFinite(normX) ? normX : 0.5;
  const safeNormY = Number.isFinite(normY) ? normY : 0.5;

  const x = (safeNormX - 0.5) * width;
  const y = -(safeNormY - 0.5) * height; 
  
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return new THREE.Vector3(0, 0, 0);
  }
  
  return new THREE.Vector3(x, y, z);
};

/**
 * Avatar parts type definition
 */
export interface AvatarParts {
  head: THREE.Mesh;
  spine: THREE.Line;
  shoulders: THREE.Line;
  leftArm: THREE.Line;
  rightArm: THREE.Line;
  hips: THREE.Line;
}

/**
 * Avatar position data returned from updateAvatar
 */
export interface AvatarPositionData {
  lWrist: THREE.Vector3;
  rWrist: THREE.Vector3;
  lElbow: THREE.Vector3;
  rElbow: THREE.Vector3;
  lPalm: THREE.Vector3;
  rPalm: THREE.Vector3;
}

/**
 * NormalizedLandmark type (simplified for this module)
 */
interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
}

/**
 * Update avatar mesh based on pose landmarks
 */
export const updateAvatar = (
  lm: NormalizedLandmark[],
  avatarParts: AvatarParts | null,
  camera: THREE.PerspectiveCamera | null
): AvatarPositionData | null => {
  if (!avatarParts) return null;
  
  const { head, spine, shoulders, hips, leftArm, rightArm } = avatarParts;
  
  const getPos = (idx: number) => mapTo3D(1 - lm[idx].x, lm[idx].y, lm[idx].z, camera);

  const nose = getPos(0);
  const lShoulder = getPos(11);
  const rShoulder = getPos(12);
  const lElbow = getPos(13);
  const rElbow = getPos(14);
  const lWrist = getPos(15);
  const rWrist = getPos(16);
  const lPalm = getPos(19);  // Left index finger base (palm center)
  const rPalm = getPos(20);  // Right index finger base (palm center)
  const lHip = getPos(23);
  const rHip = getPos(24);

  // Head
  head.position.copy(nose);
  
  // Update Lines
  const updateLine = (line: THREE.Line, points: THREE.Vector3[]) => {
    line.geometry.setFromPoints(points);
    line.geometry.attributes.position.needsUpdate = true;
  };

  const midShoulder = new THREE.Vector3().addVectors(lShoulder, rShoulder).multiplyScalar(0.5);
  const midHip = new THREE.Vector3().addVectors(lHip, rHip).multiplyScalar(0.5);

  updateLine(spine, [midShoulder, midHip]);
  updateLine(shoulders, [lShoulder, rShoulder]);
  updateLine(hips, [lHip, rHip]);
  updateLine(leftArm, [lShoulder, lElbow, lWrist]);
  updateLine(rightArm, [rShoulder, rElbow, rWrist]);

  return { lWrist, rWrist, lElbow, rElbow, lPalm, rPalm };
};
