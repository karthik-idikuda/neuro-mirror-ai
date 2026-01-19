// ============================================================================
// MIRRORBODY-X : VISUAL EFFECTS SYSTEM
// Glow, Motion Trails, Light Rays, Reflective Floor
// ============================================================================

import * as THREE from 'three';
import {
  EffectsConfig,
  GlowConfig,
  MotionTrailConfig,
  LightRayConfig,
  FloorReflectionConfig,
  PoseLandmark,
  PoseLandmarkIndex,
} from '@/types';

// ============================================================================
// GLOW EFFECT
// ============================================================================

export class GlowEffect {
  private config: GlowConfig;
  private mesh: THREE.Mesh | null = null;
  private material: THREE.ShaderMaterial;

  constructor(config: GlowConfig) {
    this.config = config;
    this.material = this.createMaterial();
  }

  private createMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: this.config.color },
        uIntensity: { value: this.config.intensity },
        uSize: { value: this.config.size },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        uniform float uSize;
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec3 inflatedPosition = position + normal * uSize;
          vec4 mvPosition = modelViewMatrix * vec4(inflatedPosition, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uTime;
        
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(vViewPosition);
          
          float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 2.0);
          float pulse = 0.8 + 0.2 * sin(uTime * 2.0);
          
          vec3 glowColor = uColor * fresnel * uIntensity * pulse;
          float alpha = fresnel * uIntensity * 0.5;
          
          gl_FragColor = vec4(glowColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    });
  }

  createMesh(geometry: THREE.BufferGeometry): THREE.Mesh {
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.visible = this.config.enabled;
    return this.mesh;
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }

  setConfig(config: Partial<GlowConfig>): void {
    if (config.enabled !== undefined) {
      this.config.enabled = config.enabled;
      if (this.mesh) this.mesh.visible = config.enabled;
    }
    if (config.color) {
      this.config.color = config.color;
      this.material.uniforms.uColor.value = config.color;
    }
    if (config.intensity !== undefined) {
      this.config.intensity = config.intensity;
      this.material.uniforms.uIntensity.value = config.intensity;
    }
    if (config.size !== undefined) {
      this.config.size = config.size;
      this.material.uniforms.uSize.value = config.size;
    }
  }

  dispose(): void {
    this.material.dispose();
  }
}

// ============================================================================
// MOTION TRAIL EFFECT
// ============================================================================

interface TrailPoint {
  position: THREE.Vector3;
  timestamp: number;
}

export class MotionTrailEffect {
  private config: MotionTrailConfig;
  private trails: Map<number, TrailPoint[]> = new Map();
  private meshes: Map<number, THREE.Line> = new Map();
  private material: THREE.LineBasicMaterial;
  private scene: THREE.Scene | null = null;

  constructor(config: MotionTrailConfig) {
    this.config = config;
    this.material = new THREE.LineBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
  }

  setScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  updateTrail(jointIndex: number, position: THREE.Vector3): void {
    if (!this.config.enabled || !this.scene) return;

    const now = performance.now();
    
    // Get or create trail for this joint
    if (!this.trails.has(jointIndex)) {
      this.trails.set(jointIndex, []);
    }
    
    const trail = this.trails.get(jointIndex)!;
    
    // Add new point
    trail.push({
      position: position.clone(),
      timestamp: now,
    });

    // Remove old points
    const cutoffTime = now - (this.config.length * 1000);
    while (trail.length > 0 && trail[0].timestamp < cutoffTime) {
      trail.shift();
    }

    // Update mesh
    this.updateMesh(jointIndex, trail);
  }

