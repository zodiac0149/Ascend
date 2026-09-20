'use client';

import React from 'react';
import type { CVMetrics } from '@/types/interview';
import { useVideoCapture } from '@/hooks/useVideoCapture';
import type { PostureAlert } from '@/types/interview';

interface VideoFeedProps {
  enabled: boolean;
  onAlert?: (alert: PostureAlert) => void;
  onMetricsUpdate?: (metrics: CVMetrics) => void;
  onDemeanorRef?: (getDemeanorSummary: () => ReturnType<ReturnType<typeof useVideoCapture>['getDemeanorSummary']>) => void;
}

export function VideoFeed({ enabled, onAlert, onMetricsUpdate, onDemeanorRef }: VideoFeedProps) {
  const { videoRef, canvasRef, isLoaded, isStreaming, metrics, getDemeanorSummary } =
    useVideoCapture({ enabled, onAlert, onMetricsUpdate });

  // Expose getDemeanorSummary to parent
  React.useEffect(() => {
    onDemeanorRef?.(getDemeanorSummary);
  }, [getDemeanorSummary, onDemeanorRef]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Live video feed (mirrored) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}  // Mirror the video
      />

      {/* Hidden MediaPipe processing canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none opacity-0"
        width={1280}
        height={720}
      />

      {/* Loading overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-900 z-20">
          <div className="w-12 h-12 rounded-full border-2 border-brand-500/30 border-t-brand-500 animate-spin mb-4" />
          <p className="text-text-secondary text-sm font-medium">Initializing camera...</p>
          <p className="text-text-muted text-xs mt-1">Loading AI vision models</p>
        </div>
      )}

      {/* Camera inactive overlay */}
      {isLoaded && !isStreaming && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-800 z-20">
          <div className="w-20 h-20 rounded-full bg-surface-700 flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.31a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
          <p className="text-text-secondary text-sm font-medium">Camera not active</p>
        </div>
      )}

      {/* Status indicators overlay */}
      {isStreaming && (
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-none">
          {/* CV status indicators */}
          <div className="flex items-center gap-2">
            {/* Eye contact indicator */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm transition-colors
                ${metrics.isLookingAtCamera
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                  : 'bg-red-500/20 border border-red-500/40 text-red-400'
                }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  metrics.isLookingAtCamera ? 'bg-emerald-400' : 'bg-red-400'
                } animate-pulse`}
              />
              {metrics.isLookingAtCamera ? 'Eye Contact ✓' : 'Look at Camera'}
            </div>

            {/* Posture indicator */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm transition-colors
                ${metrics.isGoodPosture
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                  : 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                }`}
            >
              {metrics.isGoodPosture ? 'Posture ✓' : 'Sit Upright'}
            </div>
          </div>

          {/* LIVE badge */}
          <div className="live-badge">LIVE</div>
        </div>
      )}

      {/* MediaPipe attribution (required by license) */}
      <div className="absolute top-2 right-2 text-[10px] text-white/20 pointer-events-none z-20">
        Powered by MediaPipe
      </div>
    </div>
  );
}
