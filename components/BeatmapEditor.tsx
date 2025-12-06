import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { 
  ArrowLeft, Play, Pause, Plus, Trash2, Download, Upload, 
  Save, Music, ChevronDown, ChevronUp, Volume2, VolumeX,
  SkipBack, SkipForward, Copy, Eye, EyeOff, Menu, X,
  Settings, List, Edit3, GripVertical
} from 'lucide-react';
import { Beatmap, BeatmapDifficulty, BeatData, BlockNote, SlashDirection, NoteGroup, SingleNote, BeatItem } from '../types';
import { TRACK_LAYOUT, DIRECTION_ARROWS, getTrackType, GAME_CONFIG, BEATMAPS, isNoteGroup } from '../constants';
import { beatmapStorage, processBeatmap, RawBeatmap } from '../services/beatmapStorage';
import { createBlockMesh } from '../utils/threeHelpers';

// Mobile panel types
type MobilePanel = 'timeline' | 'metadata' | 'beatEditor';

interface BeatmapEditorProps {
  onBack: () => void;
  initialBeatmap?: Beatmap;
}

const DIFFICULTIES: BeatmapDifficulty[] = ['easy', 'normal', 'hard', 'expert'];
const DIRECTIONS: SlashDirection[] = ['any', 'up', 'down', 'left', 'right', 'up-left', 'up-right', 'down-left', 'down-right'];

const DIFFICULTY_COLORS: Record<BeatmapDifficulty, string> = {
  easy: 'bg-green-500',
  normal: 'bg-blue-500',
  hard: 'bg-orange-500',
  expert: 'bg-red-500',
};

