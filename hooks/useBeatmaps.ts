/**
 * useBeatmaps Hook
 * Manages beatmap loading, storage, and synchronization
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Beatmap } from '../types';
import { BEATMAPS } from '../constants';
import { beatmapStorage, RawBeatmap } from '../services/beatmapStorage';

interface UseBeatmapsResult {
  // All available beatmaps from IndexedDB
  beatmaps: Beatmap[];
  // Loading state
  isLoading: boolean;
  // Error state
  error: string | null;
  // Import beatmap from file
  importBeatmap: (file: File) => Promise<Beatmap>;
  // Export beatmap to file
  exportBeatmap: (beatmap: Beatmap) => void;
  // Delete a custom beatmap
  deleteBeatmap: (id: string) => Promise<void>;
  // Check if beatmap is built-in (cannot be deleted)
  isBuiltInBeatmap: (id: string) => boolean;
  // Refresh beatmaps from storage
  refresh: () => Promise<void>;
}

// Built-in beatmap IDs (static, defined once)
const BUILT_IN_IDS = new Set(BEATMAPS.map(b => b.id));

export const useBeatmaps = (): UseBeatmapsResult => {
  const [beatmaps, setBeatmaps] = useState<Beatmap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  // Initialize built-in beatmaps into IndexedDB (only once)
  const initBuiltInBeatmaps = useCallback(async () => {
    for (const beatmap of BEATMAPS) {
      const exists = await beatmapStorage.exists(beatmap.id);
      if (!exists) {
        const rawBeatmap: RawBeatmap = {
          id: beatmap.id,
          title: beatmap.title,
          artist: beatmap.artist,
          bpm: beatmap.bpm,
          difficulty: beatmap.difficulty,
          difficultyRating: beatmap.difficultyRating,
          youtubeId: beatmap.youtubeId,
          startDelay: beatmap.startDelay,
          data: beatmap.data,
        };
        await beatmapStorage.save(rawBeatmap);
      }
    }
  }, []);

  // Load all beatmaps from IndexedDB
  const loadBeatmaps = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Initialize built-in beatmaps on first load
      if (!initialized.current) {
        await initBuiltInBeatmaps();
        initialized.current = true;
      }
      
      const stored = await beatmapStorage.getAll();
      setBeatmaps(stored);
    } catch (err) {
      console.error('Failed to load beatmaps:', err);
      setError('Failed to load beatmaps');
    } finally {
      setIsLoading(false);
    }
  }, [initBuiltInBeatmaps]);

  // Initial load
  useEffect(() => {
    loadBeatmaps();
  }, [loadBeatmaps]);

  // Import beatmap from file
  const importBeatmap = useCallback(async (file: File): Promise<Beatmap> => {
    try {
      setError(null);
      const beatmap = await beatmapStorage.importFromFile(file);
      
      // Check if ID conflicts with built-in beatmap
      if (BUILT_IN_IDS.has(beatmap.id)) {
        // Generate a new unique ID
        const newId = `custom-${beatmap.id}-${Date.now()}`;
        const rawBeatmap: RawBeatmap = {
          id: newId,
          title: beatmap.title,
          artist: beatmap.artist,
          bpm: beatmap.bpm,
          difficulty: beatmap.difficulty,
          difficultyRating: beatmap.difficultyRating,
          youtubeId: beatmap.youtubeId,
          startDelay: beatmap.startDelay,
          data: beatmap.data,
        };
        
        // Delete the conflicting one and save with new ID
        await beatmapStorage.delete(beatmap.id);
        await beatmapStorage.save(rawBeatmap);
        
        const newBeatmap = { ...beatmap, id: newId };
        await loadBeatmaps();
        return newBeatmap;
      }
      
      await loadBeatmaps();
      return beatmap;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import beatmap';
      setError(message);
      throw err;
    }
  }, [loadBeatmaps]);

  // Export beatmap to file
  const exportBeatmap = useCallback((beatmap: Beatmap) => {
    beatmapStorage.exportToFile(beatmap);
  }, []);

  // Delete a custom beatmap (prevent deleting built-in)
  const deleteBeatmap = useCallback(async (id: string): Promise<void> => {
    // Prevent deleting built-in beatmaps
    if (BUILT_IN_IDS.has(id)) {
      throw new Error('Cannot delete built-in beatmap');
    }
    
    try {
      setError(null);
      await beatmapStorage.delete(id);
      await loadBeatmaps();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete beatmap';
      setError(message);
      throw err;
    }
  }, [loadBeatmaps]);

  // Check if beatmap is built-in
  const isBuiltInBeatmap = useCallback((id: string): boolean => {
    return BUILT_IN_IDS.has(id);
  }, []);

  return {
    beatmaps,
    isLoading,
    error,
    importBeatmap,
    exportBeatmap,
    deleteBeatmap,
    isBuiltInBeatmap,
    refresh: loadBeatmaps,
  };
};
