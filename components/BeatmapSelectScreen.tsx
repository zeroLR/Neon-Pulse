import React, { useState, useRef } from 'react';
import { ChevronLeft, Play, Music, Clock, Zap, Target, Upload, Download, Trash2, Loader2, Plus, Edit, Search, X, Filter } from 'lucide-react';
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

const DIFFICULTY_GLOW: Record<BeatmapDifficulty, string> = {
  easy: 'shadow-green-400/30',
  normal: 'shadow-blue-400/30',
  hard: 'shadow-orange-400/30',
  expert: 'shadow-red-400/30',
};

type FilterType = 'all' | 'built-in' | 'custom';

const BeatmapSelectScreen: React.FC<BeatmapSelectScreenProps> = ({ onSelect, onBack, onOpenEditor }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showFilters, setShowFilters] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    beatmaps, 
    isLoading, 
    importBeatmap, 
    exportBeatmap, 
    deleteBeatmap, 
    isBuiltInBeatmap 
  } = useBeatmaps();

  // Filter beatmaps based on search and filter type
  const filteredBeatmaps = beatmaps.filter(beatmap => {
    const matchesSearch = searchQuery === '' || 
      beatmap.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      beatmap.artist.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterType === 'all' ||
      (filterType === 'custom' && !isBuiltInBeatmap(beatmap.id)) ||
      (filterType === 'built-in' && isBuiltInBeatmap(beatmap.id));
    
    return matchesSearch && matchesFilter;
  });

  const selectedBeatmap = filteredBeatmaps[selectedIndex] || filteredBeatmaps[0];

  const handleSelect = (beatmap: Beatmap) => {
    onSelect(beatmap);
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
      setSelectedIndex(beatmaps.length);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import beatmap');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExport = (beatmap: Beatmap, e: React.MouseEvent) => {
    e.stopPropagation();
    exportBeatmap(beatmap);
  };

  const handleDelete = async (beatmap: Beatmap, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBuiltInBeatmap(beatmap.id)) return;
    
    if (confirm(`Delete "${beatmap.title}"?`)) {
      try {
        await deleteBeatmap(beatmap.id);
        if (selectedIndex >= filteredBeatmaps.length - 1) {
          setSelectedIndex(Math.max(0, filteredBeatmaps.length - 2));
        }
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Failed to delete beatmap');
      }
    }
  };

  const handleEdit = (beatmap: Beatmap, e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenEditor?.(beatmap);
  };

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(0, prev - 1));
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(filteredBeatmaps.length - 1, prev + 1));
      }
      if (e.key === 'Enter' && selectedBeatmap) {
        handleSelect(selectedBeatmap);
      }
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, filteredBeatmaps.length, selectedBeatmap]);

  if (isLoading) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#00f3ff]" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-black/95 text-white backdrop-blur-sm">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header */}
      <div className="flex-shrink-0 px-4 md:px-8 py-4 md:py-6 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-1 md:gap-2 text-gray-400 hover:text-white transition-colors font-mono text-xs md:text-sm uppercase tracking-wider"
          >
            <ChevronLeft size={20} /> 
            <span className="hidden sm:inline">Back to Menu</span>
            <span className="sm:hidden">Back</span>
          </button>
          
          <h1 className="text-xl md:text-3xl font-black italic tracking-tight">
            <span className="text-[#00f3ff]">SELECT</span>
            <span className="text-white mx-1 md:mx-2">/</span>
            <span className="text-[#ff00ff]">BEATMAP</span>
          </h1>
          
          {/* Desktop Action Buttons */}
          <div className="hidden md:flex gap-2">
            {onOpenEditor && (
              <button
                onClick={() => onOpenEditor()}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#00f3ff]/20 to-[#ff00ff]/20 border border-[#00f3ff] rounded-lg text-[#00f3ff] hover:text-white hover:border-white transition-colors font-mono text-sm"
              >
                <Plus size={16} />
                Create
              </button>
            )}
            <button
              onClick={handleImportClick}
              disabled={isImporting}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-300 hover:text-white hover:border-[#00f3ff] transition-colors font-mono text-sm"
            >
              {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Import
            </button>
          </div>
          
          {/* Mobile placeholder for layout balance */}
          <div className="md:hidden w-12"></div>
        </div>
        
        {/* Search and Filter Bar */}
        <div className="flex gap-2 md:gap-4">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSelectedIndex(0); }}
              placeholder="Search by title or artist..."
              className="w-full pl-10 pr-10 py-2.5 md:py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#00f3ff] transition-colors font-mono text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSelectedIndex(0); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          {/* Filter Button (Mobile) */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`md:hidden p-2.5 rounded-xl border transition-colors ${
              filterType !== 'all' ? 'bg-[#00f3ff]/20 border-[#00f3ff] text-[#00f3ff]' : 'bg-gray-900 border-gray-700 text-gray-400'
            }`}
          >
            <Filter size={20} />
          </button>
          
          {/* Filter Tabs (Desktop) */}
          <div className="hidden md:flex bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            {(['all', 'built-in', 'custom'] as FilterType[]).map((type) => (
              <button
                key={type}
                onClick={() => { setFilterType(type); setSelectedIndex(0); }}
                className={`px-4 py-2.5 font-mono text-sm capitalize transition-colors ${
                  filterType === type 
                    ? 'bg-gradient-to-r from-[#00f3ff]/30 to-[#ff00ff]/30 text-white' 
                    : 'text-gray-500 hover:text-white'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          
          {/* Mobile Action Buttons */}
          <div className="flex md:hidden gap-2">
            {onOpenEditor && (
              <button
                onClick={() => onOpenEditor()}
                className="p-2.5 bg-gradient-to-r from-[#00f3ff]/20 to-[#ff00ff]/20 border border-[#00f3ff] rounded-xl text-[#00f3ff]"
              >
                <Plus size={20} />
              </button>
            )}
            <button
              onClick={handleImportClick}
              disabled={isImporting}
              className="p-2.5 bg-gray-900 border border-gray-700 rounded-xl text-gray-400"
            >
              {isImporting ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
            </button>
          </div>
        </div>
        
        {/* Mobile Filter Dropdown */}
        {showFilters && (
          <div className="md:hidden flex gap-2 mt-3">
            {(['all', 'built-in', 'custom'] as FilterType[]).map((type) => (
              <button
                key={type}
                onClick={() => { setFilterType(type); setSelectedIndex(0); setShowFilters(false); }}
                className={`flex-1 px-3 py-2 rounded-lg font-mono text-xs capitalize transition-colors ${
                  filterType === type 
                    ? 'bg-gradient-to-r from-[#00f3ff]/30 to-[#ff00ff]/30 text-white border border-[#00f3ff]' 
                    : 'bg-gray-900 text-gray-500 border border-gray-700'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error Message */}
      {importError && (
        <div className="mx-4 md:mx-8 mt-4 px-4 py-3 bg-red-900/50 border border-red-500 rounded-xl text-red-300 text-sm flex items-center justify-between">
          <span>{importError}</span>
          <button onClick={() => setImportError(null)} className="text-red-400 hover:text-red-200">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Beatmap List */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6">
        {filteredBeatmaps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Music size={48} className="mb-4 opacity-50" />
            <p className="font-mono text-sm">No beatmaps found</p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-[#00f3ff] hover:underline font-mono text-sm"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 md:gap-4">
            {filteredBeatmaps.map((beatmap, index) => {
              const isSelected = index === selectedIndex;
              const isCustom = !isBuiltInBeatmap(beatmap.id);
              
              return (
                <div
                  key={beatmap.id}
                  onClick={() => setSelectedIndex(index)}
                  onDoubleClick={() => handleSelect(beatmap)}
                  className={`
                    group relative cursor-pointer rounded-xl md:rounded-2xl overflow-hidden transition-all duration-200
                    ${isSelected 
                      ? `bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-2 border-[#00f3ff] shadow-lg ${DIFFICULTY_GLOW[beatmap.difficulty]}` 
                      : 'bg-gray-900/80 border border-gray-800 hover:border-gray-600'
                    }
                  `}
                >
                  {/* Selection indicator glow */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-gradient-to-r from-[#00f3ff]/10 to-[#ff00ff]/10 pointer-events-none" />
                  )}
                  
                  <div className="relative flex items-center gap-3 md:gap-6 p-3 md:p-5">
                    {/* Album Art / Icon */}
                    <div className={`
                      flex-shrink-0 w-14 h-14 md:w-20 md:h-20 rounded-lg md:rounded-xl flex items-center justify-center
                      bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700
                      ${isSelected ? 'border-[#00f3ff]/50' : ''}
                    `}>
                      <Music size={24} className={`md:hidden ${isSelected ? 'text-[#00f3ff]' : 'text-gray-600'}`} />
                      <Music size={32} className={`hidden md:block ${isSelected ? 'text-[#00f3ff]' : 'text-gray-600'}`} />
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1">
                        <h3 className={`text-base md:text-xl font-bold truncate ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                          {beatmap.title}
                        </h3>
                        {/* Badges */}
                        <div className="flex-shrink-0 flex gap-1.5">
                          <span className={`
                            px-2 py-0.5 rounded-full text-[10px] md:text-xs font-mono uppercase tracking-wider border
                            ${DIFFICULTY_COLORS[beatmap.difficulty]} ${DIFFICULTY_BG[beatmap.difficulty]}
                          `}>
                            {beatmap.difficulty}
                          </span>
                          {isCustom ? (
                            <span className="hidden sm:inline px-2 py-0.5 bg-purple-500/20 border border-purple-500 rounded-full text-purple-300 text-[10px] md:text-xs font-mono">
                              CUSTOM
                            </span>
                          ) : (
                            <span className="hidden sm:inline px-2 py-0.5 bg-gray-500/20 border border-gray-500 rounded-full text-gray-400 text-[10px] md:text-xs font-mono">
                              BUILT-IN
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <p className={`text-sm font-mono truncate mb-2 ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                        {beatmap.artist}
                      </p>
                      
                      {/* Stats Row */}
                      <div className="flex items-center gap-3 md:gap-6 text-xs md:text-sm">
                        <div className="flex items-center gap-1 text-[#00f3ff]">
                          <Zap size={14} />
                          <span className="font-mono">{beatmap.bpm}</span>
                          <span className="text-gray-600 hidden sm:inline">BPM</span>
                        </div>
                        <div className="flex items-center gap-1 text-[#ff00ff]">
                          <Clock size={14} />
                          <span className="font-mono">{beatmap.duration}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-400">
                          <Target size={14} />
                          <span className="font-mono">{beatmap.noteCount}</span>
                          <span className="text-gray-600 hidden sm:inline">notes</span>
                        </div>
                        
                        {/* Difficulty Rating */}
                        <div className="hidden md:flex items-center gap-1 ml-auto">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-1.5 h-3 rounded-sm ${
                                i < beatmap.difficultyRating
                                  ? 'bg-gradient-to-t from-[#00f3ff] to-[#ff00ff]'
                                  : 'bg-gray-700'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {/* Desktop actions */}
                      <div className={`hidden md:flex items-center gap-2 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        {onOpenEditor && (
                          <button
                            onClick={(e) => handleEdit(beatmap, e)}
                            className="p-2 bg-cyan-500/20 border border-cyan-500/50 rounded-lg text-cyan-300 hover:bg-cyan-500/30 transition-colors"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleExport(beatmap, e)}
                          className="p-2 bg-gray-700/50 border border-gray-600 rounded-lg text-gray-300 hover:text-white transition-colors"
                          title="Export"
                        >
                          <Download size={16} />
                        </button>
                        {isCustom && (
                          <button
                            onClick={(e) => handleDelete(beatmap, e)}
                            className="p-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 hover:bg-red-500/30 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      
                      {/* Play Button */}
                      <button
                        onClick={() => handleSelect(beatmap)}
                        className={`
                          p-3 md:p-4 rounded-xl transition-all duration-200
                          ${isSelected 
                            ? 'bg-gradient-to-r from-[#00f3ff] to-[#ff00ff] text-black shadow-lg shadow-[#00f3ff]/30' 
                            : 'bg-gray-800 text-gray-400 hover:text-white'
                          }
                        `}
                      >
                        <Play size={20} fill="currentColor" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Mobile expanded actions */}
                  {isSelected && (
                    <div className="md:hidden flex items-center justify-center gap-3 px-4 pb-3 pt-1 border-t border-gray-800">
                      {onOpenEditor && (
                        <button
                          onClick={(e) => handleEdit(beatmap, e)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 border border-cyan-500/50 rounded-lg text-cyan-300 text-xs font-mono"
                        >
                          <Edit size={14} />
                          Edit
                        </button>
                      )}
                      <button
                        onClick={(e) => handleExport(beatmap, e)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700/50 border border-gray-600 rounded-lg text-gray-300 text-xs font-mono"
                      >
                        <Download size={14} />
                        Export
                      </button>
                      {isCustom && (
                        <button
                          onClick={(e) => handleDelete(beatmap, e)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-xs font-mono"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer with Keyboard Hints (Desktop only) */}
      <div className="hidden md:flex flex-shrink-0 items-center justify-center gap-8 py-4 border-t border-gray-800 text-gray-600 font-mono text-xs">
        <span>↑ ↓ Navigate</span>
        <span>Enter / Double-click to Play</span>
        <span>Esc Back</span>
      </div>
      
      {/* Mobile Bottom Safe Area */}
      <div className="md:hidden h-4" />
    </div>
  );
};

export default BeatmapSelectScreen;
