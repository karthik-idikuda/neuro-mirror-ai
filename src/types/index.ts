// ============================================================================
// MIRRORBODY-X : TYPE DEFINITIONS
// Real-Time Pose-Synced Mirror Clone System
// ============================================================================

import * as THREE from 'three';

// ============================================================================
// POSE TRACKING TYPES
// ============================================================================

/**
 * MediaPipe Pose Landmark - 33 keypoints
 */
export interface PoseLandmark {
  x: number;      // Normalized [0, 1]
  y: number;      // Normalized [0, 1]
  z: number;      // Depth relative to hip center
  visibility: number; // Confidence [0, 1]
}

/**
 * Full body pose with all 33 MediaPipe landmarks
 */
export interface PoseData {
  landmarks: PoseLandmark[];
  worldLandmarks: PoseLandmark[]; // 3D world coordinates
  timestamp: number;
}

/**
 * Smoothed pose data after Kalman filtering
 */
export interface SmoothedPoseData extends PoseData {
  velocity: PoseLandmark[];
  confidence: number;
}

/**
 * MediaPipe landmark indices for easy reference
 */
export enum PoseLandmarkIndex {
  NOSE = 0,
  LEFT_EYE_INNER = 1,
  LEFT_EYE = 2,
  LEFT_EYE_OUTER = 3,
  RIGHT_EYE_INNER = 4,
  RIGHT_EYE = 5,
  RIGHT_EYE_OUTER = 6,
  LEFT_EAR = 7,
  RIGHT_EAR = 8,
  MOUTH_LEFT = 9,
  MOUTH_RIGHT = 10,
  LEFT_SHOULDER = 11,
  RIGHT_SHOULDER = 12,
  LEFT_ELBOW = 13,
  RIGHT_ELBOW = 14,
  LEFT_WRIST = 15,
  RIGHT_WRIST = 16,
  LEFT_PINKY = 17,
  RIGHT_PINKY = 18,
  LEFT_INDEX = 19,
  RIGHT_INDEX = 20,
  LEFT_THUMB = 21,
  RIGHT_THUMB = 22,
  LEFT_HIP = 23,
  RIGHT_HIP = 24,
  LEFT_KNEE = 25,
  RIGHT_KNEE = 26,
  LEFT_ANKLE = 27,
  RIGHT_ANKLE = 28,
  LEFT_HEEL = 29,
  RIGHT_HEEL = 30,
  LEFT_FOOT_INDEX = 31,
  RIGHT_FOOT_INDEX = 32,
}

// ============================================================================
// SKELETON RETARGETING TYPES
// ============================================================================

/**
 * Humanoid bone structure for avatar rigging
 */
export interface HumanoidBone {
  name: string;
  quaternion: THREE.Quaternion;
  position: THREE.Vector3;
  scale: THREE.Vector3;
}

/**
 * Mapping between pose landmarks and avatar bones
 */
export interface BoneMapping {
  boneName: string;
  startLandmark: PoseLandmarkIndex;
  endLandmark: PoseLandmarkIndex;
  rotationOffset: THREE.Euler;
  axisMapping: {
    x: 'x' | 'y' | 'z' | '-x' | '-y' | '-z';
    y: 'x' | 'y' | 'z' | '-x' | '-y' | '-z';
    z: 'x' | 'y' | 'z' | '-x' | '-y' | '-z';
  };
}

/**
 * Complete skeleton state for avatar
 */
export interface SkeletonState {
  hips: HumanoidBone;
  spine: HumanoidBone;
  chest: HumanoidBone;
  neck: HumanoidBone;
  head: HumanoidBone;
  leftShoulder: HumanoidBone;
  leftUpperArm: HumanoidBone;
  leftLowerArm: HumanoidBone;
  leftHand: HumanoidBone;
  rightShoulder: HumanoidBone;
  rightUpperArm: HumanoidBone;
  rightLowerArm: HumanoidBone;
  rightHand: HumanoidBone;
  leftUpperLeg: HumanoidBone;
  leftLowerLeg: HumanoidBone;
  leftFoot: HumanoidBone;
  rightUpperLeg: HumanoidBone;
  rightLowerLeg: HumanoidBone;
  rightFoot: HumanoidBone;
}

// ============================================================================
// AVATAR TYPES
// ============================================================================

/**
 * Avatar configuration options
 */
export interface AvatarConfig {
  modelUrl: string;
  scale: number;
  positionOffset: THREE.Vector3;
  rotationOffset: THREE.Euler;
  visible: boolean;
}

/**
 * Avatar state for rendering
 */
export interface AvatarState {
  skeleton: SkeletonState | null;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  opacity: number;
}

// ============================================================================
// SHADER / MATERIAL TYPES
// ============================================================================

/**
 * Mirror shader uniform values
 */
export interface MirrorShaderUniforms {
  metalness: number;
  roughness: number;
  envMapIntensity: number;
  fresnelPower: number;
  fresnelBias: number;
  tint: THREE.Color;
  time: number;
}

/**
 * Material preset configurations
 */
export interface MaterialPreset {
  name: string;
  uniforms: Partial<MirrorShaderUniforms>;
  envMap?: string;
}

// ============================================================================
// EFFECTS TYPES
// ============================================================================

/**
 * Glow effect configuration
 */
export interface GlowConfig {
  enabled: boolean;
  color: THREE.Color;
  intensity: number;
  size: number;
}

/**
 * Motion trail configuration
 */
export interface MotionTrailConfig {
  enabled: boolean;
  length: number;
  fadeSpeed: number;
  color: THREE.Color;
}

/**
 * Light ray configuration
 */
