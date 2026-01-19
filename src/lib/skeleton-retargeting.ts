// ============================================================================
// MIRRORBODY-X : SKELETON RETARGETING SYSTEM
// Bone Mapping from Pose Landmarks → Humanoid Rig
// ============================================================================

import * as THREE from 'three';
import {
  PoseLandmark,
  PoseLandmarkIndex,
  SkeletonState,
  HumanoidBone,
  SmoothedPoseData,
} from '@/types';

// ============================================================================
// CONSTANTS
// ============================================================================

// Standard humanoid bone names (compatible with Ready Player Me, Mixamo, etc.)
export const HUMANOID_BONE_NAMES = {
  HIPS: 'Hips',
  SPINE: 'Spine',
  SPINE1: 'Spine1',
  SPINE2: 'Spine2',
  CHEST: 'Chest',
  NECK: 'Neck',
  HEAD: 'Head',
  LEFT_SHOULDER: 'LeftShoulder',
  LEFT_UPPER_ARM: 'LeftArm',
  LEFT_LOWER_ARM: 'LeftForeArm',
  LEFT_HAND: 'LeftHand',
  RIGHT_SHOULDER: 'RightShoulder',
  RIGHT_UPPER_ARM: 'RightArm',
  RIGHT_LOWER_ARM: 'RightForeArm',
  RIGHT_HAND: 'RightHand',
  LEFT_UPPER_LEG: 'LeftUpLeg',
  LEFT_LOWER_LEG: 'LeftLeg',
  LEFT_FOOT: 'LeftFoot',
  LEFT_TOE: 'LeftToeBase',
  RIGHT_UPPER_LEG: 'RightUpLeg',
  RIGHT_LOWER_LEG: 'RightLeg',
  RIGHT_FOOT: 'RightFoot',
  RIGHT_TOE: 'RightToeBase',
} as const;

// Alternative naming conventions
export const MIXAMO_BONE_NAMES = {
  HIPS: 'mixamorigHips',
  SPINE: 'mixamorigSpine',
  SPINE1: 'mixamorigSpine1',
  SPINE2: 'mixamorigSpine2',
  NECK: 'mixamorigNeck',
  HEAD: 'mixamorigHead',
  LEFT_SHOULDER: 'mixamorigLeftShoulder',
  LEFT_UPPER_ARM: 'mixamorigLeftArm',
  LEFT_LOWER_ARM: 'mixamorigLeftForeArm',
  LEFT_HAND: 'mixamorigLeftHand',
  RIGHT_SHOULDER: 'mixamorigRightShoulder',
  RIGHT_UPPER_ARM: 'mixamorigRightArm',
  RIGHT_LOWER_ARM: 'mixamorigRightForeArm',
  RIGHT_HAND: 'mixamorigRightHand',
  LEFT_UPPER_LEG: 'mixamorigLeftUpLeg',
  LEFT_LOWER_LEG: 'mixamorigLeftLeg',
  LEFT_FOOT: 'mixamorigLeftFoot',
  LEFT_TOE: 'mixamorigLeftToeBase',
  RIGHT_UPPER_LEG: 'mixamorigRightUpLeg',
  RIGHT_LOWER_LEG: 'mixamorigRightLeg',
  RIGHT_FOOT: 'mixamorigRightFoot',
  RIGHT_TOE: 'mixamorigRightToeBase',
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a Vector3 from pose landmark
 */
function landmarkToVector3(landmark: PoseLandmark): THREE.Vector3 {
  return new THREE.Vector3(
    landmark.x,
    -landmark.y, // Flip Y axis (screen coords to 3D coords)
    -landmark.z  // Flip Z for correct depth
  );
}

/**
 * Calculate rotation quaternion from direction vector
 */
function directionToQuaternion(
  from: THREE.Vector3,
  to: THREE.Vector3,
  up: THREE.Vector3 = new THREE.Vector3(0, 1, 0)
): THREE.Quaternion {
  const direction = to.clone().sub(from).normalize();
  const quaternion = new THREE.Quaternion();
  
  // Create a matrix looking in the direction
  const matrix = new THREE.Matrix4();
  matrix.lookAt(new THREE.Vector3(), direction, up);
  quaternion.setFromRotationMatrix(matrix);
  
  return quaternion;
}

/**
 * Calculate angle between two vectors
 */
function angleBetweenVectors(v1: THREE.Vector3, v2: THREE.Vector3): number {
  return v1.angleTo(v2);
}

/**
 * Lerp between two quaternions for smooth transitions
 */
function lerpQuaternion(
  current: THREE.Quaternion,
  target: THREE.Quaternion,
  alpha: number
): THREE.Quaternion {
  return current.clone().slerp(target, alpha);
}

/**
 * Clamp angle to prevent impossible rotations
 */
function clampAngle(angle: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, angle));
}

