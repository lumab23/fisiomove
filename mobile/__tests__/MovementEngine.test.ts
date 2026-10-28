import { MovementEngine } from '../src/features/exercise-engine/MovementEngine';
import type { ApprovedMovementRule } from '../src/features/exercise-engine/types';
import type { PoseFrame } from '../src/features/vision/types';

// Valores geométricos sintéticos para provar o algoritmo; não são prescrição clínica.
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

function frame(
  angleDegrees: number,
  timestampMs: number,
  confidence = 0.99,
): PoseFrame {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    timestamp_ms: timestampMs,
    image_width: 640,
    image_height: 480,
    orientation: 'portrait',
    is_mirrored: false,
    inference_duration_ms: 24,
    landmarks: {
      left_shoulder: {
        x: 1,
        y: 0,
        z: null,
        visibility: confidence,
        presence: confidence,
      },
      left_elbow: {
        x: 0,
        y: 0,
        z: null,
        visibility: confidence,
        presence: confidence,
      },
      left_wrist: {
        x: Math.cos(radians),
        y: Math.sin(radians),
        z: null,
        visibility: confidence,
        presence: confidence,
      },
    },
  };
}

test('conta um ciclo completo da sequência sintética', () => {
  const engine = new MovementEngine(rule, { smoothing_window_size: 1 });
  expect(engine.update(frame(90, 0), 'left').repetitions).toBe(0);
  expect(engine.update(frame(110, 300), 'left').repetitions).toBe(0);
  expect(engine.update(frame(140, 700), 'left').phase).toBe('descending');
  expect(engine.update(frame(110, 1000), 'left').repetitions).toBe(0);
  expect(engine.update(frame(90, 1200), 'left')).toMatchObject({
    feedback: 'rep_completed',
    repetitions: 1,
    phase: 'awaiting_initial',
  });
});

test('perda de ponto e baixa confiança descartam a fase parcial', () => {
  const engine = new MovementEngine(rule, { smoothing_window_size: 1 });
  engine.update(frame(90, 0), 'left');
  const missing = frame(120, 250);
  delete missing.landmarks.left_wrist;
  expect(engine.update(missing, 'left').feedback).toBe('capture_adjustment');
  expect(engine.update(frame(140, 500), 'left').repetitions).toBe(0);

  const lowConfidence = engine.update(frame(90, 1000, 0.1), 'left');
  expect(lowConfidence.feedback).toBe('low_confidence');
  expect(lowConfidence.repetitions).toBe(0);
});

test('não conta ciclo abaixo do tempo mínimo configurado', () => {
  const engine = new MovementEngine(rule, { smoothing_window_size: 1 });
  engine.update(frame(90, 0), 'left');
  engine.update(frame(140, 200), 'left');
  expect(engine.update(frame(90, 500), 'left')).toMatchObject({
    feedback: 'movement_in_progress',
    repetitions: 0,
  });
});

test('rejeita regra sem versão clínica aprovada correspondente', () => {
  expect(
    () =>
      new MovementEngine(
        {
          ...rule,
          approved_rule_version: 'older-version',
        },
        { smoothing_window_size: 1 },
      ),
  ).toThrow('A regra do exercício não possui aprovação compatível.');
});

test('exige janela de suavização explícita e válida', () => {
  expect(() => new MovementEngine(rule, { smoothing_window_size: 0 })).toThrow(
    'A janela de suavização precisa ser informada e válida.',
  );
});

test('suaviza ângulos com a janela configurada pelo integrador', () => {
  const engine = new MovementEngine(rule, { smoothing_window_size: 2 });
  engine.update(frame(90, 0), 'left');
  engine.update(frame(90, 100), 'left');
  engine.update(frame(110, 400), 'left');
  engine.update(frame(110, 500), 'left');
  engine.update(frame(140, 700), 'left');
  expect(engine.update(frame(140, 800), 'left').phase).toBe('descending');
  engine.update(frame(110, 1100), 'left');
  engine.update(frame(110, 1200), 'left');
  engine.update(frame(90, 1400), 'left');
  expect(engine.update(frame(90, 1500), 'left')).toMatchObject({
    feedback: 'rep_completed',
    repetitions: 1,
  });
});
