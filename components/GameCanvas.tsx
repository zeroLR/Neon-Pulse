
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { PoseService } from '../services/poseService';
import { GAME_CONFIG, BEAT_MAP, TRACK_LAYOUT, getTrackType, getTrackIndexByLabel } from '../constants';
import { Block, BlockType, GameStats, Results, NormalizedLandmark, DebugConfig } from '../types';
import { Volume2, VolumeX, AlertTriangle, Pause, Play, Home } from 'lucide-react';
import CalibrationOverlay from './CalibrationOverlay';
import DebugMenu from './DebugMenu';

interface GameCanvasProps {
  onGameOver: (score: number) => void;
  gameStatus: 'loading' | 'playing' | 'gameover' | 'menu' | 'calibration';
  setGameStatus: (status: any) => void;
  onCalibrationComplete: () => void;
  onRecalibrateRequest: () => void;
}

const TRAIL_LENGTH = 20;

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
  const avatarParts = useRef<{
      head: THREE.Mesh;
      spine: THREE.Line;
      shoulders: THREE.Line;
      leftArm: THREE.Line;
      rightArm: THREE.Line;
      hips: THREE.Line;
  } | null>(null);

  // Debug Visuals Group
  const debugGroupRef = useRef<THREE.Group | null>(null);

  // --- Game State ---
  const blocks = useRef<any[]>([]); // Using any to allow adding startPos dynamically
  const stats = useRef<GameStats>({ score: 0, combo: 0, maxCombo: 0, health: 100 });
  const lastTime = useRef<number>(0);
  const nextSpawnTime = useRef<number>(0);
  const [isPaused, setIsPaused] = useState(false);
  
  // Beatmap tracking
  const currentMeasure = useRef<number>(0);
  const currentBeat = useRef<number>(0);
  
  // Use Ref for visual-only state to avoid re-renders resetting the game loop
  const nextTrackFlash = useRef<number[] | null>(null);
  
  // Countdown State
  const [countdown, setCountdown] = useState<number | null>(null);
  const isGameActive = useRef(false);
  const countdownTimer = useRef<any>(null);

  // Debug Configuration
  const [debugConfig, setDebugConfig] = useState<DebugConfig>({
      godMode: false,
      showNodes: false,
      showHitboxes: false,
      showBlockHitboxes: false,
      saberScale: GAME_CONFIG.DEFAULT_SABER_SCALE,
      blockScale: 1.0,
      showAvatar: false,
      showTrail: GAME_CONFIG.DEFAULT_SHOW_TRAIL,
      showCameraPreview: GAME_CONFIG.DEFAULT_SHOW_CAMERA_PREVIEW
  });
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  
  // Camera preview canvas ref
  const cameraPreviewRef = useRef<HTMLCanvasElement>(null);

  // Calibration State
  const [calibrationLeft, setCalibrationLeft] = useState(0);
  const [calibrationRight, setCalibrationRight] = useState(0);
  const [calibrationComplete, setCalibrationComplete] = useState(false);

  // Raw Landmarks (from MediaPipe)
  const rawLandmarks = useRef<NormalizedLandmark[] | null>(null);

  // Previous Frame 3D Positions (for velocity calc)
  const prevLeftPos = useRef<THREE.Vector3>(new THREE.Vector3());
  const prevRightPos = useRef<THREE.Vector3>(new THREE.Vector3());
  
  // Current Velocity
  const leftVelocity = useRef<number>(0);
  const rightVelocity = useRef<number>(0);
  const leftVelVector = useRef<THREE.Vector3>(new THREE.Vector3());
  const rightVelVector = useRef<THREE.Vector3>(new THREE.Vector3());

  // Audio
  const audioContext = useRef<AudioContext | null>(null);
  const noiseBuffer = useRef<AudioBuffer | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // --- Initialization ---

  const createBlockMesh = (type: BlockType): THREE.Group => {
    const group = new THREE.Group();
    const size = GAME_CONFIG.BLOCK_SIZE; // Use new larger size
    
    // Geometry
    const geometry = new THREE.BoxGeometry(size, size, size);
    const edges = new THREE.EdgesGeometry(geometry);
    
    // Add lineDistance attribute for dashed material to work on EdgesGeometry segments
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

    // 1. Wireframe (The Neon Outline - White, filling effect)
    const lineMaterial = new THREE.LineDashedMaterial({ 
        color: 0xffffff, // White
        linewidth: 3, // Increased visibility
        transparent: true, 
        opacity: 1.0, // Start fully opaque (but dashSize=0 makes it invisible initially)
        dashSize: 0, // Starts empty
        gapSize: size, // Full gap
        scale: 1.5 
    });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    wireframe.name = 'wireframe';
    // Slightly scale up wireframe to prevent Z-fighting and add "thickness" feel
    wireframe.scale.setScalar(1.01); 
    group.add(wireframe);

    // 2. Inner Glow
    const innerMaterial = new THREE.MeshBasicMaterial({ 
      color: color, 
      transparent: true, 
      opacity: 0.1, // Start dim
      side: THREE.DoubleSide
    });
    const core = new THREE.Mesh(geometry, innerMaterial);
    core.name = 'core';
    group.add(core);

    // 4. Collision Hitbox (Invisible/Debug)
    // Multiplier 1.1x as requested
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

    // Apply scale from config
    group.scale.setScalar(debugConfig.blockScale);

    return group;
  };

  const createSaberMesh = (color: number): THREE.Group => {
    const group = new THREE.Group();
    
    // Handle
    const handleGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.3, 16);
    handleGeo.rotateX(Math.PI / 2); 
    handleGeo.translate(0, 0, 0.15); // Origin at base
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.8 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    group.add(handle);

    // Blade
    const bladeLength = 4.0; // Longer blade for 3D reach
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
    
    // Hitbox (Physical Collider)
    const { WIDTH, HEIGHT, LENGTH, OFFSET_Z } = GAME_CONFIG.SABER_HITBOX_CONFIG;
    // Create Box centered at origin
    const hitboxGeo = new THREE.BoxGeometry(WIDTH, HEIGHT, LENGTH);
    
    const hitboxMat = new THREE.MeshBasicMaterial({ 
        color: color, 
        wireframe: true,
    });
    const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
    hitbox.name = 'hitbox';
    // Offset using position instead of geometry translate for better matrix handling
    hitbox.position.set(0, 0, OFFSET_Z);
    hitbox.visible = false;
    hitbox.scale.setScalar(1.25); // 1.25x Multiplier as requested
    group.add(hitbox);

    return group;
  };

  const createTrailMesh = (color: number) => {
    // Triangle strip geometry
    // 2 vertices per segment position (Base, Tip)
    const vertexCount = TRAIL_LENGTH * 2;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(vertexCount * 3);
    const alphas = new Float32Array(vertexCount);
    
    // Initialize indices for triangle strip
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

  const updateTrail = (
      mesh: THREE.Mesh | null, 
      history: React.MutableRefObject<{base: THREE.Vector3, tip: THREE.Vector3}[]>,
      saberGroup: THREE.Group | null,
      saberScale: number
  ) => {
      if (!mesh || !saberGroup) return;

      // Calculate current Base and Tip in World Space
      // Base = Group Position
      const base = saberGroup.position.clone();
      
      // Tip = Group Position + (Forward Vector * Blade Length * Scale)
      // Saber points along +Z locally? createSaberMesh rotates cylinder.
      const bladeLength = 4.0 * saberScale;
      const tip = base.clone().add(new THREE.Vector3(0, 0, bladeLength).applyQuaternion(saberGroup.quaternion));

      // Update History
      history.current.unshift({ base, tip });
      if (history.current.length > TRAIL_LENGTH) {
          history.current.pop();
      }

      // Fill Geometry
      const positions = mesh.geometry.attributes.position.array as Float32Array;
      const alphas = mesh.geometry.attributes.alpha.array as Float32Array;

      for (let i = 0; i < TRAIL_LENGTH; i++) {
          const point = history.current[i] || history.current[history.current.length - 1]; // Fallback to last known
          if (!point) continue;

          // Vertex 1 (Base)
          positions[i * 6 + 0] = point.base.x;
          positions[i * 6 + 1] = point.base.y;
          positions[i * 6 + 2] = point.base.z;

          // Vertex 2 (Tip)
          positions[i * 6 + 3] = point.tip.x;
          positions[i * 6 + 4] = point.tip.y;
          positions[i * 6 + 5] = point.tip.z;

          // Alpha Fade (Newest = 1, Oldest = 0)
          const alpha = 1.0 - (i / TRAIL_LENGTH);
          alphas[i * 2] = alpha * 0.5; // Max opacity 0.5
          alphas[i * 2 + 1] = alpha * 0.5;
      }

      mesh.geometry.attributes.position.needsUpdate = true;
      mesh.geometry.attributes.alpha.needsUpdate = true;
  };

  const createAvatarMesh = () => {
      const group = new THREE.Group();
      const material = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2, transparent: true, opacity: 0.6 });
      const blueMat = new THREE.LineBasicMaterial({ color: GAME_CONFIG.COLORS.CYAN, linewidth: 2 });
      const redMat = new THREE.LineBasicMaterial({ color: GAME_CONFIG.COLORS.MAGENTA, linewidth: 2 });

      // Head
      const headGeo = new THREE.IcosahedronGeometry(0.8, 1);
      const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.5 });
      const head = new THREE.Mesh(headGeo, headMat);
      group.add(head);

      // Helper to create line
      const createLine = (mat: THREE.Material, points = 2) => {
          const geo = new THREE.BufferGeometry().setFromPoints(new Array(points).fill(new THREE.Vector3(0,0,0)));
          const line = new THREE.Line(geo, mat);
          group.add(line);
          return line;
      };

      const spine = createLine(material);
      const shoulders = createLine(material);
      const hips = createLine(material);
      const leftArm = createLine(blueMat, 3); // Shoulder -> Elbow -> Wrist
      const rightArm = createLine(redMat, 3);

      avatarParts.current = { head, spine, shoulders, hips, leftArm, rightArm };
      
      group.visible = false; // Default hidden
      return group;
  };

  /**
   * Helper: Convert normalized 2D to 3D.
   */
  const mapTo3D = (normX: number, normY: number, rawZ: number, forceCompute = false): THREE.Vector3 => {
     let camera = cameraRef.current;
     if (!camera && forceCompute) {
        const width = window.innerWidth || 1280;
        const height = window.innerHeight || 720;
        const aspect = width / height;
        camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 100);
        camera.position.set(0, 0, GAME_CONFIG.CAMERA_Z);
     }
     
     if (!camera) return new THREE.Vector3(0, 0, 0);

     // Z-Scale: Positive means MediaPipe -Z (Front) maps to Game -Z (Into Screen)
     const zScale = 6.0; 
     const zBias = 0; 
     const safeZ = Number.isFinite(rawZ) ? rawZ : 0;
     const z = (safeZ * zScale) + zBias;

     const distance = camera.position.z - z;
     const vFov = camera.fov * Math.PI / 180;
     const height = 2 * Math.tan(vFov / 2) * distance;
     
     const aspect = Number.isFinite(camera.aspect) ? camera.aspect : GAME_CONFIG.ASPECT_RATIO;
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
    const avatar = createAvatarMesh();
    scene.add(avatar);
    avatarGroupRef.current = avatar;

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

  const startCountdown = useCallback(() => {
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    isGameActive.current = false;
    setCountdown(3);
    
    let count = 3;
    countdownTimer.current = setInterval(() => {
        count--;
        if (count > 0) {
            setCountdown(count);
        } else {
            setCountdown(null);
            isGameActive.current = true;
            lastTime.current = performance.now();
            if (countdownTimer.current) clearInterval(countdownTimer.current);
        }
    }, 1000);
  }, []);

  const initGame = useCallback(() => {
    blocks.current = [];
    stats.current = { score: 0, combo: 0, maxCombo: 0, health: 100 };
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

  // Initialize Noise Buffer for Slash Sound
  useEffect(() => {
      if (!audioContext.current) return;
      const ctx = audioContext.current;
      const bufferSize = ctx.sampleRate * 2.0; // 2 seconds
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
      }
      noiseBuffer.current = buffer;
  }, []);

  const playSlashSound = (pitchMod = 1.0) => {
    if (isMuted || !audioContext.current || !noiseBuffer.current) return;
    const ctx = audioContext.current;
    const now = ctx.currentTime;
    
    // 1. Noise Layer (Whoosh)
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer.current;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 1;
    
    const gain = ctx.createGain();
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    // Envelopes for Noise
    filter.frequency.setValueAtTime(800 * pitchMod, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.3);
    
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    noise.start(now);
    noise.stop(now + 0.3);

    // 2. Oscillator Layer (Kick/Impact)
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(150 * pitchMod, now);
    osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.15);
    
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.5, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.15);
  };

  const playSound = (freq: number, type: 'sine' | 'square' | 'sawtooth' | 'triangle', duration: number) => {
    if (isMuted || !audioContext.current) return;
    const osc = audioContext.current.createOscillator();
    const gain = audioContext.current.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioContext.current.currentTime);
    gain.gain.setValueAtTime(0.1, audioContext.current.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.current.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioContext.current.destination);
    osc.start();
    osc.stop(audioContext.current.currentTime + duration);
  };

  const createExplosion = (pos: THREE.Vector3, color: number) => {
    if (!particleMeshes.current) return;
    
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
        particleMeshes.current.add(mesh);
    }

    // 2. Shockwave (Expanding Ring)
    if (shockwaveMeshes.current) {
        const ringGeo = new THREE.RingGeometry(0.5, 0.8, 32);
        const ringMat = new THREE.MeshBasicMaterial({ 
            color: color, 
            transparent: true, 
            opacity: 0.8, 
            side: THREE.DoubleSide 
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(pos);
        if (cameraRef.current) ring.lookAt(cameraRef.current.position);
        
        ring.userData = { life: 0.5, maxScale: 4.0 };
        shockwaveMeshes.current.add(ring);
    }
  };

  const createSlashEffect = (pos: THREE.Vector3, color: number, saberVelocity: THREE.Vector3) => {
    if (!slashEffects.current) return;
    
    // Calculate slash angle from saber velocity
    const angle = Math.atan2(saberVelocity.y, saberVelocity.x);
    
    // Create rounded diamond shape (smaller size)
    const slashLength = GAME_CONFIG.BLOCK_SIZE * 1.5; // Half length
    const slashWidth = 0.12; // Half width
    const cornerRadius = 0.06; // Rounded corners
    
    // Create diamond shape with rounded corners using Shape
    const shape = new THREE.Shape();
    const hw = slashWidth; // half width
    const hl = slashLength; // half length
    const r = cornerRadius;
    
    // Draw rounded diamond: start from right point, go counter-clockwise
    shape.moveTo(hl - r, 0);
    shape.quadraticCurveTo(hl, 0, hl - r * 0.3, hw * 0.3); // right corner
    shape.lineTo(r * 0.3, hw - r * 0.3);
    shape.quadraticCurveTo(0, hw, -r * 0.3, hw - r * 0.3); // top corner
    shape.lineTo(-hl + r * 0.3, hw * 0.3);
    shape.quadraticCurveTo(-hl, 0, -hl + r * 0.3, -hw * 0.3); // left corner
    shape.lineTo(-r * 0.3, -hw + r * 0.3);
    shape.quadraticCurveTo(0, -hw, r * 0.3, -hw + r * 0.3); // bottom corner
    shape.lineTo(hl - r * 0.3, -hw * 0.3);
    shape.quadraticCurveTo(hl, 0, hl - r, 0); // back to right
    
    const geometry = new THREE.ShapeGeometry(shape);
    
    // Create gradient material with glow
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    
    const slash = new THREE.Mesh(geometry, material);
    slash.position.copy(pos);
    
    // Face camera first, then apply slash angle
    if (cameraRef.current) {
      slash.lookAt(cameraRef.current.position);
      slash.rotateZ(angle);
    }
    
    slash.userData = {
      life: 0.35,
      maxLife: 0.35,
      initialScale: 1.0,
      maxScale: 2.5,
    };
    
    slashEffects.current.add(slash);
    
    // Create secondary glow slash (slightly larger, more transparent)
    const glowShape = new THREE.Shape();
    const ghw = slashWidth * 2; // glow half width
    const ghl = slashLength * 1.1; // glow half length
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
    
    if (cameraRef.current) {
      glow.lookAt(cameraRef.current.position);
      glow.rotateZ(angle);
    }
    
    glow.userData = {
      life: 0.25,
      maxLife: 0.25,
      initialScale: 1.0,
      maxScale: 3.0,
    };
    
    slashEffects.current.add(glow);
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

  const createDebris = (pos: THREE.Vector3, color: number, saberVelocity: THREE.Vector3) => {
      if (!debrisMeshes.current) return;

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
          
          debrisMeshes.current.add(group);
      }
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

  const updateCalibration = (dt: number, landmarks: NormalizedLandmark[]) => {
      const lw = landmarks[15];
      const rw = landmarks[16];

      // Mirroring Logic for Calibration
      const tolerance = 0.15; 
      const isLeftInZone = Math.abs(lw.x - 0.8) < tolerance && Math.abs(lw.y - 0.5) < tolerance;
      const isRightInZone = Math.abs(rw.x - 0.2) < tolerance && Math.abs(rw.y - 0.5) < tolerance;

      if (isLeftInZone) setCalibrationLeft(prev => Math.min(100, prev + dt * 100));
      else setCalibrationLeft(prev => Math.max(0, prev - dt * 200));

      if (isRightInZone) setCalibrationRight(prev => Math.min(100, prev + dt * 100));
      else setCalibrationRight(prev => Math.max(0, prev - dt * 200));

      if (calibrationLeft >= 100 && calibrationRight >= 100 && !calibrationComplete) {
          setCalibrationComplete(true);
          setTimeout(() => {
              setCalibrationLeft(0);
              setCalibrationRight(0);
              setCalibrationComplete(false);
              onCalibrationComplete();
          }, 1500);
      }
  };

  // Store previous frame's saber blade points for sweep detection
  const prevLeftBladePoints = useRef<THREE.Vector3[]>([]);
  const prevRightBladePoints = useRef<THREE.Vector3[]>([]);

  const getSaberBladePoints = (saberGroup: THREE.Group, saberScale: number = 1.0): THREE.Vector3[] => {
      saberGroup.updateMatrixWorld(true);
      const points: THREE.Vector3[] = [];
      const startZ = 0;
      const endZ = 4.5 * saberScale; // Blade length scaled
      const bladeRadius = 0.15 * saberScale; // Blade thickness scaled
      const steps = 12;
      
      for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const localZ = startZ + (t * (endZ - startZ));
          
          // Center point
          const centerPoint = new THREE.Vector3(0, 0, localZ);
          centerPoint.applyMatrix4(saberGroup.matrixWorld);
          points.push(centerPoint);
          
          // Add points around the blade circumference for better collision detection
          // This accounts for the blade's thickness when scaled up
          const offsets = [
              new THREE.Vector3(bladeRadius, 0, localZ),
              new THREE.Vector3(-bladeRadius, 0, localZ),
              new THREE.Vector3(0, bladeRadius, localZ),
              new THREE.Vector3(0, -bladeRadius, localZ),
          ];
          
          for (const offset of offsets) {
              const point = offset.clone();
              point.applyMatrix4(saberGroup.matrixWorld);
              points.push(point);
          }
      }
      return points;
  };

  const checkSaberIntersection = (saberGroup: THREE.Group, blockWorldPos: THREE.Vector3, prevBladePoints: THREE.Vector3[]) => {
      // 1. Define Block AABB in World Space
      // Use 1.1x scaling + Expansion for "Any Point" logic
      const size = GAME_CONFIG.BLOCK_SIZE * debugConfig.blockScale * 1.1; 
      const halfSize = size / 2;
      
      const min = new THREE.Vector3(blockWorldPos.x - halfSize, blockWorldPos.y - halfSize, blockWorldPos.z - halfSize);
      const max = new THREE.Vector3(blockWorldPos.x + halfSize, blockWorldPos.y + halfSize, blockWorldPos.z + halfSize);
      const blockBox = new THREE.Box3(min, max);

      // Expand the block box to catch fast swings - scales with saber size
      const expansionAmount = 0.5 * debugConfig.saberScale;
      blockBox.expandByScalar(expansionAmount);

      // 2. Get current blade points (scaled)
      const currentBladePoints = getSaberBladePoints(saberGroup, debugConfig.saberScale);
      
      // 3. Check current frame collision
      for (const point of currentBladePoints) {
          if (blockBox.containsPoint(point)) {
              return true;
          }
      }

      // 4. Sweep Detection: Check interpolated positions between frames
      // This catches fast swings that might skip over the block
      if (prevBladePoints.length > 0) {
          const interpSteps = 5; // Check 5 intermediate positions
          for (let i = 0; i < currentBladePoints.length; i++) {
              const currPoint = currentBladePoints[i];
              const prevPoint = prevBladePoints[i] || currPoint;
              
              for (let s = 1; s <= interpSteps; s++) {
                  const t = s / (interpSteps + 1);
                  const interpPoint = new THREE.Vector3().lerpVectors(prevPoint, currPoint, t);
                  
                  if (blockBox.containsPoint(interpPoint)) {
                      return true;
                  }
              }
          }
          
          // 5. Triangle-based sweep collision for the blade surface
          // Check if any triangle formed by consecutive blade edges intersects the box
          for (let i = 0; i < currentBladePoints.length - 1; i++) {
              const curr0 = currentBladePoints[i];
              const curr1 = currentBladePoints[i + 1];
              const prev0 = prevBladePoints[i] || curr0;
              const prev1 = prevBladePoints[i + 1] || curr1;
              
              // Check center of the swept quad
              const center = new THREE.Vector3()
                  .add(curr0).add(curr1).add(prev0).add(prev1)
                  .multiplyScalar(0.25);
              
              if (blockBox.containsPoint(center)) {
                  return true;
              }
          }
      }

      return false;
  };

  const checkBlockCollision = (saberGroup: THREE.Group, blockWorldPos: THREE.Vector3, prevBladePoints: THREE.Vector3[]) => {
      // Use Dense Point Sampling with Sweep Detection
      return checkSaberIntersection(saberGroup, blockWorldPos, prevBladePoints);
  };

  const updateAvatar = (lm: NormalizedLandmark[]) => {
      if (!avatarParts.current) return;
      
      const { head, spine, shoulders, hips, leftArm, rightArm } = avatarParts.current;
      
      const getPos = (idx: number) => mapTo3D(1 - lm[idx].x, lm[idx].y, lm[idx].z);

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
            updateCalibration(dt, lm);
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
        for (let i = particleMeshes.current.children.length - 1; i >= 0; i--) {
            const p = particleMeshes.current.children[i];
            const u = p.userData as { velocity: THREE.Vector3, life: number };
            
            p.position.add(u.velocity.clone().multiplyScalar(dt));
            u.life -= dt * 2.5; 
            p.scale.setScalar(u.life);
            
            if (u.life <= 0) particleMeshes.current.remove(p);
        }
    }

    // --- Update Shockwaves ---
    if (shockwaveMeshes.current && !isPaused) {
        for (let i = shockwaveMeshes.current.children.length - 1; i >= 0; i--) {
            const s = shockwaveMeshes.current.children[i] as THREE.Mesh;
            const u = s.userData as { life: number, maxScale: number };
            const mat = s.material as THREE.MeshBasicMaterial;

            // Expand
            const scaleSpeed = u.maxScale * dt * 3;
            s.scale.addScalar(scaleSpeed);
            
            // Fade
            u.life -= dt * 3;
            mat.opacity = u.life;
            
            if (u.life <= 0) shockwaveMeshes.current.remove(s);
        }
    }

    // --- Update Slash Effects ---
    if (slashEffects.current && !isPaused) {
        for (let i = slashEffects.current.children.length - 1; i >= 0; i--) {
            const slash = slashEffects.current.children[i] as THREE.Mesh;
            const u = slash.userData as { life: number, maxLife: number, initialScale: number, maxScale: number };
            const mat = slash.material as THREE.MeshBasicMaterial;

            // Animate: expand uniformly, fade out
            u.life -= dt;
            const progress = 1 - (u.life / u.maxLife);
            
            // Expand scale over time (ease out)
            const easeProgress = 1 - Math.pow(1 - progress, 2);
            const currentScale = u.initialScale + (u.maxScale - u.initialScale) * easeProgress;
            slash.scale.setScalar(currentScale);
            
            // Fade out (faster at the end)
            mat.opacity = Math.max(0, Math.pow(u.life / u.maxLife, 0.5));
            
            if (u.life <= 0) slashEffects.current.remove(slash);
        }
    }

    // --- Update Debris (Block Pieces) ---
    if (debrisMeshes.current && !isPaused) {
        for (let i = debrisMeshes.current.children.length - 1; i >= 0; i--) {
            const d = debrisMeshes.current.children[i] as THREE.Group;
            const u = d.userData as { velocity: THREE.Vector3, rotVel: THREE.Vector3, life: number };
            
            // Physics
            u.velocity.y -= GAME_CONFIG.GRAVITY * dt;
            d.position.add(u.velocity.clone().multiplyScalar(dt));
            
            // Rotation
            d.rotation.x += u.rotVel.x * dt;
            d.rotation.y += u.rotVel.y * dt;
            
            // Fade out
            u.life -= dt;
            if (u.life <= 0) {
                d.scale.multiplyScalar(0.9); // Shrink out
                if (d.scale.x < 0.01) debrisMeshes.current.remove(d);
            }
        }
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
  }, [gameStatus, debugConfig, calibrationLeft, calibrationRight, isPaused]); 

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
        if (!audioContext.current) {
            audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContext.current?.state === 'suspended') audioContext.current.resume();

        requestRef.current = requestAnimationFrame(renderLoop);
    } else {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameStatus, renderLoop]);

  // Cleanup Timer on unmount
  useEffect(() => {
      return () => {
          if (countdownTimer.current) clearInterval(countdownTimer.current);
      }
  }, []);

  const onResults = useCallback((results: Results) => {
    if (results.poseLandmarks) {
        rawLandmarks.current = results.poseLandmarks;
    }
  }, []);

  // Camera preview render loop
  const cameraPreviewAnimationRef = useRef<number | null>(null);
  
  const drawCameraPreview = useCallback(() => {
    if (cameraPreviewRef.current && videoRef.current && debugConfig.showCameraPreview) {
        const canvas = cameraPreviewRef.current;
        const ctx = canvas.getContext('2d');
        const video = videoRef.current;
        
        if (ctx && video.readyState >= 2) {
            // Draw video frame (mirrored)
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
            ctx.restore();
            
            // Draw pose landmarks for wrists and palms
            if (rawLandmarks.current) {
                const lm = rawLandmarks.current;
                const leftWrist = lm[15];  // Left wrist
                const rightWrist = lm[16]; // Right wrist
                const leftPalm = lm[19];   // Left index finger base (palm center)
                const rightPalm = lm[20];  // Right index finger base (palm center)
                
                const drawPoint = (landmark: NormalizedLandmark, color: string, size: number = 8) => {
                    // Mirror X coordinate
                    const x = (1 - landmark.x) * canvas.width;
                    const y = landmark.y * canvas.height;
                    
                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();
                    
                    // Glow effect
                    ctx.beginPath();
                    ctx.arc(x, y, size + 4, 0, Math.PI * 2);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                };
                
                const drawLine = (from: NormalizedLandmark, to: NormalizedLandmark, color: string) => {
                    const x1 = (1 - from.x) * canvas.width;
                    const y1 = from.y * canvas.height;
                    const x2 = (1 - to.x) * canvas.width;
                    const y2 = to.y * canvas.height;
                    
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 3;
                    ctx.stroke();
                };
                
                // Draw wrist to palm lines (saber direction)
                drawLine(leftWrist, leftPalm, '#00f3ff');
                drawLine(rightWrist, rightPalm, '#ff00ff');
                
                // Draw points - wrists smaller, palms larger (palm is saber tip direction)
                drawPoint(leftWrist, '#00f3ff', 6);
                drawPoint(rightWrist, '#ff00ff', 6);
                drawPoint(leftPalm, '#00f3ff', 10);
                drawPoint(rightPalm, '#ff00ff', 10);
            }
        }
    }
    
    if (debugConfig.showCameraPreview) {
        cameraPreviewAnimationRef.current = requestAnimationFrame(drawCameraPreview);
    }
  }, [debugConfig.showCameraPreview]);

  // Effect to manage camera preview animation
  useEffect(() => {
    if (debugConfig.showCameraPreview) {
        cameraPreviewAnimationRef.current = requestAnimationFrame(drawCameraPreview);
    } else {
        if (cameraPreviewAnimationRef.current) {
            cancelAnimationFrame(cameraPreviewAnimationRef.current);
            cameraPreviewAnimationRef.current = null;
        }
    }
    
    return () => {
        if (cameraPreviewAnimationRef.current) {
            cancelAnimationFrame(cameraPreviewAnimationRef.current);
        }
    };
  }, [debugConfig.showCameraPreview, drawCameraPreview]);

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

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioContext.current) {
        if (!isMuted) audioContext.current.suspend();
        else audioContext.current.resume();
    }
  }

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
            leftProgress={calibrationLeft}
            rightProgress={calibrationRight}
            isComplete={calibrationComplete}
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
        {isMuted ? <VolumeX /> : <Volume2 />}
      </button>

      {/* Camera Preview Window */}
      {debugConfig.showCameraPreview && (
          <div className="absolute bottom-4 right-4 z-40 rounded-lg overflow-hidden border-2 border-gray-700 shadow-xl bg-black">
              <div className="relative">
                  <canvas 
                      ref={cameraPreviewRef}
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

const ScoreDisplay = ({ statsRef }: { statsRef: React.MutableRefObject<GameStats> }) => {
    const [val, setVal] = useState(0);
    useEffect(() => { const i = setInterval(() => setVal(statsRef.current.score), 100); return () => clearInterval(i); }, [statsRef]);
    return <>{val.toLocaleString()}</>;
};

const ComboDisplay = ({ statsRef }: { statsRef: React.MutableRefObject<GameStats> }) => {
    const [val, setVal] = useState(0);
    useEffect(() => { const i = setInterval(() => setVal(statsRef.current.combo), 100); return () => clearInterval(i); }, [statsRef]);
    return <>{val}x</>;
};

const HealthBar = ({ statsRef }: { statsRef: React.MutableRefObject<GameStats> }) => {
    const [hp, setHp] = useState(100);
    useEffect(() => { const i = setInterval(() => setHp(statsRef.current.health), 100); return () => clearInterval(i); }, [statsRef]);
    return (
        <div 
            className="h-full bg-gradient-to-r from-[#00f3ff] to-[#ff00ff] shadow-[0_0_10px_#ff00ff] transition-all duration-200"
            style={{ width: `${hp}%` }}
        />
    );
};

export default GameCanvas;
