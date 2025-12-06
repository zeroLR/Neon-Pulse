import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBeatmaps } from '../../hooks/useBeatmaps';
import BeatmapEditor from './BeatmapEditor';

const EditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { beatmapId } = useParams<{ beatmapId: string }>();
  const { beatmaps, isLoading } = useBeatmaps();
  
  // Find the beatmap to edit (if editing existing)
  const editingBeatmap = beatmapId ? beatmaps.find(b => b.id === beatmapId) : undefined;

  const handleCloseEditor = () => {
    navigate('/select');
  };

  // Show loading while beatmaps are being fetched (only if we need a beatmap)
  if (beatmapId && isLoading) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="text-cyan-400 text-xl animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative selection:bg-[#00f3ff] selection:text-black">
      <BeatmapEditor
        onBack={handleCloseEditor}
        initialBeatmap={editingBeatmap}
      />
    </div>
  );
};

export default EditorPage;
