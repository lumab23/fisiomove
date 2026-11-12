import type { Side } from '../../contracts/domain';
import type { MovementUpdate } from '../exercise-engine/types';
import type {
  RawPoseLandmarkId,
  RawPoseObservation,
} from './RawPoseObservation';

/**
 * Presentation of the live camera (DEC-012): which points and segments of the
 * prescribed arm are drawn and which status text the patient reads. Nothing
 * here judges the movement; "visible" only means the points exist.
 */

const armParts = ['shoulder', 'elbow', 'wrist'] as const;

/** Model labels of the prescribed arm, or of both arms (`bilateral`). */
export function armPrefixes(side: Side): readonly ('left' | 'right')[] {
  return side === 'bilateral' ? ['left', 'right'] : [side];
}

export function armLandmarkIds(side: Side): RawPoseLandmarkId[] {
  return armPrefixes(side).flatMap(prefix =>
    armParts.map(part => `${prefix}_${part}` as RawPoseLandmarkId),
  );
}

export function requiredArmPoints(side: Side): number {
  return armLandmarkIds(side).length;
}

/** Shoulder, elbow and wrist of the selected arm, or of both arms. */
export function countVisibleArmPoints(
  observation: RawPoseObservation | null,
  side: Side,
): number {
  if (!observation) return 0;
  return armLandmarkIds(side).filter(id => observation.landmarks[id]).length;
}

export type ArmSegment = readonly [RawPoseLandmarkId, RawPoseLandmarkId];

/** Shoulder–elbow and elbow–wrist of each arm whose two ends were found. */
export function armSegments(
  landmarks: RawPoseObservation['landmarks'],
  side: Side,
): ArmSegment[] {
  return armPrefixes(side).flatMap(prefix => {
    const segments: ArmSegment[] = [
      [`${prefix}_shoulder`, `${prefix}_elbow`],
      [`${prefix}_elbow`, `${prefix}_wrist`],
    ];
    return segments.filter(([from, to]) => landmarks[from] && landmarks[to]);
  });
}

export const cameraErrorText = 'Não foi possível analisar a imagem agora.';

/**
 * Fixed pt-BR text for native camera/model failures (DEC-014). The native
 * detail, usually in English, is appended only in development builds.
 */
export function cameraErrorMessage(
  detail: string | null | undefined,
  dev: boolean,
): string {
  return dev && detail ? `${cameraErrorText} (${detail})` : cameraErrorText;
}

/**
 * Engine feedback that is about the image, not the movement (RN05): low
 * confidence, or points that could not be measured.
 */
export type FramingFeedback = 'low_confidence' | 'capture_adjustment';

/**
 * Framing part of an engine update. `capture_adjustment` with a measured
 * angle only means the engine waits for the start of the cycle; telling the
 * patient how to move would be a movement instruction (Q-C2 not approved), so
 * it is not shown.
 */
export function framingFeedback(
  update: MovementUpdate,
): FramingFeedback | null {
  if (update.feedback === 'low_confidence') {
    return 'low_confidence';
  }
  if (
    update.feedback === 'capture_adjustment' &&
    update.angle_degrees === null
  ) {
    return 'capture_adjustment';
  }
  return null;
}

/** Framing texts only; they never describe or correct the movement. */
export const framingText: Record<FramingFeedback, string> = {
  low_confidence:
    'Não estamos vendo bem o braço. Prefira um lugar claro, com a luz à sua frente.',
  capture_adjustment: 'Afaste-se até o braço inteiro aparecer na tela.',
};

export interface CameraStatus {
  text: string;
  /** Every required point was found (shown with the success colour). */
  ok: boolean;
}

/**
 * Status line over the camera. A failure or the warm-up comes first; after
 * that, framing has priority (RN05): the patient is asked to show the arm
 * until every point of it is found and, with automatic counting, until the
 * engine can use those points ("Braço visível" uses the engine's criterion).
 */
export function cameraStatus({
  error,
  ready,
  side,
  visiblePoints,
  framing = null,
}: {
  error: boolean;
  ready: boolean;
  side: Side;
  visiblePoints: number;
  framing?: FramingFeedback | null;
}): CameraStatus {
  const bothArms = side === 'bilateral';
  if (error) {
    return { text: cameraErrorText, ok: false };
  }
  if (!ready) {
    return { text: 'Preparando a câmera…', ok: false };
  }
  if (visiblePoints < requiredArmPoints(side)) {
    return {
      text: bothArms
        ? 'Mostre os dois braços inteiros para a câmera'
        : 'Mostre o braço inteiro para a câmera',
      ok: false,
    };
  }
  if (framing) {
    return { text: framingText[framing], ok: false };
  }
  return { text: bothArms ? 'Braços visíveis' : 'Braço visível', ok: true };
}

/** Technical line for development builds only (DEC-012). */
export function cameraDebugText(
  observation: RawPoseObservation | null,
  side: Side,
  droppedFrames: number,
): string {
  const points = `${countVisibleArmPoints(observation, side)}/${requiredArmPoints(side)} pontos`;
  return observation
    ? `${points} · ${observation.inference_duration_ms} ms · análise local · ${droppedFrames} quadros descartados`
    : `${points} · aguardando pose`;
}
