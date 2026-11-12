import { createCalibration } from '../src/features/exercise-engine/calibration';
import { measureJointAngle } from '../src/features/exercise-engine/geometry';
import type { ApprovedMovementRule } from '../src/features/exercise-engine/types';
import type { PoseFrame } from '../src/features/vision/types';

// Valores sintéticos exclusivos dos testes; não representam prescrição clínica.
const rule: ApprovedMovementRule = {
  exercise_code: 'test-only',
  rule_version: 'test-v1',
  approval_status: 'approved',
  approved_rule_version: 'test-v1',
  landmarks: {
    proximal: 'left_shoulder',
    joint: 'left_elbow',
    distal: 'left_wrist',
  },
  confidence: { minimum_visibility: 0.5, minimum_presence: 0.5 },
  phases: {
    initial_angle_degrees: [85, 95],
    peak_angle_degrees: [135, 145],
    direction_to_peak: 'increasing',
    minimum_cycle_duration_ms: 1000,
    maximum_frame_gap_ms: 600,
  },
  calibration: {
    allowed_reference_degrees: [85, 95],
    required_samples: 3,
    maximum_sample_spread_degrees: 4,
  },
};

const context = {
  owner_user_id: 'user-test',
  exercise_id: 'exercise-test',
  workout_id: 'workout-test',
  workout_revision_id: 'revision-test',
  workout_item_id: 'item-test',
  rule_version: 'test-v1',
};

function point(x: number, y: number) {
  return { x, y, z: null, visibility: 0.9, presence: 0.9 };
}

function frame(angle: number): PoseFrame {
  const radians = (angle * Math.PI) / 180;
  return {
    timestamp_ms: 0,
    image_width: 640,
    image_height: 480,
    orientation: 'portrait',
    is_mirrored: false,
    inference_duration_ms: 20,
    landmarks: {
      left_shoulder: point(1, 0),
      left_elbow: point(0, 0),
      left_wrist: point(Math.cos(radians), Math.sin(radians)),
    },
  };
}

test('calcula ângulo e recusa geometria degenerada', () => {
  expect(measureJointAngle(frame(90), rule)).toMatchObject({
    status: 'measured',
    angle_degrees: 90,
  });
  const degenerate = frame(90);
  degenerate.landmarks.left_wrist = degenerate.landmarks.left_elbow;
  expect(measureJointAngle(degenerate, rule).status).toBe(
    'degenerate_geometry',
  );
});

test('cria calibração dentro dos limites e rejeita amostras fora deles', () => {
  expect(
    createCalibration(context, [89, 90, 91], rule, '2026-10-28T12:00:00Z'),
  ).toMatchObject({
    ...context,
    reference_angle_degrees: 90,
  });
  expect(() =>
    createCalibration(context, [80, 90, 100], rule, '2026-10-28T12:00:00Z'),
  ).toThrow('A posição variou além do limite de calibração aprovado.');
  expect(() =>
    createCalibration(
      { ...context, rule_version: 'old-version' },
      [89, 90, 91],
      rule,
      '2026-10-28T12:00:00Z',
    ),
  ).toThrow('A calibração exige a regra aprovada da mesma versão.');
});
