import {
  assessSelectedArm,
  toPreviewCoordinates,
} from '../src/features/vision/poseAssessment';
import type { PoseFrame } from '../src/features/vision/types';

const point = { x: 0.5, y: 0.5, z: null, visibility: 0.9, presence: 0.9 };
const frame: PoseFrame = {
  timestamp_ms: 10,
  image_width: 640,
  image_height: 480,
  orientation: 'portrait',
  is_mirrored: false,
  inference_duration_ms: 20,
  landmarks: {
    left_shoulder: point,
    left_elbow: point,
    left_wrist: point,
    right_shoulder: point,
    right_elbow: point,
    right_wrist: point,
  },
};

test('usa apenas os landmarks do lado selecionado', () => {
  const result = assessSelectedArm(frame, 'right', {
    minimum_visibility: 0.5,
    minimum_presence: 0.5,
  });
  expect(result.status).toBe('ready');
  if (result.status === 'ready') {
    expect(result.points.shoulder).toBe(point);
  }
});

test('separa perda de landmark de confiança baixa', () => {
  const withoutWrist = { ...frame, landmarks: { ...frame.landmarks } };
  delete withoutWrist.landmarks.left_wrist;
  expect(
    assessSelectedArm(withoutWrist, 'left', {
      minimum_visibility: 0.5,
      minimum_presence: 0.5,
    }).status,
  ).toBe('capture_adjustment');

  const lowConfidence = {
    ...frame,
    landmarks: {
      ...frame.landmarks,
      left_elbow: { ...point, presence: 0.1 },
    },
  };
  expect(
    assessSelectedArm(lowConfidence, 'left', {
      minimum_visibility: 0.5,
      minimum_presence: 0.5,
    }).status,
  ).toBe('low_confidence');
});

test('alinha coordenadas com rotação e espelhamento do preview', () => {
  const previewPoint = toPreviewCoordinates(
    { x: 0.2, y: 0.7 },
    'landscape-left',
    true,
  );
  expect(previewPoint.x).toBeCloseTo(0.3);
  expect(previewPoint.y).toBeCloseTo(0.8);
});