// ============================================================================
// SKELETON RETARGETING CLASS
// ============================================================================

export interface RetargetingConfig {
  smoothingFactor: number;
  scaleMultiplier: number;
  rotationSensitivity: number;
  enableLegTracking: boolean;
  enableArmTracking: boolean;
  enableSpineTracking: boolean;
  enableHeadTracking: boolean;
  mirrorMode: boolean; // Mirror left/right for mirror-like effect
}

const DEFAULT_RETARGETING_CONFIG: RetargetingConfig = {
  smoothingFactor: 0.3,
  scaleMultiplier: 1.0,
  rotationSensitivity: 1.0,
  enableLegTracking: true,
  enableArmTracking: true,
  enableSpineTracking: true,
  enableHeadTracking: true,
  mirrorMode: false,
};

export class SkeletonRetargeting {
  private config: RetargetingConfig;
  private previousState: SkeletonState | null = null;
  
  // Reference pose for calibration
  private tPoseReference: Map<string, THREE.Quaternion> = new Map();
  private isCalibrated: boolean = false;

  // Bone length normalization
  private userBoneLengths: Map<string, number> = new Map();
  private avatarBoneLengths: Map<string, number> = new Map();

  constructor(config: Partial<RetargetingConfig> = {}) {
    this.config = { ...DEFAULT_RETARGETING_CONFIG, ...config };
  }

  /**
   * Initialize bone length normalization from avatar
   */
  calibrateAvatar(skeleton: THREE.Skeleton): void {
    const bones = skeleton.bones;
    
    bones.forEach(bone => {
      if (bone.parent && bone.parent instanceof THREE.Bone) {
        const length = bone.position.length();
        this.avatarBoneLengths.set(bone.name, length);
      }
    });

    console.log('[SkeletonRetargeting] Avatar calibrated with', this.avatarBoneLengths.size, 'bones');
  }

  /**
   * Calibrate user bone lengths from T-pose
   */
  calibrateUser(landmarks: PoseLandmark[]): void {
    // Calculate user's bone lengths
    const bonePairs = [
      { name: 'upperArmLeft', start: PoseLandmarkIndex.LEFT_SHOULDER, end: PoseLandmarkIndex.LEFT_ELBOW },
      { name: 'lowerArmLeft', start: PoseLandmarkIndex.LEFT_ELBOW, end: PoseLandmarkIndex.LEFT_WRIST },
      { name: 'upperArmRight', start: PoseLandmarkIndex.RIGHT_SHOULDER, end: PoseLandmarkIndex.RIGHT_ELBOW },
      { name: 'lowerArmRight', start: PoseLandmarkIndex.RIGHT_ELBOW, end: PoseLandmarkIndex.RIGHT_WRIST },
      { name: 'upperLegLeft', start: PoseLandmarkIndex.LEFT_HIP, end: PoseLandmarkIndex.LEFT_KNEE },
      { name: 'lowerLegLeft', start: PoseLandmarkIndex.LEFT_KNEE, end: PoseLandmarkIndex.LEFT_ANKLE },
      { name: 'upperLegRight', start: PoseLandmarkIndex.RIGHT_HIP, end: PoseLandmarkIndex.RIGHT_KNEE },
      { name: 'lowerLegRight', start: PoseLandmarkIndex.RIGHT_KNEE, end: PoseLandmarkIndex.RIGHT_ANKLE },
      { name: 'spine', start: PoseLandmarkIndex.LEFT_HIP, end: PoseLandmarkIndex.LEFT_SHOULDER },
    ];

    bonePairs.forEach(({ name, start, end }) => {
      const startPos = landmarkToVector3(landmarks[start]);
      const endPos = landmarkToVector3(landmarks[end]);
      const length = startPos.distanceTo(endPos);
      this.userBoneLengths.set(name, length);
    });

    this.isCalibrated = true;
    console.log('[SkeletonRetargeting] User calibrated');
  }

