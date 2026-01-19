// ============================================================================
// MIRRORBODY-X : PERFORMANCE OPTIMIZER
// Adaptive Quality, Frame Skipping, GPU Acceleration
// ============================================================================

import {
  PerformanceMetrics,
  AdaptiveQualityState,
  PerformanceMode,
} from '@/types';

// ============================================================================
// PERFORMANCE MONITOR
// ============================================================================

export class PerformanceMonitor {
  private frameTimestamps: number[] = [];
  private frameTimes: number[] = [];
  private lastFrameTime: number = 0;
  private sampleWindow: number = 60; // Number of frames to average

  // Inference timing
  private inferenceTime: number = 0;
  private renderTime: number = 0;

  // GPU memory (if available)
  private gpuMemory: number = 0;

  // Dropped frames
  private droppedFrames: number = 0;
  private expectedFrameTime: number = 16.67; // ~60fps

  constructor() {
    this.reset();
  }

  /**
   * Record frame start
   */
  frameStart(): void {
    this.lastFrameTime = performance.now();
  }

  /**
   * Record frame end
   */
  frameEnd(): void {
    const now = performance.now();
    const frameTime = now - this.lastFrameTime;

    this.frameTimes.push(frameTime);
    this.frameTimestamps.push(now);

    // Keep only recent samples
    if (this.frameTimes.length > this.sampleWindow) {
      this.frameTimes.shift();
    }
    if (this.frameTimestamps.length > this.sampleWindow) {
      this.frameTimestamps.shift();
    }

    // Detect dropped frames
    if (frameTime > this.expectedFrameTime * 1.5) {
      this.droppedFrames++;
    }
  }

  /**
   * Record pose inference time
   */
  recordInferenceTime(time: number): void {
    this.inferenceTime = time;
  }

  /**
   * Record render time
   */
  recordRenderTime(time: number): void {
    this.renderTime = time;
  }

  /**
   * Get current FPS
   */
  getFPS(): number {
    if (this.frameTimestamps.length < 2) return 0;
    
    const timeSpan = this.frameTimestamps[this.frameTimestamps.length - 1] - this.frameTimestamps[0];
    if (timeSpan === 0) return 0;
    
    return (this.frameTimestamps.length - 1) / (timeSpan / 1000);
  }

  /**
   * Get average frame time
   */
  getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    return this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
  }

  /**
   * Get all metrics
   */
  getMetrics(): PerformanceMetrics {
    return {
      fps: Math.round(this.getFPS()),
      frameTime: Math.round(this.getAverageFrameTime() * 100) / 100,
      poseInferenceTime: Math.round(this.inferenceTime * 100) / 100,
      renderTime: Math.round(this.renderTime * 100) / 100,
      gpuMemoryUsage: this.gpuMemory,
      droppedFrames: this.droppedFrames,
    };
  }

  /**
   * Set expected frame time based on target FPS
   */
  setTargetFPS(fps: number): void {
    this.expectedFrameTime = 1000 / fps;
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.frameTimestamps = [];
    this.frameTimes = [];
    this.droppedFrames = 0;
  }
}

// ============================================================================
// ADAPTIVE QUALITY CONTROLLER
// ============================================================================

export interface AdaptiveQualityConfig {
  targetFPS: number;
  minResolutionScale: number;
  maxResolutionScale: number;
  adjustmentSpeed: number;
  stabilityThreshold: number;
  effectsLevels: number;
}

const DEFAULT_QUALITY_CONFIG: AdaptiveQualityConfig = {
  targetFPS: 30,
  minResolutionScale: 0.5,
  maxResolutionScale: 1.0,
  adjustmentSpeed: 0.1,
  stabilityThreshold: 5, // FPS deviation
  effectsLevels: 3, // 0=none, 1=low, 2=medium, 3=high
};

export class AdaptiveQualityController {
  private config: AdaptiveQualityConfig;
  private state: AdaptiveQualityState;
  private monitor: PerformanceMonitor;
  
  // Throttling
  private throttleLevel: number = 0;
  private lastAdjustmentTime: number = 0;
  private adjustmentCooldown: number = 1000; // ms

  constructor(
    monitor: PerformanceMonitor,
    config: Partial<AdaptiveQualityConfig> = {}
  ) {
    this.monitor = monitor;
    this.config = { ...DEFAULT_QUALITY_CONFIG, ...config };
    
    this.state = {
      currentResolutionScale: 1.0,
      currentEffectsLevel: this.config.effectsLevels,
      isThrottling: false,
      targetFPS: this.config.targetFPS,
      actualFPS: 0,
    };
  }

