import {
  mockNativeAlerts,
  pressNativeAlert,
  lastNativeAlert,
} from '../test-utils/nativeAlerts';
import React from 'react';
import { AppState, Image, Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ApiError } from '../src/api/errors';
import { appDependencies } from '../src/app/dependencies';
import { ScreenMessageProvider } from '../src/components/ScreenMessage';
import type { Workout } from '../src/contracts/domain';
import { FrontendNavigator } from '../src/navigation/FrontendNavigator';
import type {
  PendingSession,
  SessionDraft,
  SyncReport,
} from '../src/sync/types';
import { pageOf } from '../test-utils/helpers';

jest.mock('../src/app/dependencies', () => ({
  appDependencies: {
    profile: { mine: jest.fn(), linkedPhysiotherapist: jest.fn() },
    workouts: { listMine: jest.fn(), get: jest.fn() },
    exercises: { get: jest.fn() },
    sessions: { listMine: jest.fn() },
    progress: { mine: jest.fn() },
    api: {
      imageSource: (url: string) => ({
        uri: `http://api.test${url}`,
        headers: { Authorization: 'Bearer test' },
      }),
      refreshAuthentication: jest.fn(),
    },
  },
}));
const mockSync = {
  findDraft: jest.fn(),
  prepare: jest.fn(),
  discardDraft: jest.fn(),
  discardOutdatedDrafts: jest.fn(),
  finishDraft: jest.fn(),
  retryNow: jest.fn(),
  pending: [] as PendingSession[],
  syncing: false,
  loadError: null as unknown,
  lastReport: null as SyncReport | null,
};
/** Re-renders the screens that read the mocked sync state. */
const mockSyncListeners = new Set<() => void>();
jest.mock('../src/sync/SessionSyncContext', () => {
  const { useEffect, useReducer } = require('react');
  return {
    useSessionSync: () => {
      const [, rerender] = useReducer((count: number) => count + 1, 0);
      useEffect(() => {
        mockSyncListeners.add(rerender);
        return () => {
          mockSyncListeners.delete(rerender);
        };
      }, []);
      return { ...mockSync };
    },
  };
});

