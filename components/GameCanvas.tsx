
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { PoseService } from '../services/poseService';
import { GAME_CONFIG, BEAT_MAP, TRACK_LAYOUT, getTrackType, getTrackIndexByLabel } from '../constants';
import { Block, BlockType, GameStats, Results, NormalizedLandmark, DebugConfig } from '../types';
import { Volume2, VolumeX, AlertTriangle, Pause, Play, Home } from 'lucide-react';
import CalibrationOverlay from './CalibrationOverlay';
import DebugMenu from './DebugMenu';
import { ScoreDisplay, ComboDisplay, HealthBar } from './HUD';
import { useAudio, useGameState, useCameraPreview, useCalibration } from '../hooks';
import { 
  createBlockMesh, 
  createSaberMesh, 
  createTrailMesh, 
  updateTrail as updateTrailUtil,
  createAvatarMesh,
  mapTo3D as mapTo3DUtil,
  updateAvatar as updateAvatarUtil,
  TRAIL_LENGTH,
  AvatarParts
} from '../utils/threeHelpers';
import { 
  getSaberBladePoints, 
  checkBlockCollision as checkBlockCollisionUtil 
} from '../utils/collision';
import { 
  createExplosion as createExplosionUtil,
  createSlashEffect as createSlashEffectUtil,
  createDebris as createDebrisUtil,
  updateParticles,
  updateShockwaves,
  updateSlashEffects,
  updateDebris,
  EffectRefs
} from '../utils/effects';

interface GameCanvasProps {
  onGameOver: (score: number) => void;
  gameStatus: 'loading' | 'playing' | 'gameover' | 'menu' | 'calibration';
  setGameStatus: (status: any) => void;
  onCalibrationComplete: () => void;
  onRecalibrateRequest: () => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
    onGameOver, 
    gameStatus, 
    setGameStatus, 
    onCalibrationComplete,
    onRecalibrateRequest
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const flashRef = useRef<HTMLDivElement>(null); // Screen flash overlay
  const poseService = useRef<PoseService | null>(null);

  // --- Three.js Refs ---
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const requestRef = useRef<number | null>(null);
  
  // Object Pools / References
  const blockMeshes = useRef<Map<string, THREE.Group>>(new Map());
  const particleMeshes = useRef<THREE.Group | null>(null);
  const debrisMeshes = useRef<THREE.Group | null>(null);
  const shockwaveMeshes = useRef<THREE.Group | null>(null); 
  const slashEffects = useRef<THREE.Group | null>(null);
  const leftSaberRef = useRef<THREE.Group | null>(null);
  const rightSaberRef = useRef<THREE.Group | null>(null);
  const trackLinesRef = useRef<THREE.Line[]>([]);
  
  // Trails
  const leftTrailRef = useRef<THREE.Mesh | null>(null);
  const rightTrailRef = useRef<THREE.Mesh | null>(null);
  const leftTrailHistory = useRef<{base: THREE.Vector3, tip: THREE.Vector3}[]>([]);
  const rightTrailHistory = useRef<{base: THREE.Vector3, tip: THREE.Vector3}[]>([]);

  // Camera Shake
  const shakeIntensity = useRef<number>(0);
  
  // Avatar Refs
  const avatarGroupRef = useRef<THREE.Group | null>(null);
  const avatarParts = useRef<AvatarParts | null>(null);

  // Debug Visuals Group
  const debugGroupRef = useRef<THREE.Group | null>(null);

  // --- Game State (using custom hook) ---
  const gameState = useGameState();
  const { 
    stats, 
    isPaused, 
    setIsPaused, 
    countdown, 
    isGameActive, 
    startCountdown,
    currentMeasure, 
    currentBeat,
    debugConfig, 
    setDebugConfig, 
    isDebugOpen, 
    setIsDebugOpen 
  } = gameState;
  
  // Block management (kept here as it involves Three.js objects)
  const blocks = useRef<any[]>([]);
  const lastTime = useRef<number>(0);
  const nextSpawnTime = useRef<number>(0);
  
  // Use Ref for visual-only state to avoid re-renders resetting the game loop
  const nextTrackFlash = useRef<number[] | null>(null);

  // Raw Landmarks (from MediaPipe)
  const rawLandmarks = useRef<NormalizedLandmark[] | null>(null);
  
  // Calibration (using custom hook)
  const calibration = useCalibration(onCalibrationComplete);
  
