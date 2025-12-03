import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GAME_CONFIG, TRACK_LAYOUT, getTrackIndexByLabel, parseBeatNote } from '../constants';
import { NormalizedLandmark, BlockNote, BeatData, Beatmap } from '../types';

// Hooks
import { 
  useAudio, 
  useGameState, 
  useCameraPreview, 
  useCalibration,
  useThreeScene,
  useYouTubePlayer
} from '../hooks';
import { PoseService } from '../services/poseService';
import { Results } from '../types';

// Utils
import { 
  createBlockMesh,
  updateTrail as updateTrailUtil,
  updateAvatar as updateAvatarUtil,
  mapTo3D as mapTo3DUtil,
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

interface GameCanvasProps {
  onGameOver: (score: number) => void;
  gameStatus: 'loading' | 'playing' | 'gameover' | 'menu' | 'calibration' | 'beatmap-select';
  setGameStatus: (status: any) => void;
  onCalibrationComplete: () => void;
  onRecalibrateRequest: () => void;
  beatmap: Beatmap;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  onGameOver, 
  gameStatus, 
  setGameStatus, 
  onCalibrationComplete,
  onRecalibrateRequest,
  beatmap
}) => {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const poseService = useRef<PoseService | null>(null);
  const rawLandmarks = useRef<NormalizedLandmark[] | null>(null);
  const permissionError = useRef<string | null>(null);

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

  // Camera Preview
  const cameraPreview = useCameraPreview(videoRef, rawLandmarks, debugConfig.showCameraPreview);

  // Block speed based on BPM
  const travelDistance = Math.abs(GAME_CONFIG.SPAWN_Z - GAME_CONFIG.HIT_Z);
  const secondsPerBeat = 60 / beatmap.bpm;
  const blockSpeed = travelDistance / secondsPerBeat;

  // Game state refs
  const blocks = useRef<any[]>([]);
  const lastTime = useRef<number>(0);
  const nextSpawnTime = useRef<number>(0);
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

  // Initialize game
  const initGame = useCallback(() => {
    blocks.current = [];
    gameState.resetStats();
    const now = performance.now();
    lastTime.current = now;
    lastUpdateTime.current = now;
    accumulatedGameTime.current = 0; // Reset accumulated time
    nextSpawnTime.current = GAME_CONFIG.INITIAL_SPAWN_DELAY; // Use game time, not real time
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
    startCountdown();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    
    const effectiveGameTime = gameTime - GAME_CONFIG.INITIAL_SPAWN_DELAY;
    const currentBeatIndex = Math.max(0, Math.floor(effectiveGameTime / beatInterval));
    const targetSpawnIndex = Math.min(currentBeatIndex + lookahead, totalBeats - 1);
    
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
        for (const item of beatData) {
          const note = parseBeatNote(item);
          spawnSingleBlock(note, gameTime, beatsAhead);
        }
      } else {
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
    if (gameStatus === 'playing' && !isPaused && isGameActive.current) {
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
  
  useEffect(() => {
    // Only init game when transitioning TO 'playing' status
    if (gameStatus === 'playing' && prevGameStatus.current !== 'playing') {
      initGame();
    }
    prevGameStatus.current = gameStatus;
  }, [gameStatus, initGame]);

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

  // Pose tracking
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
        permissionError.current = "Camera access failed.";
      }
    };
    if (videoRef.current) startPose();
    return () => poseService.current?.stop();
  }, [onResults, setGameStatus]);

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

  // YouTube sync
  useEffect(() => {
    if (countdown === null && isGameActive.current && !isPaused && beatmap.youtubeId) {
      youtube.playYouTube();
    }
  }, [countdown, isPaused, beatmap.youtubeId, youtube, isGameActive]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (gameOverDelayTimer.current !== null) {
        clearTimeout(gameOverDelayTimer.current);
        gameOverDelayTimer.current = null;
      }
    };
  }, []);

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
    initGame();
  };

  const handleExit = () => {
    setGameStatus('menu');
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none" playsInline muted />
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

      {debugConfig.showCameraPreview && (
        <CameraPreview cameraPreviewRef={cameraPreview.cameraPreviewRef} />
      )}

      {gameStatus === 'playing' && beatmap.youtubeId && (
        <YouTubePlayer beatmap={beatmap} youtubePlayerRef={youtube.youtubePlayerRef} />
      )}

      {permissionError.current && <ErrorOverlay message={permissionError.current} />}
    </div>
  );
};

export default GameCanvas;
