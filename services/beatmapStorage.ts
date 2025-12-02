/**
 * Beatmap Storage Service
 * Uses IndexedDB to store custom beatmaps locally
 */

import { Beatmap, BeatData } from '../types';

const DB_NAME = 'NeonPulse';
const DB_VERSION = 1;
const STORE_NAME = 'beatmaps';

// Raw beatmap data from JSON (without computed fields)
export interface RawBeatmap {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  difficulty: 'easy' | 'normal' | 'hard' | 'expert';
  difficultyRating: number;
  youtubeId?: string;
  data: BeatData[][];
}

// Helper to count notes in a beatmap
const countNotes = (data: BeatData[][]): number => {
  let count = 0;
  for (const measure of data) {
    for (const beat of measure) {
      if (beat === null) continue;
      if (Array.isArray(beat)) {
        count += beat.length;
      } else {
        count += 1;
      }
    }
  }
  return count;
};

// Calculate duration based on BPM and measures
const calculateDuration = (measures: number, bpm: number): string => {
  const beatsPerMeasure = 4;
  const totalBeats = measures * beatsPerMeasure;
  const totalSeconds = (totalBeats / bpm) * 60;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Process raw beatmap JSON into full Beatmap type
export const processBeatmap = (raw: RawBeatmap): Beatmap => ({
  ...raw,
  duration: calculateDuration(raw.data.length, raw.bpm),
  noteCount: countNotes(raw.data),
});

class BeatmapStorageService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create beatmaps store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('title', 'title', { unique: false });
          store.createIndex('artist', 'artist', { unique: false });
          store.createIndex('difficulty', 'difficulty', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Get all custom beatmaps from IndexedDB
   */
  async getAll(): Promise<Beatmap[]> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const rawBeatmaps: RawBeatmap[] = request.result;
        const beatmaps = rawBeatmaps.map(processBeatmap);
        resolve(beatmaps);
      };

      request.onerror = () => {
        console.error('Failed to get beatmaps:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get a single beatmap by ID
   */
  async get(id: string): Promise<Beatmap | null> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        if (request.result) {
          resolve(processBeatmap(request.result));
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('Failed to get beatmap:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Save a beatmap to IndexedDB
   */
  async save(beatmap: RawBeatmap): Promise<void> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(beatmap);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to save beatmap:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete a beatmap from IndexedDB
   */
  async delete(id: string): Promise<void> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to delete beatmap:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Check if a beatmap exists
   */
  async exists(id: string): Promise<boolean> {
    const beatmap = await this.get(id);
    return beatmap !== null;
  }

  /**
   * Import beatmap from JSON file
   */
  async importFromFile(file: File): Promise<Beatmap> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const rawBeatmap: RawBeatmap = JSON.parse(content);
          
          // Validate required fields
          if (!rawBeatmap.id || !rawBeatmap.title || !rawBeatmap.bpm || !rawBeatmap.data) {
            throw new Error('Invalid beatmap format: missing required fields');
          }
          
          // Validate data structure
          if (!Array.isArray(rawBeatmap.data)) {
            throw new Error('Invalid beatmap format: data must be an array');
          }
          
          // Save to IndexedDB
          await this.save(rawBeatmap);
          
          // Return processed beatmap
          resolve(processBeatmap(rawBeatmap));
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsText(file);
    });
  }

  /**
   * Export beatmap to JSON file (triggers download)
   */
  exportToFile(beatmap: Beatmap): void {
    // Create raw beatmap without computed fields
    const rawBeatmap: RawBeatmap = {
      id: beatmap.id,
      title: beatmap.title,
      artist: beatmap.artist,
      bpm: beatmap.bpm,
      difficulty: beatmap.difficulty,
      difficultyRating: beatmap.difficultyRating,
      youtubeId: beatmap.youtubeId,
      data: beatmap.data,
    };
    
    const json = JSON.stringify(rawBeatmap, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${beatmap.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Clear all custom beatmaps
   */
  async clearAll(): Promise<void> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to clear beatmaps:', request.error);
        reject(request.error);
      };
    });
  }
}

// Export singleton instance
export const beatmapStorage = new BeatmapStorageService();
