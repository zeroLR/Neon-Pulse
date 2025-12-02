import { useState, useCallback, useRef, useEffect } from 'react';
import { NormalizedLandmark } from '../types';

export interface CalibrationAPI {
  calibrationLeft: number;
  calibrationRight: number;
  calibrationComplete: boolean;
  updateCalibration: (dt: number, landmarks: NormalizedLandmark[]) => void;
  resetCalibration: () => void;
}

export const useCalibration = (
  onCalibrationComplete: () => void
): CalibrationAPI => {
  const [calibrationLeft, setCalibrationLeft] = useState(0);
  const [calibrationRight, setCalibrationRight] = useState(0);
  const [calibrationComplete, setCalibrationComplete] = useState(false);
  
  // Use refs to track current values for completion check
  const leftRef = useRef(0);
  const rightRef = useRef(0);
  const completeRef = useRef(false);

  // Sync refs with state
  useEffect(() => {
    leftRef.current = calibrationLeft;
    rightRef.current = calibrationRight;
    completeRef.current = calibrationComplete;
  }, [calibrationLeft, calibrationRight, calibrationComplete]);

  // Check for completion
  useEffect(() => {
    if (calibrationLeft >= 100 && calibrationRight >= 100 && !calibrationComplete) {
      setCalibrationComplete(true);
      setTimeout(() => {
        setCalibrationLeft(0);
        setCalibrationRight(0);
        setCalibrationComplete(false);
        onCalibrationComplete();
      }, 1500);
    }
  }, [calibrationLeft, calibrationRight, calibrationComplete, onCalibrationComplete]);

  const updateCalibration = useCallback((dt: number, landmarks: NormalizedLandmark[]) => {
    const lw = landmarks[15];
    const rw = landmarks[16];

    // Mirroring Logic for Calibration
    const tolerance = 0.15;
    const isLeftInZone = Math.abs(lw.x - 0.8) < tolerance && Math.abs(lw.y - 0.5) < tolerance;
    const isRightInZone = Math.abs(rw.x - 0.2) < tolerance && Math.abs(rw.y - 0.5) < tolerance;

    setCalibrationLeft(prev => 
      isLeftInZone 
        ? Math.min(100, prev + dt * 100) 
        : Math.max(0, prev - dt * 200)
    );

    setCalibrationRight(prev => 
      isRightInZone 
        ? Math.min(100, prev + dt * 100) 
        : Math.max(0, prev - dt * 200)
    );
  }, []);

  const resetCalibration = useCallback(() => {
    setCalibrationLeft(0);
    setCalibrationRight(0);
    setCalibrationComplete(false);
  }, []);

  return {
    calibrationLeft,
    calibrationRight,
    calibrationComplete,
    updateCalibration,
    resetCalibration
  };
};
