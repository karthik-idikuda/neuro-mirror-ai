// ============================================================================
// MIRRORBODY-X : MIRROR AVATAR COMPONENT
// 3D Humanoid avatar with real-time pose binding and mirror shader
// ============================================================================

'use client';

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { SkeletonState, SmoothedPoseData } from '@/types';
import { SkeletonRetargeting, applySkeletonState } from '@/lib/skeleton-retargeting';
import { createMirrorMaterial, updateMirrorMaterial, MATERIAL_PRESETS } from '@/lib/mirror-shader';

interface MirrorAvatarProps {
  pose: SmoothedPoseData | null;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  metalness?: number;
  roughness?: number;
  envMapIntensity?: number;
  fresnelPower?: number;
  tintColor?: string;
  materialPreset?: keyof typeof MATERIAL_PRESETS;
  visible?: boolean;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export function MirrorAvatar({
  pose,
  position = [1.5, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  metalness = 1.0,
  roughness = 0.05,
  envMapIntensity = 1.5,
  fresnelPower = 2.5,
  tintColor = '#88ccff',
  materialPreset,
  visible = true,
  onLoad,
  onError,
}: MirrorAvatarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const skeletonRef = useRef<THREE.Skeleton | null>(null);
  const retargetingRef = useRef<SkeletonRetargeting | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const meshRef = useRef<THREE.SkinnedMesh | null>(null);

  // Create retargeting system
  useEffect(() => {
    retargetingRef.current = new SkeletonRetargeting({
      mirrorMode: true, // Mirror for reflection effect
      smoothingFactor: 0.3,
    });

    return () => {
      retargetingRef.current = null;
    };
  }, []);

  // Create mirror material
  const mirrorMaterial = useMemo(() => {
    const material = createMirrorMaterial({
      metalness,
      roughness,
      envMapIntensity,
      fresnelPower,
      tint: new THREE.Color(tintColor),
    });
    materialRef.current = material;
    return material;
  }, []);

  // Update material when props change
  useEffect(() => {
    if (materialRef.current) {
      if (materialPreset) {
        const preset = MATERIAL_PRESETS[materialPreset];
        updateMirrorMaterial(materialRef.current, preset);
      } else {
        updateMirrorMaterial(materialRef.current, {
          metalness,
          roughness,
          envMapIntensity,
          fresnelPower,
          tint: new THREE.Color(tintColor),
        });
      }
    }
  }, [metalness, roughness, envMapIntensity, fresnelPower, tintColor, materialPreset]);

  // Create procedural humanoid mesh
  const humanoidGeometry = useMemo(() => {
    return createProceduralHumanoid();
  }, []);

  // Animation frame update
  useFrame((_, delta) => {
    // Update time uniform
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }

    // Apply pose to skeleton
    if (pose && retargetingRef.current && skeletonRef.current) {
      const skeletonState = retargetingRef.current.retarget(pose);
      applySkeletonState(skeletonRef.current, skeletonState);
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      scale={[scale, scale, scale]}
      visible={visible}
    >
      {/* Procedural humanoid with mirror material */}
      <ProceduralHumanoidMesh 
        material={mirrorMaterial}
        onSkeletonReady={(skeleton) => {
          skeletonRef.current = skeleton;
          if (retargetingRef.current) {
            retargetingRef.current.calibrateAvatar(skeleton);
          }
          onLoad?.();
        }}
      />
    </group>
  );
}

// ============================================================================
// PROCEDURAL HUMANOID MESH
// ============================================================================

interface ProceduralHumanoidMeshProps {
  material: THREE.Material;
  onSkeletonReady?: (skeleton: THREE.Skeleton) => void;
}

function ProceduralHumanoidMesh({ material, onSkeletonReady }: ProceduralHumanoidMeshProps) {
  const meshRef = useRef<THREE.SkinnedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!groupRef.current) return;

    // Create skeleton hierarchy
    const { bones, skeleton, geometry } = createHumanoidSkeleton();

    // Create skinned mesh
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.add(bones[0]); // Add root bone to mesh
    mesh.bind(skeleton);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    groupRef.current.add(mesh);
    
    onSkeletonReady?.(skeleton);

    return () => {
      geometry.dispose();
      groupRef.current?.remove(mesh);
    };
  }, [material, onSkeletonReady]);

  return <group ref={groupRef} />;
}

// ============================================================================
// SKELETON CREATION
// ============================================================================