  /**
   * Update adaptive quality based on current performance
   */
  update(): AdaptiveQualityState {
    const metrics = this.monitor.getMetrics();
    this.state.actualFPS = metrics.fps;

    const now = performance.now();
    if (now - this.lastAdjustmentTime < this.adjustmentCooldown) {
      return this.state;
    }

    const fpsDelta = metrics.fps - this.config.targetFPS;

    // If performance is bad, scale down
    if (fpsDelta < -this.config.stabilityThreshold) {
      this.decreaseQuality();
      this.lastAdjustmentTime = now;
    }
    // If performance is good, try to scale up
    else if (fpsDelta > this.config.stabilityThreshold && !this.state.isThrottling) {
      this.increaseQuality();
      this.lastAdjustmentTime = now;
    }

    return this.state;
  }

  /**
   * Decrease quality to improve performance
   */
  private decreaseQuality(): void {
    // First, try reducing effects level
    if (this.state.currentEffectsLevel > 0) {
      this.state.currentEffectsLevel--;
      this.state.isThrottling = true;
      return;
    }

    // Then reduce resolution
    if (this.state.currentResolutionScale > this.config.minResolutionScale) {
      this.state.currentResolutionScale = Math.max(
        this.config.minResolutionScale,
        this.state.currentResolutionScale - this.config.adjustmentSpeed
      );
      this.state.isThrottling = true;
    }
  }

  /**
   * Increase quality when performance allows
   */
  private increaseQuality(): void {
    // First, try increasing resolution
    if (this.state.currentResolutionScale < this.config.maxResolutionScale) {
      this.state.currentResolutionScale = Math.min(
        this.config.maxResolutionScale,
        this.state.currentResolutionScale + this.config.adjustmentSpeed
      );
      return;
    }

    // Then increase effects level
    if (this.state.currentEffectsLevel < this.config.effectsLevels) {
      this.state.currentEffectsLevel++;
      this.state.isThrottling = false;
    }
  }

  /**
   * Apply performance mode preset
   */
  applyPerformanceMode(mode: PerformanceMode): void {
    switch (mode) {
      case 'quality':
        this.state.currentResolutionScale = 1.0;
        this.state.currentEffectsLevel = this.config.effectsLevels;
        this.config.targetFPS = 30;
        break;
      case 'balanced':
        this.state.currentResolutionScale = 0.85;
        this.state.currentEffectsLevel = 2;
        this.config.targetFPS = 30;
        break;
      case 'performance':
        this.state.currentResolutionScale = 0.7;
        this.state.currentEffectsLevel = 1;
        this.config.targetFPS = 60;
        break;
    }
    this.state.isThrottling = false;
  }

  /**
   * Get current state
   */
  getState(): AdaptiveQualityState {
    return { ...this.state };
  }

  /**
   * Reset to defaults
   */
  reset(): void {
    this.state = {
      currentResolutionScale: 1.0,
      currentEffectsLevel: this.config.effectsLevels,
      isThrottling: false,
      targetFPS: this.config.targetFPS,
      actualFPS: 0,
    };
  }
}

// ============================================================================
// FRAME SKIP CONTROLLER
// ============================================================================

export class FrameSkipController {
  private targetFPS: number;
  private frameInterval: number;
  private lastFrameTime: number = 0;
  private skipCount: number = 0;
  private maxSkip: number = 3;

  constructor(targetFPS: number = 30) {
    this.targetFPS = targetFPS;
    this.frameInterval = 1000 / targetFPS;
  }

  /**
   * Check if we should process this frame
   */
  shouldProcessFrame(): boolean {
    const now = performance.now();
    const elapsed = now - this.lastFrameTime;

    if (elapsed >= this.frameInterval) {
      this.lastFrameTime = now - (elapsed % this.frameInterval);
      this.skipCount = 0;
      return true;
    }

    // Don't skip too many consecutive frames
    this.skipCount++;
    if (this.skipCount >= this.maxSkip) {
      this.lastFrameTime = now;
      this.skipCount = 0;
      return true;
    }

    return false;
  }

