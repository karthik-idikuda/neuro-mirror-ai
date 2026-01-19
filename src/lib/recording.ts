// ============================================================================
// MIRRORBODY-X : RECORDING SYSTEM
// MP4 Export and Screenshot Capture
// ============================================================================

import { RecordingState, ScreenshotOptions } from '@/types';

// ============================================================================
// MEDIA RECORDER
// ============================================================================

export class VideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private state: RecordingState = {
    isRecording: false,
    isPaused: false,
    duration: 0,
    frameCount: 0,
    outputFormat: 'webm',
  };

  private canvas: HTMLCanvasElement | null = null;
  private stream: MediaStream | null = null;
  private startTime: number = 0;
  private durationInterval: number | null = null;

  constructor() {}

  /**
   * Initialize recorder with canvas
   */
  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  /**
   * Start recording
   */
  start(fps: number = 30): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.canvas) {
        reject(new Error('Canvas not initialized'));
        return;
      }

      if (this.state.isRecording) {
        reject(new Error('Already recording'));
        return;
      }

      try {
        // Get stream from canvas
        this.stream = this.canvas.captureStream(fps);
        
        // Check for supported MIME types
        const mimeType = this.getSupportedMimeType();
        
        this.mediaRecorder = new MediaRecorder(this.stream, {
          mimeType,
          videoBitsPerSecond: 5000000, // 5 Mbps
        });

        this.recordedChunks = [];

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.recordedChunks.push(event.data);
            this.state.frameCount++;
          }
        };

        this.mediaRecorder.onstop = () => {
          this.stopDurationTracking();
        };

        this.mediaRecorder.onerror = (event) => {
          console.error('[VideoRecorder] Error:', event);
          this.stop();
        };

        // Start recording
        this.mediaRecorder.start(100); // Collect data every 100ms
        this.state.isRecording = true;
        this.state.isPaused = false;
        this.startTime = performance.now();
        this.startDurationTracking();

        console.log('[VideoRecorder] Recording started');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get supported MIME type
   */
  private getSupportedMimeType(): string {
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        this.state.outputFormat = type.includes('mp4') ? 'mp4' : 'webm';
        return type;
      }
    }

    throw new Error('No supported video MIME type found');
  }

  /**
   * Pause recording
   */
  pause(): void {
    if (this.mediaRecorder && this.state.isRecording && !this.state.isPaused) {
      this.mediaRecorder.pause();
      this.state.isPaused = true;
      console.log('[VideoRecorder] Recording paused');
    }
  }

  /**
   * Resume recording
   */
  resume(): void {
    if (this.mediaRecorder && this.state.isRecording && this.state.isPaused) {
      this.mediaRecorder.resume();
      this.state.isPaused = false;
      console.log('[VideoRecorder] Recording resumed');
    }
  }

  /**
   * Stop recording and return blob
   */
  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.state.isRecording) {
        reject(new Error('Not recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        this.stopDurationTracking();
        
        const mimeType = this.state.outputFormat === 'mp4' 
          ? 'video/mp4' 
          : 'video/webm';
        
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        
        this.state.isRecording = false;
        this.state.isPaused = false;
        
        console.log('[VideoRecorder] Recording stopped, size:', blob.size);
        resolve(blob);
      };

      this.mediaRecorder.stop();
      
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }
    });
  }

  /**
   * Start tracking duration
   */
  private startDurationTracking(): void {
    this.durationInterval = window.setInterval(() => {
      if (this.state.isRecording && !this.state.isPaused) {
        this.state.duration = (performance.now() - this.startTime) / 1000;
      }
    }, 100);
  }

  /**
   * Stop tracking duration
   */
  private stopDurationTracking(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  /**
   * Download recorded video
   */
  async downloadVideo(filename: string = 'mirrorbody-recording'): Promise<void> {
    const blob = await this.stop();
    
    const extension = this.state.outputFormat;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Get current state
   */
  getState(): RecordingState {
    return { ...this.state };
  }

  /**
   * Check if recording
   */
  isRecording(): boolean {
    return this.state.isRecording;
  }
}

// ============================================================================
// SCREENSHOT CAPTURE
// ============================================================================

export class ScreenshotCapture {
  private canvas: HTMLCanvasElement | null = null;

  constructor() {}

  /**
   * Initialize with canvas
   */
  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  /**
   * Capture screenshot
   */
  capture(options: ScreenshotOptions = {
    format: 'png',
    quality: 0.95,
    includeUI: false,
  }): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.canvas) {
        reject(new Error('Canvas not initialized'));
        return;
      }

      const mimeType = `image/${options.format}`;
      
      this.canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to capture screenshot'));
          }
        },
        mimeType,
        options.quality
      );
    });
  }

  /**
   * Download screenshot
   */
  async download(
    filename: string = 'mirrorbody-screenshot',
    options?: ScreenshotOptions
  ): Promise<void> {
    const blob = await this.capture(options);
    const format = options?.format || 'png';
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Get data URL
   */
  getDataURL(options: ScreenshotOptions = {
    format: 'png',
    quality: 0.95,
    includeUI: false,
  }): string {
    if (!this.canvas) {
      throw new Error('Canvas not initialized');
    }

    const mimeType = `image/${options.format}`;
    return this.canvas.toDataURL(mimeType, options.quality);
  }

  /**
   * Copy to clipboard
   */
  async copyToClipboard(): Promise<void> {
    const blob = await this.capture({ format: 'png', quality: 1, includeUI: false });
    
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob,
        }),
      ]);
      console.log('[ScreenshotCapture] Copied to clipboard');
    } catch (error) {
      console.error('[ScreenshotCapture] Failed to copy:', error);
      throw error;
    }
  }
}

// ============================================================================
// COMPOSITE RECORDING (Canvas + Audio)
// ============================================================================

export class CompositeRecorder {
  private videoRecorder: VideoRecorder;
  private audioStream: MediaStream | null = null;
  private compositeStream: MediaStream | null = null;

  constructor() {
    this.videoRecorder = new VideoRecorder();
  }

  /**
   * Initialize with canvas and optional audio
   */
  async initialize(
    canvas: HTMLCanvasElement,
    includeAudio: boolean = false
  ): Promise<void> {
    this.videoRecorder.initialize(canvas);

    if (includeAudio) {
      try {
        this.audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
      } catch (error) {
        console.warn('[CompositeRecorder] Could not get audio:', error);
      }
    }
  }

  /**
   * Start recording with audio
   */
  async start(fps: number = 30): Promise<void> {
    await this.videoRecorder.start(fps);
  }

  /**
   * Stop and download
   */
  async stopAndDownload(filename?: string): Promise<void> {
    await this.videoRecorder.downloadVideo(filename);
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
    }
  }
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

let videoRecorderInstance: VideoRecorder | null = null;
let screenshotCaptureInstance: ScreenshotCapture | null = null;

export function getVideoRecorder(): VideoRecorder {
  if (!videoRecorderInstance) {
    videoRecorderInstance = new VideoRecorder();
  }
  return videoRecorderInstance;
}

export function getScreenshotCapture(): ScreenshotCapture {
  if (!screenshotCaptureInstance) {
    screenshotCaptureInstance = new ScreenshotCapture();
  }
  return screenshotCaptureInstance;
}

export function initializeRecording(canvas: HTMLCanvasElement): void {
  getVideoRecorder().initialize(canvas);
  getScreenshotCapture().initialize(canvas);
}

export function destroyRecording(): void {
  videoRecorderInstance = null;
  screenshotCaptureInstance = null;
}