async function updateSync(change: Partial<typeof mockSync>) {
  Object.assign(mockSync, change);
  await act(async () => mockSyncListeners.forEach(listener => listener()));
}
const mockCamera: { initial: string; result: string } = {
  initial: 'not-determined',
  result: 'authorized',
};
jest.mock('react-native-vision-camera', () => {
  const { useState } = require('react');
  return {
    useCameraPermission: () => {
      const [status, setStatus] = useState(mockCamera.initial);
      return {
        status,
        hasPermission: status === 'authorized',
        canRequestPermission: status === 'not-determined',
        requestPermission: async () => {
          setStatus(mockCamera.result);
          return mockCamera.result === 'authorized';
        },
      };
    },
  };
});
const mockCameraSides: string[] = [];
/** Props of the last camera render: the test feeds synthetic observations. */
const mockCameraProps: {
  latest: {
    onObservation?: (observation: unknown) => void;
    framing?: string | null;
  } | null;
} = { latest: null };
jest.mock('../src/features/vision/LocalPoseCamera', () => ({
  LocalPoseCamera: (props: {
    side: string;
    onObservation?: (observation: unknown) => void;
    framing?: string | null;
  }) => {
    mockCameraSides.push(props.side);
    mockCameraProps.latest = props;
    return null;
  },
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

const services = appDependencies as unknown as {
  profile: { mine: jest.Mock; linkedPhysiotherapist: jest.Mock };
  workouts: { listMine: jest.Mock; get: jest.Mock };
  exercises: { get: jest.Mock };
  sessions: { listMine: jest.Mock };
  progress: { mine: jest.Mock };
};

// Test values only; they differ from the old demo (8 repetitions, 2 sets).
const workout: Workout = {
  id: 'workout-1',
  patient_id: 'patient-1',
  created_by: 'professional-1',
  status: 'published',
  current_revision_id: 'revision-1',
  revision_number: 2,
  instructions: null,
  published_at: '2026-11-06T12:00:00Z',
  created_at: '2026-11-06T12:00:00Z',
  updated_at: '2026-11-06T12:00:00Z',
  items: [
    {
      id: 'item-1',
      position: 1,
      exercise_id: 'exercise-1',
      side: 'left',
      sets: 2,
      repetitions: 3,
      rest_duration_ms: 0,
      rule_version: 'library-reference-no-camera-rule:v1',
      professional_guidance: null,
      parameters: {},
      exercise_snapshot: { name: 'Test arm raise' },
    },
  ],
};
const draft: SessionDraft = {
  owner_user_id: 'patient-user',
  client_session_id: 'client-1',
  workout_id: 'workout-1',
  workout_revision_id: 'revision-1',
  started_at: '2026-11-06T12:00:00.000Z',
};
let app: ReactTestRenderer.ReactTestRenderer;

beforeEach(() => {
  mockNativeAlerts();
  services.profile.mine.mockResolvedValue({ full_name: 'Joana Souza' });
  services.profile.linkedPhysiotherapist.mockResolvedValue({ full_name: null });
  services.workouts.listMine.mockResolvedValue(pageOf([workout]));
  services.workouts.get.mockResolvedValue(workout);
  services.exercises.get.mockRejectedValue(new Error('not used'));
  services.sessions.listMine.mockResolvedValue(pageOf([]));
  services.progress.mine.mockRejectedValue(new Error('not used'));
  mockSync.findDraft.mockResolvedValue(null);
  mockSync.prepare.mockResolvedValue(draft);
  mockSync.discardDraft.mockResolvedValue(true);
  mockSync.discardOutdatedDrafts.mockResolvedValue(0);
  mockSync.finishDraft.mockResolvedValue({ state: 'pending' });
  mockSync.retryNow.mockResolvedValue({ sent: 1 });
  mockSync.pending = [];
  mockSync.loadError = null;
  mockSync.lastReport = null;
});

afterEach(async () => {
  jest.restoreAllMocks();
  mockCamera.initial = 'not-determined';
  mockCamera.result = 'authorized';
  mockCameraSides.length = 0;
  mockCameraProps.latest = null;
  jest.clearAllMocks();
  await act(async () => app.unmount());
});

async function render() {
  await act(async () => {
    app = ReactTestRenderer.create(
      <ScreenMessageProvider>
        <FrontendNavigator flow="patient" />
      </ScreenMessageProvider>,
    );
  });
}

function texts() {
  return app.root
    .findAllByType(Text)
    .map(node => [node.props.children].flat().join(''));
}

function hasText(value: string) {
  return texts().some(text => text.includes(value));
}

function hasButton(label: string) {
  return (
    app.root.findAll(
      node =>
        typeof node.props.onPress === 'function' &&
        node.props.accessibilityLabel === label,
    ).length > 0
  );
}

async function press(label: string) {
  if (
    (label === 'Cancelar' || label === 'Confirmar') &&
    !app.root.findAll(
      node =>
        node.props.accessibilityLabel === label &&
        typeof node.props.onPress === 'function',
    ).length
  ) {
    await act(async () => {
      pressNativeAlert(label);
    });
    return;
  }
  const [target] = app.root.findAll(
    node =>
      typeof node.props.onPress === 'function' &&
      node.props.accessibilityLabel === label,
  );
  if (!target) {
    throw new Error(`Button not found: ${label}`);
  }
  await act(async () => target.props.onPress());
}

/** Home → preparation → camera already allowed → framing. */
async function openFraming(start = 'Iniciar treino') {
  mockCamera.initial = 'authorized';
  await render();
  await press(start);
  await press('Continuar');
}

test('preparation loads the published workout and shows the front camera steps', async () => {
  await render();
  await press('Iniciar treino');
  expect(services.workouts.get).toHaveBeenCalledWith('workout-1');
  expect(hasText('Prepare o celular')).toBe(true);
  for (const step of [
    'Vamos usar a câmera da frente, a mesma do lado da tela.',
    'Deixe o celular em pé, apoiado num lugar firme, na altura do peito.',
    'Afaste-se até o braço inteiro aparecer na tela.',
    'Prefira um lugar claro, com a luz à sua frente.',
    'Só você vê a imagem; ela não sai do celular.',
  ]) {
    expect(hasText(step)).toBe(true);
  }
  // Framing only: no distance in meters.
  expect(hasText('metro')).toBe(false);
  // Voice commands are out of the flow (DEC-009).
  expect(hasText('comandos de voz')).toBe(false);
  expect(mockSync.prepare).not.toHaveBeenCalled();
});

test('framing uses the item side and prepares the draft only on start', async () => {
  await openFraming();
  expect(hasText('Confira o enquadramento')).toBe(true);
  expect(hasText('Test arm raise')).toBe(true);
  expect(mockCameraSides).toContain('left');
  expect(mockSync.prepare).not.toHaveBeenCalled();

  await press('Começar exercício');
  expect(mockSync.findDraft).toHaveBeenCalledWith('workout-1', 'revision-1');
  expect(mockSync.prepare).toHaveBeenCalledTimes(1);
  // Drafts of an older revision of the same workout are discarded first.
  expect(mockSync.discardOutdatedDrafts).toHaveBeenCalledWith(
    'workout-1',
    'revision-1',
  );
  expect(
    mockSync.discardOutdatedDrafts.mock.invocationCallOrder[0],
  ).toBeLessThan(mockSync.findDraft.mock.invocationCallOrder.at(-1)!);
  expect(mockSync.prepare).toHaveBeenCalledWith('workout-1', 'revision-1');
  expect(hasText('Série 1 de 2')).toBe(true);
  expect(hasText(' de 3')).toBe(true);
  expect(hasText(' de 8')).toBe(false);
});

test('a draft of the same revision is reused without a new prepare', async () => {
  mockSync.findDraft.mockResolvedValue(draft);
  await openFraming('Continuar treino');
  await press('Começar exercício');
  expect(mockSync.prepare).not.toHaveBeenCalled();
  expect(hasButton('Contar repetição')).toBe(true);
});

test('a bilateral item asks for both arms', async () => {
  services.workouts.get.mockResolvedValue({
    ...workout,
    items: [{ ...workout.items[0], side: 'bilateral' }],
  });
  await openFraming();
  expect(mockCameraSides).toContain('bilateral');
  expect(hasText('Veja se os dois braços aparecem inteiros na imagem.')).toBe(
    true,
  );
});

test('another revision discards the old draft and sends the patient back', async () => {
  services.workouts.get.mockResolvedValue({
    ...workout,
    current_revision_id: 'revision-2',
  });
  mockSync.findDraft.mockResolvedValue(draft);
  await render();
  await press('Continuar treino');
  expect(hasText('Seu treino foi atualizado pelo fisioterapeuta')).toBe(true);
  expect(hasButton('Continuar')).toBe(false);
  expect(mockSync.discardDraft).toHaveBeenCalledWith('client-1');
  await press('Ver meu treino');
  expect(hasText('Exercícios prescritos')).toBe(true);
});

test('an unpublished workout (404) shows the same update message', async () => {
  services.workouts.get.mockRejectedValue(
    new ApiError('not_found', 'x', 404, 'workout_not_found'),
  );
  await render();
  await press('Iniciar treino');
  expect(hasText('Seu treino foi atualizado pelo fisioterapeuta')).toBe(true);
  expect(mockSync.prepare).not.toHaveBeenCalled();
});

test('an offline workout request offers a retry', async () => {
  services.workouts.get
    .mockRejectedValueOnce(new ApiError('network', 'offline'))
    .mockResolvedValueOnce(workout);
  await render();
  await press('Iniciar treino');
  expect(hasText('Não foi possível carregar seu treino')).toBe(true);
  await press('Tentar novamente');
  expect(hasText('Prepare o celular')).toBe(true);
});

test('a failed prepare keeps the patient on the framing screen', async () => {
  mockSync.prepare.mockRejectedValue(new Error('storage'));
  await openFraming();
  await press('Começar exercício');
  expect(hasText('Confira o enquadramento')).toBe(true);
  expect(hasButton('Contar repetição')).toBe(false);
});

test('touch counts up to the prescription and pause freezes counting (RN19–RN21)', async () => {
  await openFraming();
  await press('Começar exercício');
  await press('Pausar');
  expect(hasButton('Contar repetição')).toBe(false);
  expect(hasText('A contagem está parada')).toBe(true);
  await press('Continuar exercício');
  for (let i = 0; i < 6; i += 1) {
    await press('Contar repetição');
  }
  expect(hasButton('Contar repetição')).toBe(false);
  await press('Concluir treino');
  expect(mockSync.finishDraft).toHaveBeenCalledTimes(1);
  const [clientSessionId, completion] = mockSync.finishDraft.mock.calls[0];
  expect(clientSessionId).toBe('client-1');
  expect(completion).toMatchObject({
    status: 'completed',
    items: [{ completed_sets: 2, completed_repetitions: 6 }],
  });
  expect(JSON.stringify(completion)).not.toMatch(/score|landmark|image/);
  expect(hasText('Treino concluído')).toBe(true);
  expect(hasText('Test arm raise: 6 de 6 repetições')).toBe(true);
});

test('leaving before the first repetition discards the draft (DEC-009)', async () => {
  await openFraming();
  await press('Começar exercício');
  await press('Encerrar');
  expect(lastNativeAlert()[0]).toBe('Encerrar o treino?');
  expect(lastNativeAlert()[1]).toContain('Nada será enviado.');
  // The draft is discarded: the session cannot be resumed later.
  expect(hasText('Você pode voltar depois.')).toBe(false);
  await press('Confirmar');
  expect(mockSync.discardDraft).toHaveBeenCalledWith('client-1');
  expect(mockSync.finishDraft).not.toHaveBeenCalled();
  expect(hasText('Exercícios prescritos')).toBe(true);
});

test('leaving after a repetition saves an interrupted session', async () => {
  await openFraming();
  await press('Começar exercício');
  await press('Contar repetição');
  await press('Encerrar');
  // The session is closed as interrupted and cannot be resumed.
  expect(hasText('Você pode voltar depois.')).toBe(false);
  await press('Confirmar');
  expect(mockSync.discardDraft).not.toHaveBeenCalled();
  expect(mockSync.finishDraft).toHaveBeenCalledWith(
    'client-1',
    expect.objectContaining({
      status: 'interrupted',
      items: [expect.objectContaining({ completed_repetitions: 1 })],
    }),
  );
  expect(hasText('Treino interrompido')).toBe(true);
});

test('asks for the camera with one clear action and lets the patient decline', async () => {
  await render();
  await press('Iniciar treino');
  await press('Continuar');
  expect(hasText('Vamos ativar sua câmera?')).toBe(true);
  await press('Agora não');
  expect(hasText('Prepare o celular')).toBe(true);
});

test('granting the camera opens the framing screen', async () => {
  await render();
  await press('Iniciar treino');
  await press('Continuar');
  await press('Ativar câmera');
  expect(hasText('Confira o enquadramento')).toBe(true);
});

test('a denied request stays in the flow with guidance instead of retrying', async () => {
  mockCamera.result = 'denied';
  await render();
  await press('Iniciar treino');
  await press('Continuar');
  await press('Ativar câmera');
  expect(hasText('A câmera está desativada')).toBe(true);
  expect(hasButton('Ativar câmera')).toBe(false);
  await press('Como permitir a câmera');
  expect(hasText('Abrir Ajustes do celular')).toBe(true);
  await press('Voltar aos exercícios');
  expect(hasText('Exercícios prescritos')).toBe(true);
});

test('a restricted camera explains the block without a permission request', async () => {
  mockCamera.initial = 'restricted';
  await render();
  await press('Iniciar treino');
  await press('Continuar');
  expect(hasText('A câmera está bloqueada neste celular')).toBe(true);
  expect(hasButton('Ativar câmera')).toBe(false);
});

// Two items, rest between sets and texts written by the physiotherapist and
// the source. Test values only.
const guidedWorkout: Workout = {
  ...workout,
  instructions: 'Faça devagar.',
  items: [
    {
      ...workout.items[0],
      rest_duration_ms: 30000,
      professional_guidance: 'Mantenha as costas apoiadas.',
      exercise_snapshot: {
        name: 'Test arm raise',
        instructions: '1. Raise the arm. 2. Lower the arm.',
        source: {
          source: 'OpenExerciseBase (Test)',
          license: 'CC BY-NC 4.0',
        },
      },
    },
    {
      ...workout.items[0],
      id: 'item-2',
      position: 2,
      side: 'right',
      sets: 1,
      repetitions: 2,
      exercise_snapshot: { name: 'Second test exercise' },
    },
  ],
};

/** Pending entry of the finished session in the local queue. */
function queued(state: PendingSession['state']): PendingSession {
  return {
    owner_user_id: 'patient-user',
    state,
    attempts: 0,
    next_attempt_at: null,
    last_error: null,
    created_at: '2026-11-06T12:10:00.000Z',
    updated_at: '2026-11-06T12:10:00.000Z',
    payload: {
      client_session_id: 'client-1',
      workout_id: 'workout-1',
      workout_revision_id: 'revision-1',
      status: 'completed',
      started_at: '2026-11-06T12:00:00.000Z',
      finished_at: '2026-11-06T12:10:00.000Z',
      active_duration_ms: 1000,
      low_confidence_summary: null,
      feedback_summary: null,
      items: [],
    },
  };
}

async function startGuided() {
  services.workouts.get.mockResolvedValue(guidedWorkout);
  await openFraming();
  await press('Começar exercício');
}

async function finishAll() {
  await openFraming();
  await press('Começar exercício');
  for (let i = 0; i < 6; i += 1) {
    await press('Contar repetição');
  }
  await press('Concluir treino');
}

test('execution shows the item, the guidance and the source as published', async () => {
  await startGuided();
  expect(hasText('Exercício 1 de 2')).toBe(true);
  expect(hasText('Test arm raise')).toBe(true);
  expect(hasText('Seu braço esquerdo')).toBe(true);
  expect(hasText('Série 1 de 2')).toBe(true);
  expect(hasText('Mantenha as costas apoiadas.')).toBe(true);
  expect(hasText('Fonte: OpenExerciseBase (CC BY-NC 4.0)')).toBe(true);
  expect(
    app.root.findAll(
      node =>
        node.props.accessible === true &&
        node.props.accessibilityLabel === 'Repetição 0 de 3',
    ).length,
  ).toBeGreaterThan(0);
  // Pause, "Como fazer" and exit are always reachable (RN21).
  expect(hasButton('Pausar')).toBe(true);
  expect(hasButton('Como fazer')).toBe(true);
  expect(hasButton('Encerrar')).toBe(true);
});

test('the next item follows the published order', async () => {
  let clock = Date.now();
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
  await startGuided();
  for (let i = 0; i < 6; i += 1) {
    if (!hasButton('Contar repetição')) {
      // Rest has no skip (Q-P4): the clock passes it and the screen ticks.
      clock += 31000;
      await act(() => new Promise(resolve => setTimeout(resolve, 1100)));
    }
    await press('Contar repetição');
  }
  clock += 31000;
  await act(() => new Promise(resolve => setTimeout(resolve, 1100)));
  expect(hasText('Exercício 2 de 2')).toBe(true);
  expect(hasText('Second test exercise')).toBe(true);
  expect(hasText('Série 1 de 1')).toBe(true);
  expect(mockCameraSides).toContain('right');
});

test('rest keeps pause visible and pausing freezes the countdown (RN20, RN21)', async () => {
  const start = Date.now();
  const clock = jest.spyOn(Date, 'now').mockReturnValue(start);
  await startGuided();
  for (let i = 0; i < 3; i += 1) {
    await press('Contar repetição');
  }
  expect(hasText('Descanso: 30 s')).toBe(true);
  expect(hasButton('Contar repetição')).toBe(false);
  expect(hasButton('Pular descanso')).toBe(false);
  expect(hasButton('Pausar')).toBe(true);

  clock.mockReturnValue(start + 10000);
  await press('Pausar');
  expect(hasText('A contagem está parada')).toBe(true);
  expect(hasButton('Contar repetição')).toBe(false);

  clock.mockReturnValue(start + 120000);
  await press('Continuar exercício');
  expect(hasText('Descanso: 20 s')).toBe(true);
});

test('the app going to the background pauses the session (RN20)', async () => {
  const listeners: ((state: string) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _type: string,
    listener: (state: string) => void,
  ) => {
    listeners.push(listener);
    return { remove: jest.fn() };
  }) as unknown as typeof AppState.addEventListener);
  await openFraming();
  await press('Começar exercício');
  await press('Contar repetição');
  await act(async () => listeners.forEach(listener => listener('background')));
  expect(hasText('A contagem está parada')).toBe(true);
  expect(hasButton('Contar repetição')).toBe(false);
  expect(hasButton('Continuar exercício')).toBe(true);
});

test('counting stops at the prescription and nothing invites extras (RN19)', async () => {
  await openFraming();
  await press('Começar exercício');
  for (let i = 0; i < 6; i += 1) {
    await press('Contar repetição');
  }
  expect(hasButton('Contar repetição')).toBe(false);
  expect(hasText('Você fez tudo o que foi prescrito.')).toBe(true);
  expect(hasText(/extra/i.source)).toBe(false);
});

test('"Como fazer" pauses and shows only the snapshot and professional texts', async () => {
  await startGuided();
  await press('Contar repetição');
  await press('Como fazer');
  expect(hasText('Como fazer')).toBe(true);
  expect(hasText('O treino está pausado.')).toBe(true);
  expect(hasText('Texto original em inglês')).toBe(false);
  expect(hasText('1. Raise the arm. 2. Lower the arm.')).toBe(false);
  expect(
    hasText(
      'As instruções em português ainda não foram revisadas pelo fisioterapeuta. Peça orientação para este exercício.',
    ),
  ).toBe(true);
  expect(hasText('Mantenha as costas apoiadas.')).toBe(true);
  expect(hasText('Faça devagar.')).toBe(true);
  expect(hasText('Fonte: OpenExerciseBase (CC BY-NC 4.0)')).toBe(true);
  // No corrective text invented by the app (RN18).
  expect(hasText('Volte à posição inicial.')).toBe(false);
  expect(hasText('limite orientado')).toBe(false);

  await press('Voltar ao exercício');
  expect(hasButton('Continuar exercício')).toBe(true);
  expect(hasButton('Contar repetição')).toBe(false);
  await press('Continuar exercício');
  expect(hasButton('Contar repetição')).toBe(true);
});

test('"Como fazer" shows the pt-BR text, all API images and the changed attribution', async () => {
  const [first, second] = guidedWorkout.items;
  services.workouts.get.mockResolvedValue({
    ...guidedWorkout,
    items: [
      {
        ...first,
        exercise_snapshot: {
          ...first.exercise_snapshot,
          images: [
            { position: 1, url: '/api/v1/exercises/exercise-1/images/1' },
            { position: 2, url: '/api/v1/exercises/exercise-1/images/2' },
          ],
          localization: {
            language: 'pt-BR',
            name: 'Elevação de braço de teste',
            instructions: '1. Passo um de teste.\n2. Passo dois de teste.',
            translated_by_name: 'Dra. Teste',
            translated_at: '2026-11-06T12:00:00Z',
          },
        },
      },
      second,
    ],
  });
  await openFraming();
  expect(hasText('Elevação de braço de teste')).toBe(true);
  await press('Começar exercício');
  expect(hasText('Elevação de braço de teste')).toBe(true);
  expect(hasText('Texto original em inglês')).toBe(false);
  await press('Como fazer');
  expect(hasText('1. Passo um de teste.')).toBe(true);
  expect(hasText('Raise the arm')).toBe(false);
  expect(hasText('Texto original em inglês')).toBe(false);
  expect(
    app.root.findAll(node => node.props.accessibilityLanguage === 'en'),
  ).toHaveLength(0);
  const images = app.root.findAllByType(Image);
  expect(images.map(node => node.props.accessibilityLabel)).toEqual([
    'Imagem 1 de 2 do exercício Elevação de braço de teste',
    'Imagem 2 de 2 do exercício Elevação de braço de teste',
  ]);
  expect(images[0].props.source).toEqual({
    uri: 'http://api.test/api/v1/exercises/exercise-1/images/1',
    headers: { Authorization: 'Bearer test' },
  });
  expect(
    hasText(
      'Imagem: OpenExerciseBase (CC BY-NC 4.0); parte do material da fonte pode ter sido gerada por IA',
    ),
  ).toBe(true);
  expect(
    hasText(
      'Adaptado de OpenExerciseBase (CC BY-NC 4.0). Nome e passos traduzidos para o português por Dra. Teste em 06/11/2026',
    ),
  ).toBe(true);
});

test('"Como fazer" fetches the library image for an older snapshot', async () => {
  services.exercises.get.mockResolvedValue({
    images: [{ position: 1, url: '/api/v1/exercises/exercise-1/images/1' }],
  });
  await startGuided();
  await press('Como fazer');
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(services.exercises.get).toHaveBeenCalledWith(
    guidedWorkout.items[0].exercise_id,
  );
  expect(
    app.root.findAllByType(Image).map(node => node.props.accessibilityLabel),
  ).toContain('Imagem 1 de 1 do exercício Test arm raise');
});

test('"Como fazer" of an untranslated library item hides the English steps', async () => {
  await startGuided();
  await press('Como fazer');
  const english = app.root.findAll(
    node =>
      node.props.accessibilityLanguage === 'en' &&
      typeof node.type !== 'string',
  );
  expect(english.map(node => [node.props.children].flat().join(''))).toEqual(
    expect.arrayContaining(['Test arm raise']),
  );
  expect(hasText('Texto original em inglês')).toBe(false);
  expect(hasText('1. Raise the arm. 2. Lower the arm.')).toBe(false);
  expect(app.root.findAllByType(Image)).toHaveLength(0);
});

test('"Como fazer" without written steps says so instead of inventing them', async () => {
  await openFraming();
  await press('Começar exercício');
  await press('Como fazer');
  expect(hasText('Este exercício não tem passos escritos.')).toBe(true);
  expect(hasText('Texto original em inglês')).toBe(false);
  expect(hasText('Orientação do profissional')).toBe(false);
});

test('completion shows the pending upload and retries on request', async () => {
  mockSync.pending = [queued('pending')];
  await finishAll();
  expect(hasText('Treino concluído')).toBe(true);
  expect(hasText('As repetições foram contadas pelos seus toques.')).toBe(true);
  expect(hasText('Aguardando envio')).toBe(true);
  await press('Tentar enviar agora');
  expect(mockSync.retryNow).toHaveBeenCalledWith('client-1');
});

test('completion shows a sent result confirmed by the sync report', async () => {
  mockSync.lastReport = {
    sent: 1,
    remaining: 0,
    blocked: 0,
    sent_client_session_ids: ['client-1'],
  };
  await finishAll();
  expect(hasText('Enviado')).toBe(true);
  expect(hasText('Seu fisioterapeuta já pode ver este resultado.')).toBe(true);
  expect(hasButton('Tentar enviar agora')).toBe(false);
});

test('a result seen in the queue and then sent shows "Enviado"', async () => {
  mockSync.pending = [queued('pending')];
  await finishAll();
  expect(hasText('Aguardando envio')).toBe(true);
  await updateSync({ pending: [] });
  expect(hasText('Enviado')).toBe(true);
  expect(hasButton('Tentar enviar agora')).toBe(false);
});

test('an unknown upload status is neutral, never "Enviado"', async () => {
  // Not in the queue and not in the last report: no proof it was sent.
  mockSync.pending = [];
  await finishAll();
  expect(hasText('Situação do envio indisponível')).toBe(true);
  expect(hasText('Seu fisioterapeuta já pode ver este resultado.')).toBe(false);
  await press('Tentar enviar agora');
  expect(mockSync.retryNow).toHaveBeenCalledWith('client-1');
});

test('a queue that could not be read never shows "Enviado"', async () => {
  mockSync.pending = [queued('pending')];
  await finishAll();
  await updateSync({ pending: [], loadError: new Error('storage') });
  expect(hasText('Situação do envio indisponível')).toBe(true);
  expect(hasText('Seu fisioterapeuta já pode ver este resultado.')).toBe(false);
});

test('a retryable error offers a retry and a blocked result does not', async () => {
  mockSync.pending = [{ ...queued('paused') }];
  await finishAll();
  expect(hasText('Não foi possível enviar agora.')).toBe(true);
  expect(hasButton('Tentar enviar agora')).toBe(true);
  await act(async () => app.unmount());

  mockSync.pending = [queued('blocked')];
  await finishAll();
  expect(hasText('Fale com seu fisioterapeuta.')).toBe(true);
  expect(hasButton('Tentar enviar agora')).toBe(false);
});

test('the interrupted screen shows the summary and the upload status', async () => {
  mockSync.pending = [queued('pending')];
  await openFraming();
  await press('Começar exercício');
  await press('Contar repetição');
  await press('Encerrar');
  await press('Confirmar');
  expect(hasText('Treino interrompido')).toBe(true);
  expect(hasText('Test arm raise: 1 de 6 repetições')).toBe(true);
  expect(hasText('Aguardando envio')).toBe(true);
});

// DEC-013: item with the demonstration counting rule. Synthetic, non-clinical
// fixtures: the angles only exercise the wiring between camera, engine and
// session; they are not exercise parameters.
const countedWorkout: Workout = {
  ...workout,
  items: [
    {
      ...workout.items[0],
      sets: 1,
      repetitions: 2,
      counting_rule: 'demo-elbow-flexion:v1',
    },
  ],
};

/** Shoulder–elbow–wrist of the left arm forming `angle` degrees. */
function syntheticObservation(
  angle: number,
  timestamp_ms: number,
  confidence = 0.9,
) {
  const radians = (angle * Math.PI) / 180;
  const at = (x: number, y: number) => ({ x, y, confidence, depth: null });
  return {
    timestamp_ms,
    image_width: 480,
    image_height: 640,
    orientation: 'portrait',
    is_mirrored: false,
    inference_duration_ms: 20,
    landmarks: {
      left_shoulder: at(0.7, 0.5),
      left_elbow: at(0.5, 0.5),
      left_wrist: at(
        0.5 + 0.2 * Math.cos(radians),
        0.5 + 0.2 * Math.sin(radians),
      ),
    },
  };
}

// One synthetic cycle, 100 ms apart, monotonic after the 4-frame smoothing.
const syntheticCycle = [170, 165, 160, 155, 90, 90, 90, 90, 150, 160, 170, 175];
let syntheticClock = 0;

async function feed(angles: number[], confidence = 0.9) {
  for (const angle of angles) {
    syntheticClock += 100;
    const observation = syntheticObservation(angle, syntheticClock, confidence);
    await act(async () => mockCameraProps.latest?.onObservation?.(observation));
  }
}

async function startCounted() {
  services.workouts.get.mockResolvedValue(countedWorkout);
  services.workouts.listMine.mockResolvedValue(pageOf([countedWorkout]));
  await openFraming();
  await press('Começar exercício');
}

test('a counted item counts synthetic cycles up to the prescription (RN19)', async () => {
  await startCounted();
  expect(hasText('Contagem demonstrativa · não validada clinicamente')).toBe(
    true,
  );
  expect(hasButton('Contar repetição')).toBe(false);
  expect(hasButton('Contar manualmente')).toBe(true);
  await feed(syntheticCycle);
  expect(hasText('Repetição')).toBe(true);
  expect(
    app.root.findAll(
      node => node.props.accessibilityLabel === 'Repetição 1 de 2',
    ).length,
  ).toBeGreaterThan(0);
  await feed(syntheticCycle);
  await feed(syntheticCycle);
  expect(hasText('Você fez tudo o que foi prescrito.')).toBe(true);
  await press('Concluir treino');
  const [, completion] = mockSync.finishDraft.mock.calls[0];
  expect(completion.items).toEqual([
    expect.objectContaining({
      completed_repetitions: 2,
      counting_mode: 'automatic',
    }),
  ]);
  // Nothing from the camera leaves the device (privacy, no score).
  expect(JSON.stringify(completion)).not.toMatch(
    /score|landmark|image|frame|angle/,
  );
  expect(Object.keys(completion.items[0]).sort()).toEqual([
    'active_duration_ms',
    'completed_repetitions',
    'completed_sets',
    'counting_mode',
    'interrupted',
    'position',
    'workout_item_id',
  ]);
  expect(hasText('Contadas pela câmera (demonstração)')).toBe(true);
});

test('pause freezes the engine: cycles while paused are not counted (RN20)', async () => {
  await startCounted();
  await press('Pausar');
  // Manual switch stays visible, but cannot change the origin while paused.
  expect(hasButton('Contar manualmente')).toBe(true);
  expect(mockCameraProps.latest?.onObservation).toBeDefined();
  await feed(syntheticCycle);
  expect(
    app.root.findAll(
      node => node.props.accessibilityLabel === 'Repetição 0 de 2',
    ).length,
  ).toBeGreaterThan(0);
});

test('"Contar manualmente" turns the engine off and the result is mixed', async () => {
  await startCounted();
  await feed(syntheticCycle);
  await press('Contar manualmente');
  // The first touch only switches: nothing counted twice.
  expect(
    app.root.findAll(
      node => node.props.accessibilityLabel === 'Repetição 1 de 2',
    ).length,
  ).toBeGreaterThan(0);
  expect(hasText('Contagem demonstrativa')).toBe(false);
  expect(mockCameraProps.latest?.onObservation).toBeUndefined();
  await press('Contar repetição');
  await press('Concluir treino');
  const [, completion] = mockSync.finishDraft.mock.calls[0];
  expect(completion.items[0]).toMatchObject({
    completed_repetitions: 2,
    counting_mode: 'mixed',
  });
  expect(hasText('Parte pela câmera, parte por toque')).toBe(true);
});

test('low confidence from the engine becomes a framing message (RN05)', async () => {
  await startCounted();
  await feed([170], 0.2);
  expect(mockCameraProps.latest?.framing).toBe('low_confidence');
  await feed([170]);
  expect(mockCameraProps.latest?.framing).toBeNull();
  await press('Pausar');
  expect(mockCameraProps.latest?.framing).toBeNull();
});

test('an item without the rule stays manual and has no extra button', async () => {
  await openFraming();
  await press('Começar exercício');
  expect(hasButton('Contar manualmente')).toBe(false);
  expect(hasText('Contagem demonstrativa')).toBe(false);
  expect(mockCameraProps.latest?.onObservation).toBeUndefined();
  for (let i = 0; i < 6; i += 1) {
    await press('Contar repetição');
  }
  await press('Concluir treino');
  const [, completion] = mockSync.finishDraft.mock.calls[0];
  expect(completion.items[0].counting_mode).toBe('manual');
  expect(hasText('As repetições foram contadas pelos seus toques.')).toBe(true);
});

test('cancelling the native session exit leaves the draft intact', async () => {
  await openFraming();
  await press('Começar exercício');
  await press('Encerrar');
  expect(lastNativeAlert()[0]).toBe('Encerrar o treino?');
  expect(mockSync.discardDraft).not.toHaveBeenCalled();
  expect(mockSync.finishDraft).not.toHaveBeenCalled();
  await press('Cancelar');
  expect(hasButton('Encerrar')).toBe(true);
  expect(mockSync.discardDraft).not.toHaveBeenCalled();
  expect(mockSync.finishDraft).not.toHaveBeenCalled();
});
