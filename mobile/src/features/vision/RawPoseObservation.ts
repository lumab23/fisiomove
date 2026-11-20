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

/** The person's right arm is the model's "left" in a mirrored image. */
const oppositeSide: Record<CocoLandmark, CocoLandmark> = {
  leftShoulder: 'rightShoulder',
  rightShoulder: 'leftShoulder',
  leftElbow: 'rightElbow',
  rightElbow: 'leftElbow',
  leftWrist: 'rightWrist',
  rightWrist: 'leftWrist',
};

/**
 * `pixelsMirrored` tells that the pixels given to the model were already
 * flipped (front camera output with a physically mirrored buffer). The model
 * names sides as seen in the image, so they are swapped back to the person's
 * own right and left; positions stay as they are, matching the preview.
 */
export function toRawPoseObservation(
  detection: CocoDetection | undefined,
  metadata: Omit<RawPoseObservation, 'landmarks'>,
  pixelsMirrored = false,
): RawPoseObservation {
  const landmarks: RawPoseObservation['landmarks'] = {};
  if (detection && metadata.image_width > 0 && metadata.image_height > 0) {
    for (const [personId, outputId] of Object.entries(trackedLandmarks) as [
      CocoLandmark,
      RawPoseLandmarkId,
    ][]) {
      const modelId = pixelsMirrored ? oppositeSide[personId] : personId;
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
