// ============================================================================
// MIRRORBODY-X : POSE TRACKING ENGINE
// MediaPipe Pose Integration with Kalman Filter Smoothing
// ============================================================================

import {
  PoseData,
  PoseLandmark,
  SmoothedPoseData,
  KalmanFilter3D,
  KalmanState,
  PoseLandmarkIndex,
} from '@/types';

// Re-export types for convenience
export type { SmoothedPoseData } from '@/types';

// ============================================================================
// KALMAN FILTER IMPLEMENTATION
// ============================================================================

/**
 * Creates a new Kalman filter state
 */
function createKalmanState(
  processNoise: number = 0.001,
  measurementNoise: number = 0.1
): KalmanState {
  return {
    x: 0,      // Initial state
    p: 1,      // Initial covariance
    q: processNoise,
    r: measurementNoise,
    k: 0,      // Kalman gain
  };
}

/**
 * Updates Kalman filter with new measurement
 */
function kalmanUpdate(state: KalmanState, measurement: number): number {
  // Prediction step
  const predictedP = state.p + state.q;

  // Update step
  state.k = predictedP / (predictedP + state.r);
  state.x = state.x + state.k * (measurement - state.x);
  state.p = (1 - state.k) * predictedP;

  return state.x;
}

/**
 * Creates a 3D Kalman filter for landmark smoothing
 */
function createKalmanFilter3D(): KalmanFilter3D {
  return {
    x: createKalmanState(0.0001, 0.05),
    y: createKalmanState(0.0001, 0.05),
    z: createKalmanState(0.001, 0.1),
  };
}

// ============================================================================
// EXPONENTIAL SMOOTHING
// ============================================================================

interface ExponentialSmoother {
  value: number;
  alpha: number;
}

function createSmoother(alpha: number = 0.3): ExponentialSmoother {
  return { value: 0, alpha };
}

function smoothValue(smoother: ExponentialSmoother, newValue: number): number {
  smoother.value = smoother.alpha * newValue + (1 - smoother.alpha) * smoother.value;
  return smoother.value;
}

// ============================================================================
// POSE TRACKER CLASS
// ============================================================================

export type PoseCallback = (pose: SmoothedPoseData | null) => void;

export interface PoseTrackerConfig {
  modelComplexity: 0 | 1 | 2;
  smoothLandmarks: boolean;
  enableSegmentation: boolean;
  minDetectionConfidence: number;
  minTrackingConfidence: number;
  useKalmanFilter: boolean;
  useExponentialSmoothing: boolean;
  smoothingFactor: number;
}

const DEFAULT_CONFIG: PoseTrackerConfig = {
  modelComplexity: 1, // 0=lite, 1=full, 2=heavy
  smoothLandmarks: true,
  enableSegmentation: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
  useKalmanFilter: true,
  useExponentialSmoothing: true,
  smoothingFactor: 0.4,
};

export class PoseTracker {
  private pose: any = null;
  private camera: any = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private isRunning: boolean = false;
  private config: PoseTrackerConfig;

  // Smoothing filters
  private kalmanFilters: KalmanFilter3D[] = [];
  private worldKalmanFilters: KalmanFilter3D[] = [];
  private smoothers: { x: ExponentialSmoother; y: ExponentialSmoother; z: ExponentialSmoother }[] = [];

  // State tracking
  private lastPoseData: SmoothedPoseData | null = null;
  private lastPoseTime: number = 0;
  private poseCallback: PoseCallback | null = null;
  private frameCount: number = 0;
  private inferenceTime: number = 0;

  // Performance
  private throttleInterval: number = 33; // ~30 FPS
  private lastInferenceTime: number = 0;

  constructor(config: Partial<PoseTrackerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeFilters();
  }

  /**
   * Initialize Kalman filters and smoothers for all 33 landmarks
   */
  private initializeFilters(): void {
    for (let i = 0; i < 33; i++) {
      this.kalmanFilters.push(createKalmanFilter3D());
      this.worldKalmanFilters.push(createKalmanFilter3D());
      this.smoothers.push({
        x: createSmoother(this.config.smoothingFactor),
        y: createSmoother(this.config.smoothingFactor),
        z: createSmoother(this.config.smoothingFactor),
      });
    }
  }

