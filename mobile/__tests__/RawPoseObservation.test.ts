import {
  toRawPoseObservation,
  type RawPoseLandmarkId,
} from '../src/features/vision/RawPoseObservation';
import type { KeypointDetection } from 'react-native-executorch';

type CocoId =
  | 'leftEye'
  | 'rightEye'
  | 'leftEar'
  | 'rightEar'
  | 'nose'
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftElbow'
  | 'rightElbow'
  | 'leftWrist'
  | 'rightWrist'
  | 'leftHip'
  | 'rightHip'
  | 'leftKnee'
  | 'rightKnee'
  | 'leftAnkle'
  | 'rightAnkle';

const detection = {
  box: { x1: 0, y1: 0, x2: 384, y2: 384 },
  confidence: 0.9,
  landmarks: {
    leftShoulder: { x: 192, y: 192, confidence: 1, depth: 0.2 },
    leftElbow: { x: 384, y: 0, confidence: 1.2 },
    leftWrist: { x: 0, y: 384, confidence: -0.1 },
  },
} as unknown as KeypointDetection<'xyxy', CocoId>;

const metadata = {
  timestamp_ms: 123,
  image_width: 640,
  image_height: 480,
  orientation: 'portrait' as const,
  is_mirrored: false,
  inference_duration_ms: 24,
};

test('normaliza pontos e desfaz letterbox sem inventar confiança', () => {
  const observation = toRawPoseObservation(detection, metadata);

  expect(observation.landmarks.left_shoulder).toEqual({
    x: 0.5,
    y: 0.5,
    confidence: 1,
    depth: 0.2,
  });
  expect(observation.landmarks.left_elbow?.x).toBe(1);
  expect(observation.landmarks.left_elbow?.y).toBe(0);
  expect(observation.landmarks.left_elbow?.confidence).toBe(1);
  expect(observation.landmarks.left_wrist?.confidence).toBe(0);
  expect(Object.keys(observation.landmarks) as RawPoseLandmarkId[]).toEqual([
    'left_shoulder',
    'left_elbow',
    'left_wrist',
  ]);
});

test('ausência de detecção produz observação vazia', () => {
  expect(toRawPoseObservation(undefined, metadata).landmarks).toEqual({});
});
