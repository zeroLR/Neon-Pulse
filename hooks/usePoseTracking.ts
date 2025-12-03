import React, { useRef, useState, useEffect, useCallback } from 'react';
import { PoseService } from '../services/poseService';
import { NormalizedLandmark, Results } from '../types';

export interface UsePoseTrackingReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  rawLandmarks: React.RefObject<NormalizedLandmark[] | null>;
  permissionError: string | null;
  isReady: boolean;
}

export const usePoseTracking = (
  onReady: () => void
): UsePoseTrackingReturn => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rawLandmarks = useRef<NormalizedLandmark[] | null>(null);
  const poseService = useRef<PoseService | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const onResults = useCallback((results: Results) => {
    if (results.poseLandmarks) {
      rawLandmarks.current = results.poseLandmarks;
    }
  }, []);

  useEffect(() => {
    const startPose = async () => {
      try {
        const service = new PoseService(onResults);
        await service.initialize();
        poseService.current = service;
        if (videoRef.current) {
          await service.start(videoRef.current);
          setIsReady(true);
          onReady();
        }
      } catch (e) {
        console.error(e);
        setPermissionError("Camera access failed.");
      }
    };

    if (videoRef.current) startPose();

    return () => {
      poseService.current?.stop();
    };
  }, [onResults, onReady]);

  return {
    videoRef,
    rawLandmarks,
    permissionError,
    isReady,
  };
};
