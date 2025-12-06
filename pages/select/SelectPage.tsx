import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Beatmap } from '../../types';
import BeatmapSelectScreen from './BeatmapSelectScreen';

const SelectPage: React.FC = () => {
  const navigate = useNavigate();

  const handleBeatmapSelect = (beatmap: Beatmap) => {
    navigate(`/play/${beatmap.id}`);
  };

  const handleBackToMenu = () => {
    navigate('/');
  };

  const handleOpenEditor = (beatmap?: Beatmap) => {
    if (beatmap) {
      navigate(`/editor/${beatmap.id}`);
    } else {
      navigate('/editor');
    }
  };

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative selection:bg-[#00f3ff] selection:text-black">
      <BeatmapSelectScreen
        onSelect={handleBeatmapSelect}
        onBack={handleBackToMenu}
        onOpenEditor={handleOpenEditor}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]"></div>
    </div>
  );
};

export default SelectPage;