  // Camera Preview (using custom hook)
  const cameraPreview = useCameraPreview(videoRef, rawLandmarks, debugConfig.showCameraPreview);

  // Previous Frame 3D Positions (for velocity calc)
  const prevLeftPos = useRef<THREE.Vector3>(new THREE.Vector3());
  const prevRightPos = useRef<THREE.Vector3>(new THREE.Vector3());
  
  // Current Velocity
  const leftVelocity = useRef<number>(0);
  const rightVelocity = useRef<number>(0);
  const leftVelVector = useRef<THREE.Vector3>(new THREE.Vector3());
  const rightVelVector = useRef<THREE.Vector3>(new THREE.Vector3());

  // Audio (using custom hook)
  const audio = useAudio();
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // --- Initialization ---

  // createBlockMesh is now imported from utils/threeHelpers

  // createSaberMesh is now imported from utils/threeHelpers

  // createTrailMesh is now imported from utils/threeHelpers

  // Wrapper for updateTrail to use refs
  const updateTrail = (
      mesh: THREE.Mesh | null, 
      history: React.MutableRefObject<{base: THREE.Vector3, tip: THREE.Vector3}[]>,
      saberGroup: THREE.Group | null,
      saberScale: number
  ) => {
      updateTrailUtil(mesh, history.current, saberGroup, saberScale);
  };

  // createAvatarMesh is now imported from utils/threeHelpers

  /**
   * Helper: Convert normalized 2D to 3D (wrapper for utility function).
   */
  const mapTo3D = (normX: number, normY: number, rawZ: number, forceCompute = false): THREE.Vector3 => {
     return mapTo3DUtil(normX, normY, rawZ, cameraRef.current, forceCompute);
  };

  const createTrackLines = (scene: THREE.Scene) => {
      // Clear existing lines
      trackLinesRef.current.forEach(line => scene.remove(line));
      trackLinesRef.current = [];

      TRACK_LAYOUT.forEach((track, index) => {
          const target3D = mapTo3D(track.x, track.y, 0, true);
          // Start position logic matching spawnBlock (spreadFactor 1.3 at SPAWN_Z)
          const spreadFactor = 1.3;
          // Calculate height/width at SPAWN_Z
          // Approximate by scaling based on target
          const startX = target3D.x * spreadFactor;
          const startY = target3D.y * spreadFactor;
          const startPos = new THREE.Vector3(startX, startY, GAME_CONFIG.SPAWN_Z);

          const geometry = new THREE.BufferGeometry().setFromPoints([startPos, target3D]);
          const material = new THREE.LineBasicMaterial({ 
              color: GAME_CONFIG.COLORS.GRAY, 
              transparent: true, 
              opacity: 0.1, // Softer rails
              linewidth: 1
          });
          const line = new THREE.Line(geometry, material);
          scene.add(line);
          trackLinesRef.current[index] = line;
      });
  };

  const initThree = () => {
    if (!containerRef.current) return;
    
    const width = window.innerWidth || 1280;
    const height = window.innerHeight || 720;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.set(0, 2, GAME_CONFIG.CAMERA_Z); // Slightly higher camera for TPS
    camera.lookAt(0, 0, -20);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(0, 10, 10);
    scene.add(pointLight);

    // Tracks
    createTrackLines(scene);

    // Grid (Floor) - Raised for TPS
    const gridHelper = new THREE.GridHelper(60, 60, 0x111111, 0x000000);
    gridHelper.position.y = -6;
    gridHelper.position.z = -20;
    scene.add(gridHelper);

    // Avatar
    const avatarResult = createAvatarMesh();
    scene.add(avatarResult.group);
    avatarGroupRef.current = avatarResult.group;
    avatarParts.current = avatarResult.parts;

    // Sabers
    const lSaber = createSaberMesh(GAME_CONFIG.COLORS.CYAN);
    scene.add(lSaber);
    leftSaberRef.current = lSaber;

    const rSaber = createSaberMesh(GAME_CONFIG.COLORS.MAGENTA);
    scene.add(rSaber);
    rightSaberRef.current = rSaber;

    // Trails
    const lTrail = createTrailMesh(GAME_CONFIG.COLORS.CYAN);
    scene.add(lTrail);
    leftTrailRef.current = lTrail;

    const rTrail = createTrailMesh(GAME_CONFIG.COLORS.MAGENTA);
    scene.add(rTrail);
    rightTrailRef.current = rTrail;

    // Particles Group
    const pGroup = new THREE.Group();
    scene.add(pGroup);
    particleMeshes.current = pGroup;

    // Debris Group
    const dGroup = new THREE.Group();
    scene.add(dGroup);
    debrisMeshes.current = dGroup;
    
    // Shockwave Group
    const sGroup = new THREE.Group();
    scene.add(sGroup);
    shockwaveMeshes.current = sGroup;

    // Slash Effects Group
    const slashGroup = new THREE.Group();
    scene.add(slashGroup);
    slashEffects.current = slashGroup;

    // Debug Group
    const debugGroup = new THREE.Group();
    scene.add(debugGroup);
    debugGroupRef.current = debugGroup;
  };

