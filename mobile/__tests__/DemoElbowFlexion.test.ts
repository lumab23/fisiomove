import { MovementEngine } from '../src/features/exercise-engine/MovementEngine';
import {
  demoElbowFlexionRule,
  demoRuleForItem,
} from '../src/features/exercise-engine/demoElbowFlexion';
import type { PoseFrame } from '../src/features/vision/types';

function frame(angleDegrees: number, timestampMs: number): PoseFrame {
  const radians = (angleDegrees * Math.PI) / 180;
  const quality = { z: null, visibility: 0.99, presence: 0.99 };
  return {
    timestamp_ms: timestampMs,
    image_width: 640,
    image_height: 480,
    orientation: 'portrait',
    is_mirrored: true,
    inference_duration_ms: 18,
    landmarks: {
      left_shoulder: { x: 1, y: 0, ...quality },
      left_elbow: { x: 0, y: 0, ...quality },
      left_wrist: { x: Math.cos(radians), y: Math.sin(radians), ...quality },
    },
  };
}

test('counts one full synthetic elbow flexion and extension cycle', () => {
  const engine = new MovementEngine(demoElbowFlexionRule, {
    smoothing_window_size: 1,
  });

  expect(engine.update(frame(160, 0), 'left').repetitions).toBe(0);
  expect(engine.update(frame(120, 300), 'left').repetitions).toBe(0);
  expect(engine.update(frame(70, 600), 'left').phase).toBe('descending');
  expect(engine.update(frame(120, 900), 'left').repetitions).toBe(0);
  expect(engine.update(frame(160, 1100), 'left')).toMatchObject({
    feedback: 'rep_completed',
    repetitions: 1,
  });
});

test('only the item marked with the demonstration counting rule opts in (DEC-013)', () => {
  expect(demoRuleForItem('demo-elbow-flexion:v1', 'left')).toMatchObject({
    mode: 'demonstration',
    clinically_validated: false,
    landmarks: { joint: 'left_elbow' },
  });
  expect(demoRuleForItem('demo-elbow-flexion:v1', 'right')).toMatchObject({
    landmarks: { joint: 'right_elbow' },
  });
  // The trigger is the item, not the exercise code or its rule version.
  expect(demoRuleForItem(null, 'left')).toBeNull();
  expect(demoRuleForItem(undefined, 'left')).toBeNull();
  expect(demoRuleForItem('another-rule:v1', 'left')).toBeNull();
  expect(demoRuleForItem('demo-elbow-flexion:v1', 'bilateral')).toBeNull();
});

test('keeps the values approved as an academic demonstration (Q-C1)', () => {
  expect(demoElbowFlexionRule).toMatchObject({
    confidence: { minimum_visibility: 0.5, minimum_presence: 0.5 },
    phases: {
      initial_angle_degrees: [145, 180],
      peak_angle_degrees: [40, 100],
      direction_to_peak: 'decreasing',
      minimum_cycle_duration_ms: 900,
      maximum_frame_gap_ms: 700,
    },
  });
});
