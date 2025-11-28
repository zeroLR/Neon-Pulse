import { Pose, Results } from '../types';

declare global {
  interface Window {
    Pose: new (config: { locateFile: (file: string) => string }) => Pose;
  }
}

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
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      });

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
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.pose) {
      this.pose.close();
      this.pose = null;
    }
  }
}