  /**
   * Set target FPS
   */
  setTargetFPS(fps: number): void {
    this.targetFPS = fps;
    this.frameInterval = 1000 / fps;
  }

  /**
   * Set maximum consecutive frames to skip
   */
  setMaxSkip(max: number): void {
    this.maxSkip = max;
  }
}

// ============================================================================
// RENDER THROTTLE
// ============================================================================

export class RenderThrottle {
  private rafId: number | null = null;
  private isRunning: boolean = false;
  private callback: ((delta: number) => void) | null = null;
  private lastTime: number = 0;
  private frameSkip: FrameSkipController;
  private monitor: PerformanceMonitor;

  constructor(targetFPS: number = 30) {
    this.frameSkip = new FrameSkipController(targetFPS);
    this.monitor = new PerformanceMonitor();
    this.monitor.setTargetFPS(targetFPS);
  }

  /**
   * Start the render loop
   */
  start(callback: (delta: number) => void): void {
    if (this.isRunning) return;

    this.callback = callback;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop();
  }

  /**
   * Main render loop
   */
  private loop = (): void => {
    if (!this.isRunning) return;

    this.rafId = requestAnimationFrame(this.loop);

    if (!this.frameSkip.shouldProcessFrame()) return;

    this.monitor.frameStart();

    const now = performance.now();
    const delta = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (this.callback) {
      this.callback(delta);
    }

    this.monitor.frameEnd();
  };

  /**
   * Stop the render loop
   */
  stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Set target FPS
   */
  setTargetFPS(fps: number): void {
    this.frameSkip.setTargetFPS(fps);
    this.monitor.setTargetFPS(fps);
  }

  /**
   * Get performance monitor
   */
  getMonitor(): PerformanceMonitor {
    return this.monitor;
  }

  /**
   * Check if running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}

// ============================================================================
// GPU DETECTION
// ============================================================================

export interface GPUInfo {
  renderer: string;
  vendor: string;
  isHighEnd: boolean;
  supportsWebGL2: boolean;
  maxTextureSize: number;
  maxVertexUniforms: number;
}

export function getGPUInfo(): GPUInfo | null {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  
  if (!gl) {
    return null;
  }

  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  
  const renderer = debugInfo 
    ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) 
    : 'Unknown';
  const vendor = debugInfo 
    ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) 
    : 'Unknown';

  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const maxVertexUniforms = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);

  // Heuristic for high-end GPU
  const isHighEnd = 
    maxTextureSize >= 8192 &&
    (renderer.includes('NVIDIA') || 
     renderer.includes('AMD') || 
     renderer.includes('Apple') ||
     renderer.includes('M1') ||
     renderer.includes('M2') ||
     renderer.includes('M3'));

  return {
    renderer,
    vendor,
    isHighEnd,
    supportsWebGL2: !!canvas.getContext('webgl2'),
    maxTextureSize,
    maxVertexUniforms,
  };
}

/**
 * Get recommended performance mode based on GPU
 */
export function getRecommendedPerformanceMode(): PerformanceMode {
  const gpuInfo = getGPUInfo();
  
  if (!gpuInfo) {
    return 'performance';
  }

  if (gpuInfo.isHighEnd) {
    return 'quality';
  }

  if (gpuInfo.supportsWebGL2 && gpuInfo.maxTextureSize >= 4096) {
    return 'balanced';
  }

  return 'performance';
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

let performanceMonitorInstance: PerformanceMonitor | null = null;
let adaptiveQualityInstance: AdaptiveQualityController | null = null;
let renderThrottleInstance: RenderThrottle | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new PerformanceMonitor();
  }
  return performanceMonitorInstance;
}

export function getAdaptiveQuality(config?: Partial<AdaptiveQualityConfig>): AdaptiveQualityController {
  if (!adaptiveQualityInstance) {
    adaptiveQualityInstance = new AdaptiveQualityController(getPerformanceMonitor(), config);
  }
  return adaptiveQualityInstance;
}

export function getRenderThrottle(targetFPS: number = 30): RenderThrottle {
  if (!renderThrottleInstance) {
    renderThrottleInstance = new RenderThrottle(targetFPS);
  }
  return renderThrottleInstance;
}

export function destroyPerformanceInstances(): void {
  if (renderThrottleInstance) {
    renderThrottleInstance.stop();
    renderThrottleInstance = null;
  }
  performanceMonitorInstance = null;
  adaptiveQualityInstance = null;
}
