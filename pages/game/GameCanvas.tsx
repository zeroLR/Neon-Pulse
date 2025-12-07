import React, { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { GAME_CONFIG, TRACK_LAYOUT, getTrackIndexByLabel, parseBeatNote, isNoteGroup, getNotesFromBeatItem } from '../../constants';
import { BlockNote, BeatData, Beatmap, BeatItem } from '../../types';

// Hooks
import { 
  useAudio, 
  useGameState, 
  useCameraPreview, 
  useCalibration,
  useThreeScene,
  useYouTubePlayer,
  usePoseTracking
} from '../../hooks';
import { Results } from '../../types';

// Utils
import { 
  createBlockMesh,
  updateTrail as updateTrailUtil,
  updateAvatar as updateAvatarUtil,
  mapTo3D as mapTo3DUtil,
} from '../../utils/threeHelpers';
import { 
  getSaberBladePoints, 
  checkBlockCollision as checkBlockCollisionUtil 
} from '../../utils/collision';
import { 
  createExplosion as createExplosionUtil,
  createSlashEffect as createSlashEffectUtil,
  createDebris as createDebrisUtil,
  updateParticles,
  updateShockwaves,
  updateSlashEffects,
  updateDebris,
  EffectRefs
} from '../../utils/effects';

// Components
import CalibrationOverlay from './CalibrationOverlay';
import DebugMenu from './DebugMenu';
import PauseMenu from './PauseMenu';
import CountdownOverlay from './CountdownOverlay';
import GameHUD from './GameHUD';
import ControlButtons from './ControlButtons';
import CameraPreview from './CameraPreview';
import YouTubePlayer from './YouTubePlayer';
import ErrorOverlay from './ErrorOverlay';

// Exposed methods for parent component
export interface GameCanvasHandle {
  stopPoseDetection: () => void;
}

interface GameCanvasProps {
  onGameOver: (score: number) => void;
  gameStatus: 'loading' | 'playing' | 'gameover' | 'menu' | 'calibration' | 'beatmap-select' | 'beatmap-editor';
  setGameStatus: (status: any) => void;
  onCalibrationComplete: () => void;
  onRecalibrateRequest: () => void;
  onExit?: () => void;
  beatmap: Beatmap;
}

const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(({ 
  onGameOver, 
  gameStatus, 
  setGameStatus, 
  onCalibrationComplete,
  onRecalibrateRequest,
  onExit,
  beatmap
}, ref) => {
  // Refs
  const flashRef = useRef<HTMLDivElement>(null);
  const cameraStartedForSession = useRef<boolean>(false);
  const isExiting = useRef<boolean>(false); // Flag to prevent camera restart during exit

  // Pose Tracking (lazy initialization)
  const poseTracking = usePoseTracking();
  const { 
    rawLandmarks, 
    permissionError, 
    isActive: isPoseActive, 
    isInitializing: isPoseInitializing, 
    isReady: isPoseReady,  // True when first pose result received
    start: startPose, 
    stop: stopPose 
  } = poseTracking;
  
  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    stopPoseDetection: () => {
      stopPose();
    }
  }), [stopPose]);

  // Three.js Scene
  const threeScene = useThreeScene();
  const { containerRef, refs: sceneRefs, shakeIntensity, clearBlockMeshes, clearEffects } = threeScene;

  // YouTube Player
  const youtube = useYouTubePlayer();

  // Audio
  const audio = useAudio();

  // Game State
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

  // Calibration
  const calibration = useCalibration(onCalibrationComplete);

  // Camera Preview - only show when pose is ready
  const cameraPreview = useCameraPreview(poseTracking.videoRef, rawLandmarks, debugConfig.showCameraPreview && isPoseReady);

  // Block speed based on BPM
  const travelDistance = Math.abs(GAME_CONFIG.SPAWN_Z - GAME_CONFIG.HIT_Z);
  const secondsPerBeat = 60 / beatmap.bpm;
  const blockSpeed = travelDistance / secondsPerBeat;
  
  // Time for block to travel from spawn to hit zone (in ms)
  const blockTravelTime = (travelDistance / blockSpeed) * 1000;
  
  // Start delay: use beatmap's startDelay or default
  const startDelay = beatmap.startDelay ?? GAME_CONFIG.INITIAL_SPAWN_DELAY;

  // Game state refs
  const blocks = useRef<any[]>([]);
  const lastTime = useRef<number>(0);
  const nextSpawnTime = useRef<number>(startDelay);
  const accumulatedGameTime = useRef<number>(0); // Total game time excluding pauses
  const lastUpdateTime = useRef<number>(0); // Last frame time for delta calculation
  const beatmapCompleted = useRef<boolean>(false);
  const gameOverDelayTimer = useRef<number | null>(null);
  const spawnedBeatIndex = useRef<number>(0);
  const nextTrackFlash = useRef<number[] | null>(null);
  const requestRef = useRef<number | null>(null);

  // Velocity tracking
  const prevLeftPos = useRef<THREE.Vector3>(new THREE.Vector3());
  const prevRightPos = useRef<THREE.Vector3>(new THREE.Vector3());
  const leftVelVector = useRef<THREE.Vector3>(new THREE.Vector3());
  const rightVelVector = useRef<THREE.Vector3>(new THREE.Vector3());
  const leftTrailHistory = useRef<{base: THREE.Vector3, tip: THREE.Vector3}[]>([]);
  const rightTrailHistory = useRef<{base: THREE.Vector3, tip: THREE.Vector3}[]>([]);
  const prevLeftBladePoints = useRef<THREE.Vector3[]>([]);
  const prevRightBladePoints = useRef<THREE.Vector3[]>([]);

  // Helper functions
  const mapTo3D = (normX: number, normY: number, rawZ: number, forceCompute = false): THREE.Vector3 => {
    return mapTo3DUtil(normX, normY, rawZ, sceneRefs.current.camera, forceCompute);
  };

  const getEffectRefs = (): EffectRefs => ({
    particleMeshes: sceneRefs.current.particleMeshes!,
    debrisMeshes: sceneRefs.current.debrisMeshes!,
    shockwaveMeshes: sceneRefs.current.shockwaveMeshes!,
    slashEffects: sceneRefs.current.slashEffects!,
    camera: sceneRefs.current.camera
  });

  const triggerImpact = (color: number) => {
    if (flashRef.current) {
      const hex = '#' + new THREE.Color(color).getHexString();
      flashRef.current.style.backgroundColor = hex;
      flashRef.current.style.opacity = String(GAME_CONFIG.SCREEN_FLASH.OPACITY);
      setTimeout(() => {
        if (flashRef.current) flashRef.current.style.opacity = '0';
      }, GAME_CONFIG.SCREEN_FLASH.DURATION);
    }
    shakeIntensity.current = GAME_CONFIG.CAMERA_SHAKE.INITIAL_INTENSITY;
  };

  // Initialize game (without starting countdown - that happens after camera is ready)
  const initGame = useCallback((startCountdownImmediately: boolean = false) => {
    blocks.current = [];
    gameState.resetStats();
    const now = performance.now();
    lastTime.current = now;
    lastUpdateTime.current = now;
    accumulatedGameTime.current = 0; // Reset accumulated time
    // Use beatmap's startDelay (read from beatmap prop directly)
    const currentStartDelay = beatmap.startDelay ?? GAME_CONFIG.INITIAL_SPAWN_DELAY;
    nextSpawnTime.current = currentStartDelay;
    setIsPaused(false);
    nextTrackFlash.current = null;
    shakeIntensity.current = 0;
    
    currentMeasure.current = 0;
    currentBeat.current = 0;
    beatmapCompleted.current = false;
    spawnedBeatIndex.current = 0;
    
    if (gameOverDelayTimer.current !== null) {
      clearTimeout(gameOverDelayTimer.current);
      gameOverDelayTimer.current = null;
    }
    
    leftTrailHistory.current = [];
    rightTrailHistory.current = [];
    
    clearBlockMeshes();
    clearEffects();
    
    // Only start countdown if explicitly requested (e.g., when camera is already active)
    if (startCountdownImmediately) {
      startCountdown();
    }
  }, [beatmap.startDelay, gameState, setIsPaused, currentMeasure, currentBeat, clearBlockMeshes, clearEffects, startCountdown]);

  // Spawn block helpers
  const getBeatDataAtIndex = (globalBeatIndex: number): BeatData | null => {
    let beatIdx = globalBeatIndex;
    for (let m = 0; m < beatmap.data.length; m++) {
      const measure = beatmap.data[m];
      if (beatIdx < measure.length) {
        return measure[beatIdx];
      }
      beatIdx -= measure.length;
    }
    return null;
  };

  const getTotalBeats = (): number => {
    return beatmap.data.reduce((sum, measure) => sum + measure.length, 0);
  };

  const spawnSingleBlock = (note: BlockNote, time: number, beatsAhead: number = 0) => {
    const trackIndex = getTrackIndexByLabel(note.track);
    const target = TRACK_LAYOUT[trackIndex];
    const type = note.color!;
    const direction = note.direction!;
    
    const id = Math.random().toString(36);
    const mesh = createBlockMesh(type);
    
    const target3D = mapTo3D(target.x, target.y, 0, true);
    const extraDistance = beatsAhead * travelDistance;
    const spawnZ = GAME_CONFIG.SPAWN_Z - extraDistance;
    
    const startX = target3D.x * GAME_CONFIG.SPAWN.SPREAD_FACTOR;
    const startY = target3D.y * GAME_CONFIG.SPAWN.SPREAD_FACTOR;
    const startPos = new THREE.Vector3(startX, startY, spawnZ);

    mesh.position.copy(startPos);
    
    if (sceneRefs.current.scene) sceneRefs.current.scene.add(mesh);
    sceneRefs.current.blockMeshes.set(id, mesh);

    blocks.current.push({
      id,
      type,
      direction,
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

  const spawnBlock = () => {
    const gameTime = accumulatedGameTime.current;
    if (gameTime < nextSpawnTime.current) return;
    if (beatmapCompleted.current) return;

    
    const beatInterval = 60000 / beatmap.bpm;
    const lookahead = GAME_CONFIG.SPAWN.LOOKAHEAD_BEATS;
    const totalBeats = getTotalBeats();
    
    // Add blockTravelTime to spawn blocks early so they arrive at HIT_Z on the beat
    const effectiveGameTime = gameTime - startDelay + blockTravelTime;
    const currentBeatIndex = Math.max(0, Math.floor(effectiveGameTime / beatInterval));
    const targetSpawnIndex = Math.min(currentBeatIndex + lookahead, totalBeats - 1);
    
    // Helper to spawn all notes from a BeatItem at given timing
    const spawnBeatItem = (item: BeatItem, timing: number) => {
      const notes = getNotesFromBeatItem(item);
      for (const note of notes) {
        spawnSingleBlock(note, gameTime, timing);
      }
    };
    
    while (spawnedBeatIndex.current <= targetSpawnIndex) {
      const beatIndex = spawnedBeatIndex.current;
      const beatData = getBeatDataAtIndex(beatIndex);
      
      if (beatData === null) {
        if (beatIndex >= totalBeats) {
          beatmapCompleted.current = true;
          break;
        }
        spawnedBeatIndex.current++;
        continue;
      }
      
      const beatsAhead = beatIndex - currentBeatIndex;
      
      if (Array.isArray(beatData)) {
        // Array of items: spread across sub-beats (2 items = 1/2, 3 items = 1/3, etc.)
        const subBeatOffset = 1 / beatData.length;
        for (let i = 0; i < beatData.length; i++) {
          spawnBeatItem(beatData[i] as BeatItem, beatsAhead + (i * subBeatOffset));
        }
      } else if (isNoteGroup(beatData)) {
        // NoteGroup: all notes appear simultaneously
        const notes = beatData.notes.map(n => parseBeatNote(n));
        for (const note of notes) {
          spawnSingleBlock(note, gameTime, beatsAhead);
        }
      } else {
        // Single note (string or BlockNote)
        const note = parseBeatNote(beatData);
        spawnSingleBlock(note, gameTime, beatsAhead);
      }
      
      spawnedBeatIndex.current++;
    }
    
    if (spawnedBeatIndex.current >= totalBeats) {
      beatmapCompleted.current = true;
    }
    
    nextSpawnTime.current = gameTime + beatInterval;
  };

  // Main update loop
  const update = useCallback((time: number) => {
    const rawDt = (time - lastUpdateTime.current) / 1000;
    const dt = Math.min(rawDt, 0.1);
    lastUpdateTime.current = time;
    
    // Only accumulate game time when playing and not paused
    if (gameStatus === 'playing' && !isPaused && isGameActive.current) {
      accumulatedGameTime.current += dt * 1000; // Convert to ms
    }
    
    lastTime.current = time;

    let currentLeftPos = new THREE.Vector3();
    let currentRightPos = new THREE.Vector3();
    
    if (rawLandmarks.current) {
      const lm = rawLandmarks.current;
      const avatarData = updateAvatarUtil(lm, sceneRefs.current.avatarParts, sceneRefs.current.camera);

      if (avatarData) {
        currentLeftPos = avatarData.lWrist;
        currentRightPos = avatarData.rWrist;

        if (sceneRefs.current.leftSaber) {
          sceneRefs.current.leftSaber.position.copy(currentLeftPos);
          const dir = new THREE.Vector3().subVectors(avatarData.lPalm, currentLeftPos).normalize();
          sceneRefs.current.leftSaber.lookAt(currentLeftPos.clone().add(dir));
          sceneRefs.current.leftSaber.updateMatrixWorld(true);
        }
        if (sceneRefs.current.rightSaber) {
          sceneRefs.current.rightSaber.position.copy(currentRightPos);
          const dir = new THREE.Vector3().subVectors(avatarData.rPalm, currentRightPos).normalize();
          sceneRefs.current.rightSaber.lookAt(currentRightPos.clone().add(dir));
          sceneRefs.current.rightSaber.updateMatrixWorld(true);
        }
      }
      
      updateTrailUtil(sceneRefs.current.leftTrail, leftTrailHistory.current, sceneRefs.current.leftSaber, debugConfig.saberScale);
      updateTrailUtil(sceneRefs.current.rightTrail, rightTrailHistory.current, sceneRefs.current.rightSaber, debugConfig.saberScale);

      leftVelVector.current.subVectors(currentLeftPos, prevLeftPos.current).divideScalar(dt);
      rightVelVector.current.subVectors(currentRightPos, prevRightPos.current).divideScalar(dt);

      prevLeftPos.current.copy(currentLeftPos);
      prevRightPos.current.copy(currentRightPos);
      
      if (gameStatus === 'calibration') {
        calibration.updateCalibration(dt, lm);
      }
    }

    // Gameplay
    if (gameStatus === 'playing' && !isPaused && isGameActive.current ) {
      spawnBlock();
      
      if (beatmapCompleted.current) {
        const activeBlocks = blocks.current.filter(b => !b.hit && !b.missed);
        if (activeBlocks.length === 0 && gameOverDelayTimer.current === null) {
          gameOverDelayTimer.current = window.setTimeout(() => {
            onGameOver(stats.current.score);
            setGameStatus('gameover');
          }, 1000);
        }
      }

      blocks.current.forEach(block => {
        if (block.hit || block.missed) return;

        block.position.z += blockSpeed * dt;
        
        const totalDist = 0 - GAME_CONFIG.SPAWN_Z;
        const currentDist = block.position.z - GAME_CONFIG.SPAWN_Z;
        const t = Math.max(0, currentDist / totalDist);

        if (block.startPos && block.endPos) {
          const newPos = new THREE.Vector3().lerpVectors(block.startPos, block.endPos, t);
          block.position.x = newPos.x;
          block.position.y = newPos.y;
        }

        const mesh = sceneRefs.current.blockMeshes.get(block.id);
        if (mesh) {
          mesh.position.set(block.position.x, block.position.y, block.position.z);
          
          const hitStartZ = GAME_CONFIG.HIT_Z + GAME_CONFIG.HIT_ZONE.FILL_START_OFFSET;
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

        // Miss
        if (block.position.z > GAME_CONFIG.DESPAWN_Z) {
          block.missed = true;
          stats.current.combo = 0;
          if (!debugConfig.godMode) {
            stats.current.health -= GAME_CONFIG.DAMAGE_PER_MISS;
          }
          audio.playSound(150, 'sawtooth', 0.2);
          if (mesh) {
            sceneRefs.current.scene?.remove(mesh);
            sceneRefs.current.blockMeshes.delete(block.id);
          }
        }

        // Hit
        if (block.position.z > GAME_CONFIG.HIT_ZONE.MIN_Z && block.position.z < GAME_CONFIG.HIT_ZONE.MAX_Z && !block.hit) {
          let hitBy: 'left' | 'right' | null = null;
          const blockCenter = new THREE.Vector3(block.position.x, block.position.y, block.position.z);
          
          if (sceneRefs.current.leftSaber) {
            if (checkBlockCollisionUtil(sceneRefs.current.leftSaber, blockCenter, prevLeftBladePoints.current, debugConfig.blockScale, debugConfig.saberScale)) {
              hitBy = 'left';
            }
          }
          
          if (!hitBy && sceneRefs.current.rightSaber) {
            if (checkBlockCollisionUtil(sceneRefs.current.rightSaber, blockCenter, prevRightBladePoints.current, debugConfig.blockScale, debugConfig.saberScale)) {
              hitBy = 'right';
            }
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
              stats.current.score += 100 + (stats.current.combo * 10);
              stats.current.combo++;
              stats.current.maxCombo = Math.max(stats.current.maxCombo, stats.current.combo);
              stats.current.health = Math.min(100, stats.current.health + GAME_CONFIG.HEAL_PER_HIT);
              audio.playSlashSound(isLeftMatch ? 1.0 : 1.2);
              triggerImpact(debrisColor);
            } else {
              stats.current.combo = 0;
              audio.playSound(100, 'square', 0.1);
            }
            
            const saberVel = hitBy === 'left' ? leftVelVector.current : rightVelVector.current;
            createDebrisUtil(blockCenter, debrisColor, saberVel, sceneRefs.current.debrisMeshes!);
            createExplosionUtil(blockCenter, debrisColor, getEffectRefs());
            createSlashEffectUtil(blockCenter, debrisColor, saberVel, getEffectRefs());

            if (mesh) {
              sceneRefs.current.scene?.remove(mesh);
              sceneRefs.current.blockMeshes.delete(block.id);
            }
          }
        }
      });

      blocks.current = blocks.current.filter(b => !b.hit && !b.missed);

      if (stats.current.health <= 0 && isGameActive.current) {
        setGameStatus('gameover');
        onGameOver(stats.current.score);
      }
    }

    // Update effects
    if (!isPaused) {
      if (sceneRefs.current.particleMeshes) updateParticles(sceneRefs.current.particleMeshes, dt);
      if (sceneRefs.current.shockwaveMeshes) updateShockwaves(sceneRefs.current.shockwaveMeshes, dt);
      if (sceneRefs.current.slashEffects) updateSlashEffects(sceneRefs.current.slashEffects, dt);
      if (sceneRefs.current.debrisMeshes) updateDebris(sceneRefs.current.debrisMeshes, dt);
    }
    
    // Update blade points for sweep detection
    if (sceneRefs.current.leftSaber) {
      prevLeftBladePoints.current = getSaberBladePoints(sceneRefs.current.leftSaber, debugConfig.saberScale);
    }
    if (sceneRefs.current.rightSaber) {
      prevRightBladePoints.current = getSaberBladePoints(sceneRefs.current.rightSaber, debugConfig.saberScale);
    }
  }, [gameStatus, isPaused, debugConfig, calibration, audio, blockSpeed, stats, isGameActive, onGameOver, setGameStatus, beatmap]);

  // Render loop
  const renderLoop = useCallback((time: number) => {
    update(time);
    threeScene.render();
    requestRef.current = requestAnimationFrame(renderLoop);
  }, [update, threeScene]);

  // Effects
  useEffect(() => {
    if (sceneRefs.current.leftSaber) sceneRefs.current.leftSaber.scale.setScalar(debugConfig.saberScale);
    if (sceneRefs.current.rightSaber) sceneRefs.current.rightSaber.scale.setScalar(debugConfig.saberScale);
    if (sceneRefs.current.avatarGroup) sceneRefs.current.avatarGroup.visible = debugConfig.showAvatar;
    if (sceneRefs.current.leftTrail) sceneRefs.current.leftTrail.visible = debugConfig.showTrail;
    if (sceneRefs.current.rightTrail) sceneRefs.current.rightTrail.visible = debugConfig.showTrail;
    
    sceneRefs.current.blockMeshes.forEach((mesh) => {
      mesh.scale.setScalar(debugConfig.blockScale);
    });
  }, [debugConfig, sceneRefs]);

  // Track previous game status to detect transition to 'playing'
  const prevGameStatus = useRef(gameStatus);
  const gameInitialized = useRef(false);
  
  useEffect(() => {
    // Only init game when transitioning TO 'playing' status
    if (gameStatus === 'playing' && prevGameStatus.current !== 'playing') {
      gameInitialized.current = false;
      // Initialize game state but don't start countdown yet (wait for camera)
      initGame(false);
    }
    prevGameStatus.current = gameStatus;
  }, [gameStatus, initGame]);

  // Start countdown when camera is READY (received first pose) and game is playing
  useEffect(() => {
    if (gameStatus === 'playing' && isPoseReady && !gameInitialized.current) {
      gameInitialized.current = true;
      startCountdown();
    }
  }, [gameStatus, isPoseReady, startCountdown]);

  useEffect(() => {
    if (gameStatus === 'playing' || gameStatus === 'calibration') {
      audio.initAudio();
      requestRef.current = requestAnimationFrame(renderLoop);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameStatus, renderLoop, audio]);

  // Pose tracking - start/stop based on game status
  useEffect(() => {
    // Don't restart camera if we're exiting
    if (isExiting.current) {
      return;
    }
    
    const shouldPoseBeActive = gameStatus === 'playing' || gameStatus === 'calibration';
    
    if (shouldPoseBeActive && !isPoseActive && !isPoseInitializing) {
      // Start pose tracking when entering playing or calibration
      startPose().then(() => {
        cameraStartedForSession.current = true;
      });
    } else if (!shouldPoseBeActive && isPoseActive) {
      // Stop pose tracking when leaving playing/calibration states
      stopPose();
    }
  }, [gameStatus, isPoseActive, isPoseInitializing, startPose, stopPose]);

  // Handle loading -> menu transition (no camera needed for menu)
  useEffect(() => {
    // Auto-transition from loading to menu after a short delay (no camera needed)
    if (gameStatus === 'loading') {
      const timer = setTimeout(() => {
        setGameStatus('menu');
      }, 500); // Short delay for initial load
      return () => clearTimeout(timer);
    }
  }, [gameStatus, setGameStatus]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && gameStatus === 'playing') {
        if (isPaused) {
          handleResume();
        } else {
          handlePause();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStatus, isPaused]);

  // YouTube sync - start music when countdown ends
  // Music should start immediately when game becomes active, blocks will arrive at HIT_Z after startDelay
  useEffect(() => {
    if (countdown === null && isGameActive.current && !isPaused && beatmap.youtubeId) {
      console.log('YouTube sync: playing video, startDelay =', startDelay);
      // Seek to 0 and play - the startDelay in beatmap determines when first beat arrives at HIT_Z
      youtube.seekTo(0);
      youtube.playYouTube();
    }
  }, [countdown, isPaused, beatmap.youtubeId, youtube, isGameActive, startDelay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop pose detection and camera when component unmounts
      stopPose();
      
      if (gameOverDelayTimer.current !== null) {
        clearTimeout(gameOverDelayTimer.current);
        gameOverDelayTimer.current = null;
      }
    };
  }, [stopPose]);

  // Handlers
  const handlePause = () => {
    setIsPaused(true);
    youtube.pauseYouTube();
  };

  const handleResume = () => {
    setIsPaused(false);
    // Reset lastUpdateTime to prevent large dt on resume
    lastUpdateTime.current = performance.now();
    startCountdown();
  };

  const handleRetry = () => {
    setIsPaused(false);
    youtube.restartYouTube();
    // On retry, camera is already active, so start countdown immediately
    initGame(true);
  };

  const handleExit = () => {
    // Set flag to prevent camera restart during exit
    isExiting.current = true;
    
    // Stop pose detection and camera before navigating away
    console.log('handleExit: stopping pose detection...');
    stopPose();
    
    // Small delay to ensure camera is fully released before navigation
    setTimeout(() => {
      console.log('handleExit: navigating after delay...');
      if (onExit) {
        onExit();
      } else {
        setGameStatus('beatmap-select');
      }
    }, 100);
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 z-10" />
      
      <div ref={flashRef} className="absolute inset-0 z-30 pointer-events-none opacity-0 transition-opacity duration-75 ease-out mix-blend-add"></div>

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

      {gameStatus === 'calibration' && (
        <CalibrationOverlay 
          leftProgress={calibration.calibrationLeft}
          rightProgress={calibration.calibrationRight}
          isComplete={calibration.calibrationComplete}
        />
      )}

      {countdown !== null && <CountdownOverlay countdown={countdown} />}

      {isPaused && (
        <PauseMenu 
          onResume={handleResume}
          onRetry={handleRetry}
          onExit={handleExit}
        />
      )}

      {gameStatus === 'playing' && <GameHUD statsRef={stats} />}

      <ControlButtons 
        gameStatus={gameStatus}
        isPaused={isPaused}
        isMuted={audio.isMuted}
        onPause={handlePause}
        onToggleMute={audio.toggleMute}
      />

      {debugConfig.showCameraPreview && isPoseReady && (
        <CameraPreview cameraPreviewRef={cameraPreview.cameraPreviewRef} />
      )}

      {/* Only load YouTube player after pose is ready */}
      {gameStatus === 'playing' && beatmap.youtubeId && isPoseReady && (
        <YouTubePlayer beatmap={beatmap} youtubePlayerRef={youtube.youtubePlayerRef} />
      )}

      {permissionError && <ErrorOverlay message={permissionError} />}
      
      {/* Camera initialization overlay - show while initializing OR while waiting for first pose */}
      {(isPoseInitializing || (isPoseActive && !isPoseReady)) && (gameStatus === 'playing' || gameStatus === 'calibration') && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#00f3ff] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white font-mono text-lg">
              {isPoseInitializing ? 'Initializing Camera...' : 'Detecting Pose...'}
            </p>
            <p className="text-gray-400 font-mono text-sm mt-2">
              {isPoseInitializing ? 'Please allow camera access' : 'Please stand in view of the camera'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

GameCanvas.displayName = 'GameCanvas';

export default GameCanvas;