export interface LightRayConfig {
  enabled: boolean;
  joints: PoseLandmarkIndex[];
  color: THREE.Color;
  intensity: number;
  length: number;
}

/**
 * Floor reflection configuration
 */
export interface FloorReflectionConfig {
  enabled: boolean;
  opacity: number;
  blur: number;
  color: THREE.Color;
}

/**
 * Combined effects configuration
 */
export interface EffectsConfig {
  glow: GlowConfig;
  motionTrail: MotionTrailConfig;
  lightRays: LightRayConfig;
  floorReflection: FloorReflectionConfig;
  shadowEnabled: boolean;
}

// ============================================================================
// CAMERA PIPELINE TYPES
// ============================================================================

/**
 * Camera configuration
 */
export interface CameraConfig {
  width: number;
  height: number;
  facingMode: 'user' | 'environment';
  frameRate: number;
}

/**
 * Background segmentation options
 */
export interface SegmentationConfig {
  enabled: boolean;
  backgroundBlur: number;
  edgeBlur: number;
  threshold: number;
}

/**
 * Camera pipeline state
 */
export interface CameraPipelineState {
  isStreaming: boolean;
  hasPermission: boolean;
  error: string | null;
  currentFrame: ImageData | null;
  segmentationMask: ImageData | null;
}

// ============================================================================
// UI / SETTINGS TYPES
// ============================================================================

/**
 * Performance mode settings
 */
export type PerformanceMode = 'quality' | 'balanced' | 'performance';

/**
 * Lighting preset names
 */
export type LightingPreset = 'studio' | 'sunset' | 'neon' | 'dramatic' | 'soft';

/**
 * Complete application settings
 */
export interface AppSettings {
  // Clone settings
  cloneEnabled: boolean;
  cloneOffset: THREE.Vector3;
  cloneRotation: number;

  // Material settings
  shaderIntensity: number;
  mirrorRoughness: number;
  mirrorMetalness: number;
  fresnelPower: number;
  tintColor: string;

  // Lighting
  lightingPreset: LightingPreset;
  environmentIntensity: number;

  // Effects
  effects: EffectsConfig;

  // Performance
  performanceMode: PerformanceMode;
  targetFPS: number;
  adaptiveResolution: boolean;

  // Camera
  camera: CameraConfig;
  segmentation: SegmentationConfig;
}

// ============================================================================
// PERFORMANCE TYPES
// ============================================================================

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  poseInferenceTime: number;
  renderTime: number;
  gpuMemoryUsage: number;
  droppedFrames: number;
}

/**
 * Adaptive quality state
 */
export interface AdaptiveQualityState {
  currentResolutionScale: number;
  currentEffectsLevel: number;
  isThrottling: boolean;
  targetFPS: number;
  actualFPS: number;
}

// ============================================================================
// RECORDING TYPES
// ============================================================================

/**
 * Recording state
 */
export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  frameCount: number;
  outputFormat: 'webm' | 'mp4';
}

/**
 * Screenshot options
 */
export interface ScreenshotOptions {
  format: 'png' | 'jpeg' | 'webp';
  quality: number;
  includeUI: boolean;
}

// ============================================================================
// KALMAN FILTER TYPES
// ============================================================================

/**
 * Kalman filter state for pose smoothing
 */
export interface KalmanState {
  x: number;  // State estimate
  p: number;  // Estimate covariance
  q: number;  // Process noise
  r: number;  // Measurement noise
  k: number;  // Kalman gain
}

/**
 * 3D Kalman filter for landmark smoothing
 */
export interface KalmanFilter3D {
  x: KalmanState;
  y: KalmanState;
  z: KalmanState;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Pose detection events
 */
export type PoseEvent = 
  | { type: 'pose_detected'; data: PoseData }
  | { type: 'pose_lost'; timestamp: number }
  | { type: 'tracking_quality'; confidence: number };

/**
 * System events
 */
export type SystemEvent =
  | { type: 'camera_ready' }
  | { type: 'camera_error'; error: string }
  | { type: 'model_loaded' }
  | { type: 'model_error'; error: string }
  | { type: 'performance_warning'; metrics: PerformanceMetrics };

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const DEFAULT_SETTINGS: AppSettings = {
  cloneEnabled: true,
  cloneOffset: new THREE.Vector3(1.5, 0, 0),
  cloneRotation: 0,

  shaderIntensity: 1.0,
  mirrorRoughness: 0.05,
  mirrorMetalness: 1.0,
  fresnelPower: 2.5,
  tintColor: '#88ccff',

  lightingPreset: 'studio',
  environmentIntensity: 1.0,

  effects: {
    glow: {
      enabled: true,
      color: new THREE.Color(0x00ffff),
      intensity: 0.5,
      size: 0.1,
    },
    motionTrail: {
      enabled: true,
      length: 10,
      fadeSpeed: 0.1,
      color: new THREE.Color(0x4488ff),
    },
    lightRays: {
      enabled: false,
      joints: [
        PoseLandmarkIndex.LEFT_WRIST,
        PoseLandmarkIndex.RIGHT_WRIST,
      ],
      color: new THREE.Color(0xffffff),
      intensity: 1.0,
      length: 0.5,
    },
    floorReflection: {
      enabled: true,
      opacity: 0.3,
      blur: 0.5,
      color: new THREE.Color(0x111122),
    },
    shadowEnabled: true,
  },

  performanceMode: 'balanced',
  targetFPS: 30,
  adaptiveResolution: true,

  camera: {
    width: 1280,
    height: 720,
    facingMode: 'user',
    frameRate: 30,
  },
  segmentation: {
    enabled: false,
    backgroundBlur: 5,
    edgeBlur: 3,
    threshold: 0.7,
  },
};