  /**
   * Main retargeting function - convert pose to skeleton state
   */
  retarget(poseData: SmoothedPoseData): SkeletonState {
    const { landmarks, worldLandmarks } = poseData;
    
    // Use world landmarks for 3D accuracy
    const lm = worldLandmarks;

    // Create bone state object
    const state: SkeletonState = {
      hips: this.calculateHips(lm),
      spine: this.calculateSpine(lm),
      chest: this.calculateChest(lm),
      neck: this.calculateNeck(lm),
      head: this.calculateHead(lm),
      leftShoulder: this.calculateShoulder(lm, 'left'),
      leftUpperArm: this.calculateUpperArm(lm, 'left'),
      leftLowerArm: this.calculateLowerArm(lm, 'left'),
      leftHand: this.calculateHand(lm, 'left'),
      rightShoulder: this.calculateShoulder(lm, 'right'),
      rightUpperArm: this.calculateUpperArm(lm, 'right'),
      rightLowerArm: this.calculateLowerArm(lm, 'right'),
      rightHand: this.calculateHand(lm, 'right'),
      leftUpperLeg: this.calculateUpperLeg(lm, 'left'),
      leftLowerLeg: this.calculateLowerLeg(lm, 'left'),
      leftFoot: this.calculateFoot(lm, 'left'),
      rightUpperLeg: this.calculateUpperLeg(lm, 'right'),
      rightLowerLeg: this.calculateLowerLeg(lm, 'right'),
      rightFoot: this.calculateFoot(lm, 'right'),
    };

    // Apply smoothing
    if (this.previousState) {
      this.smoothState(state, this.previousState);
    }

    this.previousState = state;
    return state;
  }

  /**
   * Calculate hip bone transform
   */
  private calculateHips(lm: PoseLandmark[]): HumanoidBone {
    const leftHip = landmarkToVector3(lm[PoseLandmarkIndex.LEFT_HIP]);
    const rightHip = landmarkToVector3(lm[PoseLandmarkIndex.RIGHT_HIP]);
    
    // Hip center position
    const position = leftHip.clone().add(rightHip).multiplyScalar(0.5);
    position.multiplyScalar(this.config.scaleMultiplier);

    // Hip rotation from hip direction
    const hipDirection = rightHip.clone().sub(leftHip).normalize();
    const forward = new THREE.Vector3(0, 0, 1);
    
    // Calculate yaw rotation
    const yaw = Math.atan2(hipDirection.x, hipDirection.z);
    
    // Calculate tilt from shoulder line
    const leftShoulder = landmarkToVector3(lm[PoseLandmarkIndex.LEFT_SHOULDER]);
    const rightShoulder = landmarkToVector3(lm[PoseLandmarkIndex.RIGHT_SHOULDER]);
    const shoulderMid = leftShoulder.clone().add(rightShoulder).multiplyScalar(0.5);
    
    const spineDirection = shoulderMid.clone().sub(position).normalize();
    const pitch = Math.asin(clampAngle(-spineDirection.z, -1, 1));
    const roll = Math.atan2(
      rightHip.y - leftHip.y,
      rightHip.clone().sub(leftHip).length()
    );

    const quaternion = new THREE.Quaternion();
    quaternion.setFromEuler(new THREE.Euler(
      pitch * this.config.rotationSensitivity,
      yaw * this.config.rotationSensitivity,
      roll * this.config.rotationSensitivity,
      'YXZ'
    ));

    return {
      name: 'Hips',
      quaternion,
      position,
      scale: new THREE.Vector3(1, 1, 1),
    };
  }

