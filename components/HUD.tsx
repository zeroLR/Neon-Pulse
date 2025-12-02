import React, { useState, useEffect, MutableRefObject } from 'react';
import { GameStats } from '../types';

interface HUDProps {
  statsRef: MutableRefObject<GameStats>;
}

export const ScoreDisplay: React.FC<HUDProps> = ({ statsRef }) => {
  const [val, setVal] = useState(0);
  
  useEffect(() => {
    const i = setInterval(() => setVal(statsRef.current.score), 100);
    return () => clearInterval(i);
  }, [statsRef]);
  
  return <>{val.toLocaleString()}</>;
};

export const ComboDisplay: React.FC<HUDProps> = ({ statsRef }) => {
  const [val, setVal] = useState(0);
  
  useEffect(() => {
    const i = setInterval(() => setVal(statsRef.current.combo), 100);
    return () => clearInterval(i);
  }, [statsRef]);
  
  return <>{val}x</>;
};

export const HealthBar: React.FC<HUDProps> = ({ statsRef }) => {
  const [hp, setHp] = useState(100);
  
  useEffect(() => {
    const i = setInterval(() => setHp(statsRef.current.health), 100);
    return () => clearInterval(i);
  }, [statsRef]);
  
  return (
    <div
      className="h-full bg-gradient-to-r from-[#00f3ff] to-[#ff00ff] shadow-[0_0_10px_#ff00ff] transition-all duration-200"
      style={{ width: `${hp}%` }}
    />
  );
};
