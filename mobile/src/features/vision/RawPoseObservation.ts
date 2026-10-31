import type { KeypointDetection } from 'react-native-executorch';
import type { FrameOrientation } from './types';

const trackedLandmarks = {
  leftShoulder: 'left_shoulder',
  rightShoulder: 'right_shoulder',
  leftElbow: 'left_elbow',
  rightElbow: 'right_elbow',
  leftWrist: 'left_wrist',
  rightWrist: 'right_wrist',
} as const;

export type RawPoseLandmarkId =
  (typeof trackedLandmarks)[keyof typeof trackedLandmarks];

export interface RawPoseLandmark {
  x: number;
  y: number;
  confidence: number;
  depth: number | null;
}

export interface RawPoseObservation {
  timestamp_ms: number;
  image_width: number;
  image_height: number;
  orientation: FrameOrientation;
  is_mirrored: boolean;
  inference_duration_ms: number;
  landmarks: Partial<Record<RawPoseLandmarkId, RawPoseLandmark>>;
}

type CocoLandmark = keyof typeof trackedLandmarks;
type CocoDetection = KeypointDetection<
  'xyxy',
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
  | 'rightAnkle'
>;

export function toRawPoseObservation(
  detection: CocoDetection | undefined,
  metadata: Omit<RawPoseObservation, 'landmarks'>,
): RawPoseObservation {
  const landmarks: RawPoseObservation['landmarks'] = {};
  if (detection && metadata.image_width > 0 && metadata.image_height > 0) {
    for (const [modelId, outputId] of Object.entries(trackedLandmarks) as [
      CocoLandmark,
      RawPoseLandmarkId,
    ][]) {
      const point = detection.landmarks[modelId];
      if (!point) continue;
      const scale = Math.min(
        384 / metadata.image_width,
        384 / metadata.image_height,
      );
      const displayedWidth = metadata.image_width * scale;
      const displayedHeight = metadata.image_height * scale;
      const offsetX = (384 - displayedWidth) / 2;
      const offsetY = (384 - displayedHeight) / 2;
      landmarks[outputId] = {
        x: clamp((point.x - offsetX) / displayedWidth),
        y: clamp((point.y - offsetY) / displayedHeight),
        confidence: clamp(point.confidence),
        depth: point.depth ?? null,
      };
    }
  }
  return { ...metadata, landmarks };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
