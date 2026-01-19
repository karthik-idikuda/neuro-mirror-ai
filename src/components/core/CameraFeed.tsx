// ============================================================================
// MIRRORBODY-X : CAMERA FEED COMPONENT
// Webcam capture with pose visualization overlay
// ============================================================================

'use client';

import React, { useRef, useEffect, useState } from 'react';
import { SmoothedPoseData, PoseLandmarkIndex } from '@/types';

interface CameraFeedProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  pose: SmoothedPoseData | null;
  showSkeleton?: boolean;
  showLandmarks?: boolean;
  mirrored?: boolean;
  className?: string;
}

// Connections between landmarks for skeleton visualization
const POSE_CONNECTIONS: [PoseLandmarkIndex, PoseLandmarkIndex][] = [
  // Torso
  [PoseLandmarkIndex.LEFT_SHOULDER, PoseLandmarkIndex.RIGHT_SHOULDER],
  [PoseLandmarkIndex.LEFT_SHOULDER, PoseLandmarkIndex.LEFT_HIP],
  [PoseLandmarkIndex.RIGHT_SHOULDER, PoseLandmarkIndex.RIGHT_HIP],
  [PoseLandmarkIndex.LEFT_HIP, PoseLandmarkIndex.RIGHT_HIP],
  
  // Left arm
  [PoseLandmarkIndex.LEFT_SHOULDER, PoseLandmarkIndex.LEFT_ELBOW],
  [PoseLandmarkIndex.LEFT_ELBOW, PoseLandmarkIndex.LEFT_WRIST],
  
  // Right arm
  [PoseLandmarkIndex.RIGHT_SHOULDER, PoseLandmarkIndex.RIGHT_ELBOW],
  [PoseLandmarkIndex.RIGHT_ELBOW, PoseLandmarkIndex.RIGHT_WRIST],
  
  // Left leg
  [PoseLandmarkIndex.LEFT_HIP, PoseLandmarkIndex.LEFT_KNEE],
  [PoseLandmarkIndex.LEFT_KNEE, PoseLandmarkIndex.LEFT_ANKLE],
  
  // Right leg
  [PoseLandmarkIndex.RIGHT_HIP, PoseLandmarkIndex.RIGHT_KNEE],
  [PoseLandmarkIndex.RIGHT_KNEE, PoseLandmarkIndex.RIGHT_ANKLE],
];

export function CameraFeed({
  videoRef,
  pose,
  showSkeleton = true,
  showLandmarks = true,
  mirrored = true,
  className = '',
}: CameraFeedProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1280, height: 720 });

  // Update canvas dimensions when video loads
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateDimensions = () => {
      if (video.videoWidth && video.videoHeight) {
        setDimensions({
          width: video.videoWidth,
          height: video.videoHeight,
        });
      }
    };

    video.addEventListener('loadedmetadata', updateDimensions);
    updateDimensions();

    return () => {
      video.removeEventListener('loadedmetadata', updateDimensions);
    };
  }, [videoRef]);

  // Draw pose overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!pose || (!showSkeleton && !showLandmarks)) return;

    const { landmarks } = pose;
    const { width, height } = dimensions;

    // Transform function for mirrored coordinates
    const transformX = (x: number) => mirrored ? width - x * width : x * width;
    const transformY = (y: number) => y * height;

    // Draw connections (skeleton)
    if (showSkeleton) {
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';

      POSE_CONNECTIONS.forEach(([start, end]) => {
        const startLm = landmarks[start];
        const endLm = landmarks[end];

        if (startLm.visibility > 0.5 && endLm.visibility > 0.5) {
          ctx.beginPath();
          ctx.moveTo(transformX(startLm.x), transformY(startLm.y));
          ctx.lineTo(transformX(endLm.x), transformY(endLm.y));
          ctx.stroke();
        }
      });
    }

    // Draw landmarks
    if (showLandmarks) {
      landmarks.forEach((landmark, index) => {
        if (landmark.visibility > 0.5) {
          const x = transformX(landmark.x);
          const y = transformY(landmark.y);
          
          // Outer glow
          ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.fill();

          // Inner circle
          ctx.fillStyle = '#00ffff';
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();

          // Key joints get larger indicators
          const keyJoints = [
            PoseLandmarkIndex.LEFT_WRIST,
            PoseLandmarkIndex.RIGHT_WRIST,
            PoseLandmarkIndex.LEFT_ANKLE,
            PoseLandmarkIndex.RIGHT_ANKLE,
            PoseLandmarkIndex.NOSE,
          ];

          if (keyJoints.includes(index)) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      });
    }
  }, [pose, showSkeleton, showLandmarks, mirrored, dimensions]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${mirrored ? 'scale-x-[-1]' : ''}`}
        style={{ display: 'block' }}
      />

      {/* Pose overlay canvas */}
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Tracking status indicator */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${
            pose ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`}
        />
        <span className="text-white text-sm font-medium drop-shadow-lg">
          {pose ? 'Tracking' : 'No pose detected'}
        </span>
      </div>

      {/* Confidence indicator */}
      {pose && (
        <div className="absolute top-4 right-4 text-white text-sm drop-shadow-lg">
          <span className="opacity-70">Confidence:</span>{' '}
          <span className="font-mono">{Math.round(pose.confidence * 100)}%</span>
        </div>
      )}
    </div>
  );
}

export default CameraFeed;
