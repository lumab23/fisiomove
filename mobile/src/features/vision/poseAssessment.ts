import type { Side } from '../../contracts/domain';
import type {
  FrameOrientation,
  PoseAssessment,
  PoseFrame,
  PoseLandmark,
  PoseLandmarkId,
  PoseQualityPolicy,
  SelectedArmLandmarks,
} from './types';
import { selectedArmIds } from './types';

export function assessSelectedArm(
  frame: PoseFrame,
  side: Side,
  policy: PoseQualityPolicy,
): PoseAssessment {
  if (
    !Number.isFinite(frame.timestamp_ms) ||
    !Number.isFinite(frame.image_width) ||
    !Number.isFinite(frame.image_height) ||
    frame.image_width <= 0 ||
    frame.image_height <= 0 ||
    !validConfidencePolicy(policy)
  ) {
    return {
      status: 'capture_adjustment',
      missing: [...selectedArmIds(side)],
    };
  }
  const ids = selectedArmIds(side);
  const missing = ids.filter(id => !frame.landmarks[id]);
  if (missing.length > 0) {
    return { status: 'capture_adjustment', missing };
  }

  const lowConfidence = ids.filter(id => {
    const point = frame.landmarks[id];
    return (
      point === undefined ||
      point.visibility < policy.minimum_visibility ||
      point.presence < policy.minimum_presence
    );
  });
  if (lowConfidence.length > 0) {
    return { status: 'low_confidence', landmarks: lowConfidence };
  }

  const [shoulderId, elbowId, wristId] = ids;
  const shoulder = frame.landmarks[shoulderId];
  const elbow = frame.landmarks[elbowId];
  const wrist = frame.landmarks[wristId];
  if (!shoulder || !elbow || !wrist) {
    return { status: 'capture_adjustment', missing: [...ids] };
  }
  return {
    status: 'ready',
    points: { shoulder, elbow, wrist } satisfies SelectedArmLandmarks,
  };
}

function validConfidencePolicy(policy: PoseQualityPolicy): boolean {
  return (
    Number.isFinite(policy.minimum_visibility) &&
    policy.minimum_visibility >= 0 &&
    policy.minimum_visibility <= 1 &&
    Number.isFinite(policy.minimum_presence) &&
    policy.minimum_presence >= 0 &&
    policy.minimum_presence <= 1
  );
}

export function toPreviewCoordinates(
  landmark: Pick<PoseLandmark, 'x' | 'y'>,
  orientation: FrameOrientation,
  isMirrored: boolean,
): { x: number; y: number } {
  let x: number;
  let y: number;
  switch (orientation) {
    case 'portrait':
      ({ x, y } = landmark);
      break;
    case 'portrait-upside-down':
      x = 1 - landmark.x;
      y = 1 - landmark.y;
      break;
    case 'landscape-left':
      x = landmark.y;
      y = 1 - landmark.x;
      break;
    case 'landscape-right':
      x = 1 - landmark.y;
      y = landmark.x;
      break;
  }
  return { x: isMirrored ? 1 - x : x, y };
}

export function frameInferenceRate(
  frames: readonly PoseFrame[],
): number | null {
  if (frames.length < 2) {
    return null;
  }
  const first = frames[0];
  const last = frames[frames.length - 1];
  const elapsed = last.timestamp_ms - first.timestamp_ms;
  if (elapsed <= 0) {
    return null;
  }
  return ((frames.length - 1) * 1000) / elapsed;
}

export function missingSelectedLandmarks(
  landmarks: PoseFrame['landmarks'],
  side: Side,
): PoseLandmarkId[] {
  return selectedArmIds(side).filter(id => !landmarks[id]);
}
