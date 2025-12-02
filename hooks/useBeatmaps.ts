/**
 * useBeatmaps Hook
 * Manages beatmap loading, storage, and synchronization
 */

import { useState, useEffect, useCallback } from 'react';
import { Beatmap } from '../types';
import { BEATMAPS } from '../constants';
import { beatmapStorage, RawBeatmap } from '../services/beatmapStorage';

interface UseBeatmapsResult {
  // All available beatmaps (built-in + custom)
  beatmaps: Beatmap[];
  // Custom beatmaps only
  customBeatmaps: Beatmap[];
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
  // Check if beatmap is custom (can be deleted)
  isCustomBeatmap: (id: string) => boolean;
  // Refresh beatmaps from storage
  refresh: () => Promise<void>;
}

export const useBeatmaps = (): UseBeatmapsResult => {
  const [customBeatmaps, setCustomBeatmaps] = useState<Beatmap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Built-in beatmap IDs for checking
  const builtInIds = new Set(BEATMAPS.map(b => b.id));

  // Load custom beatmaps from IndexedDB
  const loadCustomBeatmaps = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const stored = await beatmapStorage.getAll();
      setCustomBeatmaps(stored);
    } catch (err) {
      console.error('Failed to load custom beatmaps:', err);
      setError('Failed to load custom beatmaps');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadCustomBeatmaps();
  }, [loadCustomBeatmaps]);

  // Combine built-in and custom beatmaps
  const beatmaps = [...BEATMAPS, ...customBeatmaps];

  // Import beatmap from file
  const importBeatmap = useCallback(async (file: File): Promise<Beatmap> => {
    try {
      setError(null);
      const beatmap = await beatmapStorage.importFromFile(file);
      
      // Check if ID conflicts with built-in beatmap
      if (builtInIds.has(beatmap.id)) {
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
          data: beatmap.data,
        };
        
        // Delete the conflicting one and save with new ID
        await beatmapStorage.delete(beatmap.id);
        await beatmapStorage.save(rawBeatmap);
        
        const newBeatmap = { ...beatmap, id: newId };
        await loadCustomBeatmaps();
        return newBeatmap;
      }
      
      await loadCustomBeatmaps();
      return beatmap;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import beatmap';
      setError(message);
      throw err;
    }
  }, [loadCustomBeatmaps, builtInIds]);

  // Export beatmap to file
  const exportBeatmap = useCallback((beatmap: Beatmap) => {
    beatmapStorage.exportToFile(beatmap);
  }, []);

  // Delete a custom beatmap
  const deleteBeatmap = useCallback(async (id: string): Promise<void> => {
    // Prevent deleting built-in beatmaps
    if (builtInIds.has(id)) {
      throw new Error('Cannot delete built-in beatmap');
    }
    
    try {
      setError(null);
      await beatmapStorage.delete(id);
      await loadCustomBeatmaps();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete beatmap';
      setError(message);
      throw err;
    }
  }, [loadCustomBeatmaps, builtInIds]);

  // Check if beatmap is custom
  const isCustomBeatmap = useCallback((id: string): boolean => {
    return !builtInIds.has(id);
  }, [builtInIds]);

  return {
    beatmaps,
    customBeatmaps,
    isLoading,
    error,
    importBeatmap,
    exportBeatmap,
    deleteBeatmap,
    isCustomBeatmap,
    refresh: loadCustomBeatmaps,
  };
};
