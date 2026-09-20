import { useRef, useEffect, useCallback, useState } from 'react';
import { CV_THRESHOLDS } from '@/utils/cvThresholds';
import type { CVMetrics, PostureAlert } from '@/types/interview';

declare global {
  interface Window {
    FaceMesh: new (config: { locateFile: (f: string) => string }) => FaceMeshInstance;
    Pose: new (config: { locateFile: (f: string) => string }) => PoseInstance;
    Camera: new (
      video: HTMLVideoElement,
      config: { onFrame: () => Promise<void>; width: number; height: number }
    ) => CameraInstance;
  }
}

interface FaceMeshInstance {
  setOptions: (opts: Record<string, unknown>) => void;
  onResults: (cb: (results: FaceMeshResults) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
}

interface PoseInstance {
  setOptions: (opts: Record<string, unknown>) => void;
  onResults: (cb: (results: PoseResults) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
}

interface CameraInstance {
  start: () => void;
  stop: () => void;
}

interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

interface FaceMeshResults {
  multiFaceLandmarks?: Landmark[][];
  image: CanvasImageSource;
}

interface PoseResults {
  poseLandmarks?: Landmark[];
  image: CanvasImageSource;
}

interface UseVideoCaptureOptions {
  enabled: boolean;
  onAlert?: (alert: PostureAlert) => void;
  onMetricsUpdate?: (metrics: CVMetrics) => void;
}

interface UseVideoCaptureReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isLoaded: boolean;
  isStreaming: boolean;
  metrics: CVMetrics;
  stopCamera: () => void;
  getDemeanorSummary: () => {
    eyeContactPercent: number;
    postureAlertCount: number;
    poorPostureDuration: number;
    eyeContactLossCount: number;
    gazeOffScreenDuration: number;
    totalDurationSeconds: number;
  };
}

const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe';

async function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(s);
  });
}

async function loadMediaPipe(): Promise<void> {
  await loadScript(`${MEDIAPIPE_CDN}/face_mesh/face_mesh.js`);
  await loadScript(`${MEDIAPIPE_CDN}/pose/pose.js`);
  await loadScript(`${MEDIAPIPE_CDN}/camera_utils/camera_utils.js`);
}

