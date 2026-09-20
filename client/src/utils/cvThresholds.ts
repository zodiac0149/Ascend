// ============================================================
// Computer Vision Threshold Configuration
// All values are empirically tuned for a typical laptop/webcam setup.
// Modify these to fine-tune sensitivity.
// ============================================================

export const CV_THRESHOLDS = {
  // ── Eye Gaze ────────────────────────────────────────────────
  /**
   * Max normalised horizontal gaze deviation before "looking away" is flagged.
   * Range: 0 (center) – 1.0 (fully left/right)
   * 0.25 ≈ 25% off-center before triggering.
   */
  EYE_GAZE_X_MAX: 0.25,

  /**
   * Max normalised vertical gaze deviation.
   */
  EYE_GAZE_Y_MAX: 0.20,

  /**
   * Consecutive off-gaze frames before a "loss" is counted.
   * At 30fps, 90 frames ≈ 3 seconds (spec requirement).
   */
  EYE_LOSS_FRAME_THRESHOLD: 90,

  /**
   * Seconds of consecutive eye-contact loss before showing alert.
   */
  EYE_LOSS_SECONDS_BEFORE_ALERT: 3,

  // ── Posture / Shoulder Alignment ────────────────────────────
  /**
   * Max shoulder tilt (in pixels) before "slouching" is flagged.
   * Calculated as |left_shoulder_y - right_shoulder_y|.
   */
  SHOULDER_TILT_MAX_PX: 30,

  /**
   * Minimum shoulder visibility confidence (0–1).
   * Below this, the pose is considered out-of-frame.
   */
  SHOULDER_VISIBILITY_MIN: 0.5,

  /**
   * Seconds of poor posture before alert fires.
   */
  POSTURE_ALERT_DELAY_SECONDS: 4,

  // ── Frame Detection ─────────────────────────────────────────
  /**
   * Minimum face detection confidence (0–1).
   * Below this, user is considered "out of frame".
   */
  FACE_DETECTION_CONFIDENCE_MIN: 0.5,

  // ── Processing Frequency ────────────────────────────────────
  /**
   * MediaPipe processes every N-th video frame to balance accuracy and CPU.
   * 2 = process every other frame (~15fps analysis at 30fps capture).
   */
  FRAME_SKIP: 2,

  // ── Scoring Weights ─────────────────────────────────────────
  /**
   * Weight of eye contact in the demeanor score calculation (0–1).
   */
  EYE_CONTACT_WEIGHT: 0.6,
  POSTURE_WEIGHT: 0.4,
} as const;

/**
 * Calculates the demeanor score (0–100) from raw CV telemetry.
 */
export function calculateDemeanorScore(
  eyeContactPercent: number,
  postureAlertCount: number,
  totalDurationSeconds: number
): number {
  const eyeScore = eyeContactPercent; // already 0-100

  // Posture penalty: each alert deducts points proportional to session length
  const posturePenalty = Math.min(
    40,
    postureAlertCount * (10 / Math.max(1, totalDurationSeconds / 60))
  );
  const postureScore = Math.max(0, 100 - posturePenalty);

  const score =
    eyeScore * CV_THRESHOLDS.EYE_CONTACT_WEIGHT +
    postureScore * CV_THRESHOLDS.POSTURE_WEIGHT;

  return Math.round(Math.min(100, Math.max(0, score)));
}
