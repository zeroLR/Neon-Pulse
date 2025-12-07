import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { GAME_CONFIG } from '../constants';
import {
  createSaberMesh,
  createTrailMesh,
  createAvatarMesh,
  AvatarParts
} from '../utils/threeHelpers';

export interface ThreeSceneRefs {
  renderer: THREE.WebGLRenderer | null;
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  // Object groups
  blockMeshes: Map<string, THREE.Group>;
  particleMeshes: THREE.Group | null;
  debrisMeshes: THREE.Group | null;
  shockwaveMeshes: THREE.Group | null;
  slashEffects: THREE.Group | null;
  // Sabers
  leftSaber: THREE.Group | null;
  rightSaber: THREE.Group | null;
  // Trails
  leftTrail: THREE.Mesh | null;
  rightTrail: THREE.Mesh | null;
  // Avatar
  avatarGroup: THREE.Group | null;
  avatarParts: AvatarParts | null;
  // Track lines
  trackLines: THREE.Line[];
  // Debug
  debugGroup: THREE.Group | null;
}

export interface UseThreeSceneReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  refs: React.RefObject<ThreeSceneRefs>;
  shakeIntensity: React.RefObject<number>;
  render: () => void;
  clearBlockMeshes: () => void;
  clearEffects: () => void;
}

export const useThreeScene = (): UseThreeSceneReturn => {
  const containerRef = useRef<HTMLDivElement>(null);
  const shakeIntensity = useRef<number>(0);
  
  const refs = useRef<ThreeSceneRefs>({
    renderer: null,
    scene: null,
    camera: null,
    blockMeshes: new Map(),
    particleMeshes: null,
    debrisMeshes: null,
    shockwaveMeshes: null,
    slashEffects: null,
    leftSaber: null,
    rightSaber: null,
    leftTrail: null,
    rightTrail: null,
    avatarGroup: null,
    avatarParts: null,
    trackLines: [],
    debugGroup: null,
  });

  const initThree = useCallback(() => {
    if (!containerRef.current) return;
    
    const width = window.innerWidth || 1280;
    const height = window.innerHeight || 720;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a12);
    scene.fog = new THREE.Fog(0x0a0a12, 50, 400);
    refs.current.scene = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      GAME_CONFIG.CAMERA.FOV,
      width / height,
      GAME_CONFIG.CAMERA.NEAR,
      GAME_CONFIG.CAMERA.FAR
    );
    camera.position.set(0, GAME_CONFIG.CAMERA.POSITION_Y, GAME_CONFIG.CAMERA_Z);
    camera.lookAt(0, 0, GAME_CONFIG.CAMERA.LOOK_AT_Z);
    refs.current.camera = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    refs.current.renderer = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, GAME_CONFIG.LIGHTS.AMBIENT_INTENSITY);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(
      0xffffff,
      GAME_CONFIG.LIGHTS.POINT_INTENSITY,
      GAME_CONFIG.LIGHTS.POINT_DISTANCE
    );
    pointLight.position.set(
      GAME_CONFIG.LIGHTS.POINT_POSITION.x,
      GAME_CONFIG.LIGHTS.POINT_POSITION.y,
      GAME_CONFIG.LIGHTS.POINT_POSITION.z
    );
    scene.add(pointLight);

    // Grid (Floor)
    const gridHelper = new THREE.GridHelper(
      GAME_CONFIG.GRID.SIZE,
      GAME_CONFIG.GRID.DIVISIONS,
      GAME_CONFIG.GRID.COLOR_CENTER,
      GAME_CONFIG.GRID.COLOR_GRID
    );
    gridHelper.position.y = GAME_CONFIG.GRID.POSITION_Y;
    gridHelper.position.z = GAME_CONFIG.GRID.POSITION_Z;
    scene.add(gridHelper);

    // Avatar
    const avatarResult = createAvatarMesh();
    scene.add(avatarResult.group);
    refs.current.avatarGroup = avatarResult.group;
    refs.current.avatarParts = avatarResult.parts;

    // Sabers
    const lSaber = createSaberMesh(GAME_CONFIG.COLORS.CYAN);
    lSaber.scale.setScalar(GAME_CONFIG.DEFAULT_SABER_SCALE);
    scene.add(lSaber);
    refs.current.leftSaber = lSaber;

    const rSaber = createSaberMesh(GAME_CONFIG.COLORS.MAGENTA);
    rSaber.scale.setScalar(GAME_CONFIG.DEFAULT_SABER_SCALE);
    scene.add(rSaber);
    refs.current.rightSaber = rSaber;

    // Trails
    const lTrail = createTrailMesh(GAME_CONFIG.TRAIL.LEFT_COLOR);
    scene.add(lTrail);
    refs.current.leftTrail = lTrail;

    const rTrail = createTrailMesh(GAME_CONFIG.TRAIL.RIGHT_COLOR);
    scene.add(rTrail);
    refs.current.rightTrail = rTrail;

    // Effect Groups
    const pGroup = new THREE.Group();
    scene.add(pGroup);
    refs.current.particleMeshes = pGroup;

    const dGroup = new THREE.Group();
    scene.add(dGroup);
    refs.current.debrisMeshes = dGroup;

    const sGroup = new THREE.Group();
    scene.add(sGroup);
    refs.current.shockwaveMeshes = sGroup;

    const slashGroup = new THREE.Group();
    scene.add(slashGroup);
    refs.current.slashEffects = slashGroup;

    // Debug Group
    const debugGroup = new THREE.Group();
    scene.add(debugGroup);
    refs.current.debugGroup = debugGroup;
  }, []);

  const render = useCallback(() => {
    const { renderer, scene, camera } = refs.current;
    if (renderer && scene && camera) {
      // Apply camera shake
      if (shakeIntensity.current > 0 && camera) {
        const amount = shakeIntensity.current;
        const rx = (Math.random() - 0.5) * amount;
        const ry = (Math.random() - 0.5) * amount;
        camera.position.set(rx, GAME_CONFIG.CAMERA.POSITION_Y + ry, GAME_CONFIG.CAMERA_Z);

        shakeIntensity.current *= GAME_CONFIG.CAMERA_SHAKE.DECAY_RATE;
        if (shakeIntensity.current < GAME_CONFIG.CAMERA_SHAKE.THRESHOLD) {
          shakeIntensity.current = 0;
          camera.position.set(0, GAME_CONFIG.CAMERA.POSITION_Y, GAME_CONFIG.CAMERA_Z);
        }
      }

      renderer.render(scene, camera);
    }
  }, []);

  const clearBlockMeshes = useCallback(() => {
    const { scene, blockMeshes } = refs.current;
    if (scene) {
      blockMeshes.forEach(mesh => scene.remove(mesh));
      blockMeshes.clear();
    }
  }, []);

  const clearEffects = useCallback(() => {
    const { particleMeshes, debrisMeshes, shockwaveMeshes, slashEffects } = refs.current;
    if (particleMeshes) particleMeshes.clear();
    if (debrisMeshes) debrisMeshes.clear();
    if (shockwaveMeshes) shockwaveMeshes.clear();
    if (slashEffects) slashEffects.clear();
  }, []);

  // Initialize and cleanup
  useEffect(() => {
    initThree();

    const handleResize = () => {
      const { renderer, camera } = refs.current;
      if (!containerRef.current || !renderer || !camera) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      const { renderer } = refs.current;
      if (renderer && containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
        renderer.dispose();
      }
    };
  }, [initThree]);

  return {
    containerRef,
    refs,
    shakeIntensity,
    render,
    clearBlockMeshes,
    clearEffects,
  };
};
