// ============================================================================
// MIRRORBODY-X : SCENE COMPONENT
// Three.js scene with avatar and effects
// ============================================================================

'use client';

import React, { useRef, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  Environment, 
  OrbitControls, 
  PerspectiveCamera,
  useEnvironment,
  ContactShadows,
} from '@react-three/drei';
import * as THREE from 'three';
import { SmoothedPoseData, AppSettings, LightingPreset } from '@/types';
import { MirrorAvatar } from '@/components/avatar';

interface MirrorSceneProps {
  pose: SmoothedPoseData | null;
  settings: AppSettings;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

// Environment presets mapping
const ENVIRONMENT_PRESETS: Record<LightingPreset, string> = {
  studio: 'studio',
  sunset: 'sunset',
  neon: 'night',
  dramatic: 'warehouse',
  soft: 'apartment',
};

export function MirrorScene({ pose, settings, onCanvasReady }: MirrorSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Notify parent when canvas is ready
  useEffect(() => {
    if (canvasRef.current) {
      onCanvasReady?.(canvasRef.current);
    }
  }, [onCanvasReady]);

  return (
    <Canvas
      ref={canvasRef}
      shadows
      dpr={[1, 2]}
      gl={{ 
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true, // Required for screenshots
      }}
      camera={{ position: [0, 1.5, 3], fov: 50 }}
      style={{ background: 'transparent' }}
    >
      <Suspense fallback={<LoadingIndicator />}>
        <SceneContent pose={pose} settings={settings} />
      </Suspense>
    </Canvas>
  );
}

// ============================================================================
// SCENE CONTENT
// ============================================================================

interface SceneContentProps {
  pose: SmoothedPoseData | null;
  settings: AppSettings;
}

function SceneContent({ pose, settings }: SceneContentProps) {
  const { gl, scene, camera } = useThree();

  // Performance optimization
  useEffect(() => {
    gl.setPixelRatio(settings.performanceMode === 'performance' ? 1 : window.devicePixelRatio);
  }, [gl, settings.performanceMode]);

  const envPreset = ENVIRONMENT_PRESETS[settings.lightingPreset];

  return (
    <>
      {/* Camera */}
      <PerspectiveCamera makeDefault position={[0, 1.5, 3]} fov={50} />
      
      {/* Controls */}
      <OrbitControls
        enablePan={false}
        minDistance={2}
        maxDistance={6}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.5}
        target={[0, 1, 0]}
      />

      {/* Lighting */}
      <SceneLighting preset={settings.lightingPreset} intensity={settings.environmentIntensity} />

      {/* Environment */}
      <Environment preset={envPreset as any} background={false} />

      {/* Mirror Avatar */}
      {settings.cloneEnabled && (
        <MirrorAvatar
          pose={pose}
          position={[
            settings.cloneOffset.x,
            settings.cloneOffset.y,
            settings.cloneOffset.z,
          ]}
          rotation={[0, settings.cloneRotation, 0]}
          metalness={settings.mirrorMetalness}
          roughness={settings.mirrorRoughness}
          envMapIntensity={settings.shaderIntensity}
          fresnelPower={settings.fresnelPower}
          tintColor={settings.tintColor}
          visible={settings.cloneEnabled}
        />
      )}

      {/* Floor */}
      {settings.effects.floorReflection.enabled && (
        <ReflectiveFloor settings={settings} />
      )}

      {/* Contact Shadows */}
      {settings.effects.shadowEnabled && (
        <ContactShadows
          position={[0, 0, 0]}
          opacity={0.5}
          scale={10}
          blur={2}
          far={4}
          color="#000000"
        />
      )}
    </>
  );
}

// ============================================================================
// LIGHTING SYSTEM
// ============================================================================

interface SceneLightingProps {
  preset: LightingPreset;
  intensity: number;
}

function SceneLighting({ preset, intensity }: SceneLightingProps) {
  const lightConfigs: Record<LightingPreset, {
    ambient: number;
    directional: { color: string; intensity: number; position: [number, number, number] };
    point?: { color: string; intensity: number; position: [number, number, number] };
  }> = {
    studio: {
      ambient: 0.5,
      directional: { color: '#ffffff', intensity: 1, position: [5, 10, 5] },
    },
    sunset: {
      ambient: 0.3,
      directional: { color: '#ff8844', intensity: 1.2, position: [10, 5, 0] },
      point: { color: '#ffaa44', intensity: 0.5, position: [-5, 3, -5] },
    },
    neon: {
      ambient: 0.2,
      directional: { color: '#8844ff', intensity: 0.8, position: [0, 10, 5] },
      point: { color: '#00ffff', intensity: 1, position: [3, 2, 3] },
    },
    dramatic: {
      ambient: 0.1,
      directional: { color: '#ffffff', intensity: 1.5, position: [5, 15, -5] },
    },
    soft: {
      ambient: 0.6,
      directional: { color: '#ffffee', intensity: 0.7, position: [5, 8, 5] },
    },
  };

  const config = lightConfigs[preset];

  return (
    <>
      <ambientLight intensity={config.ambient * intensity} />
      
      <directionalLight
        color={config.directional.color}
        intensity={config.directional.intensity * intensity}
        position={config.directional.position}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />

      {config.point && (
        <pointLight
          color={config.point.color}
          intensity={config.point.intensity * intensity}
          position={config.point.position}
          distance={10}
        />
      )}
    </>
  );
}

// ============================================================================
// REFLECTIVE FLOOR
// ============================================================================

interface ReflectiveFloorProps {
  settings: AppSettings;
}

function ReflectiveFloor({ settings }: ReflectiveFloorProps) {
  const floorConfig = settings.effects.floorReflection;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial
        color={floorConfig.color}
        metalness={0.8}
        roughness={floorConfig.blur}
        transparent
        opacity={floorConfig.opacity}
      />
    </mesh>
  );
}

// ============================================================================
// LOADING INDICATOR
// ============================================================================

function LoadingIndicator() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 2;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 1, 0]}>
      <boxGeometry args={[0.3, 0.3, 0.3]} />
      <meshStandardMaterial color="#00ffff" wireframe />
    </mesh>
  );
}

export default MirrorScene;