const BeatmapEditor: React.FC<BeatmapEditorProps> = ({ onBack, initialBeatmap }) => {
  // Check if editing a built-in beatmap
  const builtInIds = new Set(BEATMAPS.map(b => b.id));
  const isBuiltIn = initialBeatmap ? builtInIds.has(initialBeatmap.id) : false;
  
  // Metadata state - for built-in beatmaps, add " (Copy)" to title
  const [title, setTitle] = useState(
    initialBeatmap 
      ? (isBuiltIn ? `${initialBeatmap.title} (Copy)` : initialBeatmap.title)
      : 'New Beatmap'
  );
  const [artist, setArtist] = useState(initialBeatmap?.artist || 'Unknown Artist');
  const [bpm, setBpm] = useState(initialBeatmap?.bpm || 120);
  const [difficulty, setDifficulty] = useState<BeatmapDifficulty>(initialBeatmap?.difficulty || 'normal');
  const [difficultyRating, setDifficultyRating] = useState(initialBeatmap?.difficultyRating || 5);
  const [youtubeId, setYoutubeId] = useState(initialBeatmap?.youtubeId || '');
  const [startDelay, setStartDelay] = useState(initialBeatmap?.startDelay || 2000);
  
  // For built-in beatmaps, always generate a new ID
  const [beatmapId] = useState(() => {
    if (!initialBeatmap) return null;
    if (isBuiltIn) {
      // Generate new ID for built-in beatmap copies
      return `custom-${initialBeatmap.id}-${Date.now().toString(36)}`;
    }
    return initialBeatmap.id;
  });
  
  // Beatmap data state (measures -> beats)
  const [measures, setMeasures] = useState<BeatData[][]>(
    initialBeatmap?.data || [[null, null, null, null]]
  );
  
  // Editor state
  const [selectedMeasure, setSelectedMeasure] = useState(0);
  const [selectedBeat, setSelectedBeat] = useState(0);
  const [selectedSubBeat, setSelectedSubBeat] = useState<number | null>(null); // Which sub-beat/group to edit (null = add new)
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentPlayBeat, setCurrentPlayBeat] = useState(0);
  const [showMetadata, setShowMetadata] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('timeline');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // Drag and drop state
  const [draggedMeasure, setDraggedMeasure] = useState<number | null>(null);
  const [dragOverMeasure, setDragOverMeasure] = useState<number | null>(null);
  
  // Touch drag state
  const touchStartY = useRef<number>(0);
  const touchCurrentY = useRef<number>(0);
  const measureRefs = useRef<(HTMLDivElement | null)[]>([]);
  const measureListRef = useRef<HTMLDivElement>(null);
  const isDraggingTouch = useRef<boolean>(false);
  const dragHandleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragTimerRef = useRef<number | null>(null);
  const touchDragIndexRef = useRef<number | null>(null);
  
  // Refs
  const youtubeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const playIntervalRef = useRef<number | null>(null);
  
  // Preview refs
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewSceneRef = useRef<THREE.Scene | null>(null);
  const previewCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const previewRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const previewBlocksRef = useRef<THREE.Group[]>([]);
  const previewAnimationRef = useRef<number | null>(null);
  
  // Preview window drag state
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const previewDragStart = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const previewDragTimer = useRef<number | null>(null);
  const isPreviewDragging = useRef<boolean>(false);
  
  // Calculate beat interval in ms
  const beatInterval = 60000 / bpm;
  
  // Total beats
  const totalBeats = measures.reduce((sum, m) => sum + m.length, 0);
  
  // YouTube controls
  const playYouTube = useCallback(() => {
    if (youtubeRef.current?.contentWindow) {
      youtubeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'playVideo' }), '*'
      );
    }
  }, []);
  
  const pauseYouTube = useCallback(() => {
    if (youtubeRef.current?.contentWindow) {
      youtubeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo' }), '*'
      );
    }
  }, []);
  
  const seekYouTube = useCallback((seconds: number) => {
    if (youtubeRef.current?.contentWindow) {
      youtubeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }), '*'
      );
    }
  }, []);
  
  const muteYouTube = useCallback(() => {
    if (youtubeRef.current?.contentWindow) {
      youtubeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: isMuted ? 'unMute' : 'mute' }), '*'
      );
      setIsMuted(!isMuted);
    }
  }, [isMuted]);
  
  // Playback controls
  const handlePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      pauseYouTube();
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    } else {
      setIsPlaying(true);
      // Calculate YouTube start time based on current beat
      const beatTimeMs = currentPlayBeat * beatInterval;
      const youtubeStartTime = (startDelay + beatTimeMs) / 1000;
      seekYouTube(youtubeStartTime);
      playYouTube();
      
      playIntervalRef.current = window.setInterval(() => {
        setCurrentPlayBeat(prev => {
          if (prev >= totalBeats - 1) {
            setIsPlaying(false);
            pauseYouTube();
            if (playIntervalRef.current) {
              clearInterval(playIntervalRef.current);
              playIntervalRef.current = null;
            }
            return 0;
          }
          return prev + 1;
        });
      }, beatInterval);
    }
  };
  
  const handleSeekToStart = () => {
    setCurrentPlayBeat(0);
    seekYouTube(startDelay / 1000);
    clearPreviewBlocks();
  };
  
  const handleSeekToBeat = (beatIndex: number) => {
    setCurrentPlayBeat(beatIndex);
    const beatTimeMs = beatIndex * beatInterval;
    const youtubeTime = (startDelay + beatTimeMs) / 1000;
    seekYouTube(youtubeTime);
    clearPreviewBlocks();
  };
  
  // Clear all preview blocks
  const clearPreviewBlocks = () => {
    if (previewSceneRef.current) {
      previewBlocksRef.current.forEach(block => {
        previewSceneRef.current?.remove(block);
      });
      previewBlocksRef.current = [];
    }
  };
  
  // Preview window drag handlers
  const handlePreviewDragStart = useCallback((clientX: number, clientY: number) => {
    previewDragStart.current = {
      x: clientX,
      y: clientY,
      posX: previewPosition.x,
      posY: previewPosition.y
    };
    
    // Clear any existing timer
    if (previewDragTimer.current) {
      clearTimeout(previewDragTimer.current);
    }
    
    // Start drag after 200ms delay
    previewDragTimer.current = window.setTimeout(() => {
      isPreviewDragging.current = true;
      document.body.style.cursor = 'grabbing';
    }, 200);
  }, [previewPosition]);
  
  const handlePreviewDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isPreviewDragging.current || !previewDragStart.current) return;
    
    const dx = clientX - previewDragStart.current.x;
    const dy = clientY - previewDragStart.current.y;
    
    // Since we use right/bottom positioning, we need to invert the delta
    // Moving mouse right (positive dx) should decrease 'right' value
    // Moving mouse down (positive dy) should decrease 'bottom' value
    setPreviewPosition({
      x: previewDragStart.current.posX - dx,
      y: previewDragStart.current.posY - dy
    });
  }, []);
  
  const handlePreviewDragEnd = useCallback(() => {
    if (previewDragTimer.current) {
      clearTimeout(previewDragTimer.current);
      previewDragTimer.current = null;
    }
    isPreviewDragging.current = false;
    previewDragStart.current = null;
    document.body.style.cursor = '';
  }, []);
  
  // Global mouse/touch listeners for preview drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      handlePreviewDragMove(e.clientX, e.clientY);
    };
    
    const handleMouseUp = () => {
      handlePreviewDragEnd();
    };
    
    const handleTouchMovePreview = (e: TouchEvent) => {
      if (isPreviewDragging.current) {
        e.preventDefault();
        handlePreviewDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    
    const handleTouchEndPreview = () => {
      handlePreviewDragEnd();
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMovePreview, { passive: false });
    document.addEventListener('touchend', handleTouchEndPreview);
    document.addEventListener('touchcancel', handleTouchEndPreview);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMovePreview);
      document.removeEventListener('touchend', handleTouchEndPreview);
      document.removeEventListener('touchcancel', handleTouchEndPreview);
    };
  }, [handlePreviewDragMove, handlePreviewDragEnd]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
      if (previewAnimationRef.current) {
        cancelAnimationFrame(previewAnimationRef.current);
      }
      if (previewRendererRef.current) {
        previewRendererRef.current.dispose();
      }
    };
  }, []);
  
  // Initialize 3D Preview
  useEffect(() => {
    if (!previewCanvasRef.current || !showPreview) return;
    
    const canvas = previewCanvasRef.current;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a15);
    scene.fog = new THREE.Fog(0x0a0a15, 30, 80);
    previewSceneRef.current = scene;
    
    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 200);
    camera.position.set(0, 2, 12);
    camera.lookAt(0, 0, -20);
    previewCameraRef.current = camera;
    
    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    previewRendererRef.current = renderer;
    
    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const point = new THREE.PointLight(0xffffff, 1, 100);
    point.position.set(0, 10, 10);
    scene.add(point);
    
    // Grid
    const grid = new THREE.GridHelper(100, 50, 0x333344, 0x111122);
    grid.position.y = -4;
    grid.position.z = -30;
    scene.add(grid);
    
    // Hit zone line
    const hitLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-10, -4, 0),
      new THREE.Vector3(10, -4, 0)
    ]);
    const hitLineMat = new THREE.LineBasicMaterial({ color: 0x00ff00, opacity: 0.5, transparent: true });
    const hitLine = new THREE.Line(hitLineGeo, hitLineMat);
    scene.add(hitLine);
    
    return () => {
      renderer.dispose();
      previewSceneRef.current = null;
      previewCameraRef.current = null;
      previewRendererRef.current = null;
    };
  }, [showPreview]);
  
  // Preview animation loop
  useEffect(() => {
    if (!showPreview || !previewRendererRef.current || !previewSceneRef.current || !previewCameraRef.current) return;
    
    const scene = previewSceneRef.current;
    const camera = previewCameraRef.current;
    const renderer = previewRendererRef.current;
    
    // Block speed calculation (same as game)
    const travelDistance = Math.abs(GAME_CONFIG.SPAWN_Z - GAME_CONFIG.HIT_Z);
    const secondsPerBeat = 60 / bpm;
    const blockSpeed = travelDistance / secondsPerBeat;
    
    let lastTime = performance.now();
    
    const animate = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;
      
      // Move existing blocks
      previewBlocksRef.current.forEach((block, index) => {
        block.position.z += blockSpeed * dt;
        
        // Remove blocks past despawn
        if (block.position.z > 15) {
          scene.remove(block);
          previewBlocksRef.current.splice(index, 1);
        }
      });
      
      renderer.render(scene, camera);
      previewAnimationRef.current = requestAnimationFrame(animate);
    };
    
    previewAnimationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (previewAnimationRef.current) {
        cancelAnimationFrame(previewAnimationRef.current);
      }
    };
  }, [showPreview, bpm]);
  
  // Spawn blocks when playing - supports NoteGroup for simultaneous notes and sub-beat offsets
  useEffect(() => {
    if (!isPlaying || !showPreview || !previewSceneRef.current) return;
    
    const scene = previewSceneRef.current;
    
    // Get notes for current beat
    const { measure, beat } = getMeasureAndBeat(currentPlayBeat);
    const beatData = measures[measure]?.[beat];
    
    if (beatData === null) return;
    
    // Block speed calculation for z offset
    const travelDistance = Math.abs(GAME_CONFIG.SPAWN_Z - GAME_CONFIG.HIT_Z);
    const secondsPerBeat = 60 / bpm;
    const distancePerBeat = travelDistance / (GAME_CONFIG.SPAWN.LOOKAHEAD_BEATS || 4);
    
    // Helper to spawn a single note
    const spawnNote = (note: string | BlockNote, zOffset: number = 0) => {
      const track = typeof note === 'string' ? note : note.track;
      const trackInfo = TRACK_LAYOUT.find(t => t.label === track);
      if (!trackInfo) return;
      
      const type = getTrackType(track);
      const block = createBlockMesh(type, 0.8);
      
      // Position based on track, with z offset for sub-beat timing
      const x = (trackInfo.x - 0.5) * 16;
      const y = (0.5 - trackInfo.y) * 10 - 1;
      block.position.set(x, y, GAME_CONFIG.SPAWN_Z - zOffset);
      
      scene.add(block);
      previewBlocksRef.current.push(block);
    };
    
    if (Array.isArray(beatData)) {
      // Array of items - each item gets a sub-beat offset
      const subBeatOffset = distancePerBeat / beatData.length;
      
      beatData.forEach((item, index) => {
        const zOffset = index * subBeatOffset;
        
        if (isNoteGroup(item as BeatItem)) {
          // NoteGroup: all notes in the group spawn at same z (same time)
          const group = item as NoteGroup;
          group.notes.forEach(note => {
            spawnNote(note, zOffset);
          });
        } else {
          // Single note
          spawnNote(item as string | BlockNote, zOffset);
        }
      });
    } else if (isNoteGroup(beatData)) {
      // Single NoteGroup: all notes spawn at same z (same time)
      beatData.notes.forEach(note => {
        spawnNote(note, 0);
      });
    } else {
      // Single note
      spawnNote(beatData, 0);
    }
  }, [currentPlayBeat, isPlaying, showPreview, measures, bpm]);
  
  // Clear preview blocks when not playing
  useEffect(() => {
    if (!isPlaying) {
      clearPreviewBlocks();
    }
  }, [isPlaying]);
  
  // Helper to get measure and beat from global index
  const getMeasureAndBeat = (globalIndex: number): { measure: number; beat: number } => {
    let remaining = globalIndex;
    for (let i = 0; i < measures.length; i++) {
      if (remaining < measures[i].length) {
        return { measure: i, beat: remaining };
      }
      remaining -= measures[i].length;
    }
    return { measure: measures.length - 1, beat: measures[measures.length - 1].length - 1 };
  };
  
  // Measure/Beat management
  const addMeasure = () => {
    setMeasures([...measures, [null, null, null, null]]);
  };
  
  const removeMeasure = (index: number) => {
    if (measures.length <= 1) return;
    const newMeasures = measures.filter((_, i) => i !== index);
    setMeasures(newMeasures);
    if (selectedMeasure >= newMeasures.length) {
      setSelectedMeasure(newMeasures.length - 1);
    }
  };
  
  const duplicateMeasure = (index: number) => {
    const newMeasures = [...measures];
    newMeasures.splice(index + 1, 0, JSON.parse(JSON.stringify(measures[index])));
    setMeasures(newMeasures);
  };
  
  // Drag and drop handlers for measures
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedMeasure(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    // Add a slight delay to show the drag visual
    setTimeout(() => {
      (e.target as HTMLElement).style.opacity = '0.5';
    }, 0);
  };
  
  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
    setDraggedMeasure(null);
    setDragOverMeasure(null);
  };
  
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedMeasure !== null && draggedMeasure !== index) {
      setDragOverMeasure(index);
    }
  };
  
  const handleDragLeave = () => {
    setDragOverMeasure(null);
  };
  
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedMeasure === null || draggedMeasure === dropIndex) {
      setDraggedMeasure(null);
      setDragOverMeasure(null);
      return;
    }
    
    const newMeasures = [...measures];
    const [removed] = newMeasures.splice(draggedMeasure, 1);
    newMeasures.splice(dropIndex, 0, removed);
    setMeasures(newMeasures);
    
    // Update selected measure if needed
    if (selectedMeasure === draggedMeasure) {
      setSelectedMeasure(dropIndex);
    } else if (draggedMeasure < selectedMeasure && dropIndex >= selectedMeasure) {
      setSelectedMeasure(selectedMeasure - 1);
    } else if (draggedMeasure > selectedMeasure && dropIndex <= selectedMeasure) {
      setSelectedMeasure(selectedMeasure + 1);
    }
    
    setDraggedMeasure(null);
    setDragOverMeasure(null);
  };
  
  // Touch drag handlers - need to be used with useEffect for non-passive listeners
  const handleTouchStartForIndex = useCallback((index: number) => (e: TouchEvent) => {
    const touch = e.touches[0];
    touchStartY.current = touch.clientY;
    touchCurrentY.current = touch.clientY;
    isDraggingTouch.current = false;
    touchDragIndexRef.current = index;
    
    // Clear any existing timer
    if (dragTimerRef.current) {
      clearTimeout(dragTimerRef.current);
    }
    
    // Start drag after a short delay to distinguish from scroll
    dragTimerRef.current = window.setTimeout(() => {
      if (Math.abs(touchCurrentY.current - touchStartY.current) < 10) {
        isDraggingTouch.current = true;
        setDraggedMeasure(index);
        // Prevent scrolling while dragging
        document.body.style.overflow = 'hidden';
      }
    }, 200);
  }, []);
  
  const handleTouchMoveGlobal = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    touchCurrentY.current = touch.clientY;
    
    if (!isDraggingTouch.current || draggedMeasure === null) return;
    
    e.preventDefault();
    
    // Find which measure we're over
    const measureElements = measureRefs.current;
    for (let i = 0; i < measureElements.length; i++) {
      const el = measureElements[i];
      if (el) {
        const rect = el.getBoundingClientRect();
        if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
          if (i !== draggedMeasure) {
            setDragOverMeasure(i);
          }
          break;
        }
      }
    }
  }, [draggedMeasure]);
  
  const handleTouchEndGlobal = useCallback(() => {
    // Clear the timer
    if (dragTimerRef.current) {
      clearTimeout(dragTimerRef.current);
      dragTimerRef.current = null;
    }
    
    // Re-enable scrolling
    document.body.style.overflow = '';
    
    if (!isDraggingTouch.current || draggedMeasure === null) {
      isDraggingTouch.current = false;
      touchDragIndexRef.current = null;
      return;
    }
    
    if (dragOverMeasure !== null && dragOverMeasure !== draggedMeasure) {
      setMeasures(prev => {
        const newMeasures = [...prev];
        const [removed] = newMeasures.splice(draggedMeasure, 1);
        newMeasures.splice(dragOverMeasure, 0, removed);
        return newMeasures;
      });
      
      // Update selected measure if needed
      setSelectedMeasure(prev => {
        if (prev === draggedMeasure) {
          return dragOverMeasure;
        } else if (draggedMeasure < prev && dragOverMeasure >= prev) {
          return prev - 1;
        } else if (draggedMeasure > prev && dragOverMeasure <= prev) {
          return prev + 1;
        }
        return prev;
      });
    }
    
    isDraggingTouch.current = false;
    touchDragIndexRef.current = null;
    setDraggedMeasure(null);
    setDragOverMeasure(null);
  }, [draggedMeasure, dragOverMeasure]);
  
  // Setup touch event listeners with passive: false
  useEffect(() => {
    const handleGlobalTouchMove = (e: TouchEvent) => {
      handleTouchMoveGlobal(e);
    };
    
    const handleGlobalTouchEnd = () => {
      handleTouchEndGlobal();
    };
    
    // Add global listeners for move and end
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    document.addEventListener('touchend', handleGlobalTouchEnd);
    document.addEventListener('touchcancel', handleGlobalTouchEnd);
    
    return () => {
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
      document.removeEventListener('touchcancel', handleGlobalTouchEnd);
    };
  }, [handleTouchMoveGlobal, handleTouchEndGlobal]);
  
  // Setup touch start listeners on drag handles
  useEffect(() => {
    const handles = dragHandleRefs.current;
    const listeners: Array<{ el: HTMLDivElement; handler: (e: TouchEvent) => void }> = [];
    
    handles.forEach((el, index) => {
      if (el) {
        const handler = handleTouchStartForIndex(index);
        el.addEventListener('touchstart', handler, { passive: true });
        listeners.push({ el, handler });
      }
    });
    
    return () => {
      listeners.forEach(({ el, handler }) => {
        el.removeEventListener('touchstart', handler);
      });
    };
  }, [measures.length, handleTouchStartForIndex]);
  
  // Beat editing
  const updateBeat = (measureIndex: number, beatIndex: number, data: BeatData) => {
    const newMeasures = [...measures];
    newMeasures[measureIndex] = [...newMeasures[measureIndex]];
    newMeasures[measureIndex][beatIndex] = data;
    setMeasures(newMeasures);
  };
  
  // Get structured beat items (sub-beats)
  const getBeatItems = (beat: BeatData): BeatItem[] => {
    if (beat === null) return [];
    if (Array.isArray(beat)) return beat as BeatItem[];
    return [beat as BeatItem];
  };
  
  // Add a note to a specific sub-beat group, or create a new sub-beat
  const addNoteToBeat = (measureIndex: number, beatIndex: number, track: string, direction: SlashDirection = 'any') => {
    const currentBeat = measures[measureIndex][beatIndex];
    const newNote: BlockNote = { track, direction, color: getTrackType(track) };
    
    if (currentBeat === null) {
      // Empty beat - add single note
      updateBeat(measureIndex, beatIndex, newNote);
      return;
    }
    
    if (selectedSubBeat === null) {
      // Add as new sub-beat (single note)
      if (Array.isArray(currentBeat)) {
        updateBeat(measureIndex, beatIndex, [...currentBeat, newNote]);
      } else {
        updateBeat(measureIndex, beatIndex, [currentBeat as BeatItem, newNote]);
      }
    } else {
      // Add to existing sub-beat group
      const items = getBeatItems(currentBeat);
      const newItems = [...items];
      const targetItem = newItems[selectedSubBeat];
      
      if (isNoteGroup(targetItem)) {
        // Add to existing group
        newItems[selectedSubBeat] = { notes: [...targetItem.notes, newNote] };
      } else {
        // Convert single note to group
        newItems[selectedSubBeat] = { notes: [targetItem as SingleNote, newNote] };
      }
      
      updateBeat(measureIndex, beatIndex, newItems.length === 1 ? newItems[0] : newItems);
    }
  };
  
  // Add a new empty group (NoteGroup) to the beat
  const addGroupToBeat = (measureIndex: number, beatIndex: number) => {
    const currentBeat = measures[measureIndex][beatIndex];
    const emptyGroup: NoteGroup = { notes: [] };
    
    if (currentBeat === null) {
      updateBeat(measureIndex, beatIndex, emptyGroup);
      setSelectedSubBeat(0);
    } else if (Array.isArray(currentBeat)) {
      updateBeat(measureIndex, beatIndex, [...currentBeat, emptyGroup]);
      setSelectedSubBeat(currentBeat.length);
    } else {
      updateBeat(measureIndex, beatIndex, [currentBeat as BeatItem, emptyGroup]);
      setSelectedSubBeat(1);
    }
  };
  
  // Remove a sub-beat item
  const removeSubBeat = (measureIndex: number, beatIndex: number, subBeatIndex: number) => {
    const currentBeat = measures[measureIndex][beatIndex];
    if (!Array.isArray(currentBeat)) {
      updateBeat(measureIndex, beatIndex, null);
      setSelectedSubBeat(null);
      return;
    }
    
    const newItems = currentBeat.filter((_, i) => i !== subBeatIndex);
    if (newItems.length === 0) {
      updateBeat(measureIndex, beatIndex, null);
    } else if (newItems.length === 1) {
      updateBeat(measureIndex, beatIndex, newItems[0]);
    } else {
      updateBeat(measureIndex, beatIndex, newItems);
    }
    setSelectedSubBeat(null);
  };
  
  // Remove a note from a specific sub-beat
  const removeNoteFromBeat = (measureIndex: number, beatIndex: number, subBeatIndex: number, noteIndex: number) => {
    const currentBeat = measures[measureIndex][beatIndex];
    const items = getBeatItems(currentBeat);
    const targetItem = items[subBeatIndex];
    
    if (isNoteGroup(targetItem)) {
      const newNotes = targetItem.notes.filter((_, i) => i !== noteIndex);
      if (newNotes.length === 0) {
        removeSubBeat(measureIndex, beatIndex, subBeatIndex);
      } else {
        const newItems = [...items];
        newItems[subBeatIndex] = { notes: newNotes };
        updateBeat(measureIndex, beatIndex, newItems.length === 1 ? newItems[0] : newItems);
      }
    } else {
      // Single note item
      removeSubBeat(measureIndex, beatIndex, subBeatIndex);
    }
  };
  
  const updateNoteDirection = (measureIndex: number, beatIndex: number, subBeatIndex: number, noteIndex: number, direction: SlashDirection) => {
    const currentBeat = measures[measureIndex][beatIndex];
    const items = getBeatItems(currentBeat);
    const targetItem = items[subBeatIndex];
    
    const updateNote = (note: string | BlockNote): BlockNote => {
      if (typeof note === 'string') {
        return { track: note, direction, color: getTrackType(note) };
      }
      return { ...note, direction };
    };
    
    if (isNoteGroup(targetItem)) {
      const newNotes = [...targetItem.notes];
      newNotes[noteIndex] = updateNote(newNotes[noteIndex]);
      const newItems = [...items];
      newItems[subBeatIndex] = { notes: newNotes };
      updateBeat(measureIndex, beatIndex, newItems.length === 1 ? newItems[0] : newItems);
    } else {
      // Single note
      const newItems = [...items];
      newItems[subBeatIndex] = updateNote(targetItem as SingleNote);
      updateBeat(measureIndex, beatIndex, newItems.length === 1 ? newItems[0] : newItems);
    }
  };
  
  // Get notes from beat data (flattens all notes from all groups/items)
  const getNotesFromBeat = (beat: BeatData): (string | BlockNote)[] => {
    if (beat === null) return [];
    if (Array.isArray(beat)) {
      // Array of items - flatten all notes from each item
      const notes: (string | BlockNote)[] = [];
      for (const item of beat) {
        if (isNoteGroup(item as BeatItem)) {
          notes.push(...(item as NoteGroup).notes);
        } else {
          notes.push(item as string | BlockNote);
        }
      }
      return notes;
    }
    if (isNoteGroup(beat)) {
      // Single NoteGroup - return all notes
      return beat.notes;
    }
    // Single note
    return [beat];
  };
  
  // Generate unique ID
  const generateId = () => {
    return title.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36);
  };
  
  // Get the ID to use for saving/exporting
  const getSaveId = () => {
    return beatmapId || generateId();
  };
  
  // Export beatmap
  const handleExport = () => {
    const rawBeatmap: RawBeatmap = {
      id: getSaveId(),
      title,
      artist,
      bpm,
      difficulty,
      difficultyRating,
      youtubeId: youtubeId || undefined,
      startDelay,
      data: measures,
    };
    
    const beatmap = processBeatmap(rawBeatmap);
    beatmapStorage.exportToFile(beatmap);
  };
  
  // Save to storage
  const handleSave = async () => {
    const rawBeatmap: RawBeatmap = {
      id: getSaveId(),
      title,
      artist,
      bpm,
      difficulty,
      difficultyRating,
      youtubeId: youtubeId || undefined,
      startDelay,
      data: measures,
    };
    
    const beatmap = processBeatmap(rawBeatmap);
    await beatmapStorage.save(beatmap);
    alert(`Beatmap saved${isBuiltIn ? ' as a new custom beatmap' : ''}!`);
  };
  
  // Import beatmap
  const handleImport = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as RawBeatmap;
      
      setTitle(raw.title || 'Imported Beatmap');
      setArtist(raw.artist || 'Unknown');
      setBpm(raw.bpm || 120);
      setDifficulty(raw.difficulty || 'normal');
      setDifficultyRating(raw.difficultyRating || 5);
      setYoutubeId(raw.youtubeId || '');
      setStartDelay(raw.startDelay || 2000);
      setMeasures(raw.data || [[null, null, null, null]]);
      setSelectedMeasure(0);
      setSelectedBeat(0);
    } catch (err) {
      alert('Failed to import beatmap: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Get global beat index
  const getGlobalBeatIndex = (measureIndex: number, beatIndex: number): number => {
    let index = 0;
    for (let i = 0; i < measureIndex; i++) {
      index += measures[i].length;
    }
    return index + beatIndex;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-b from-gray-900 via-black to-gray-900 text-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4 border-b border-gray-700 bg-black/50">
        <button
          onClick={onBack}
          className="flex items-center gap-1 md:gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="hidden sm:inline">Back</span>
        </button>
        
        <div className="flex items-center gap-2 md:gap-3">
          <h1 className="text-base md:text-xl font-bold text-cyan-400">
            <span className="hidden sm:inline">Beatmap Editor</span>
            <span className="sm:hidden">Editor</span>
          </h1>
          {isBuiltIn && (
            <span className="px-1.5 md:px-2 py-0.5 md:py-1 bg-yellow-500/20 border border-yellow-500 rounded text-yellow-300 text-[10px] md:text-xs font-mono">
              Copy
            </span>
          )}
        </div>
        
        {/* Desktop buttons */}
        <div className="hidden md:flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={handleImport}
            className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            <Upload size={16} />
            Import
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            <Download size={16} />
            Export
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 rounded transition-colors"
          >
            <Save size={16} />
            Save
          </button>
        </div>
        
        {/* Mobile menu button */}
        <div className="flex md:hidden gap-2">
          <button
            onClick={handleSave}
            className="p-2 bg-cyan-600 hover:bg-cyan-500 rounded transition-colors"
          >
            <Save size={18} />
          </button>
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            {showMobileMenu ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      
      {/* Mobile Menu Dropdown */}
      {showMobileMenu && (
        <div className="md:hidden absolute top-14 right-3 z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl overflow-hidden">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => { handleImport(); setShowMobileMenu(false); }}
            className="flex items-center gap-2 w-full px-4 py-3 hover:bg-gray-700 transition-colors text-left"
          >
            <Upload size={16} />
            Import Beatmap
          </button>
          <button
            onClick={() => { handleExport(); setShowMobileMenu(false); }}
            className="flex items-center gap-2 w-full px-4 py-3 hover:bg-gray-700 transition-colors text-left border-t border-gray-700"
          >
            <Download size={16} />
            Export Beatmap
          </button>
        </div>
      )}
      
      {/* Mobile Tab Bar */}
      <div className="md:hidden flex border-b border-gray-700 bg-gray-900">
        <button
          onClick={() => setMobilePanel('metadata')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 transition-colors ${
            mobilePanel === 'metadata' ? 'bg-cyan-600/20 text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400'
          }`}
        >
          <Settings size={16} />
          <span className="text-sm">Setup</span>
        </button>
        <button
          onClick={() => setMobilePanel('timeline')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 transition-colors ${
            mobilePanel === 'timeline' ? 'bg-cyan-600/20 text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400'
          }`}
        >
          <List size={16} />
          <span className="text-sm">Timeline</span>
        </button>
        <button
          onClick={() => setMobilePanel('beatEditor')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 transition-colors ${
            mobilePanel === 'beatEditor' ? 'bg-cyan-600/20 text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400'
          }`}
        >
          <Edit3 size={16} />
          <span className="text-sm">Beat</span>
        </button>
      </div>
      
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden pb-16 md:pb-0">
        {/* Left Panel - Metadata & YouTube */}
        <div className={`
          ${mobilePanel === 'metadata' ? 'flex' : 'hidden'} md:flex
          w-full md:w-80 border-r-0 md:border-r border-gray-700 flex-col bg-gray-900/50
          overflow-y-auto
        `}>
          {/* Collapsible Metadata Section */}
          <div className="border-b border-gray-700">
            <button
              onClick={() => setShowMetadata(!showMetadata)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors"
            >
              <span className="font-semibold">Metadata</span>
              {showMetadata ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            
            {showMetadata && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Artist</label>
                  <input
                    type="text"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">BPM</label>
                    <input
                      type="number"
                      value={bpm}
                      onChange={(e) => setBpm(Number(e.target.value) || 120)}
                      min={60}
                      max={300}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Start Delay (ms)</label>
                    <input
                      type="number"
                      value={startDelay}
                      onChange={(e) => setStartDelay(Number(e.target.value) || 0)}
                      min={0}
                      step={100}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Difficulty</label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as BeatmapDifficulty)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded focus:border-cyan-400 focus:outline-none"
                    >
                      {DIFFICULTIES.map(d => (
                        <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Rating (1-10)</label>
                    <input
                      type="number"
                      value={difficultyRating}
                      onChange={(e) => setDifficultyRating(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                      min={1}
                      max={10}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* YouTube Section */}
          <div className="flex-1 flex flex-col p-4">
            <div className="mb-3">
              <label className="block text-xs text-gray-400 mb-1">YouTube Video ID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={youtubeId}
                  onChange={(e) => setYoutubeId(e.target.value)}
                  placeholder="e.g., dQw4w9WgXcQ"
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded focus:border-cyan-400 focus:outline-none font-mono text-sm"
                />
                <button
                  onClick={muteYouTube}
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              </div>
            </div>
            
            {youtubeId && (
              <div className="relative aspect-video bg-black rounded overflow-hidden mb-3">
                <iframe
                  ref={youtubeRef}
                  src={`https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&controls=0&modestbranding=1`}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
                  allowFullScreen
                />
              </div>
            )}
            
            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-2 py-3">
              <button
                onClick={handleSeekToStart}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                <SkipBack size={16} />
              </button>
              <button
                onClick={handlePlay}
                className="p-3 bg-cyan-600 hover:bg-cyan-500 rounded-full transition-colors"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <button
                onClick={() => handleSeekToBeat(Math.min(currentPlayBeat + 4, totalBeats - 1))}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                <SkipForward size={16} />
              </button>
            </div>
            
            <div className="text-center text-sm text-gray-400">
              Beat {currentPlayBeat + 1} / {totalBeats}
            </div>
          </div>
        </div>
        
        {/* Center Panel - Timeline */}
        <div className={`
          ${mobilePanel === 'timeline' ? 'flex' : 'hidden'} md:flex
          flex-1 flex-col overflow-hidden
        `}>
          {/* Measure List */}
          <div ref={measureListRef} className="flex-1 overflow-y-auto p-2 md:p-4">
            <div className="space-y-2">
              {measures.map((measure, measureIndex) => (
                <div
                  key={measureIndex}
                  ref={(el) => { measureRefs.current[measureIndex] = el; }}
                  draggable
                  onDragStart={(e) => handleDragStart(e, measureIndex)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, measureIndex)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, measureIndex)}
                  className={`border rounded-lg p-3 transition-all ${
                    selectedMeasure === measureIndex 
                      ? 'border-cyan-400 bg-cyan-900/20' 
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
                  } ${
                    dragOverMeasure === measureIndex && draggedMeasure !== measureIndex
                      ? 'border-yellow-400 border-2 bg-yellow-900/20'
                      : ''
                  } ${
                    draggedMeasure === measureIndex ? 'opacity-50' : ''
                  }`}
                  onClick={() => setSelectedMeasure(measureIndex)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div 
                        ref={(el) => { dragHandleRefs.current[measureIndex] = el; }}
                        className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 transition-colors touch-none select-none p-1"
                        title="Drag to reorder"
                      >
                        <GripVertical size={16} />
                      </div>
                      <span className="text-sm font-semibold text-gray-400">
                        Measure {measureIndex + 1}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); duplicateMeasure(measureIndex); }}
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                        title="Duplicate"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeMeasure(measureIndex); }}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                        title="Delete"
                        disabled={measures.length <= 1}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Beat Grid */}
                  <div className="grid grid-cols-4 gap-2">
                    {measure.map((beat, beatIndex) => {
                      const globalBeat = getGlobalBeatIndex(measureIndex, beatIndex);
                      const isCurrentPlay = globalBeat === currentPlayBeat;
                      const isSelected = selectedMeasure === measureIndex && selectedBeat === beatIndex;
                      const notes = getNotesFromBeat(beat);
                      
                      return (
                        <div
                          key={beatIndex}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMeasure(measureIndex);
                            setSelectedBeat(beatIndex);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            // Start playback from this beat
                            handleSeekToBeat(globalBeat);
                            if (!isPlaying) {
                              handlePlay();
                            }
                          }}
                          className={`
                            relative p-2 rounded border-2 min-h-[60px] cursor-pointer transition-all
                            ${isSelected ? 'border-cyan-400 bg-cyan-900/30' : 'border-gray-600 bg-gray-800/50'}
                            ${isCurrentPlay ? 'ring-2 ring-yellow-400' : ''}
                            hover:border-gray-400
                          `}
                          title="Click to select, double-click to play from here"
                        >
                          <div className="text-xs text-gray-500 mb-1">Beat {beatIndex + 1}</div>
                          
                          {notes.length === 0 ? (
                            <div className="text-gray-600 text-xs italic">Empty</div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {notes.map((note, noteIndex) => {
                                const track = typeof note === 'string' ? note : note.track;
                                const direction = typeof note === 'string' ? 'any' : (note.direction || 'any');
                                const isLeft = track.startsWith('L');
                                const isRight = track.startsWith('R');
                                
                                return (
                                  <span
                                    key={noteIndex}
                                    className={`
                                      px-1.5 py-0.5 rounded text-xs font-mono
                                      ${isLeft ? 'bg-cyan-600/50 text-cyan-200' : ''}
                                      ${isRight ? 'bg-pink-600/50 text-pink-200' : ''}
                                      ${!isLeft && !isRight ? 'bg-purple-600/50 text-purple-200' : ''}
                                    `}
                                  >
                                    {track} {DIRECTION_ARROWS[direction]}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Add Measure Button */}
            <button
              onClick={addMeasure}
              className="w-full mt-4 py-3 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Add Measure
            </button>
          </div>
        </div>
        
        {/* Right Panel - Beat Editor */}
        <div className={`
          ${mobilePanel === 'beatEditor' ? 'flex' : 'hidden'} md:flex
          w-full md:w-80 border-l-0 md:border-l border-gray-700 bg-gray-900/50 flex-col
        `}>
          <div className="px-4 py-3 border-b border-gray-700">
            <h3 className="font-semibold">
              Edit Beat: M{selectedMeasure + 1} B{selectedBeat + 1}
            </h3>
          </div>
          
          <div className="flex-1 flex flex-col overflow-hidden p-4">
            {/* Add Note Section - Fixed at top */}
            <div className="flex-shrink-0 mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm text-gray-400">Add Note</h4>
                <span className="text-xs text-gray-500">
                  {selectedSubBeat !== null 
                    ? `→ Group #${selectedSubBeat + 1}` 
                    : '→ New sub-beat'}
                </span>
              </div>
              
              {/* Track Grid */}
              <div className="bg-gray-800 rounded-lg p-3 mb-3">
                <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(4, 1fr)' }}>
                  <TrackButton track="L1" onClick={() => addNoteToBeat(selectedMeasure, selectedBeat, 'L1')} />
                  <TrackButton track="T1" onClick={() => addNoteToBeat(selectedMeasure, selectedBeat, 'T1')} />
                  <TrackButton track="T2" onClick={() => addNoteToBeat(selectedMeasure, selectedBeat, 'T2')} />
                  <TrackButton track="R1" onClick={() => addNoteToBeat(selectedMeasure, selectedBeat, 'R1')} />
                  
                  <TrackButton track="L2" onClick={() => addNoteToBeat(selectedMeasure, selectedBeat, 'L2')} />
                  <div />
                  <div />
                  <TrackButton track="R2" onClick={() => addNoteToBeat(selectedMeasure, selectedBeat, 'R2')} />
                  
                  <TrackButton track="L3" onClick={() => addNoteToBeat(selectedMeasure, selectedBeat, 'L3')} />
                  <div />
                  <div />
                  <TrackButton track="R3" onClick={() => addNoteToBeat(selectedMeasure, selectedBeat, 'R3')} />
                  
                  <TrackButton track="L4" onClick={() => addNoteToBeat(selectedMeasure, selectedBeat, 'L4')} />
                  <TrackButton track="B1" onClick={() => addNoteToBeat(selectedMeasure, selectedBeat, 'B1')} />
                  <TrackButton track="B2" onClick={() => addNoteToBeat(selectedMeasure, selectedBeat, 'B2')} />
                  <TrackButton track="R4" onClick={() => addNoteToBeat(selectedMeasure, selectedBeat, 'R4')} />
                </div>
              </div>
              
              {/* Add Group Button */}
              <button
                onClick={() => addGroupToBeat(selectedMeasure, selectedBeat)}
                className="w-full py-2 mb-2 text-yellow-400 border border-yellow-400/50 rounded hover:bg-yellow-400/10 transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Plus size={14} />
                Add New Group (Simultaneous Notes)
              </button>
              
              {/* Deselect Group */}
              {selectedSubBeat !== null && (
                <button
                  onClick={() => setSelectedSubBeat(null)}
                  className="w-full py-2 mb-2 text-gray-400 border border-gray-600 rounded hover:bg-gray-700 transition-colors text-sm"
                >
                  Deselect Group (Add as new sub-beat)
                </button>
              )}
              
              {/* Clear Beat */}
              <button
                onClick={() => { updateBeat(selectedMeasure, selectedBeat, null); setSelectedSubBeat(null); }}
                className="w-full py-2 text-red-400 border border-red-400/50 rounded hover:bg-red-400/10 transition-colors text-sm"
              >
                Clear Beat
              </button>
            </div>
            
            {/* Current Beat Structure - Scrollable */}
            <div className="flex-1 min-h-0 flex flex-col">
              <h4 className="text-sm text-gray-400 mb-2 flex-shrink-0">Beat Structure</h4>
              <div className="flex-1 overflow-y-auto">
              {(() => {
                const currentBeat = measures[selectedMeasure]?.[selectedBeat];
                const items = getBeatItems(currentBeat);
                
                if (items.length === 0) {
                  return <div className="text-gray-600 text-sm italic">Empty beat</div>;
                }
                
                return (
                  <div className="space-y-2">
                    {items.map((item, subBeatIndex) => {
                      const isGroup = isNoteGroup(item);
                      const notes = isGroup ? (item as NoteGroup).notes : [item as SingleNote];
                      const isSelected = selectedSubBeat === subBeatIndex;
                      
                      return (
                        <div 
                          key={subBeatIndex}
                          className={`border rounded-lg p-2 transition-colors cursor-pointer ${
                            isSelected 
                              ? 'border-cyan-400 bg-cyan-900/20' 
                              : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
                          }`}
                          onClick={() => setSelectedSubBeat(isSelected ? null : subBeatIndex)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-500">
                              {items.length > 1 ? `1/${items.length} beat #${subBeatIndex + 1}` : 'Full beat'}
                              {isGroup && <span className="ml-1 text-yellow-400">(Group)</span>}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeSubBeat(selectedMeasure, selectedBeat, subBeatIndex); }}
                              className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          
                          <div className="space-y-1">
                            {notes.map((note, noteIndex) => {
                              const track = typeof note === 'string' ? note : (note as BlockNote).track;
                              const direction = typeof note === 'string' ? 'any' : ((note as BlockNote).direction || 'any');
                              const isLeft = track.startsWith('L');
                              const isRight = track.startsWith('R');
                              
                              return (
                                <div key={noteIndex} className="flex items-center gap-2 p-1.5 bg-gray-700/50 rounded">
                                  <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                                    isLeft ? 'bg-cyan-600/50 text-cyan-200' : 
                                    isRight ? 'bg-pink-600/50 text-pink-200' : 
                                    'bg-purple-600/50 text-purple-200'
                                  }`}>
                                    {track}
                                  </span>
                                  <select
                                    value={direction}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => updateNoteDirection(selectedMeasure, selectedBeat, subBeatIndex, noteIndex, e.target.value as SlashDirection)}
                                    className="px-1 py-0.5 bg-gray-600 border border-gray-500 rounded text-xs flex-1"
                                  >
                                    {DIRECTIONS.map(d => (
                                      <option key={d} value={d}>{DIRECTION_ARROWS[d]} {d}</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); removeNoteFromBeat(selectedMeasure, selectedBeat, subBeatIndex, noteIndex); }}
                                    className="p-0.5 text-red-400 hover:text-red-300"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 3D Preview Window - Fixed position on both mobile and desktop, draggable */}
      <div 
        ref={previewContainerRef}
        className="fixed z-[101] select-none"
        style={{ 
          bottom: `${80 + previewPosition.y}px`,
          right: `${8 + previewPosition.x}px`
        }}
      >
        <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-2xl">
          {/* Preview Header - Drag handle */}
          <div 
            className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700 cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => handlePreviewDragStart(e.clientX, e.clientY)}
            onTouchStart={(e) => handlePreviewDragStart(e.touches[0].clientX, e.touches[0].clientY)}
          >
            <span className="text-xs text-gray-400 font-mono">3D Preview (drag to move)</span>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          
          {/* Preview Canvas - Smaller on mobile */}
          {showPreview && (
            <canvas
              ref={previewCanvasRef}
              className="w-[200px] h-[125px] md:w-[320px] md:h-[200px]"
              style={{ width: 320, height: 200 }}
            />
          )}
          
          {!showPreview && (
            <div className="w-[200px] md:w-[320px] h-[40px] md:h-[50px] flex items-center justify-center text-gray-500 text-xs">
              Preview Hidden
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile Playback Controls - Fixed bottom bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[102] bg-gray-900 border-t border-gray-700 px-4 py-3 flex items-center justify-center gap-4">
        <button
          onClick={handleSeekToStart}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        >
          <SkipBack size={18} />
        </button>
        <button
          onClick={handlePlay}
          className="p-4 bg-cyan-600 hover:bg-cyan-500 rounded-full transition-colors"
        >
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </button>
        <button
          onClick={() => handleSeekToBeat(Math.min(currentPlayBeat + 4, totalBeats - 1))}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        >
          <SkipForward size={18} />
        </button>
        <span className="text-sm text-gray-400 ml-2">
          {currentPlayBeat + 1}/{totalBeats}
        </span>
      </div>
      
      {/* Footer Status Bar - Desktop only */}
      <div className="hidden md:flex px-6 py-2 border-t border-gray-700 bg-black/50 items-center justify-between text-sm text-gray-400">
        <div className="flex items-center gap-4">
          <span>{measures.length} measures</span>
          <span>{totalBeats} beats</span>
          <span className={`px-2 py-0.5 rounded ${DIFFICULTY_COLORS[difficulty]}`}>
            {difficulty}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>{bpm} BPM</span>
          <span>Duration: ~{Math.floor(totalBeats * beatInterval / 60000)}:{String(Math.floor((totalBeats * beatInterval / 1000) % 60)).padStart(2, '0')}</span>
        </div>
      </div>
    </div>
  );
};

// Track Button Component
const TrackButton: React.FC<{ track: string; onClick: () => void }> = ({ track, onClick }) => {
  const isLeft = track.startsWith('L');
  const isRight = track.startsWith('R');
  
  return (
    <button
      onClick={onClick}
      className={`
        p-3 md:p-2 rounded text-sm md:text-xs font-mono font-bold transition-colors active:scale-95
        ${isLeft ? 'bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/50' : ''}
        ${isRight ? 'bg-pink-600/30 hover:bg-pink-600/50 text-pink-300 border border-pink-500/50' : ''}
        ${!isLeft && !isRight ? 'bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/50' : ''}
      `}
    >
      {track}
    </button>
  );
};

export default BeatmapEditor;
