import { useState, useCallback, useRef, useEffect } from 'react';
import { NormalizedLandmark } from '../types';
import { CALIBRATION_CONFIG } from '../constants';

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
      }, CALIBRATION_CONFIG.COMPLETION_DELAY);
    }
  }, [calibrationLeft, calibrationRight, calibrationComplete, onCalibrationComplete]);

  const updateCalibration = useCallback((dt: number, landmarks: NormalizedLandmark[]) => {
    const lw = landmarks[15];
    const rw = landmarks[16];

    // Mirroring Logic for Calibration
    const { TOLERANCE, LEFT_ZONE, RIGHT_ZONE, PROGRESS_RATE, DECAY_RATE } = CALIBRATION_CONFIG;
    const isLeftInZone = Math.abs(lw.x - LEFT_ZONE.x) < TOLERANCE && Math.abs(lw.y - LEFT_ZONE.y) < TOLERANCE;
    const isRightInZone = Math.abs(rw.x - RIGHT_ZONE.x) < TOLERANCE && Math.abs(rw.y - RIGHT_ZONE.y) < TOLERANCE;

    setCalibrationLeft(prev => 
      isLeftInZone 
        ? Math.min(100, prev + dt * PROGRESS_RATE) 
        : Math.max(0, prev - dt * DECAY_RATE)
    );

    setCalibrationRight(prev => 
      isRightInZone 
        ? Math.min(100, prev + dt * PROGRESS_RATE) 
        : Math.max(0, prev - dt * DECAY_RATE)
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
