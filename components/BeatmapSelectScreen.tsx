import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Music, Clock, Zap, Target } from 'lucide-react';
import { Beatmap, BeatmapDifficulty } from '../types';
import { BEATMAPS } from '../constants';

interface BeatmapSelectScreenProps {
  onSelect: (beatmap: Beatmap) => void;
  onBack: () => void;
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

const BeatmapSelectScreen: React.FC<BeatmapSelectScreenProps> = ({ onSelect, onBack }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedBeatmap = BEATMAPS[selectedIndex];

  const handlePrev = () => {
    setSelectedIndex((prev) => (prev - 1 + BEATMAPS.length) % BEATMAPS.length);
  };

  const handleNext = () => {
    setSelectedIndex((prev) => (prev + 1) % BEATMAPS.length);
  };

  const handleSelect = () => {
    onSelect(selectedBeatmap);
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
  }, [selectedIndex]);

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 text-white backdrop-blur-sm">
      {/* Header */}
      <div className="absolute top-8 left-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors font-mono text-sm uppercase tracking-wider"
        >
          <ChevronLeft size={20} /> Back to Menu
        </button>
      </div>

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
        <div className="relative group">
          {/* Glow Effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-[#00f3ff] to-[#ff00ff] rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-300"></div>
          
          <div className="relative w-[400px] bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
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

        <button
          onClick={handleNext}
          className="p-4 text-gray-500 hover:text-[#ff00ff] transition-colors hover:scale-110"
        >
          <ChevronRight size={40} />
        </button>
      </div>

      {/* Pagination Dots */}
      <div className="flex gap-2 mb-8">
        {BEATMAPS.map((_, i) => (
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
