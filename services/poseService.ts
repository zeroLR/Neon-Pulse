import { Pose, Results } from '../types';

declare global {
  interface Window {
    Pose: new (config: { locateFile: (file: string) => string }) => Pose;
    __activeCameraStream?: MediaStream | null;
  }
}

// Store stream globally so we can always access and stop it
const setGlobalStream = (stream: MediaStream | null) => {
  if (window.__activeCameraStream && window.__activeCameraStream !== stream) {
    // Stop any existing stream before setting new one
    console.log('Stopping previous global stream...');
    window.__activeCameraStream.getTracks().forEach(track => {
      console.log('Stopping old track:', track.kind, track.readyState);
      track.stop();
    });
  }
  window.__activeCameraStream = stream;
};

// Global function to stop all camera streams
export const stopAllCameraStreams = () => {
  console.log('stopAllCameraStreams called');
  if (window.__activeCameraStream) {
    console.log('Found global stream, stopping...');
    window.__activeCameraStream.getTracks().forEach(track => {
      console.log('Stopping global track:', track.kind, track.label, 'readyState:', track.readyState);
      track.stop();
      console.log('After stop, readyState:', track.readyState);
    });
    window.__activeCameraStream = null;
  } else {
    console.log('No global stream found');
  }
};

export class PoseService {
  private pose: Pose | null = null;
  private onResultsCallback: (results: Results) => void;
  private animationFrameId: number | null = null;
  private stream: MediaStream | null = null;

  constructor(onResults: (results: Results) => void) {
    this.onResultsCallback = onResults;
  }

  public async initialize(): Promise<void> {
    if (!window.Pose) {
        throw new Error("MediaPipe Pose script not loaded");
    }

    this.pose = new window.Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      },
    });

    this.pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    this.pose.onResults(this.onResultsCallback);
  }

  public async start(videoElement: HTMLVideoElement): Promise<void> {
    if (!this.pose) await this.initialize();

    try {
      // Stop any existing global stream first
      stopAllCameraStreams();
      
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      });
      
      // Store in global for cleanup
      setGlobalStream(this.stream);

      videoElement.srcObject = this.stream;
      
      await new Promise<void>((resolve) => {
        videoElement.onloadedmetadata = () => {
          videoElement.play();
          resolve();
        };
      });

      this.processVideo(videoElement);

    } catch (error) {
      console.error("Error accessing camera:", error);
      throw error;
    }
  }

  private async processVideo(videoElement: HTMLVideoElement) {
    if (!this.pose) return;

    try {
        if (videoElement.readyState >= 2) {
             await this.pose.send({ image: videoElement });
        }
    } catch (error) {
        console.error("Pose processing error:", error);
    }
    
    if (this.pose) {
        this.animationFrameId = requestAnimationFrame(() => this.processVideo(videoElement));
    }
  }

  public stop() {
    console.log('PoseService.stop() called');
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.stream) {
      console.log('Stopping camera tracks...');
      this.stream.getTracks().forEach(track => {
        console.log('Stopping track:', track.kind, track.label);
        track.stop();
      });
      this.stream = null;
      console.log('Camera tracks stopped');
    }

    if (this.pose) {
      this.pose.close();
      this.pose = null;
    }
    
    console.log('PoseService.stop() completed');
  }
}