export function useVideoCapture({
  enabled,
  onAlert,
  onMetricsUpdate,
}: UseVideoCaptureOptions): UseVideoCaptureReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceMeshRef = useRef<FaceMeshInstance | null>(null);
  const poseRef = useRef<PoseInstance | null>(null);
  const cameraRef = useRef<CameraInstance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameCountRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  // Telemetry counters (accumulated over session)
  const eyeLossFramesRef = useRef(0);
  const eyeContactLossCountRef = useRef(0);
  const gazeOffFramesRef = useRef(0);
  const poorPostureFramesRef = useRef(0);
  const postureAlertCountRef = useRef(0);
  const totalEyeContactFramesRef = useRef(0);
  const totalFramesRef = useRef(0);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [metrics, setMetrics] = useState<CVMetrics>({
    isLookingAtCamera: true,
    isGoodPosture: true,
    isInFrame: false,
    eyeContactLossSeconds: 0,
    postureAlertCount: 0,
  });

  const fireAlert = useCallback(
    (type: PostureAlert['type'], message: string) => {
      onAlert?.({
        id: `${type}-${Date.now()}`,
        type,
        message,
        timestamp: Date.now(),
      });
    },
    [onAlert]
  );

  const processFaceMesh = useCallback(
    (results: FaceMeshResults) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Mirror the canvas to match video feed
      ctx.scale(-1, 1);
      ctx.translate(-canvas.width, 0);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      const landmarks = results.multiFaceLandmarks?.[0];
      const isInFrame = !!landmarks;

      totalFramesRef.current++;

      if (!isInFrame) {
        fireAlert('out_of_frame', 'Please return to the camera frame.');
        setMetrics((prev) => ({ ...prev, isInFrame: false }));
        return;
      }

      // Eye gaze: use iris landmarks 468 (left) and 473 (right)
      // or approximate with eye corners 33, 133 (left) and 362, 263 (right)
      const leftEyeCenter = landmarks[468] ?? landmarks[33];
      const rightEyeCenter = landmarks[473] ?? landmarks[263];

      const avgX = ((leftEyeCenter?.x ?? 0.5) + (rightEyeCenter?.x ?? 0.5)) / 2;
      const avgY = ((leftEyeCenter?.y ?? 0.5) + (rightEyeCenter?.y ?? 0.5)) / 2;

      const deviationX = Math.abs(avgX - 0.5);
      const deviationY = Math.abs(avgY - 0.5);

      const isLooking =
        deviationX < CV_THRESHOLDS.EYE_GAZE_X_MAX &&
        deviationY < CV_THRESHOLDS.EYE_GAZE_Y_MAX;

      if (isLooking) {
        totalEyeContactFramesRef.current++;
        if (eyeLossFramesRef.current > 0) {
          // Reset loss streak
          eyeLossFramesRef.current = 0;
        }
      } else {
        eyeLossFramesRef.current++;
        gazeOffFramesRef.current++;

        if (eyeLossFramesRef.current === CV_THRESHOLDS.EYE_LOSS_FRAME_THRESHOLD) {
          eyeContactLossCountRef.current++;
          fireAlert('eye_contact', 'Please maintain eye contact with the camera.');
        }
      }

      const eyeContactLossSeconds = gazeOffFramesRef.current / 30;

      setMetrics((prev) => ({
        ...prev,
        isInFrame: true,
        isLookingAtCamera: isLooking,
        eyeContactLossSeconds,
        postureAlertCount: postureAlertCountRef.current,
      }));

      // Draw subtle eye contact indicator on canvas
      ctx.save();
      ctx.beginPath();
      ctx.arc(canvas.width / 2, 20, 6, 0, Math.PI * 2);
      ctx.fillStyle = isLooking ? 'rgba(16,185,129,0.8)' : 'rgba(239,68,68,0.8)';
      ctx.fill();
      ctx.restore();

      onMetricsUpdate?.({
        isLookingAtCamera: isLooking,
        isGoodPosture: metrics.isGoodPosture,
        isInFrame: true,
        eyeContactLossSeconds,
        postureAlertCount: postureAlertCountRef.current,
      });
    },
    [fireAlert, metrics.isGoodPosture, onMetricsUpdate]
  );

  const processPose = useCallback(
    (results: PoseResults) => {
      const landmarks = results.poseLandmarks;
      if (!landmarks) return;

      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];

      if (
        !leftShoulder ||
        !rightShoulder ||
        (leftShoulder.visibility ?? 0) < CV_THRESHOLDS.SHOULDER_VISIBILITY_MIN ||
        (rightShoulder.visibility ?? 0) < CV_THRESHOLDS.SHOULDER_VISIBILITY_MIN
      ) {
        return; // shoulders not visible — don't penalise
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      const lShoulderY = leftShoulder.y * canvas.height;
      const rShoulderY = rightShoulder.y * canvas.height;
      const tilt = Math.abs(lShoulderY - rShoulderY);

      const isGoodPosture = tilt < CV_THRESHOLDS.SHOULDER_TILT_MAX_PX;

      if (!isGoodPosture) {
        poorPostureFramesRef.current++;
        const poorPosSeconds = poorPostureFramesRef.current / 30;
        if (poorPosSeconds >= CV_THRESHOLDS.POSTURE_ALERT_DELAY_SECONDS &&
          poorPostureFramesRef.current % (CV_THRESHOLDS.POSTURE_ALERT_DELAY_SECONDS * 30) === 0) {
          postureAlertCountRef.current++;
          fireAlert('posture', 'Posture alert: Please sit upright and face the camera.');
        }
      } else {
        poorPostureFramesRef.current = 0;
      }

      setMetrics((prev) => ({
        ...prev,
        isGoodPosture,
        postureAlertCount: postureAlertCountRef.current,
      }));
    },
    [fireAlert]
  );

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function init() {
      try {
        await loadMediaPipe();
        if (cancelled) return;

        // Init FaceMesh
        faceMeshRef.current = new window.FaceMesh({
          locateFile: (f) => `${MEDIAPIPE_CDN}/face_mesh/${f}`,
        });
        faceMeshRef.current.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: CV_THRESHOLDS.FACE_DETECTION_CONFIDENCE_MIN,
          minTrackingConfidence: 0.5,
        });
        faceMeshRef.current.onResults(processFaceMesh);

        // Init Pose
        poseRef.current = new window.Pose({
          locateFile: (f) => `${MEDIAPIPE_CDN}/pose/${f}`,
        });
        poseRef.current.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        poseRef.current.onResults(processPose);

        // Get webcam stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: false,
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        if (!cancelled && videoRef.current) {
          cameraRef.current = new window.Camera(videoRef.current, {
            onFrame: async () => {
              frameCountRef.current++;
              // Skip frames for performance
              if (frameCountRef.current % CV_THRESHOLDS.FRAME_SKIP !== 0) return;
              if (videoRef.current) {
                await faceMeshRef.current?.send({ image: videoRef.current });
                await poseRef.current?.send({ image: videoRef.current });
              }
            },
            width: 1280,
            height: 720,
          });
          cameraRef.current.start();
          startTimeRef.current = Date.now();
          setIsStreaming(true);
          setIsLoaded(true);
        }
      } catch (err) {
        console.error('[useVideoCapture] Init failed:', err);
        setIsLoaded(true); // mark as loaded even on failure so UI doesn't hang
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const stopCamera = useCallback(() => {
    cameraRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setIsStreaming(false);
  }, []);

  const getDemeanorSummary = useCallback(() => {
    const totalSeconds = (Date.now() - startTimeRef.current) / 1000;
    const eyeContactPercent =
      totalFramesRef.current > 0
        ? Math.round((totalEyeContactFramesRef.current / totalFramesRef.current) * 100)
        : 100;

    return {
      eyeContactPercent,
      postureAlertCount: postureAlertCountRef.current,
      poorPostureDuration: Math.round(poorPostureFramesRef.current / 30),
      eyeContactLossCount: eyeContactLossCountRef.current,
      gazeOffScreenDuration: Math.round(gazeOffFramesRef.current / 30),
      totalDurationSeconds: Math.round(totalSeconds),
    };
  }, []);

  return { videoRef, canvasRef, isLoaded, isStreaming, metrics, stopCamera, getDemeanorSummary };
}