  private updateMesh(jointIndex: number, trail: TrailPoint[]): void {
    if (!this.scene) return;

    // Remove existing mesh
    const existingMesh = this.meshes.get(jointIndex);
    if (existingMesh) {
      this.scene.remove(existingMesh);
      existingMesh.geometry.dispose();
    }

    if (trail.length < 2) return;

    // Create new geometry
    const positions: number[] = [];
    trail.forEach(point => {
      positions.push(point.position.x, point.position.y, point.position.z);
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const mesh = new THREE.Line(geometry, this.material);
    this.meshes.set(jointIndex, mesh);
    this.scene.add(mesh);
  }

  clearTrails(): void {
    this.trails.clear();
    this.meshes.forEach((mesh, key) => {
      if (this.scene) this.scene.remove(mesh);
      mesh.geometry.dispose();
    });
    this.meshes.clear();
  }

  setConfig(config: Partial<MotionTrailConfig>): void {
    if (config.enabled !== undefined) {
      this.config.enabled = config.enabled;
      if (!config.enabled) this.clearTrails();
    }
    if (config.color) {
      this.config.color = config.color;
      this.material.color = config.color;
    }
    if (config.length !== undefined) {
      this.config.length = config.length;
    }
    if (config.fadeSpeed !== undefined) {
      this.config.fadeSpeed = config.fadeSpeed;
    }
  }

  dispose(): void {
    this.clearTrails();
    this.material.dispose();
  }
}

// ============================================================================
// LIGHT RAY EFFECT
// ============================================================================

export class LightRayEffect {
  private config: LightRayConfig;
  private rays: Map<number, THREE.Mesh> = new Map();
  private material: THREE.ShaderMaterial;
  private scene: THREE.Scene | null = null;

  constructor(config: LightRayConfig) {
    this.config = config;
    this.material = this.createMaterial();
  }

  private createMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: this.config.color },
        uIntensity: { value: this.config.intensity },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uTime;
        varying vec2 vUv;
        
        void main() {
          float dist = abs(vUv.x - 0.5) * 2.0;
          float fade = 1.0 - vUv.y;
          float flicker = 0.8 + 0.2 * sin(uTime * 10.0 + vUv.y * 20.0);
          
          float alpha = (1.0 - dist) * fade * uIntensity * flicker;
          alpha = pow(alpha, 2.0);
          
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }

  setScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  updateRay(jointIndex: number, position: THREE.Vector3): void {
    if (!this.config.enabled || !this.scene) return;
    if (!this.config.joints.includes(jointIndex)) return;

    let ray = this.rays.get(jointIndex);
    
    if (!ray) {
      const geometry = new THREE.PlaneGeometry(0.05, this.config.length);
      ray = new THREE.Mesh(geometry, this.material.clone());
      this.rays.set(jointIndex, ray);
      this.scene.add(ray);
    }

    ray.position.copy(position);
    ray.position.y += this.config.length / 2;
    ray.lookAt(ray.position.x, ray.position.y + 10, ray.position.z);
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
    this.rays.forEach(ray => {
      (ray.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    });
  }

  setConfig(config: Partial<LightRayConfig>): void {
    if (config.enabled !== undefined) {
      this.config.enabled = config.enabled;
      this.rays.forEach(ray => {
        ray.visible = config.enabled!;
      });
    }
    if (config.color) {
      this.config.color = config.color;
      this.material.uniforms.uColor.value = config.color;
    }
    if (config.intensity !== undefined) {
      this.config.intensity = config.intensity;
      this.material.uniforms.uIntensity.value = config.intensity;
    }
    if (config.joints) {
      this.config.joints = config.joints;
    }
  }

  dispose(): void {
    this.rays.forEach(ray => {
      if (this.scene) this.scene.remove(ray);
      ray.geometry.dispose();
      (ray.material as THREE.ShaderMaterial).dispose();
    });
    this.rays.clear();
    this.material.dispose();
  }
}

// ============================================================================
// FLOOR REFLECTION EFFECT
// ============================================================================

export class FloorReflectionEffect {
  private config: FloorReflectionConfig;
  private floor: THREE.Mesh | null = null;
  private material: THREE.MeshStandardMaterial;

  constructor(config: FloorReflectionConfig) {
    this.config = config;
    this.material = this.createMaterial();
  }

  private createMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: this.config.color,
      metalness: 0.8,
      roughness: this.config.blur,
      transparent: true,
      opacity: this.config.opacity,
    });
  }

  createFloor(size: number = 10): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(size, size);
    this.floor = new THREE.Mesh(geometry, this.material);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -1;
    this.floor.receiveShadow = true;
    this.floor.visible = this.config.enabled;
    return this.floor;
  }

  setConfig(config: Partial<FloorReflectionConfig>): void {
    if (config.enabled !== undefined) {
      this.config.enabled = config.enabled;
      if (this.floor) this.floor.visible = config.enabled;
    }
    if (config.opacity !== undefined) {
      this.config.opacity = config.opacity;
      this.material.opacity = config.opacity;
    }
    if (config.blur !== undefined) {
      this.config.blur = config.blur;
      this.material.roughness = config.blur;
    }
    if (config.color) {
      this.config.color = config.color;
      this.material.color = config.color;
    }
  }

  dispose(): void {
    if (this.floor) {
      this.floor.geometry.dispose();
    }
    this.material.dispose();
  }
}

// ============================================================================
// SHADOW SYSTEM
// ============================================================================

export class ShadowSystem {
  private enabled: boolean = true;
  private light: THREE.DirectionalLight | null = null;
  private shadowMapSize: number = 1024;

  setupLight(scene: THREE.Scene): THREE.DirectionalLight {
    this.light = new THREE.DirectionalLight(0xffffff, 1);
    this.light.position.set(5, 10, 5);
    this.light.castShadow = true;
    
    // Shadow map settings
    this.light.shadow.mapSize.width = this.shadowMapSize;
    this.light.shadow.mapSize.height = this.shadowMapSize;
    this.light.shadow.camera.near = 0.5;
    this.light.shadow.camera.far = 50;
    this.light.shadow.camera.left = -10;
    this.light.shadow.camera.right = 10;
    this.light.shadow.camera.top = 10;
    this.light.shadow.camera.bottom = -10;
    this.light.shadow.bias = -0.0001;

    scene.add(this.light);
    
    // Add ambient light
    const ambient = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambient);