  /**
   * Calculate spine bone transform
   */
  private calculateSpine(lm: PoseLandmark[]): HumanoidBone {
    const hipMid = landmarkToVector3(lm[PoseLandmarkIndex.LEFT_HIP])
      .add(landmarkToVector3(lm[PoseLandmarkIndex.RIGHT_HIP]))
      .multiplyScalar(0.5);
    
    const shoulderMid = landmarkToVector3(lm[PoseLandmarkIndex.LEFT_SHOULDER])
      .add(landmarkToVector3(lm[PoseLandmarkIndex.RIGHT_SHOULDER]))
      .multiplyScalar(0.5);

    const spineDirection = shoulderMid.clone().sub(hipMid).normalize();
    
    const quaternion = directionToQuaternion(hipMid, shoulderMid);

    return {
      name: 'Spine',
      quaternion,
      position: hipMid.clone().lerp(shoulderMid, 0.33),
      scale: new THREE.Vector3(1, 1, 1),
    };
  }

  /**
   * Calculate chest bone transform
   */
  private calculateChest(lm: PoseLandmark[]): HumanoidBone {
    const hipMid = landmarkToVector3(lm[PoseLandmarkIndex.LEFT_HIP])
      .add(landmarkToVector3(lm[PoseLandmarkIndex.RIGHT_HIP]))
      .multiplyScalar(0.5);
    
    const shoulderMid = landmarkToVector3(lm[PoseLandmarkIndex.LEFT_SHOULDER])
      .add(landmarkToVector3(lm[PoseLandmarkIndex.RIGHT_SHOULDER]))
      .multiplyScalar(0.5);

    const quaternion = directionToQuaternion(hipMid, shoulderMid);

    return {
      name: 'Chest',
      quaternion,
      position: hipMid.clone().lerp(shoulderMid, 0.66),
      scale: new THREE.Vector3(1, 1, 1),
    };
  }

  /**
   * Calculate neck bone transform
   */
  private calculateNeck(lm: PoseLandmark[]): HumanoidBone {
    const shoulderMid = landmarkToVector3(lm[PoseLandmarkIndex.LEFT_SHOULDER])
      .add(landmarkToVector3(lm[PoseLandmarkIndex.RIGHT_SHOULDER]))
      .multiplyScalar(0.5);
    
    const nose = landmarkToVector3(lm[PoseLandmarkIndex.NOSE]);
    
    // Estimate neck position
    const neckPos = shoulderMid.clone().lerp(nose, 0.3);
    
    const quaternion = directionToQuaternion(shoulderMid, nose);

    return {
      name: 'Neck',
      quaternion,
      position: neckPos,
      scale: new THREE.Vector3(1, 1, 1),
    };
  }

  /**
   * Calculate head bone transform
   */
  private calculateHead(lm: PoseLandmark[]): HumanoidBone {
    const nose = landmarkToVector3(lm[PoseLandmarkIndex.NOSE]);
    const leftEar = landmarkToVector3(lm[PoseLandmarkIndex.LEFT_EAR]);
    const rightEar = landmarkToVector3(lm[PoseLandmarkIndex.RIGHT_EAR]);
    
    // Head rotation from ear positions
    const earDirection = rightEar.clone().sub(leftEar).normalize();
    const yaw = Math.atan2(earDirection.z, earDirection.x);
    
    // Pitch from nose position relative to ears
    const earMid = leftEar.clone().add(rightEar).multiplyScalar(0.5);
    const noseOffset = nose.clone().sub(earMid);
    const pitch = Math.atan2(-noseOffset.y, Math.sqrt(noseOffset.x * noseOffset.x + noseOffset.z * noseOffset.z));
    
    // Roll from ear height difference
    const roll = Math.atan2(leftEar.y - rightEar.y, leftEar.clone().sub(rightEar).length());

    const quaternion = new THREE.Quaternion();
    quaternion.setFromEuler(new THREE.Euler(
      pitch * this.config.rotationSensitivity,
      yaw * this.config.rotationSensitivity,
      roll * this.config.rotationSensitivity,
      'YXZ'
    ));

    return {
      name: 'Head',
      quaternion,
      position: nose,
      scale: new THREE.Vector3(1, 1, 1),
    };
  }

