import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { MenuPage, SelectPage, GamePage, EditorPage } from './pages';

// Main App with Routes
const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<MenuPage />} />
      <Route path="/select" element={<SelectPage />} />
      <Route path="/play/:beatmapId" element={<GamePage />} />
      <Route path="/editor" element={<EditorPage />} />
      <Route path="/editor/:beatmapId" element={<EditorPage />} />
    </Routes>
  );
};

export default App;