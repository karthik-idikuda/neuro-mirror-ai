// ============================================================================
// MIRRORBODY-X : MIRROR SHADER SYSTEM
// Chrome/Mirror PBR Material with Fresnel, Environment Reflections, HDR
// ============================================================================

import * as THREE from 'three';
import { MirrorShaderUniforms } from '@/types';

// ============================================================================
// GLSL SHADER CODE
// ============================================================================

/**
 * Chrome Mirror Vertex Shader
 */
export const mirrorVertexShader = /* glsl */ `
precision highp float;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vViewDirection;
varying vec2 vUv;
varying vec3 vReflect;
varying float vFresnel;

uniform float uTime;
uniform float uFresnelPower;
uniform float uFresnelBias;

void main() {
  vUv = uv;
  
  // World space calculations
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  
  // Normal in world space
  vWorldNormal = normalize(normalMatrix * normal);
  
  // View direction
  vec3 cameraToVertex = normalize(worldPosition.xyz - cameraPosition);
  vViewDirection = cameraToVertex;
  
  // Reflection vector for environment mapping
  vReflect = reflect(cameraToVertex, vWorldNormal);
  
  // Fresnel calculation (schlick approximation)
  float dotProduct = dot(-cameraToVertex, vWorldNormal);
  vFresnel = uFresnelBias + (1.0 - uFresnelBias) * pow(1.0 - dotProduct, uFresnelPower);
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Chrome Mirror Fragment Shader
 */
export const mirrorFragmentShader = /* glsl */ `
precision highp float;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vViewDirection;
varying vec2 vUv;
varying vec3 vReflect;
varying float vFresnel;

uniform float uMetalness;
uniform float uRoughness;
uniform float uEnvMapIntensity;
uniform float uFresnelPower;
uniform float uFresnelBias;
uniform vec3 uTint;
uniform float uTime;
uniform samplerCube uEnvMap;
uniform float uOpacity;

// PBR functions
float distributionGGX(vec3 N, vec3 H, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float NdotH = max(dot(N, H), 0.0);
  float NdotH2 = NdotH * NdotH;
  
  float num = a2;
  float denom = (NdotH2 * (a2 - 1.0) + 1.0);
  denom = 3.14159265 * denom * denom;
  
  return num / denom;
}

float geometrySchlickGGX(float NdotV, float roughness) {
  float r = (roughness + 1.0);
  float k = (r * r) / 8.0;
  
  float num = NdotV;
  float denom = NdotV * (1.0 - k) + k;
  
  return num / denom;
}

float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
  float NdotV = max(dot(N, V), 0.0);
  float NdotL = max(dot(N, L), 0.0);
  float ggx2 = geometrySchlickGGX(NdotV, roughness);
  float ggx1 = geometrySchlickGGX(NdotL, roughness);
  
  return ggx1 * ggx2;
}

vec3 fresnelSchlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(-vViewDirection);
  
  // Sample environment map with roughness-based mip level
  float mipLevel = uRoughness * 8.0;
  vec3 envColor = textureCube(uEnvMap, vReflect, mipLevel).rgb;
  
  // Base reflectivity for metals
  vec3 F0 = vec3(0.95); // High reflectivity for chrome
  F0 = mix(F0, uTint, uMetalness);
  
  // Fresnel
  vec3 fresnel = fresnelSchlick(max(dot(N, V), 0.0), F0);
  
  // Environment reflection
  vec3 reflection = envColor * uEnvMapIntensity;
  
  // Combine with fresnel and metalness
  vec3 color = reflection * fresnel * uMetalness;
  
  // Add fresnel edge glow
  vec3 edgeGlow = uTint * vFresnel * 0.5;
  color += edgeGlow;
  
  // Add subtle color tint
  color = mix(color, color * uTint, 0.2);
  
  // HDR tone mapping (simple Reinhard)
  color = color / (color + vec3(1.0));
  
  // Gamma correction
  color = pow(color, vec3(1.0 / 2.2));
  
  gl_FragColor = vec4(color, uOpacity);
}
`;

// ============================================================================
// GLOW SHADER
// ============================================================================

export const glowVertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const glowFragmentShader = /* glsl */ `
uniform vec3 uGlowColor;
uniform float uGlowIntensity;
uniform float uGlowSize;

varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);
  
  // Fresnel-based glow
  float fresnel = 1.0 - abs(dot(normal, viewDir));
  fresnel = pow(fresnel, 2.0) * uGlowIntensity;
  
  vec3 glowColor = uGlowColor * fresnel;
  
  gl_FragColor = vec4(glowColor, fresnel * uGlowSize);
}
`;

// ============================================================================
// MIRROR MATERIAL CLASS
// ============================================================================

export interface MirrorMaterialOptions {
  metalness?: number;
  roughness?: number;
  envMapIntensity?: number;
  fresnelPower?: number;
  fresnelBias?: number;
  tint?: THREE.Color;
  opacity?: number;
  envMap?: THREE.CubeTexture;
}

const DEFAULT_OPTIONS: Required<Omit<MirrorMaterialOptions, 'envMap'>> = {
  metalness: 1.0,
  roughness: 0.05,
  envMapIntensity: 1.5,
  fresnelPower: 2.5,
  fresnelBias: 0.1,
  tint: new THREE.Color(0x88ccff),
  opacity: 1.0,
};

/**
 * Create a Chrome Mirror Shader Material
 */
export function createMirrorMaterial(options: MirrorMaterialOptions = {}): THREE.ShaderMaterial {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Create default environment map if not provided
  const envMap = options.envMap || createDefaultEnvMap();

  const material = new THREE.ShaderMaterial({
    vertexShader: mirrorVertexShader,
    fragmentShader: mirrorFragmentShader,
    uniforms: {
      uMetalness: { value: opts.metalness },
      uRoughness: { value: opts.roughness },
      uEnvMapIntensity: { value: opts.envMapIntensity },
      uFresnelPower: { value: opts.fresnelPower },
      uFresnelBias: { value: opts.fresnelBias },
      uTint: { value: opts.tint },
      uTime: { value: 0 },
      uEnvMap: { value: envMap },
      uOpacity: { value: opts.opacity },
    },
    transparent: opts.opacity < 1.0,
    side: THREE.DoubleSide,
  });

  return material;
}

/**
 * Create a glow outline material
 */
export function createGlowMaterial(
  color: THREE.Color = new THREE.Color(0x00ffff),
  intensity: number = 0.5,
  size: number = 1.0
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: glowVertexShader,
    fragmentShader: glowFragmentShader,
    uniforms: {
      uGlowColor: { value: color },
      uGlowIntensity: { value: intensity },
      uGlowSize: { value: size },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
}

// ============================================================================
// ENVIRONMENT MAP UTILITIES
// ============================================================================

/**
 * Create a procedural HDR environment map
 */
export function createDefaultEnvMap(): THREE.CubeTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Create gradient for each face
  const createFaceTexture = (isTop: boolean, isBottom: boolean, isSide: boolean) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    
    if (isTop) {
      gradient.addColorStop(0, '#1a1a2e');
      gradient.addColorStop(1, '#16213e');
    } else if (isBottom) {
      gradient.addColorStop(0, '#0f0f1a');
      gradient.addColorStop(1, '#0a0a12');
    } else {
      gradient.addColorStop(0, '#1a1a2e');
      gradient.addColorStop(0.5, '#16213e');
      gradient.addColorStop(1, '#0f3460');
    }
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // Add some "stars" / highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 2 + 1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    
    return ctx.getImageData(0, 0, size, size);
  };

  const textures: ImageData[] = [
    createFaceTexture(false, false, true), // +X
    createFaceTexture(false, false, true), // -X
    createFaceTexture(true, false, false),  // +Y
    createFaceTexture(false, true, false),  // -Y
    createFaceTexture(false, false, true), // +Z
    createFaceTexture(false, false, true), // -Z
  ];

  const cubeTexture = new THREE.CubeTexture();
  
  textures.forEach((data, i) => {
    const faceCanvas = document.createElement('canvas');
    faceCanvas.width = size;
    faceCanvas.height = size;
    const faceCtx = faceCanvas.getContext('2d')!;
    faceCtx.putImageData(data, 0, 0);
    cubeTexture.images[i] = faceCanvas;
  });

  cubeTexture.needsUpdate = true;
  return cubeTexture;
}

/**
 * Load HDR environment map from URL
 */
export async function loadHDREnvMap(
  url: string,
  renderer: THREE.WebGLRenderer
): Promise<THREE.CubeTexture> {
  const { RGBELoader } = await import('three/examples/jsm/loaders/RGBELoader.js');
  const { PMREMGenerator } = await import('three');
  
  return new Promise((resolve, reject) => {
    const loader = new RGBELoader();
    
    loader.load(
      url,
      (texture) => {
        const pmremGenerator = new PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();
        
        const envMap = pmremGenerator.fromEquirectangular(texture).texture;
        
        texture.dispose();
        pmremGenerator.dispose();
        
        resolve(envMap as unknown as THREE.CubeTexture);
      },
      undefined,
      reject
    );
  });
}

// ============================================================================
// MATERIAL PRESETS
// ============================================================================

export const MATERIAL_PRESETS = {
  chrome: {
    metalness: 1.0,
    roughness: 0.05,
    envMapIntensity: 2.0,
    fresnelPower: 3.0,
    fresnelBias: 0.1,
    tint: new THREE.Color(0xcccccc),
  },
  gold: {
    metalness: 1.0,
    roughness: 0.1,
    envMapIntensity: 1.5,
    fresnelPower: 2.5,
    fresnelBias: 0.1,
    tint: new THREE.Color(0xffd700),
  },
  holographic: {
    metalness: 0.8,
    roughness: 0.2,
    envMapIntensity: 2.5,
    fresnelPower: 4.0,
    fresnelBias: 0.05,
    tint: new THREE.Color(0x00ffff),
  },
  neon: {
    metalness: 0.5,
    roughness: 0.3,
    envMapIntensity: 1.0,
    fresnelPower: 5.0,
    fresnelBias: 0.2,
    tint: new THREE.Color(0xff00ff),
  },
  glass: {
    metalness: 0.1,
    roughness: 0.0,
    envMapIntensity: 1.5,
    fresnelPower: 2.0,
    fresnelBias: 0.3,
    tint: new THREE.Color(0x88ccff),
    opacity: 0.7,
  },
  obsidian: {
    metalness: 0.9,
    roughness: 0.15,
    envMapIntensity: 1.2,
    fresnelPower: 2.0,
    fresnelBias: 0.05,
    tint: new THREE.Color(0x222233),
  },
};

// ============================================================================
// MATERIAL UPDATE HELPER
// ============================================================================

/**
 * Update mirror material uniforms
 */
export function updateMirrorMaterial(
  material: THREE.ShaderMaterial,
  uniforms: Partial<MirrorShaderUniforms>
): void {
  if (uniforms.metalness !== undefined) {
    material.uniforms.uMetalness.value = uniforms.metalness;
  }
  if (uniforms.roughness !== undefined) {
    material.uniforms.uRoughness.value = uniforms.roughness;
  }
  if (uniforms.envMapIntensity !== undefined) {
    material.uniforms.uEnvMapIntensity.value = uniforms.envMapIntensity;
  }
  if (uniforms.fresnelPower !== undefined) {
    material.uniforms.uFresnelPower.value = uniforms.fresnelPower;
  }
  if (uniforms.fresnelBias !== undefined) {
    material.uniforms.uFresnelBias.value = uniforms.fresnelBias;
  }
  if (uniforms.tint !== undefined) {
    material.uniforms.uTint.value = uniforms.tint;
  }
  if (uniforms.time !== undefined) {
    material.uniforms.uTime.value = uniforms.time;
  }
}

/**
 * Update material from preset
 */
export function applyMaterialPreset(
  material: THREE.ShaderMaterial,
  presetName: keyof typeof MATERIAL_PRESETS
): void {
  const preset = MATERIAL_PRESETS[presetName];
  updateMirrorMaterial(material, preset);
}
