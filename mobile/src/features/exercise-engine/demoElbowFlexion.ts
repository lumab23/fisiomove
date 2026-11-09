import type { JsonValue } from '../../contracts/common';
import type { RawPoseObservation } from '../vision/RawPoseObservation';
import type { PoseFrame } from '../vision/types';
import type { DemonstrationMovementRule } from './types';

/**
 * Technical demonstration only. These angle and timing bands are synthetic;
 * they are not clinician-approved exercise parameters.
 */
export const demoElbowFlexionRule: DemonstrationMovementRule = {
  mode: 'demonstration',
  clinically_validated: false,
  exercise_code: 'demo-elbow-flexion',
  rule_version: 'demo-elbow-flexion:v1',
  landmarks: {
    proximal: 'left_shoulder',
    joint: 'left_elbow',
    distal: 'left_wrist',
  },
  confidence: { minimum_visibility: 0.5, minimum_presence: 0.5 },
  phases: {
    initial_angle_degrees: [145, 180],
    peak_angle_degrees: [40, 100],
    direction_to_peak: 'decreasing',
    minimum_cycle_duration_ms: 900,
    maximum_frame_gap_ms: 700,
  },
  calibration: {
    allowed_reference_degrees: [145, 180],
    required_samples: 3,
    maximum_sample_spread_degrees: 15,
  },
};

/** Enable the demonstration rule only for the explicitly marked exercise. */
export function demoRuleForExercise(
  exerciseSnapshot: Record<string, JsonValue>,
  ruleVersion: string,
  side: 'left' | 'right' | 'bilateral',
): DemonstrationMovementRule | null {
  if (
    exerciseSnapshot.code !== demoElbowFlexionRule.exercise_code ||
    exerciseSnapshot.rule_version !== demoElbowFlexionRule.rule_version ||
    ruleVersion !== demoElbowFlexionRule.rule_version ||
    side === 'bilateral'
  ) {
    return null;
  }
  return side === 'left'
    ? demoElbowFlexionRule
    : {
        ...demoElbowFlexionRule,
        landmarks: {
          proximal: 'right_shoulder',
          joint: 'right_elbow',
          distal: 'right_wrist',
        },
      };
}

/** Maps the detector's single confidence value to both pose quality fields. */
export function poseFrameFromObservation(
  observation: RawPoseObservation,
): PoseFrame {
  const landmarks: PoseFrame['landmarks'] = {};
  for (const [id, point] of Object.entries(observation.landmarks)) {
    if (!point) continue;
    landmarks[id as keyof PoseFrame['landmarks']] = {
      x: point.x,
      y: point.y,
      z: point.depth,
      visibility: point.confidence,
      presence: point.confidence,
    };
  }
  return {
    timestamp_ms: observation.timestamp_ms,
    image_width: observation.image_width,
    image_height: observation.image_height,
    orientation: observation.orientation,
    is_mirrored: observation.is_mirrored,
    inference_duration_ms: observation.inference_duration_ms,
    landmarks,
  };
}