function createHumanoidSkeleton() {
  const bones: THREE.Bone[] = [];
  const boneNames: string[] = [];

  // Helper to create a bone
  const createBone = (name: string, parent: THREE.Bone | null, position: THREE.Vector3) => {
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.copy(position);
    if (parent) {
      parent.add(bone);
    }
    bones.push(bone);
    boneNames.push(name);
    return bone;
  };

  // Create bone hierarchy (Y-up, Z-forward)
  const hips = createBone('Hips', null, new THREE.Vector3(0, 1, 0));
  const spine = createBone('Spine', hips, new THREE.Vector3(0, 0.1, 0));
  const spine1 = createBone('Spine1', spine, new THREE.Vector3(0, 0.15, 0));
  const spine2 = createBone('Spine2', spine1, new THREE.Vector3(0, 0.15, 0));
  const neck = createBone('Neck', spine2, new THREE.Vector3(0, 0.1, 0));
  const head = createBone('Head', neck, new THREE.Vector3(0, 0.15, 0));

  // Left arm
  const leftShoulder = createBone('LeftShoulder', spine2, new THREE.Vector3(0.05, 0.05, 0));
  const leftArm = createBone('LeftArm', leftShoulder, new THREE.Vector3(0.15, 0, 0));
  const leftForeArm = createBone('LeftForeArm', leftArm, new THREE.Vector3(0.25, 0, 0));
  const leftHand = createBone('LeftHand', leftForeArm, new THREE.Vector3(0.25, 0, 0));

  // Right arm
  const rightShoulder = createBone('RightShoulder', spine2, new THREE.Vector3(-0.05, 0.05, 0));
  const rightArm = createBone('RightArm', rightShoulder, new THREE.Vector3(-0.15, 0, 0));
  const rightForeArm = createBone('RightForeArm', rightArm, new THREE.Vector3(-0.25, 0, 0));
  const rightHand = createBone('RightHand', rightForeArm, new THREE.Vector3(-0.25, 0, 0));

  // Left leg
  const leftUpLeg = createBone('LeftUpLeg', hips, new THREE.Vector3(0.1, 0, 0));
  const leftLeg = createBone('LeftLeg', leftUpLeg, new THREE.Vector3(0, -0.45, 0));
  const leftFoot = createBone('LeftFoot', leftLeg, new THREE.Vector3(0, -0.45, 0));
  const leftToeBase = createBone('LeftToeBase', leftFoot, new THREE.Vector3(0, 0, 0.15));

  // Right leg
  const rightUpLeg = createBone('RightUpLeg', hips, new THREE.Vector3(-0.1, 0, 0));
  const rightLeg = createBone('RightLeg', rightUpLeg, new THREE.Vector3(0, -0.45, 0));
  const rightFoot = createBone('RightFoot', rightLeg, new THREE.Vector3(0, -0.45, 0));
  const rightToeBase = createBone('RightToeBase', rightFoot, new THREE.Vector3(0, 0, 0.15));

  // Create skeleton
  const skeleton = new THREE.Skeleton(bones);

  // Create skinned geometry
  const geometry = createSkinnedGeometry(bones, boneNames);

  return { bones, skeleton, geometry };
}

function createSkinnedGeometry(bones: THREE.Bone[], boneNames: string[]): THREE.BufferGeometry {
  // Create a simple capsule-based humanoid
  const geometry = new THREE.BufferGeometry();
  
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  const indices: number[] = [];

  // Helper to add a capsule segment
  const addCapsule = (
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    radius: number,
    boneIndex: number,
    segments: number = 8
  ) => {
    const startIdx = positions.length / 3;
    const direction = endPos.clone().sub(startPos);
    const length = direction.length();
    direction.normalize();

    // Create quaternion to rotate from Y-axis to direction
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

    const matrix = new THREE.Matrix4();
    matrix.makeRotationFromQuaternion(quaternion);
    matrix.setPosition(startPos);

    // Generate cylinder vertices
    for (let i = 0; i <= segments; i++) {
      const v = i / segments;
      const y = v * length;
      
      for (let j = 0; j <= 8; j++) {
        const u = j / 8;
        const theta = u * Math.PI * 2;
        
        const x = Math.cos(theta) * radius;
        const z = Math.sin(theta) * radius;
        
        const vertex = new THREE.Vector3(x, y, z);
        vertex.applyMatrix4(matrix);
        
        positions.push(vertex.x, vertex.y, vertex.z);
        
        const normal = new THREE.Vector3(x, 0, z).normalize();
        normal.applyQuaternion(quaternion);
        normals.push(normal.x, normal.y, normal.z);
        
        uvs.push(u, v);
        
        skinIndices.push(boneIndex, 0, 0, 0);
        skinWeights.push(1, 0, 0, 0);
      }
    }

    // Generate indices
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < 8; j++) {
        const a = startIdx + i * 9 + j;
        const b = startIdx + i * 9 + j + 1;
        const c = startIdx + (i + 1) * 9 + j;
        const d = startIdx + (i + 1) * 9 + j + 1;
        
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }
  };

  // Add body parts
  // Torso
  addCapsule(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1.5, 0), 0.15, 0, 4);
  
  // Head
  addCapsule(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 1.85, 0), 0.1, 5, 4);
  
  // Left arm
  addCapsule(new THREE.Vector3(0.2, 1.45, 0), new THREE.Vector3(0.45, 1.45, 0), 0.04, 7, 3);
  addCapsule(new THREE.Vector3(0.45, 1.45, 0), new THREE.Vector3(0.7, 1.45, 0), 0.035, 8, 3);
  
  // Right arm
  addCapsule(new THREE.Vector3(-0.2, 1.45, 0), new THREE.Vector3(-0.45, 1.45, 0), 0.04, 11, 3);
  addCapsule(new THREE.Vector3(-0.45, 1.45, 0), new THREE.Vector3(-0.7, 1.45, 0), 0.035, 12, 3);
  
  // Left leg
  addCapsule(new THREE.Vector3(0.1, 1, 0), new THREE.Vector3(0.1, 0.55, 0), 0.06, 14, 3);
  addCapsule(new THREE.Vector3(0.1, 0.55, 0), new THREE.Vector3(0.1, 0.1, 0), 0.05, 15, 3);
  
  // Right leg
  addCapsule(new THREE.Vector3(-0.1, 1, 0), new THREE.Vector3(-0.1, 0.55, 0), 0.06, 18, 3);
  addCapsule(new THREE.Vector3(-0.1, 0.55, 0), new THREE.Vector3(-0.1, 0.1, 0), 0.05, 19, 3);

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geometry.setIndex(indices);

  geometry.computeBoundingSphere();

  return geometry;
}

// ============================================================================
// PROCEDURAL HUMANOID HELPER
// ============================================================================

function createProceduralHumanoid(): THREE.BufferGeometry {
  // Create a simple humanoid shape
  const group = new THREE.Group();
  
  // This is a fallback - the actual skinned mesh is created in ProceduralHumanoidMesh
  const geometry = new THREE.BoxGeometry(0.4, 1.8, 0.2);
  return geometry;
}

export default MirrorAvatar;
