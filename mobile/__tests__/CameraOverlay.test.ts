import {
  armSegments,
  cameraDebugText,
  cameraErrorMessage,
  cameraStatus,
  countVisibleArmPoints,
  framingFeedback,
} from '../src/features/vision/cameraOverlay';
import type { RawPoseObservation } from '../src/features/vision/RawPoseObservation';

// Synthetic points: positions only matter for presence, not for any rule.
const point = { x: 0.5, y: 0.5, confidence: 0.9, depth: null };

function observation(
  landmarks: RawPoseObservation['landmarks'],
): RawPoseObservation {
  return {
    timestamp_ms: 1000,
    image_width: 480,
    image_height: 640,
    orientation: 'portrait',
    is_mirrored: false,
    inference_duration_ms: 42,
    landmarks,
  };
}

const leftArm = {
  left_shoulder: point,
  left_elbow: point,
  left_wrist: point,
};

describe('armSegments', () => {
  it('links shoulder, elbow and wrist of the prescribed arm only', () => {
    expect(armSegments({ ...leftArm, right_shoulder: point }, 'left')).toEqual([
      ['left_shoulder', 'left_elbow'],
      ['left_elbow', 'left_wrist'],
    ]);
    expect(armSegments(leftArm, 'right')).toEqual([]);
  });

  it('skips a segment whose end is missing', () => {
    expect(
      armSegments({ left_shoulder: point, left_elbow: point }, 'left'),
    ).toEqual([['left_shoulder', 'left_elbow']]);
  });

  it('draws both arms for a bilateral item', () => {
    expect(
      armSegments(
        {
          ...leftArm,
          right_shoulder: point,
          right_elbow: point,
          right_wrist: point,
        },
        'bilateral',
      ),
    ).toHaveLength(4);
  });
});

describe('cameraStatus', () => {
  const base = { error: false, ready: true, side: 'left' as const };

  it('asks to show the arm until every point is found (framing first)', () => {
    expect(cameraStatus({ ...base, visiblePoints: 2 })).toEqual({
      text: 'Mostre o braço inteiro para a câmera',
      ok: false,
    });
    expect(cameraStatus({ ...base, visiblePoints: 3 })).toEqual({
      text: 'Braço visível',
      ok: true,
    });
    expect(
      cameraStatus({ ...base, side: 'bilateral', visiblePoints: 3 }).text,
    ).toBe('Mostre os dois braços inteiros para a câmera');
  });

  it('shows a fixed pt-BR text on failure and a warm-up text', () => {
    expect(cameraStatus({ ...base, error: true, visiblePoints: 3 })).toEqual({
      text: 'Não foi possível analisar a imagem agora.',
      ok: false,
    });
    expect(cameraStatus({ ...base, ready: false, visiblePoints: 0 }).text).toBe(
      'Preparando a câmera…',
    );
  });
});

describe('camera texts', () => {
  it('keeps the native English detail for development builds only', () => {
    expect(cameraErrorMessage('Model failed to load', false)).toBe(
      'Não foi possível analisar a imagem agora.',
    );
    expect(cameraErrorMessage('Model failed to load', true)).toBe(
      'Não foi possível analisar a imagem agora. (Model failed to load)',
    );
  });

  it('counts the visible points and describes the analysis', () => {
    const latest = observation({ left_shoulder: point, left_elbow: point });
    expect(countVisibleArmPoints(latest, 'left')).toBe(2);
    expect(cameraDebugText(latest, 'left', 3)).toBe(
      '2/3 pontos · 42 ms · análise local · 3 quadros descartados',
    );
    expect(cameraDebugText(null, 'left', 0)).toBe(
      '0/3 pontos · aguardando pose',
    );
  });
});

describe('engine framing feedback (RN05, DEC-013)', () => {
  const base = { error: false, ready: true, side: 'left' as const };

  it('replaces "Braço visível" while the engine cannot use the points', () => {
    expect(
      cameraStatus({ ...base, visiblePoints: 3, framing: 'low_confidence' }),
    ).toEqual({
      text: 'Não estamos vendo bem o braço. Prefira um lugar claro, com a luz à sua frente.',
      ok: false,
    });
    expect(cameraStatus({ ...base, visiblePoints: 3, framing: null })).toEqual({
      text: 'Braço visível',
      ok: true,
    });
  });

  it('keeps errors and missing points first', () => {
    expect(
      cameraStatus({
        ...base,
        error: true,
        visiblePoints: 3,
        framing: 'low_confidence',
      }).text,
    ).toBe('Não foi possível analisar a imagem agora.');
    expect(
      cameraStatus({ ...base, visiblePoints: 1, framing: 'low_confidence' })
        .text,
    ).toBe('Mostre o braço inteiro para a câmera');
  });

  it('shows image problems only, never the movement', () => {
    const update = {
      phase: 'awaiting_initial' as const,
      repetitions: 0,
      angle_degrees: null,
    };
    expect(framingFeedback({ ...update, feedback: 'low_confidence' })).toBe(
      'low_confidence',
    );
    expect(framingFeedback({ ...update, feedback: 'capture_adjustment' })).toBe(
      'capture_adjustment',
    );
    // Arm measured but not at the start of the cycle: no instruction (Q-C2).
    expect(
      framingFeedback({
        ...update,
        feedback: 'capture_adjustment',
        angle_degrees: 120,
      }),
    ).toBeNull();
    expect(
      framingFeedback({ ...update, feedback: 'movement_in_progress' }),
    ).toBeNull();
  });
});
