import React, { useRef, useCallback, useEffect, RefObject, MutableRefObject } from 'react';
import { NormalizedLandmark } from '../types';

export interface CameraPreviewAPI {
  cameraPreviewRef: RefObject<HTMLCanvasElement>;
  startPreview: () => void;
  stopPreview: () => void;
}

export const useCameraPreview = (
  videoRef: RefObject<HTMLVideoElement>,
  rawLandmarks: MutableRefObject<NormalizedLandmark[] | null>,
  showPreview: boolean
): CameraPreviewAPI => {
  const cameraPreviewRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  const drawCameraPreview = useCallback(() => {
    if (cameraPreviewRef.current && videoRef.current && showPreview) {
      const canvas = cameraPreviewRef.current;
      const ctx = canvas.getContext('2d');
      const video = videoRef.current;
      
      if (ctx && video.readyState >= 2) {
        // Draw video frame (mirrored)
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();
        
        // Draw pose landmarks for wrists and palms
        if (rawLandmarks.current) {
          const lm = rawLandmarks.current;
          const leftWrist = lm[15];
          const rightWrist = lm[16];
          const leftPalm = lm[19];
          const rightPalm = lm[20];
          
          const drawPoint = (landmark: NormalizedLandmark, color: string, size: number = 8) => {
            const x = (1 - landmark.x) * canvas.width;
            const y = landmark.y * canvas.height;
            
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            
            // Glow effect
            ctx.beginPath();
            ctx.arc(x, y, size + 4, 0, Math.PI * 2);
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();
          };
          
          const drawLine = (from: NormalizedLandmark, to: NormalizedLandmark, color: string) => {
            const x1 = (1 - from.x) * canvas.width;
            const y1 = from.y * canvas.height;
            const x2 = (1 - to.x) * canvas.width;
            const y2 = to.y * canvas.height;
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.stroke();
          };
          
          // Draw wrist to palm lines (saber direction)
          drawLine(leftWrist, leftPalm, '#00f3ff');
          drawLine(rightWrist, rightPalm, '#ff00ff');
          
          // Draw points - wrists smaller, palms larger
          drawPoint(leftWrist, '#00f3ff', 6);
          drawPoint(rightWrist, '#ff00ff', 6);
          drawPoint(leftPalm, '#00f3ff', 10);
          drawPoint(rightPalm, '#ff00ff', 10);
        }
      }
    }
    
    if (showPreview) {
      animationRef.current = requestAnimationFrame(drawCameraPreview);
    }
  }, [showPreview, videoRef, rawLandmarks]);

  const startPreview = useCallback(() => {
    if (!animationRef.current) {
      animationRef.current = requestAnimationFrame(drawCameraPreview);
    }
  }, [drawCameraPreview]);

  const stopPreview = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  // Auto start/stop based on showPreview
  useEffect(() => {
    if (showPreview) {
      startPreview();
    } else {
      stopPreview();
    }
    
    return () => stopPreview();
  }, [showPreview, startPreview, stopPreview]);

  return {
    cameraPreviewRef,
    startPreview,
    stopPreview
  };
};
