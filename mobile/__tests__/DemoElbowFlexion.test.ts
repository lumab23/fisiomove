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

// Camera-like sequences: 20 frames/s, smooth (cosine) movement and a
// deterministic noise. Synthetic geometry only; not a clinical recording.
const FRAME_MS = 50;

function ease(from: number, to: number, durationMs: number): number[] {
  const count = Math.round(durationMs / FRAME_MS);
  return Array.from(
    { length: count },
    (_, index) =>
      from + ((to - from) * (1 - Math.cos((Math.PI * index) / count))) / 2,
  );
}

function cycle(bottom: number): number[] {
  return [
    ...ease(165, 165, 500),
    ...ease(165, bottom, 1200),
    ...ease(bottom, bottom, 300),
    ...ease(bottom, 165, 1200),
    ...ease(165, 165, 500),
  ];
}

function noise(amplitude: number): (index: number) => number {
  let seed = 12345;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed / 2147483647 - 0.5) * 2 * amplitude;
  };
}

function countFrames(angles: readonly number[], amplitude = 0): number {
  const engine = new MovementEngine(demoElbowFlexionRule, {
    smoothing_window_size: 4,
  });
  const jitter = noise(amplitude);
  let repetitions = 0;
  angles.forEach((angle, index) => {
    repetitions = engine.update(
      frame(angle + jitter(index), index * FRAME_MS),
      'left',
    ).repetitions;
  });
  return repetitions;
}

test('counts a cycle that keeps flexing after entering the peak range', () => {
  expect(countFrames(cycle(60))).toBe(1);
  expect(countFrames(cycle(45))).toBe(1);
});

test('counts every cycle of a noisy camera-like sequence', () => {
  const tenCycles = Array.from({ length: 10 }, () => cycle(60)).flat();
  expect(countFrames(tenCycles, 3)).toBe(10);
});

test('does not count movements that never reach the peak range', () => {
  const partial = Array.from({ length: 5 }, () => [
    ...ease(165, 165, 500),
    ...ease(165, 115, 1000),
    ...ease(115, 165, 1000),
  ]).flat();
  expect(countFrames(partial, 3)).toBe(0);
});

test('does not count a flexion that never returns to the initial range', () => {
  const noReturn = [
    ...ease(165, 165, 500),
    ...ease(165, 60, 1200),
    ...ease(60, 130, 1200),
    ...ease(130, 130, 1000),
  ];
  expect(countFrames(noReturn, 3)).toBe(0);
});

test('counts once when the angle oscillates at the peak edge', () => {
  const edge = [
    ...ease(165, 165, 500),
    ...ease(165, 95, 1200),
    ...Array.from({ length: 10 }, () => [
      ...ease(95, 104, 200),
      ...ease(104, 95, 200),
    ]).flat(),
    ...ease(95, 165, 1200),
    ...ease(165, 165, 500),
  ];
  expect(countFrames(edge)).toBe(1);
});

test('does not count again while the arm oscillates near extension', () => {
  const top = [
    ...cycle(60),
    ...Array.from({ length: 10 }, () => [
      ...ease(165, 140, 200),
      ...ease(140, 165, 200),
    ]).flat(),
  ];
  expect(countFrames(top, 3)).toBe(1);
});

test('drops the partial cycle after a frame gap above the limit', () => {
  const engine = new MovementEngine(demoElbowFlexionRule, {
    smoothing_window_size: 1,
  });
  engine.update(frame(165, 0), 'left');
  engine.update(frame(70, 600), 'left');
  // 800 ms without frames (> 700 ms): the flexion seen before is discarded.
  engine.update(frame(160, 1400), 'left');
  expect(engine.update(frame(165, 1500), 'left').repetitions).toBe(0);
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