  // --- Logic Helpers ---

  const initGame = useCallback(() => {
    blocks.current = [];
    gameState.resetStats();
    lastTime.current = performance.now();
    nextSpawnTime.current = performance.now() + 2000;
    setIsPaused(false);
    nextTrackFlash.current = null;
    shakeIntensity.current = 0;
    
    // Reset beatmap position
    currentMeasure.current = 0;
    currentBeat.current = 0;
    
    // Clear trails on restart
    leftTrailHistory.current = [];
    rightTrailHistory.current = [];
    
    if (sceneRef.current) {
        blockMeshes.current.forEach(mesh => sceneRef.current?.remove(mesh));
        blockMeshes.current.clear();
        if (particleMeshes.current) particleMeshes.current.clear();
        if (debrisMeshes.current) debrisMeshes.current.clear();
        if (shockwaveMeshes.current) shockwaveMeshes.current.clear();
        if (slashEffects.current) slashEffects.current.clear();
    }

    startCountdown();
  }, [startCountdown]);

  // Audio functions are now provided by useAudio hook
  const playSlashSound = audio.playSlashSound;
  const playSound = audio.playSound;

  // Helper to get effect refs
  const getEffectRefs = (): EffectRefs => ({
    particleMeshes: particleMeshes.current!,
    debrisMeshes: debrisMeshes.current!,
    shockwaveMeshes: shockwaveMeshes.current!,
    slashEffects: slashEffects.current!,
    camera: cameraRef.current
  });

  // Wrapper functions for effects
  const createExplosion = (pos: THREE.Vector3, color: number) => {
    createExplosionUtil(pos, color, getEffectRefs());
  };

  const createSlashEffect = (pos: THREE.Vector3, color: number, saberVelocity: THREE.Vector3) => {
    createSlashEffectUtil(pos, color, saberVelocity, getEffectRefs());
  };

  const createDebris = (pos: THREE.Vector3, color: number, saberVelocity: THREE.Vector3) => {
    if (debrisMeshes.current) {
      createDebrisUtil(pos, color, saberVelocity, debrisMeshes.current);
    }
  };

  const triggerImpact = (color: number) => {
      // 1. Screen Flash
      if (flashRef.current) {
          const hex = '#' + new THREE.Color(color).getHexString();
          flashRef.current.style.backgroundColor = hex;
          flashRef.current.style.opacity = '0.3';
          setTimeout(() => {
              if (flashRef.current) flashRef.current.style.opacity = '0';
          }, 80);
      }
      
      // 2. Camera Shake
      shakeIntensity.current = 0.4;
  };

  const updateDebugVisuals = (
      lPos: THREE.Vector3, rPos: THREE.Vector3, 
      lKnuckle: THREE.Vector3, rKnuckle: THREE.Vector3
  ) => {
      if (debugGroupRef.current) {
          const group = debugGroupRef.current;
          group.clear();
          
          if (debugConfig.showNodes) {
              const sphereGeo = new THREE.SphereGeometry(0.1, 8, 8);
              const mat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
              
              const l1 = new THREE.Mesh(sphereGeo, mat); l1.position.copy(lPos); group.add(l1);
              const r1 = new THREE.Mesh(sphereGeo, mat); r1.position.copy(rPos); group.add(r1);
              const l2 = new THREE.Mesh(sphereGeo, mat); l2.position.copy(lKnuckle); group.add(l2);
              const r2 = new THREE.Mesh(sphereGeo, mat); r2.position.copy(rKnuckle); group.add(r2);
          }
      }

      const toggleSaberHitbox = (saber: THREE.Group | null) => {
          if (!saber) return;
          const hitbox = saber.getObjectByName('hitbox') as THREE.Mesh;
          if (hitbox) {
              hitbox.visible = debugConfig.showHitboxes;
          }
      };
      toggleSaberHitbox(leftSaberRef.current);
      toggleSaberHitbox(rightSaberRef.current);

      blockMeshes.current.forEach((mesh) => {
          const hitbox = mesh.getObjectByName('hitbox') as THREE.Mesh;
          if (hitbox) {
              hitbox.visible = debugConfig.showBlockHitboxes;
          }
      });
  };

