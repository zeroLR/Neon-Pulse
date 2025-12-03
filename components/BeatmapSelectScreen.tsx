import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Music, Clock, Zap, Target, Upload, Download, Trash2, Loader2, Plus, Edit } from 'lucide-react';
import { Beatmap, BeatmapDifficulty } from '../types';
import { useBeatmaps } from '../hooks';

interface BeatmapSelectScreenProps {
  onSelect: (beatmap: Beatmap) => void;
  onBack: () => void;
  onOpenEditor?: (beatmap?: Beatmap) => void;
}

const DIFFICULTY_COLORS: Record<BeatmapDifficulty, string> = {
  easy: 'text-green-400 border-green-400',
  normal: 'text-blue-400 border-blue-400',
  hard: 'text-orange-400 border-orange-400',
  expert: 'text-red-400 border-red-400',
};

const DIFFICULTY_BG: Record<BeatmapDifficulty, string> = {
  easy: 'bg-green-400/20',
  normal: 'bg-blue-400/20',
  hard: 'bg-orange-400/20',
  expert: 'bg-red-400/20',
};

const BeatmapSelectScreen: React.FC<BeatmapSelectScreenProps> = ({ onSelect, onBack, onOpenEditor }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    beatmaps, 
    isLoading, 
    importBeatmap, 
    exportBeatmap, 
    deleteBeatmap, 
    isCustomBeatmap 
  } = useBeatmaps();

  const selectedBeatmap = beatmaps[selectedIndex] || beatmaps[0];

  const handlePrev = () => {
    setSelectedIndex((prev) => (prev - 1 + beatmaps.length) % beatmaps.length);
  };

  const handleNext = () => {
    setSelectedIndex((prev) => (prev + 1) % beatmaps.length);
  };

  const handleSelect = () => {
    if (selectedBeatmap) {
      onSelect(selectedBeatmap);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportError(null);

    try {
      await importBeatmap(file);
      // Select the newly imported beatmap (it will be at the end)
      setSelectedIndex(beatmaps.length); // Will point to new beatmap after refresh
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import beatmap');
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExport = () => {
    if (selectedBeatmap) {
      exportBeatmap(selectedBeatmap);
    }
  };

  const handleDelete = async () => {
    if (!selectedBeatmap || !isCustomBeatmap(selectedBeatmap.id)) return;
    
    if (confirm(`Delete "${selectedBeatmap.title}"?`)) {
      try {
        await deleteBeatmap(selectedBeatmap.id);
        // Adjust selected index if needed
        if (selectedIndex >= beatmaps.length - 1) {
          setSelectedIndex(Math.max(0, beatmaps.length - 2));
        }
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Failed to delete beatmap');
      }
    }
  };

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Enter') handleSelect();
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, beatmaps.length]);

  if (isLoading) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#00f3ff]" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 text-white backdrop-blur-sm">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header */}
      <div className="absolute top-8 left-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors font-mono text-sm uppercase tracking-wider"
        >
          <ChevronLeft size={20} /> Back to Menu
        </button>
      </div>

      {/* Import/Export/Create Buttons */}
      <div className="absolute top-8 right-8 flex gap-2">
        {onOpenEditor && (
          <button
            onClick={() => onOpenEditor()}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#00f3ff]/20 to-[#ff00ff]/20 border border-[#00f3ff] rounded-lg text-[#00f3ff] hover:text-white hover:border-white transition-colors font-mono text-sm"
          >
            <Plus size={16} />
            Create New
          </button>
        )}
        <button
          onClick={handleImportClick}
          disabled={isImporting}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-300 hover:text-white hover:border-[#00f3ff] transition-colors font-mono text-sm"
        >
          {isImporting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Upload size={16} />
          )}
          Import
        </button>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-300 hover:text-white hover:border-[#ff00ff] transition-colors font-mono text-sm"
        >
          <Download size={16} />
          Export
        </button>
      </div>

      {/* Error Message */}
      {importError && (
        <div className="absolute top-20 right-8 px-4 py-2 bg-red-900/50 border border-red-500 rounded-lg text-red-300 text-sm max-w-xs">
          {importError}
          <button 
            onClick={() => setImportError(null)}
            className="ml-2 text-red-400 hover:text-red-200"
          >
            ×
          </button>
        </div>
      )}

      <div className="text-center mb-8">
        <h1 className="text-4xl font-black italic tracking-tight mb-2">
          <span className="text-[#00f3ff]">SELECT</span>
          <span className="text-white mx-2">/</span>
          <span className="text-[#ff00ff]">BEATMAP</span>
        </h1>
        <p className="text-gray-500 font-mono text-sm uppercase tracking-widest">
          Choose your challenge
        </p>
      </div>

      {/* Beatmap Carousel */}
      <div className="flex items-center gap-8 mb-8">
        <button
          onClick={handlePrev}
          className="p-4 text-gray-500 hover:text-[#00f3ff] transition-colors hover:scale-110"
        >
          <ChevronLeft size={40} />
        </button>

        {/* Main Card */}
        {selectedBeatmap && (
          <div className="relative group">
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-[#00f3ff] to-[#ff00ff] rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-300"></div>
            
            <div className="relative w-[400px] bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
              {/* Badge & Action Buttons */}
              <div className="absolute top-4 left-4 flex gap-2 z-10">
                {isCustomBeatmap(selectedBeatmap.id) ? (
                  <span className="px-2 py-1 bg-purple-500/30 border border-purple-500 rounded text-purple-300 text-xs font-mono">
                    CUSTOM
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-gray-500/30 border border-gray-500 rounded text-gray-300 text-xs font-mono">
                    BUILT-IN
                  </span>
                )}
                {onOpenEditor && (
                  <button
                    onClick={() => onOpenEditor(selectedBeatmap)}
                    className="p-1 bg-cyan-500/30 border border-cyan-500 rounded text-cyan-300 hover:bg-cyan-500/50 transition-colors"
                    title="Edit beatmap (creates a copy for custom beatmaps)"
                  >
                    <Edit size={14} />
                  </button>
                )}
                {isCustomBeatmap(selectedBeatmap.id) && (
                  <button
                    onClick={handleDelete}
                    className="p-1 bg-red-500/30 border border-red-500 rounded text-red-300 hover:bg-red-500/50 transition-colors"
                    title="Delete beatmap"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* Difficulty Badge */}
              <div className={`absolute top-4 right-4 px-3 py-1 rounded-full border ${DIFFICULTY_COLORS[selectedBeatmap.difficulty]} ${DIFFICULTY_BG[selectedBeatmap.difficulty]} font-mono text-xs uppercase tracking-wider`}>
                {selectedBeatmap.difficulty}
              </div>

              {/* Album Art Placeholder */}
              <div className="h-48 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center border-b border-gray-700">
                <Music size={64} className="text-gray-600" />
              </div>

              {/* Info Section */}
              <div className="p-6 space-y-4">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">{selectedBeatmap.title}</h2>
                  <p className="text-gray-400 font-mono text-sm">{selectedBeatmap.artist}</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4 py-4 border-t border-b border-gray-700">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-[#00f3ff] mb-1">
                      <Zap size={16} />
                      <span className="font-mono text-lg">{selectedBeatmap.bpm}</span>
                    </div>
                    <span className="text-gray-500 text-xs uppercase tracking-wider">BPM</span>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-[#ff00ff] mb-1">
                      <Clock size={16} />
                      <span className="font-mono text-lg">{selectedBeatmap.duration}</span>
                    </div>
                    <span className="text-gray-500 text-xs uppercase tracking-wider">Duration</span>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-white mb-1">
                      <Target size={16} />
                      <span className="font-mono text-lg">{selectedBeatmap.noteCount}</span>
                    </div>
                    <span className="text-gray-500 text-xs uppercase tracking-wider">Notes</span>
                  </div>
                </div>

                {/* Difficulty Rating */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Difficulty</span>
                  <div className="flex gap-1">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-4 rounded-sm transition-colors ${
                          i < selectedBeatmap.difficultyRating
                            ? 'bg-gradient-to-t from-[#00f3ff] to-[#ff00ff]'
                            : 'bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleNext}
          className="p-4 text-gray-500 hover:text-[#ff00ff] transition-colors hover:scale-110"
        >
          <ChevronRight size={40} />
        </button>
      </div>

      {/* Pagination Dots */}
      <div className="flex gap-2 mb-8">
        {beatmaps.map((_, i) => (
          <button
            key={i}
            onClick={() => setSelectedIndex(i)}
            className={`w-3 h-3 rounded-full transition-all ${
              i === selectedIndex
                ? 'bg-gradient-to-r from-[#00f3ff] to-[#ff00ff] scale-125'
                : 'bg-gray-600 hover:bg-gray-500'
            }`}
          />
        ))}
      </div>

      {/* Play Button */}
      <button
        onClick={handleSelect}
        className="group relative inline-flex items-center justify-center px-12 py-4 font-bold text-black transition-all duration-200 bg-gradient-to-r from-[#00f3ff] to-[#ff00ff] font-mono uppercase tracking-widest hover:scale-105 hover:shadow-lg hover:shadow-[#00f3ff]/50"
      >
        <Play size={24} fill="currentColor" className="mr-2" />
        Start Game
      </button>

      {/* Keyboard Hints */}
      <div className="absolute bottom-8 flex gap-8 text-gray-600 font-mono text-xs">
        <span>← → Navigate</span>
        <span>Enter Select</span>
        <span>Esc Back</span>
      </div>
    </div>
  );
};

export default BeatmapSelectScreen;
