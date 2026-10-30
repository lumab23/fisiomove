import type { PoseFrame } from '../vision/types';
import type { ApprovedMovementRule } from './types';

export type AngleResult =
  | { status: 'measured'; angle_degrees: number; confidence: number }
  | { status: 'capture_adjustment' }
  | { status: 'low_confidence' }
  | { status: 'degenerate_geometry' };

export function measureJointAngle(
  frame: PoseFrame,
  rule: ApprovedMovementRule,
): AngleResult {
  const { proximal, joint, distal } = rule.landmarks;
  const first = frame.landmarks[proximal];
  const vertex = frame.landmarks[joint];
  const last = frame.landmarks[distal];
  if (!first || !vertex || !last) {
    return { status: 'capture_adjustment' };
  }

  const points = [first, vertex, last];
  if (
    points.some(
      point =>
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        !Number.isFinite(point.visibility) ||
        !Number.isFinite(point.presence) ||
        point.visibility < rule.confidence.minimum_visibility ||
        point.presence < rule.confidence.minimum_presence,
    )
  ) {
    return { status: 'low_confidence' };
  }

  const firstVector = { x: first.x - vertex.x, y: first.y - vertex.y };
  const lastVector = { x: last.x - vertex.x, y: last.y - vertex.y };
  const firstLength = Math.hypot(firstVector.x, firstVector.y);
  const lastLength = Math.hypot(lastVector.x, lastVector.y);
  if (firstLength === 0 || lastLength === 0) {
    return { status: 'degenerate_geometry' };
  }

  const cosine =
    (firstVector.x * lastVector.x + firstVector.y * lastVector.y) /
    (firstLength * lastLength);
  const boundedCosine = Math.max(-1, Math.min(1, cosine));
  const angle = (Math.acos(boundedCosine) * 180) / Math.PI;
  if (!Number.isFinite(angle)) {
    return { status: 'degenerate_geometry' };
  }
  const confidence = Math.min(
    ...points.map(point => Math.min(point.visibility, point.presence)),
  );
  return {
    status: 'measured',
    angle_degrees: angle,
    confidence,
  };
}