  // Store previous frame's saber blade points for sweep detection
  const prevLeftBladePoints = useRef<THREE.Vector3[]>([]);
  const prevRightBladePoints = useRef<THREE.Vector3[]>();

  // Wrapper for checkBlockCollision to use current debugConfig
  const checkBlockCollision = (
    saberGroup: THREE.Group, 
    blockWorldPos: THREE.Vector3, 
    prevBladePoints: THREE.Vector3[]
  ) => {
    return checkBlockCollisionUtil(
      saberGroup, 
      blockWorldPos, 
      prevBladePoints,
      debugConfig.blockScale,
      debugConfig.saberScale
    );
  };

  // Wrapper for updateAvatar to use refs
  const updateAvatar = (lm: NormalizedLandmark[]) => {
    return updateAvatarUtil(lm, avatarParts.current, cameraRef.current);
  };

  // --- Main Loop ---

  const spawnSingleBlock = (trackLabel: string, time: number) => {
    const trackIndex = getTrackIndexByLabel(trackLabel);
    const target = TRACK_LAYOUT[trackIndex];
    const type = getTrackType(trackLabel);
    
    const id = Math.random().toString(36);
    const mesh = createBlockMesh(type);
    
    // Calculate 3D Target (at Z=0)
    const target3D = mapTo3D(target.x, target.y, 0, true);
    
    // Calculate 3D Start (at SPAWN_Z)
    const spreadFactor = 1.3;
    const startX = target3D.x * spreadFactor;
    const startY = target3D.y * spreadFactor;
    const startPos = new THREE.Vector3(startX, startY, GAME_CONFIG.SPAWN_Z);

    mesh.position.copy(startPos);
    
    if (sceneRef.current) sceneRef.current.add(mesh);
    blockMeshes.current.set(id, mesh);

    blocks.current.push({
      id,
      type,
      spawnTime: time,
      targetPos: { x: target.x, y: target.y },
      startPos: startPos,
      endPos: target3D,
      position: { x: startPos.x, y: startPos.y, z: startPos.z },
      hit: false,
      missed: false,
      trackIndex
    });
    
    return trackIndex;
  };

  const spawnBlock = (time: number) => {
    if (time < nextSpawnTime.current) return;
    const beatInterval = 60000 / GAME_CONFIG.BPM;
    nextSpawnTime.current = time + beatInterval;

    // Get current beat from beatmap
    const measure = BEAT_MAP[currentMeasure.current];
    if (!measure) {
      // Loop back to start when beatmap ends
      currentMeasure.current = 0;
      currentBeat.current = 0;
      return;
    }
    
    const beatData = measure[currentBeat.current];
    
    // Advance to next beat
    currentBeat.current++;
    if (currentBeat.current >= measure.length) {
      currentBeat.current = 0;
      currentMeasure.current++;
      // Loop beatmap
      if (currentMeasure.current >= BEAT_MAP.length) {
        currentMeasure.current = 0;
      }
    }
    
    // Skip if null (rest)
    if (beatData === null) return;
    
    const spawnedTracks: number[] = [];
    
    if (Array.isArray(beatData)) {
      // Multiple simultaneous blocks
      for (const trackLabel of beatData) {
        const trackIdx = spawnSingleBlock(trackLabel, time);
        spawnedTracks.push(trackIdx);
      }
    } else {
      // Single block
      const trackIdx = spawnSingleBlock(beatData, time);
      spawnedTracks.push(trackIdx);
    }
    
    // Flash the spawned tracks
    if (spawnedTracks.length > 0) {
      nextTrackFlash.current = spawnedTracks;
      setTimeout(() => { nextTrackFlash.current = null; }, 500);
    }
  };

  // Effect to sync settings with meshes
  useEffect(() => {
    if (leftSaberRef.current) leftSaberRef.current.scale.setScalar(debugConfig.saberScale);
    if (rightSaberRef.current) rightSaberRef.current.scale.setScalar(debugConfig.saberScale);
    if (avatarGroupRef.current) avatarGroupRef.current.visible = debugConfig.showAvatar;
    if (leftTrailRef.current) leftTrailRef.current.visible = debugConfig.showTrail;
    if (rightTrailRef.current) rightTrailRef.current.visible = debugConfig.showTrail;
    
    blockMeshes.current.forEach((mesh) => {
        mesh.scale.setScalar(debugConfig.blockScale);
    });
  }, [debugConfig]);

