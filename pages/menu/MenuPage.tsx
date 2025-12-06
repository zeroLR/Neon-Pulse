import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import IntroScreen from './IntroScreen';

const MenuPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleStart = () => {
    navigate('/select');
  };

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative selection:bg-[#00f3ff] selection:text-black">
      <IntroScreen 
        isLoading={isLoading} 
        onStart={handleStart} 
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]"></div>
    </div>
  );
};

export default MenuPage;
