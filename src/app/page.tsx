// ============================================================================
// MIRRORBODY-X : MAIN APPLICATION PAGE
// Real-Time Pose-Synced Mirror Clone System
// ============================================================================

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { usePoseTracking } from '@/hooks/usePoseTracking';
import { useSettings } from '@/hooks/useSettings';
import { CameraFeed } from '@/components/core/CameraFeed';
import { ControlPanel } from '@/components/ui/ControlPanel';
import { 
  getVideoRecorder, 
  getScreenshotCapture, 
  initializeRecording 
} from '@/lib/recording';
import { 
  getPerformanceMonitor,
  getRecommendedPerformanceMode,
} from '@/lib/performance';

// Dynamic import for Three.js scene (no SSR)
const MirrorScene = dynamic(
  () => import('@/components/core/MirrorScene').then(mod => mod.MirrorScene),
  { ssr: false }
);

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function HomePage() {
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    fps: 0,
    frameTime: 0,
    inferenceTime: 0,
  });

  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Hooks
  const { settings, updateSettings, resetSettings } = useSettings();
  const {
    pose,
    isTracking,
    isInitialized,
    error: poseError,
    videoRef,
    start: startTracking,
    stop: stopTracking,
    inferenceTime,
  } = usePoseTracking({
    config: {
      modelComplexity: settings.performanceMode === 'performance' ? 0 : 1,
      smoothLandmarks: true,
      useKalmanFilter: true,
      useExponentialSmoothing: true,
    },
    onError: (err) => setError(err.message),
  });

  // Initialize on mount
  useEffect(() => {
    // Check WebGL support
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    
    if (!gl) {
      setError('WebGL is not supported on this device/browser');
      return;
    }

    // Apply recommended performance mode
    const recommendedMode = getRecommendedPerformanceMode();
    console.log(`[MirrorBody-X] Recommended performance mode: ${recommendedMode}`);

    // Hide intro after delay
    const timer = setTimeout(() => {
      setShowIntro(false);
      setIsLoading(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  // Performance monitoring
  useEffect(() => {
    const monitor = getPerformanceMonitor();
    
    const updateMetrics = () => {
      const metrics = monitor.getMetrics();
      setPerformanceMetrics({
        fps: metrics.fps,
        frameTime: metrics.frameTime,
        inferenceTime: inferenceTime,
      });
      animationRef.current = requestAnimationFrame(updateMetrics);
    };

    updateMetrics();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [inferenceTime]);

  // Handle canvas ready
  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
    initializeRecording(canvas);
  }, []);

  // Start experience
  const handleStart = useCallback(async () => {
    try {
      await startTracking();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start camera');
    }
  }, [startTracking]);

  // Recording controls
  const handleStartRecording = useCallback(async () => {
    try {
      await getVideoRecorder().start(30);
      setIsRecording(true);
    } catch (err) {
      console.error('Recording error:', err);
    }
  }, []);

  const handleStopRecording = useCallback(async () => {
    try {
      await getVideoRecorder().downloadVideo('mirrorbody-recording');
      setIsRecording(false);
    } catch (err) {
      console.error('Stop recording error:', err);
    }
  }, []);

  const handleScreenshot = useCallback(async () => {
    try {
      await getScreenshotCapture().download('mirrorbody-screenshot');
    } catch (err) {
      console.error('Screenshot error:', err);
    }
  }, []);

  // Render error state
  if (error) {
    return <ErrorScreen error={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Intro Animation */}
      <AnimatePresence>
        {showIntro && <IntroAnimation />}
      </AnimatePresence>

      {/* Loading State */}
      <AnimatePresence>
        {isLoading && !showIntro && <LoadingScreen />}
      </AnimatePresence>

      {/* Main Content */}
      {!isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative w-full h-full"
        >
          {/* Background Grid */}
          <div className="absolute inset-0 cyber-grid opacity-30" />

          {/* Split View Container */}
          <div className="relative w-full h-full flex">
            {/* Left: Camera Feed */}
            <div className="relative w-1/2 h-full border-r border-white/10">
              {isTracking ? (
                <CameraFeed
                  videoRef={videoRef}
                  pose={pose}
                  showSkeleton={true}
                  showLandmarks={true}
                  mirrored={true}
                  className="w-full h-full"
                />
              ) : (
                <StartScreen onStart={handleStart} isInitialized={isInitialized} />
              )}

              {/* Camera Label */}
              <div className="absolute bottom-4 left-4 glass px-3 py-1 rounded-full">
                <span className="text-xs text-cyan-400 font-medium">LIVE FEED</span>
              </div>
            </div>

            {/* Right: 3D Scene */}
            <div className="relative w-1/2 h-full">
              <MirrorScene
                pose={pose}
                settings={settings}
                onCanvasReady={handleCanvasReady}
              />

              {/* Scene Label */}
              <div className="absolute bottom-4 left-4 glass px-3 py-1 rounded-full">
                <span className="text-xs text-purple-400 font-medium">MIRROR CLONE</span>
              </div>

              {/* Recording Indicator */}
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 glass px-3 py-2 rounded-full">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm text-white font-medium">REC</span>
                </div>
              )}
            </div>
          </div>

          {/* Control Panel */}
          <ControlPanel
            settings={settings}
            onSettingsChange={updateSettings}
            onReset={resetSettings}
            performanceMetrics={performanceMetrics}
            isRecording={isRecording}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            onScreenshot={handleScreenshot}
          />

          {/* Logo */}
          <div className="absolute top-4 left-4 z-50">
            <h1 className="text-xl font-bold tracking-wider">
              <span className="neon-text">MIRROR</span>
              <span className="text-white">BODY</span>
              <span className="neon-text-pink">-X</span>
            </h1>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function IntroAnimation() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0 z-50 bg-black flex items-center justify-center"
    >
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <div className="w-24 h-24 mx-auto border-4 border-cyan-400 rounded-full pulse-glow flex items-center justify-center">
            <div className="w-16 h-16 border-2 border-purple-500 rounded-full spin-slow" />
          </div>
        </motion.div>
        
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-4xl font-bold tracking-widest"
        >
          <span className="neon-text">MIRROR</span>
          <span className="text-white">BODY</span>
          <span className="neon-text-pink">-X</span>
        </motion.h1>
        
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-4 text-white/50 text-sm tracking-wide"
        >
          REAL-TIME POSE-SYNCED MIRROR CLONE SYSTEM
        </motion.p>
      </div>
    </motion.div>
  );
}

function LoadingScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 bg-black flex items-center justify-center"
    >
      <div className="text-center">
        <div className="w-16 h-16 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-white/70 text-sm">Initializing pose tracking...</p>
      </div>
    </motion.div>
  );
}

