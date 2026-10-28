import type { PoseLandmarkId } from '../vision/types';

export interface ApprovedMovementRule {
  exercise_code: string;
  rule_version: string;
  approval_status: 'approved';
  approved_rule_version: string;
  landmarks: {
    proximal: PoseLandmarkId;
    joint: PoseLandmarkId;
    distal: PoseLandmarkId;
  };
  confidence: {
    minimum_visibility: number;
    minimum_presence: number;
  };
  phases: {
    initial_angle_degrees: readonly [number, number];
    peak_angle_degrees: readonly [number, number];
    direction_to_peak: 'increasing' | 'decreasing';
    minimum_cycle_duration_ms: number;
    maximum_frame_gap_ms: number;
  };
  calibration: {
    allowed_reference_degrees: readonly [number, number];
    required_samples: number;
    maximum_sample_spread_degrees: number;
  };
}

export interface MovementEngineOptions {
  /** Informational signal-processing window, supplied by the integrator. */
  smoothing_window_size: number;
}

export type MovementPhase = 'awaiting_initial' | 'ascending' | 'descending';

export type MovementFeedback =
  | 'ready'
  | 'capture_adjustment'
  | 'low_confidence'
  | 'movement_in_progress'
  | 'rep_completed'
  | 'paused';

export interface MovementUpdate {
  phase: MovementPhase;
  repetitions: number;
  feedback: MovementFeedback;
  angle_degrees: number | null;
}

export interface CalibrationContext {
  owner_user_id: string;
  exercise_id: string;
  workout_id: string;
  workout_revision_id: string;
  workout_item_id: string;
  rule_version: string;
}

export interface MovementCalibration extends CalibrationContext {
  reference_angle_degrees: number;
  calibrated_at: string;
}
