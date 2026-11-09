import { MovementEngine } from '../src/features/exercise-engine/MovementEngine';
import {
  demoElbowFlexionRule,
  demoRuleForExercise,
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

test('only opts the exact explicitly marked exercise into demonstration mode', () => {
  expect(
    demoRuleForExercise(
      {
        code: 'demo-elbow-flexion',
        rule_version: 'demo-elbow-flexion:v1',
      },
      'demo-elbow-flexion:v1',
      'left',
    ),
  ).toMatchObject({ mode: 'demonstration', clinically_validated: false });

  expect(
    demoRuleForExercise(
      { code: 'another-exercise', rule_version: 'demo-elbow-flexion:v1' },
      'demo-elbow-flexion:v1',
      'left',
    ),
  ).toBeNull();
  expect(
    demoRuleForExercise(
      { code: 'demo-elbow-flexion', rule_version: 'demo-elbow-flexion:v1' },
      'demo-elbow-flexion:v1',
      'bilateral',
    ),
  ).toBeNull();
});