  const update = (time: number) => {
    const dt = Math.min((time - lastTime.current) / 1000, 0.1); 
    lastTime.current = time;

    // --- Camera Shake & Impact Effects ---
    if (shakeIntensity.current > 0 && cameraRef.current) {
        const amount = shakeIntensity.current;
        const rx = (Math.random() - 0.5) * amount;
        const ry = (Math.random() - 0.5) * amount;
        cameraRef.current.position.set(rx, 2 + ry, GAME_CONFIG.CAMERA_Z);
        
        shakeIntensity.current *= 0.9; // Decay
        if (shakeIntensity.current < 0.01) {
            shakeIntensity.current = 0;
            cameraRef.current.position.set(0, 2, GAME_CONFIG.CAMERA_Z); // Reset
        }
    }

    // --- MediaPipe Processing ---
    let currentLeftPos = new THREE.Vector3();
    let currentRightPos = new THREE.Vector3();
    
    if (rawLandmarks.current) {
        const lm = rawLandmarks.current;
        
        // Update Stickman Avatar
        const avatarData = updateAvatar(lm);

        if (avatarData) {
            currentLeftPos = avatarData.lWrist;
            currentRightPos = avatarData.rWrist;

            // Update Sabers (Attached to Wrist, Pointing toward Palm)
            if (leftSaberRef.current) {
                leftSaberRef.current.position.copy(currentLeftPos);
                // Direction: Wrist -> Palm (extend through hand)
                const dir = new THREE.Vector3().subVectors(avatarData.lPalm, currentLeftPos).normalize();
                leftSaberRef.current.lookAt(currentLeftPos.clone().add(dir));
                leftSaberRef.current.updateMatrixWorld(true);
            }
            if (rightSaberRef.current) {
                rightSaberRef.current.position.copy(currentRightPos);
                // Direction: Wrist -> Palm (extend through hand)
                const dir = new THREE.Vector3().subVectors(avatarData.rPalm, currentRightPos).normalize();
                rightSaberRef.current.lookAt(currentRightPos.clone().add(dir));
                rightSaberRef.current.updateMatrixWorld(true);
            }
        } else {
             const lw = lm[15]; const rw = lm[16];
             currentLeftPos = mapTo3D(lw.x, lw.y, lw.z);
             currentRightPos = mapTo3D(rw.x, rw.y, rw.z);
        }
        
        // Update Trails (with scale)
        updateTrail(leftTrailRef.current, leftTrailHistory, leftSaberRef.current, debugConfig.saberScale);
        updateTrail(rightTrailRef.current, rightTrailHistory, rightSaberRef.current, debugConfig.saberScale);

        // Velocity Calculation
        leftVelocity.current = currentLeftPos.distanceTo(prevLeftPos.current) / dt;
        rightVelocity.current = currentRightPos.distanceTo(prevRightPos.current) / dt;
        
        leftVelVector.current.subVectors(currentLeftPos, prevLeftPos.current).divideScalar(dt);
        rightVelVector.current.subVectors(currentRightPos, prevRightPos.current).divideScalar(dt);

        prevLeftPos.current.copy(currentLeftPos);
        prevRightPos.current.copy(currentRightPos);

        updateDebugVisuals(currentLeftPos, currentRightPos, currentLeftPos, currentRightPos);
        
        if (gameStatus === 'calibration') {
            calibration.updateCalibration(dt, lm);
        }
    }

    // --- Gameplay Loop ---
    if (gameStatus === 'playing' && !isPaused && isGameActive.current) {
        spawnBlock(time);

        // Update Track Flash Effects
        trackLinesRef.current.forEach((line, idx) => {
            const material = line.material as THREE.LineBasicMaterial;
            const isFlashing = nextTrackFlash.current?.includes(idx) ?? false;
            if (isFlashing) {
                material.opacity = 0.8;
                material.color.setHex(GAME_CONFIG.COLORS.WHITE);
                material.linewidth = 2;
            } else {
                material.opacity = 0.2;
                material.color.setHex(GAME_CONFIG.COLORS.GRAY);
                material.linewidth = 1;
            }
            material.needsUpdate = true;
        });

        blocks.current.forEach(block => {
            if (block.hit || block.missed) return;

            // Move Block (Rail Logic)
            block.position.z += GAME_CONFIG.BLOCK_SPEED * dt;
            
            // Calculate progress (t) based on Z. 0 at Start, 1 at Target.
            // Start: SPAWN_Z (-50). Target: 0.
            const totalDist = 0 - GAME_CONFIG.SPAWN_Z;
            const currentDist = block.position.z - GAME_CONFIG.SPAWN_Z;
            const t = Math.max(0, currentDist / totalDist);

            // Lerp Position
            if (block.startPos && block.endPos) {
                 const newPos = new THREE.Vector3().lerpVectors(block.startPos, block.endPos, t);
                 block.position.x = newPos.x;
                 block.position.y = newPos.y;
            }

            const mesh = blockMeshes.current.get(block.id);
            if (mesh) {
                mesh.position.set(block.position.x, block.position.y, block.position.z);
                
                // Visual Cues: Filling Wireframe
                const hitStartZ = GAME_CONFIG.HIT_Z - 3.5; 
                const spawnZ = GAME_CONFIG.SPAWN_Z; 
                
                let fillProgress = (block.position.z - spawnZ) / (hitStartZ - spawnZ);
                fillProgress = Math.max(0, Math.min(1, fillProgress));

                const core = mesh.getObjectByName('core') as THREE.Mesh;
                const wireframe = mesh.getObjectByName('wireframe') as THREE.LineSegments;
                
                if (core && wireframe) {
                    const coreMat = core.material as THREE.MeshBasicMaterial;
                    const wireMat = wireframe.material as THREE.LineDashedMaterial; 
                    
                    coreMat.opacity = 0.1 + (fillProgress * 0.5);
                    wireMat.dashSize = fillProgress * GAME_CONFIG.BLOCK_SIZE;
                    wireMat.gapSize = GAME_CONFIG.BLOCK_SIZE - wireMat.dashSize;
                    wireMat.opacity = 0.5 + (fillProgress * 0.5);
                }
            }

            // Miss Logic
            if (block.position.z > GAME_CONFIG.DESPAWN_Z) {
                block.missed = true;
                stats.current.combo = 0;
                if (!debugConfig.godMode) {
                    stats.current.health -= GAME_CONFIG.DAMAGE_PER_MISS;
                }
                playSound(150, 'sawtooth', 0.2);
                if (mesh) {
                    sceneRef.current?.remove(mesh);
                    blockMeshes.current.delete(block.id);
                }
            }

            // Hit Logic - Extended Z range for better hit detection
            if (block.position.z > -5 && block.position.z < 5 && !block.hit) { 
                let hitBy: 'left' | 'right' | null = null;
                const blockCenter = new THREE.Vector3(block.position.x, block.position.y, block.position.z);
                
                // Check Left Saber with sweep detection
                if (leftSaberRef.current) {
                    if (checkBlockCollision(leftSaberRef.current, blockCenter, prevLeftBladePoints.current)) hitBy = 'left';
                }
                
                // Check Right Saber (if not already hit by left)
                if (!hitBy && rightSaberRef.current) {
                    if (checkBlockCollision(rightSaberRef.current, blockCenter, prevRightBladePoints.current)) hitBy = 'right';
                }

                if (hitBy) {
                    block.hit = true;
                    const isWhite = block.type === 'both';
                    const isLeftMatch = hitBy === 'left' && (block.type === 'left' || isWhite);
                    const isRightMatch = hitBy === 'right' && (block.type === 'right' || isWhite);
                    
                    let debrisColor = GAME_CONFIG.COLORS.WHITE;
                    if (block.type === 'left') debrisColor = GAME_CONFIG.COLORS.CYAN;
                    if (block.type === 'right') debrisColor = GAME_CONFIG.COLORS.MAGENTA;

                    if (isLeftMatch || isRightMatch) {
                        // Good Hit
                        stats.current.score += 100 + (stats.current.combo * 10);
                        stats.current.combo++;
                        stats.current.maxCombo = Math.max(stats.current.maxCombo, stats.current.combo);
                        stats.current.health = Math.min(100, stats.current.health + GAME_CONFIG.HEAL_PER_HIT);
                        playSlashSound(isLeftMatch ? 1.0 : 1.2); 
                        triggerImpact(debrisColor);
                    } else {
                        // Bad Color Hit
                        stats.current.combo = 0; // Combo Breaker
                        playSound(100, 'square', 0.1);
                    }
                    
                    const saberVel = hitBy === 'left' ? leftVelVector.current : rightVelVector.current;
                    createDebris(blockCenter, debrisColor, saberVel);
                    createExplosion(blockCenter, debrisColor);
                    createSlashEffect(blockCenter, debrisColor, saberVel);

                    if (mesh) {
                        sceneRef.current?.remove(mesh);
                        blockMeshes.current.delete(block.id);
                    }
                }
            }
        });

        blocks.current = blocks.current.filter(b => !b.hit && !b.missed);

        if (stats.current.health <= 0) {
            setGameStatus('gameover');
            onGameOver(stats.current.score);
        }
    } else if (isPaused) {
        // Paused state
    }

    // --- Update Particles (Sparks) ---
    if (particleMeshes.current && !isPaused) {
        updateParticles(particleMeshes.current, dt);
    }

    // --- Update Shockwaves ---
    if (shockwaveMeshes.current && !isPaused) {
        updateShockwaves(shockwaveMeshes.current, dt);
    }

    // --- Update Slash Effects ---
    if (slashEffects.current && !isPaused) {
        updateSlashEffects(slashEffects.current, dt);
    }

    // --- Update Debris (Block Pieces) ---
    if (debrisMeshes.current && !isPaused) {
        updateDebris(debrisMeshes.current, dt);
    }
    
    // --- Update Previous Blade Points for Sweep Detection (with scale) ---
    if (leftSaberRef.current) {
        prevLeftBladePoints.current = getSaberBladePoints(leftSaberRef.current, debugConfig.saberScale);
    }
    if (rightSaberRef.current) {
        prevRightBladePoints.current = getSaberBladePoints(rightSaberRef.current, debugConfig.saberScale);
    }
  };