  /**
   * Calculate shoulder bone transform
   */
  private calculateShoulder(lm: PoseLandmark[], side: 'left' | 'right'): HumanoidBone {
    const shoulderIdx = side === 'left' 
      ? PoseLandmarkIndex.LEFT_SHOULDER 
      : PoseLandmarkIndex.RIGHT_SHOULDER;
    
    const actualSide = this.config.mirrorMode 
      ? (side === 'left' ? 'right' : 'left') 
      : side;

    const shoulder = landmarkToVector3(lm[shoulderIdx]);
    
    return {
      name: actualSide === 'left' ? 'LeftShoulder' : 'RightShoulder',
      quaternion: new THREE.Quaternion(),
      position: shoulder,
      scale: new THREE.Vector3(1, 1, 1),
    };
  }

  /**
   * Calculate upper arm bone transform
   */
  private calculateUpperArm(lm: PoseLandmark[], side: 'left' | 'right'): HumanoidBone {
    const shoulderIdx = side === 'left' 
      ? PoseLandmarkIndex.LEFT_SHOULDER 
      : PoseLandmarkIndex.RIGHT_SHOULDER;
    const elbowIdx = side === 'left' 
      ? PoseLandmarkIndex.LEFT_ELBOW 
      : PoseLandmarkIndex.RIGHT_ELBOW;

    const actualSide = this.config.mirrorMode 
      ? (side === 'left' ? 'right' : 'left') 
      : side;

    const shoulder = landmarkToVector3(lm[shoulderIdx]);
    const elbow = landmarkToVector3(lm[elbowIdx]);

    const direction = elbow.clone().sub(shoulder).normalize();
    
    // Calculate rotation
    const quaternion = new THREE.Quaternion();
    const defaultDir = new THREE.Vector3(side === 'left' ? -1 : 1, 0, 0);
    quaternion.setFromUnitVectors(defaultDir, direction);

    return {
      name: actualSide === 'left' ? 'LeftArm' : 'RightArm',
      quaternion,
      position: shoulder,
      scale: new THREE.Vector3(1, 1, 1),
    };
  }

  /**
   * Calculate lower arm (forearm) bone transform
   */
  private calculateLowerArm(lm: PoseLandmark[], side: 'left' | 'right'): HumanoidBone {
    const elbowIdx = side === 'left' 
      ? PoseLandmarkIndex.LEFT_ELBOW 
      : PoseLandmarkIndex.RIGHT_ELBOW;
    const wristIdx = side === 'left' 
      ? PoseLandmarkIndex.LEFT_WRIST 
      : PoseLandmarkIndex.RIGHT_WRIST;

    const actualSide = this.config.mirrorMode 
      ? (side === 'left' ? 'right' : 'left') 
      : side;

    const elbow = landmarkToVector3(lm[elbowIdx]);
    const wrist = landmarkToVector3(lm[wristIdx]);

    const direction = wrist.clone().sub(elbow).normalize();
    
    const quaternion = new THREE.Quaternion();
    const defaultDir = new THREE.Vector3(side === 'left' ? -1 : 1, 0, 0);
    quaternion.setFromUnitVectors(defaultDir, direction);

    return {
      name: actualSide === 'left' ? 'LeftForeArm' : 'RightForeArm',
      quaternion,
      position: elbow,
      scale: new THREE.Vector3(1, 1, 1),
    };
  }

