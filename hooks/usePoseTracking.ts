import React, { useRef, useState, useCallback } from 'react';
import { PoseService, stopAllCameraStreams } from '../services/poseService';
import { NormalizedLandmark, Results } from '../types';

export interface UsePoseTrackingReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  rawLandmarks: React.RefObject<NormalizedLandmark[] | null>;
  permissionError: string | null;
  isActive: boolean;
  isInitializing: boolean;
  isReady: boolean; // True when first pose result is received
  start: () => Promise<void>;
  stop: () => void;
}

export const usePoseTracking = (): UsePoseTrackingReturn => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rawLandmarks = useRef<NormalizedLandmark[] | null>(null);
  const poseService = useRef<PoseService | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const hasReceivedFirstResult = useRef(false);

  const onResults = useCallback((results: Results) => {
    if (results.poseLandmarks) {
      rawLandmarks.current = results.poseLandmarks;
      
      // Mark as ready when we receive the first valid pose result
      if (!hasReceivedFirstResult.current) {
        hasReceivedFirstResult.current = true;
        setIsReady(true);
      }
    }
  }, []);

  const start = useCallback(async () => {
    if (isActive || isInitializing) return;
    
    setIsInitializing(true);
    setPermissionError(null);
    hasReceivedFirstResult.current = false;
    setIsReady(false);
    
    try {
      // Create video element if not exists
      if (!videoRef.current) {
        const video = document.createElement('video');
        video.playsInline = true;
        video.muted = true;
        video.style.position = 'absolute';
        video.style.opacity = '0';
        video.style.pointerEvents = 'none';
        video.style.width = '1px';
        video.style.height = '1px';
        document.body.appendChild(video);
        videoRef.current = video;
      }
      
      const service = new PoseService(onResults);
      await service.initialize();
      poseService.current = service;
      
      await service.start(videoRef.current);
      setIsActive(true);
      // Note: isReady will be set to true when first pose result is received
    } catch (e) {
      console.error('Failed to start pose tracking:', e);
      setPermissionError('Camera access failed. Please allow camera permissions.');
    } finally {
      setIsInitializing(false);
    }
  }, [isActive, isInitializing, onResults]);

  const stop = useCallback(() => {
    console.log('usePoseTracking.stop() called');
    
    // Always try to stop global stream first
    stopAllCameraStreams();
    
    if (poseService.current) {
      poseService.current.stop();
      poseService.current = null;
    }
    
    // Remove video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      if (videoRef.current.parentNode) {
        videoRef.current.parentNode.removeChild(videoRef.current);
      }
      videoRef.current = null;
    }
    
    // Also find and stop any orphaned video elements with streams
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach(video => {
      if (video.srcObject) {
        console.log('Found orphaned video with stream, stopping...');
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          console.log('Stopping orphaned track:', track.kind, track.readyState);
          track.stop();
        });
        video.srcObject = null;
        if (video.parentNode) {
          video.parentNode.removeChild(video);
        }
      }
    });
    
    rawLandmarks.current = null;
    hasReceivedFirstResult.current = false;
    setIsActive(false);
    setIsReady(false);
    setPermissionError(null);
    console.log('usePoseTracking.stop() completed');
  }, []);

  return {
    videoRef,
    rawLandmarks,
    permissionError,
    isActive,
    isInitializing,
    isReady,
    start,
    stop,
  };
};
