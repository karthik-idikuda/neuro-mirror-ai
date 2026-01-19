// ============================================================================
// MIRRORBODY-X : POSE TRACKING HOOK
// React hook for MediaPipe pose tracking
// ============================================================================

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { PoseTracker, PoseTrackerConfig, SmoothedPoseData } from '@/lib/pose-tracker';

interface UsePoseTrackingOptions {
  config?: Partial<PoseTrackerConfig>;
  autoStart?: boolean;
  onPoseUpdate?: (pose: SmoothedPoseData | null) => void;
  onError?: (error: Error) => void;
}

interface UsePoseTrackingReturn {
  pose: SmoothedPoseData | null;
  isTracking: boolean;
  isInitialized: boolean;
  error: Error | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  start: () => Promise<void>;
  stop: () => void;
  updateConfig: (config: Partial<PoseTrackerConfig>) => void;
  inferenceTime: number;
}

export function usePoseTracking(options: UsePoseTrackingOptions = {}): UsePoseTrackingReturn {
  const { config, autoStart = false, onPoseUpdate, onError } = options;

  const [pose, setPose] = useState<SmoothedPoseData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [inferenceTime, setInferenceTime] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackerRef = useRef<PoseTracker | null>(null);

  // Initialize tracker
  useEffect(() => {
    const initTracker = async () => {
      try {
        trackerRef.current = new PoseTracker(config);
        await trackerRef.current.initialize();
        setIsInitialized(true);
        console.log('[usePoseTracking] Tracker initialized');
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to initialize');
        setError(error);
        onError?.(error);
      }
    };

    initTracker();

    return () => {
      if (trackerRef.current) {
        trackerRef.current.stop();
        trackerRef.current = null;
      }
    };
  }, []);

  // Auto-start if configured
  useEffect(() => {
    if (autoStart && isInitialized && videoRef.current && !isTracking) {
      start();
    }
  }, [autoStart, isInitialized]);

  // Pose callback
  const handlePoseUpdate = useCallback((newPose: SmoothedPoseData | null) => {
    setPose(newPose);
    onPoseUpdate?.(newPose);

    if (trackerRef.current) {
      setInferenceTime(trackerRef.current.getInferenceTime());
    }
  }, [onPoseUpdate]);

  // Start tracking
  const start = useCallback(async () => {
    if (!trackerRef.current || !videoRef.current) {
      setError(new Error('Tracker or video element not ready'));
      return;
    }

    if (isTracking) return;

    try {
      await trackerRef.current.start(videoRef.current, handlePoseUpdate);
      setIsTracking(true);
      setError(null);
      console.log('[usePoseTracking] Tracking started');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start tracking');
      setError(error);
      onError?.(error);
    }
  }, [isTracking, handlePoseUpdate, onError]);

  // Stop tracking
  const stop = useCallback(() => {
    if (trackerRef.current) {
      trackerRef.current.stop();
      setIsTracking(false);
      setPose(null);
      console.log('[usePoseTracking] Tracking stopped');
    }
  }, []);

  // Update config
  const updateConfig = useCallback((newConfig: Partial<PoseTrackerConfig>) => {
    if (trackerRef.current) {
      trackerRef.current.updateConfig(newConfig);
    }
  }, []);

  return {
    pose,
    isTracking,
    isInitialized,
    error,
    videoRef,
    start,
    stop,
    updateConfig,
    inferenceTime,
  };
}