  /**
   * Calculate hand bone transform
   */
  private calculateHand(lm: PoseLandmark[], side: 'left' | 'right'): HumanoidBone {
    const wristIdx = side === 'left' 
      ? PoseLandmarkIndex.LEFT_WRIST 
      : PoseLandmarkIndex.RIGHT_WRIST;
    const indexIdx = side === 'left' 
      ? PoseLandmarkIndex.LEFT_INDEX 
      : PoseLandmarkIndex.RIGHT_INDEX;

    const actualSide = this.config.mirrorMode 
      ? (side === 'left' ? 'right' : 'left') 
      : side;

    const wrist = landmarkToVector3(lm[wristIdx]);
    const index = landmarkToVector3(lm[indexIdx]);

    const direction = index.clone().sub(wrist).normalize();
    
    const quaternion = new THREE.Quaternion();
    const defaultDir = new THREE.Vector3(side === 'left' ? -1 : 1, 0, 0);
    quaternion.setFromUnitVectors(defaultDir, direction);

    return {
      name: actualSide === 'left' ? 'LeftHand' : 'RightHand',
      quaternion,
      position: wrist,
      scale: new THREE.Vector3(1, 1, 1),
    };
  }

  /**
   * Calculate upper leg (thigh) bone transform
   */
  private calculateUpperLeg(lm: PoseLandmark[], side: 'left' | 'right'): HumanoidBone {
    const hipIdx = side === 'left' 
      ? PoseLandmarkIndex.LEFT_HIP 
      : PoseLandmarkIndex.RIGHT_HIP;
    const kneeIdx = side === 'left' 
      ? PoseLandmarkIndex.LEFT_KNEE 
      : PoseLandmarkIndex.RIGHT_KNEE;

    const actualSide = this.config.mirrorMode 
      ? (side === 'left' ? 'right' : 'left') 
      : side;

    const hip = landmarkToVector3(lm[hipIdx]);
    const knee = landmarkToVector3(lm[kneeIdx]);

    const direction = knee.clone().sub(hip).normalize();
    
    const quaternion = new THREE.Quaternion();
    const defaultDir = new THREE.Vector3(0, -1, 0);
    quaternion.setFromUnitVectors(defaultDir, direction);

    return {
      name: actualSide === 'left' ? 'LeftUpLeg' : 'RightUpLeg',
      quaternion,
      position: hip,
      scale: new THREE.Vector3(1, 1, 1),
    };
  }

  /**
   * Calculate lower leg (shin) bone transform
   */
  private calculateLowerLeg(lm: PoseLandmark[], side: 'left' | 'right'): HumanoidBone {
    const kneeIdx = side === 'left' 
      ? PoseLandmarkIndex.LEFT_KNEE 
      : PoseLandmarkIndex.RIGHT_KNEE;
    const ankleIdx = side === 'left' 
      ? PoseLandmarkIndex.LEFT_ANKLE 
      : PoseLandmarkIndex.RIGHT_ANKLE;

    const actualSide = this.config.mirrorMode 
      ? (side === 'left' ? 'right' : 'left') 
      : side;

    const knee = landmarkToVector3(lm[kneeIdx]);
    const ankle = landmarkToVector3(lm[ankleIdx]);

    const direction = ankle.clone().sub(knee).normalize();
    
    const quaternion = new THREE.Quaternion();
    const defaultDir = new THREE.Vector3(0, -1, 0);
    quaternion.setFromUnitVectors(defaultDir, direction);

    return {
      name: actualSide === 'left' ? 'LeftLeg' : 'RightLeg',
      quaternion,
      position: knee,
      scale: new THREE.Vector3(1, 1, 1),
    };
  }