  const renderLoop = useCallback((time: number) => {
    update(time);
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
    requestRef.current = requestAnimationFrame(renderLoop);
  }, [gameStatus, debugConfig, calibration.calibrationLeft, calibration.calibrationRight, isPaused]); 

  // --- Effects ---

  useEffect(() => {
    initThree();
    const handleResize = () => {
        if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    return () => {
        window.removeEventListener('resize', handleResize);
        if (rendererRef.current && containerRef.current) {
            containerRef.current.removeChild(rendererRef.current.domElement);
            rendererRef.current.dispose();
        }
    };
  }, []);

  // Separate effect for initializing the game logic when status changes to playing
  useEffect(() => {
      if (gameStatus === 'playing') {
          initGame();
      }
  }, [gameStatus, initGame]);

  // Effect for the render loop
  useEffect(() => {
    if (gameStatus === 'playing' || gameStatus === 'calibration') {
        // Initialize audio using hook
        audio.initAudio();

        requestRef.current = requestAnimationFrame(renderLoop);
    } else {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameStatus, renderLoop, audio]);

  const onResults = useCallback((results: Results) => {
    if (results.poseLandmarks) {
        rawLandmarks.current = results.poseLandmarks;
    }
  }, []);

  useEffect(() => {
    const startPose = async () => {
        try {
            const service = new PoseService(onResults);
            await service.initialize();
            poseService.current = service;
            if (videoRef.current) {
                await service.start(videoRef.current);
                setGameStatus((prev: any) => (prev === 'loading' ? 'menu' : prev));
            }
        } catch (e) {
            console.error(e);
            setPermissionError("Camera access failed.");
        }
    };
    if (videoRef.current) startPose();
    return () => poseService.current?.stop();
  }, []);

  // Mute toggle now uses hook
  const toggleMute = audio.toggleMute;

  // Handle Pause
  const handlePause = () => setIsPaused(true);
  const handleResume = () => {
      setIsPaused(false);
      startCountdown(); // Resume with countdown
  };
  const handleExit = () => {
      setGameStatus('menu');
  }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Video is hidden (opacity-0) but still active for processing */}
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none" playsInline muted />
      <div ref={containerRef} className="absolute inset-0 z-10" />
      
      {/* Screen Flash Overlay */}
      <div ref={flashRef} className="absolute inset-0 z-30 pointer-events-none opacity-0 transition-opacity duration-75 ease-out mix-blend-add"></div>

      {/* Debug Menu */}
      <DebugMenu 
        config={debugConfig} 
        onConfigChange={setDebugConfig} 
        onRecalibrate={() => {
            setIsDebugOpen(false);
            onRecalibrateRequest();
        }}
        isOpen={isDebugOpen}
        setIsOpen={setIsDebugOpen}
      />

      {/* Calibration Overlay */}
      {gameStatus === 'calibration' && (
          <CalibrationOverlay 
            leftProgress={calibration.calibrationLeft}
            rightProgress={calibration.calibrationRight}
            isComplete={calibration.calibrationComplete}
          />
      )}

      {/* Countdown Overlay */}
      {countdown !== null && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-black/20">
            <span className="text-[10px] sm:text-[10rem] font-black text-white animate-ping drop-shadow-[0_0_20px_#00f3ff]">
                {countdown}
            </span>
        </div>
      )}