interface StartScreenProps {
  onStart: () => void;
  isInitialized: boolean;
}

function StartScreen({ onStart, isInitialized }: StartScreenProps) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
      <div className="text-center max-w-md px-8">
        <div className="w-20 h-20 mx-auto mb-6 border-2 border-cyan-400/50 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">Enable Camera</h2>
        <p className="text-white/50 text-sm mb-6">
          Allow camera access to start the mirror clone experience. 
          Your video stays on your device.
        </p>
        
        <button
          onClick={onStart}
          disabled={!isInitialized}
          className={`px-8 py-3 rounded-full font-medium transition-all ${
            isInitialized
              ? 'bg-cyan-500 hover:bg-cyan-400 text-black'
              : 'bg-white/10 text-white/50 cursor-not-allowed'
          }`}
        >
          {isInitialized ? 'Start Experience' : 'Loading...'}
        </button>

        <p className="mt-6 text-xs text-white/30">
          Works best in Chrome/Edge with GPU acceleration enabled
        </p>
      </div>
    </div>
  );
}

interface ErrorScreenProps {
  error: string;
  onRetry: () => void;
}

function ErrorScreen({ error, onRetry }: ErrorScreenProps) {
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-black">
      <div className="text-center max-w-md px-8">
        <div className="w-16 h-16 mx-auto mb-6 border-2 border-red-500/50 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-red-400 text-sm mb-6">{error}</p>
        
        <button
          onClick={onRetry}
          className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