  /**
   * Calculate foot bone transform
   */
  private calculateFoot(lm: PoseLandmark[], side: 'left' | 'right'): HumanoidBone {
    const ankleIdx = side === 'left' 
      ? PoseLandmarkIndex.LEFT_ANKLE 
      : PoseLandmarkIndex.RIGHT_ANKLE;
    const toeIdx = side === 'left' 
      ? PoseLandmarkIndex.LEFT_FOOT_INDEX 
      : PoseLandmarkIndex.RIGHT_FOOT_INDEX;
    const heelIdx = side === 'left' 
      ? PoseLandmarkIndex.LEFT_HEEL 
      : PoseLandmarkIndex.RIGHT_HEEL;

    const actualSide = this.config.mirrorMode 
      ? (side === 'left' ? 'right' : 'left') 
      : side;

    const ankle = landmarkToVector3(lm[ankleIdx]);
    const toe = landmarkToVector3(lm[toeIdx]);
    const heel = landmarkToVector3(lm[heelIdx]);

    // Foot direction from heel to toe
    const direction = toe.clone().sub(heel).normalize();
    
    const quaternion = new THREE.Quaternion();
    const defaultDir = new THREE.Vector3(0, 0, 1);
    quaternion.setFromUnitVectors(defaultDir, direction);

    return {
      name: actualSide === 'left' ? 'LeftFoot' : 'RightFoot',
      quaternion,
      position: ankle,
      scale: new THREE.Vector3(1, 1, 1),
    };
  }

  /**
   * Apply smoothing between states
   */
  private smoothState(current: SkeletonState, previous: SkeletonState): void {
    const alpha = this.config.smoothingFactor;
    
    Object.keys(current).forEach(key => {
      const bone = current[key as keyof SkeletonState];
      const prevBone = previous[key as keyof SkeletonState];
      
      if (bone && prevBone) {
        // Smooth quaternion
        bone.quaternion.slerp(prevBone.quaternion, 1 - alpha);
        
        // Smooth position
        bone.position.lerp(prevBone.position, 1 - alpha);
      }
    });
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RetargetingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Reset state
   */
  reset(): void {
    this.previousState = null;
    this.isCalibrated = false;
    this.userBoneLengths.clear();
  }
}

// ============================================================================
// APPLY SKELETON TO AVATAR
// ============================================================================

/**
 * Apply retargeted skeleton state to Three.js skeleton
 */
export function applySkeletonState(
  skeleton: THREE.Skeleton,
  state: SkeletonState,
  boneNameMapping?: Record<string, string>
): void {
  const defaultMapping: Record<string, string> = {
    Hips: 'Hips',
    Spine: 'Spine',
    Chest: 'Spine2',
    Neck: 'Neck',
    Head: 'Head',
    LeftShoulder: 'LeftShoulder',
    LeftArm: 'LeftArm',
    LeftForeArm: 'LeftForeArm',
    LeftHand: 'LeftHand',
    RightShoulder: 'RightShoulder',
    RightArm: 'RightArm',
    RightForeArm: 'RightForeArm',
    RightHand: 'RightHand',
    LeftUpLeg: 'LeftUpLeg',
    LeftLeg: 'LeftLeg',
    LeftFoot: 'LeftFoot',
    RightUpLeg: 'RightUpLeg',
    RightLeg: 'RightLeg',
    RightFoot: 'RightFoot',
  };

  const mapping = boneNameMapping || defaultMapping;

  // Find and update each bone
  Object.values(state).forEach(boneState => {
    const boneName = mapping[boneState.name] || boneState.name;
    
    // Find bone by name (try multiple naming conventions)
    let bone = skeleton.bones.find(b => 
      b.name === boneName ||
      b.name === `mixamorig${boneName}` ||
      b.name.toLowerCase() === boneName.toLowerCase()
    );

    if (bone) {
      bone.quaternion.copy(boneState.quaternion);
      // Don't update position for most bones (only hips root)
      if (boneState.name === 'Hips') {
        // Scale position to avatar space
        bone.position.set(
          boneState.position.x * 100, // Scale factor
          boneState.position.y * 100,
          boneState.position.z * 100
        );
      }
    }
  });
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let retargetingInstance: SkeletonRetargeting | null = null;

export function getSkeletonRetargeting(config?: Partial<RetargetingConfig>): SkeletonRetargeting {
  if (!retargetingInstance) {
    retargetingInstance = new SkeletonRetargeting(config);
  }
  return retargetingInstance;
}

export function destroySkeletonRetargeting(): void {
  if (retargetingInstance) {
    retargetingInstance.reset();
    retargetingInstance = null;
  }
}