    return this.light;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.light) {
      this.light.castShadow = enabled;
    }
  }

  setShadowMapSize(size: number): void {
    this.shadowMapSize = size;
    if (this.light) {
      this.light.shadow.mapSize.width = size;
      this.light.shadow.mapSize.height = size;
      this.light.shadow.map?.dispose();
      this.light.shadow.map = null;
    }
  }
}

// ============================================================================
// EFFECTS MANAGER
// ============================================================================

export class EffectsManager {
  private config: EffectsConfig;
  private scene: THREE.Scene | null = null;

  private glow: GlowEffect;
  private motionTrail: MotionTrailEffect;
  private lightRays: LightRayEffect;
  private floorReflection: FloorReflectionEffect;
  private shadowSystem: ShadowSystem;

  constructor(config: EffectsConfig) {
    this.config = config;
    
    this.glow = new GlowEffect(config.glow);
    this.motionTrail = new MotionTrailEffect(config.motionTrail);
    this.lightRays = new LightRayEffect(config.lightRays);
    this.floorReflection = new FloorReflectionEffect(config.floorReflection);
    this.shadowSystem = new ShadowSystem();
  }

  initialize(scene: THREE.Scene): void {
    this.scene = scene;
    
    this.motionTrail.setScene(scene);
    this.lightRays.setScene(scene);
    
    // Add floor
    const floor = this.floorReflection.createFloor();
    scene.add(floor);
    
    // Setup lighting with shadows
    this.shadowSystem.setupLight(scene);
  }

  createGlowMesh(geometry: THREE.BufferGeometry): THREE.Mesh {
    return this.glow.createMesh(geometry);
  }

  update(time: number, landmarks?: PoseLandmark[]): void {
    this.glow.update(time);
    this.lightRays.update(time);

    // Update trails and rays from landmarks
    if (landmarks) {
      const trackedJoints = [
        PoseLandmarkIndex.LEFT_WRIST,
        PoseLandmarkIndex.RIGHT_WRIST,
        PoseLandmarkIndex.LEFT_ANKLE,
        PoseLandmarkIndex.RIGHT_ANKLE,
      ];

      trackedJoints.forEach(jointIndex => {
        const lm = landmarks[jointIndex];
        const position = new THREE.Vector3(
          lm.x - 0.5, // Center
          -(lm.y - 0.5),
          -lm.z
        ).multiplyScalar(2); // Scale

        this.motionTrail.updateTrail(jointIndex, position);
        this.lightRays.updateRay(jointIndex, position);
      });
    }
  }

  setConfig(config: Partial<EffectsConfig>): void {
    if (config.glow) this.glow.setConfig(config.glow);
    if (config.motionTrail) this.motionTrail.setConfig(config.motionTrail);
    if (config.lightRays) this.lightRays.setConfig(config.lightRays);
    if (config.floorReflection) this.floorReflection.setConfig(config.floorReflection);
    if (config.shadowEnabled !== undefined) {
      this.shadowSystem.setEnabled(config.shadowEnabled);
    }
  }

  /**
   * Set effects level for adaptive quality
   */
  setEffectsLevel(level: number): void {
    switch (level) {
      case 0: // None
        this.glow.setConfig({ enabled: false });
        this.motionTrail.setConfig({ enabled: false });
        this.lightRays.setConfig({ enabled: false });
        this.floorReflection.setConfig({ enabled: false });
        this.shadowSystem.setEnabled(false);
        break;
      case 1: // Low
        this.glow.setConfig({ enabled: false });
        this.motionTrail.setConfig({ enabled: false });
        this.lightRays.setConfig({ enabled: false });
        this.floorReflection.setConfig({ enabled: true, blur: 0.8 });
        this.shadowSystem.setEnabled(true);
        this.shadowSystem.setShadowMapSize(512);
        break;
      case 2: // Medium
        this.glow.setConfig({ enabled: true, intensity: 0.3 });
        this.motionTrail.setConfig({ enabled: true, length: 5 });
        this.lightRays.setConfig({ enabled: false });
        this.floorReflection.setConfig({ enabled: true, blur: 0.5 });
        this.shadowSystem.setEnabled(true);
        this.shadowSystem.setShadowMapSize(1024);
        break;
      case 3: // High
        this.glow.setConfig({ enabled: true, intensity: 0.5 });
        this.motionTrail.setConfig({ enabled: true, length: 10 });
        this.lightRays.setConfig({ enabled: true });
        this.floorReflection.setConfig({ enabled: true, blur: 0.3 });
        this.shadowSystem.setEnabled(true);
        this.shadowSystem.setShadowMapSize(2048);
        break;
    }
  }

  dispose(): void {
    this.glow.dispose();
    this.motionTrail.dispose();
    this.lightRays.dispose();
    this.floorReflection.dispose();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let effectsManagerInstance: EffectsManager | null = null;

export function getEffectsManager(config?: EffectsConfig): EffectsManager {
  if (!effectsManagerInstance && config) {
    effectsManagerInstance = new EffectsManager(config);
  }
  return effectsManagerInstance!;
}

export function destroyEffectsManager(): void {
  if (effectsManagerInstance) {
    effectsManagerInstance.dispose();
    effectsManagerInstance = null;
  }
}