      {/* Pause Menu Overlay */}
      {isPaused && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
              <div className="flex flex-col gap-4 min-w-[300px]">
                  <h2 className="text-3xl font-black text-center text-white italic mb-4">PAUSED</h2>
                  
                  <button onClick={handleResume} className="flex items-center justify-center gap-2 px-6 py-4 bg-[#00f3ff] text-black font-bold uppercase hover:bg-white transition-colors">
                      <Play size={20} fill="currentColor" /> Resume
                  </button>
                  
                  <button onClick={handleExit} className="flex items-center justify-center gap-2 px-6 py-4 border border-gray-600 text-gray-300 font-bold uppercase hover:bg-white/10 transition-colors">
                      <Home size={20} /> Exit to Menu
                  </button>
              </div>
          </div>
      )}

      {/* HUD */}
      {gameStatus === 'playing' && (
        <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-start z-20 pointer-events-none">
          {/* Spacer for Debug Menu on Left */}
          <div className="w-16"></div> 
          
          <div className="flex flex-col items-center">
            <span className="text-gray-400 text-xs font-mono uppercase tracking-widest">Score</span>
            <span className="text-4xl font-black text-white italic tracking-tighter" style={{ textShadow: '0 0 20px rgba(255,255,255,0.5)' }}>
              <ScoreDisplay statsRef={stats} />
            </span>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-gray-400 text-xs font-mono uppercase tracking-widest">Combo</span>
            <span className="text-6xl font-black text-[#00f3ff] italic" style={{ textShadow: '0 0 20px cyan' }}>
              <ComboDisplay statsRef={stats} />
            </span>
          </div>
           {/* Health Bar */}
           <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 w-1/2 h-1 bg-gray-800 rounded overflow-hidden">
                <HealthBar statsRef={stats} />
           </div>
        </div>
      )}

       {/* Bottom Left Pause Button (Visual only, Logic in handlePause) */}
       {gameStatus === 'playing' && !isPaused && (
           <div className="absolute bottom-8 left-8 z-30">
               <button 
                   onClick={handlePause}
                   className="p-3 bg-gray-900/50 border border-gray-700 rounded-full text-white hover:bg-white hover:text-black transition-all hover:scale-110"
               >
                   <Pause size={24} fill="currentColor" />
               </button>
           </div>
       )}

      <button onClick={toggleMute} className="absolute top-4 right-4 z-50 text-white/50 hover:text-white transition-colors">
        {audio.isMuted ? <VolumeX /> : <Volume2 />}
      </button>

      {/* Camera Preview Window */}
      {debugConfig.showCameraPreview && (
          <div className="absolute bottom-4 right-4 z-40 rounded-lg overflow-hidden border-2 border-gray-700 shadow-xl bg-black">
              <div className="relative">
                  <canvas 
                      ref={cameraPreview.cameraPreviewRef}
                      width={240}
                      height={180}
                      className="block"
                  />
                  <div className="absolute top-1 left-1 px-2 py-0.5 bg-black/70 rounded text-[10px] font-mono text-gray-400 uppercase">
                      Camera
                  </div>
                  <div className="absolute bottom-1 left-1 flex gap-2">
                      <span className="px-1.5 py-0.5 bg-[#00f3ff]/30 rounded text-[8px] font-mono text-[#00f3ff]">L</span>
                      <span className="px-1.5 py-0.5 bg-[#ff00ff]/30 rounded text-[8px] font-mono text-[#ff00ff]">R</span>
                  </div>
              </div>
          </div>
      )}

      {permissionError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black text-white z-50">
             <div className="text-center text-red-500">
                <AlertTriangle size={48} className="mx-auto mb-4" />
                <p>{permissionError}</p>
             </div>
          </div>
      )}
    </div>
  );
};

export default GameCanvas;
