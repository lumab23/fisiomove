import type { Side } from '../../contracts/domain';

export type PoseLandmarkId =
  | 'left_shoulder'
  | 'right_shoulder'
  | 'left_elbow'
  | 'right_elbow'
  | 'left_wrist'
  | 'right_wrist';

export type FrameOrientation =
  'portrait' | 'portrait-upside-down' | 'landscape-left' | 'landscape-right';

export interface PoseLandmark {
  x: number;
  y: number;
  z: number | null;
  visibility: number;
  presence: number;
}

export interface PoseFrame {
  timestamp_ms: number;
  image_width: number;
  image_height: number;
  orientation: FrameOrientation;
  is_mirrored: boolean;
  landmarks: Partial<Record<PoseLandmarkId, PoseLandmark>>;
  inference_duration_ms: number;
}

export interface SelectedArmLandmarks {
  shoulder: PoseLandmark;
  elbow: PoseLandmark;
  wrist: PoseLandmark;
}

export interface PoseQualityPolicy {
  minimum_visibility: number;
  minimum_presence: number;
}

export type PoseAssessment =
  | { status: 'ready'; points: SelectedArmLandmarks }
  | {
      status: 'capture_adjustment';
      missing: PoseLandmarkId[];
    }
  | {
      status: 'low_confidence';
      landmarks: PoseLandmarkId[];
    };

export function selectedArmIds(side: Side): readonly PoseLandmarkId[] {
  if (side === 'right') {
    return ['right_shoulder', 'right_elbow', 'right_wrist'];
  }
  if (side === 'left') {
    return ['left_shoulder', 'left_elbow', 'left_wrist'];
  }
  throw new Error(
    'A unilateral side must be selected before assessing arm landmarks.',
  );
}