  /**
   * Initialize MediaPipe Pose
   */
  async initialize(): Promise<void> {
    // Dynamically import MediaPipe
    const { Pose } = await import('@mediapipe/pose');
    const { Camera } = await import('@mediapipe/camera_utils');

    this.pose = new Pose({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      },
    });

    this.pose.setOptions({
      modelComplexity: this.config.modelComplexity,
      smoothLandmarks: this.config.smoothLandmarks,
      enableSegmentation: this.config.enableSegmentation,
      minDetectionConfidence: this.config.minDetectionConfidence,
      minTrackingConfidence: this.config.minTrackingConfidence,
    });

    this.pose.onResults(this.onPoseResults.bind(this));

    console.log('[PoseTracker] MediaPipe Pose initialized');
  }

  /**
   * Start pose tracking from video element
   */
  async start(
    videoElement: HTMLVideoElement,
    callback: PoseCallback
  ): Promise<void> {
    if (this.isRunning) {
      console.warn('[PoseTracker] Already running');
      return;
    }

    this.videoElement = videoElement;
    this.poseCallback = callback;

    // Request camera access
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
          frameRate: { ideal: 30 },
        },
      });

      videoElement.srcObject = stream;
      await videoElement.play();

      // Use MediaPipe Camera utility
      const { Camera } = await import('@mediapipe/camera_utils');
      
      this.camera = new Camera(videoElement, {
        onFrame: async () => {
          if (this.pose && this.shouldProcess()) {
            const startTime = performance.now();
            await this.pose.send({ image: videoElement });
            this.inferenceTime = performance.now() - startTime;
          }
        },
        width: 1280,
        height: 720,
      });

      await this.camera.start();
      this.isRunning = true;

      console.log('[PoseTracker] Camera started');
    } catch (error) {
      console.error('[PoseTracker] Camera access error:', error);
      throw error;
    }
  }

  /**
   * Throttle inference for performance
   */
  private shouldProcess(): boolean {
    const now = performance.now();
    if (now - this.lastInferenceTime >= this.throttleInterval) {
      this.lastInferenceTime = now;
      return true;
    }
    return false;
  }

  /**
   * Handle MediaPipe pose results
   */
  private onPoseResults(results: any): void {
    this.frameCount++;

    if (!results.poseLandmarks || !results.poseWorldLandmarks) {
      // No pose detected
      if (this.poseCallback) {
        this.poseCallback(null);
      }
      return;
    }

    const timestamp = performance.now();

    // Process and smooth landmarks
    const smoothedLandmarks = this.smoothLandmarks(
      results.poseLandmarks,
      this.kalmanFilters
    );

    const smoothedWorldLandmarks = this.smoothLandmarks(
      results.poseWorldLandmarks,
      this.worldKalmanFilters
    );

    // Calculate velocity
    const velocity = this.calculateVelocity(smoothedLandmarks, timestamp);

    // Calculate overall confidence
    const confidence = this.calculateConfidence(results.poseLandmarks);

    const poseData: SmoothedPoseData = {
      landmarks: smoothedLandmarks,
      worldLandmarks: smoothedWorldLandmarks,
      timestamp,
      velocity,
      confidence,
    };

    this.lastPoseData = poseData;
    this.lastPoseTime = timestamp;

    if (this.poseCallback) {
      this.poseCallback(poseData);
    }
  }

  /**
   * Apply smoothing filters to landmarks
   */
  private smoothLandmarks(
    landmarks: any[],
    filters: KalmanFilter3D[]
  ): PoseLandmark[] {
    return landmarks.map((landmark, i) => {
      let x = landmark.x;
      let y = landmark.y;
      let z = landmark.z;
      const visibility = landmark.visibility ?? 1;

      // Apply Kalman filter
      if (this.config.useKalmanFilter) {
        x = kalmanUpdate(filters[i].x, x);
        y = kalmanUpdate(filters[i].y, y);
        z = kalmanUpdate(filters[i].z, z);
      }

      // Apply exponential smoothing
      if (this.config.useExponentialSmoothing) {
        x = smoothValue(this.smoothers[i].x, x);
        y = smoothValue(this.smoothers[i].y, y);
        z = smoothValue(this.smoothers[i].z, z);
      }

      return { x, y, z, visibility };
    });
  }

  /**
   * Calculate landmark velocity for motion prediction
   */
  private calculateVelocity(
    landmarks: PoseLandmark[],
    timestamp: number
  ): PoseLandmark[] {
    if (!this.lastPoseData) {
      return landmarks.map(() => ({ x: 0, y: 0, z: 0, visibility: 0 }));
    }

    const dt = (timestamp - this.lastPoseTime) / 1000; // Convert to seconds
    if (dt === 0) {
      return landmarks.map(() => ({ x: 0, y: 0, z: 0, visibility: 0 }));
    }

    return landmarks.map((landmark, i) => {
      const prevLandmark = this.lastPoseData!.landmarks[i];
      return {
        x: (landmark.x - prevLandmark.x) / dt,
        y: (landmark.y - prevLandmark.y) / dt,
        z: (landmark.z - prevLandmark.z) / dt,
        visibility: landmark.visibility,
      };
    });
  }

  /**
   * Calculate overall pose confidence
   */
  private calculateConfidence(landmarks: any[]): number {
    const keyJoints = [
      PoseLandmarkIndex.LEFT_SHOULDER,
      PoseLandmarkIndex.RIGHT_SHOULDER,
      PoseLandmarkIndex.LEFT_HIP,
      PoseLandmarkIndex.RIGHT_HIP,
      PoseLandmarkIndex.LEFT_ELBOW,
      PoseLandmarkIndex.RIGHT_ELBOW,
      PoseLandmarkIndex.LEFT_WRIST,
      PoseLandmarkIndex.RIGHT_WRIST,
    ];

    const totalVisibility = keyJoints.reduce((sum, idx) => {
      return sum + (landmarks[idx]?.visibility ?? 0);
    }, 0);

    return totalVisibility / keyJoints.length;
  }

  /**
   * Stop pose tracking
   */
  stop(): void {
    if (this.camera) {
      this.camera.stop();
      this.camera = null;
    }

    if (this.videoElement?.srcObject) {
      const tracks = (this.videoElement.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      this.videoElement.srcObject = null;
    }

    this.isRunning = false;
    console.log('[PoseTracker] Stopped');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PoseTrackerConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.pose) {
      this.pose.setOptions({
        modelComplexity: this.config.modelComplexity,
        smoothLandmarks: this.config.smoothLandmarks,
        enableSegmentation: this.config.enableSegmentation,
        minDetectionConfidence: this.config.minDetectionConfidence,
        minTrackingConfidence: this.config.minTrackingConfidence,
      });
    }
  }

  /**
   * Set throttle interval for performance tuning
   */
  setThrottleInterval(ms: number): void {
    this.throttleInterval = Math.max(16, ms); // Minimum ~60fps
  }

  /**
   * Get current pose data
   */
  getCurrentPose(): SmoothedPoseData | null {
    return this.lastPoseData;
  }

  /**
   * Get inference time
   */
  getInferenceTime(): number {
    return this.inferenceTime;
  }

  /**
   * Get frame count
   */
  getFrameCount(): number {
    return this.frameCount;
  }

  /**
   * Check if tracker is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Reset filters (useful when pose is lost)
   */
  resetFilters(): void {
    this.kalmanFilters = [];
    this.worldKalmanFilters = [];
    this.smoothers = [];
    this.initializeFilters();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let poseTrackerInstance: PoseTracker | null = null;

export function getPoseTracker(config?: Partial<PoseTrackerConfig>): PoseTracker {
  if (!poseTrackerInstance) {
    poseTrackerInstance = new PoseTracker(config);
  }
  return poseTrackerInstance;
}

export function destroyPoseTracker(): void {
  if (poseTrackerInstance) {
    poseTrackerInstance.stop();
    poseTrackerInstance = null;
  }
}
