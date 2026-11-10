import React from 'react';
import { Image, Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ApiError } from '../src/api/errors';
import { appDependencies } from '../src/app/dependencies';
import { ScreenMessageProvider } from '../src/components/ScreenMessage';
import type {
  ProgressSummary,
  SessionSummary,
  Workout,
} from '../src/contracts/domain';
import { currentWeek } from '../src/integration/usePatientData';
import { FrontendNavigator } from '../src/navigation/FrontendNavigator';
import { PhysiotherapistInfoScreen } from '../src/screens/patient/PhysiotherapistInfoScreen';
import type { PendingSession } from '../src/sync/types';
import { pageOf } from '../test-utils/helpers';

jest.mock('../src/app/dependencies', () => ({
  appDependencies: {
    profile: { mine: jest.fn(), linkedPhysiotherapist: jest.fn() },
    workouts: { listMine: jest.fn() },
    sessions: { listMine: jest.fn() },
    progress: { mine: jest.fn() },
    notes: { mine: jest.fn() },
    api: {
      imageSource: (url: string) => ({
        uri: `http://api.test${url}`,
        headers: { Authorization: 'Bearer test' },
      }),
      refreshAuthentication: jest.fn(),
    },
  },
}));
const mockFindDraft = jest.fn();
const mockQueue: { pending: PendingSession[] } = { pending: [] };
jest.mock('../src/sync/SessionSyncContext', () => ({
  useSessionSync: () => ({
    findDraft: mockFindDraft,
    pending: mockQueue.pending,
    lastReport: null,
  }),
}));
jest.mock('react-native-vision-camera', () => ({
  useCameraPermission: () => ({
    status: 'not-determined',
    hasPermission: false,
    requestPermission: async () => false,
  }),
}));
jest.mock('../src/features/vision/LocalPoseCamera', () => ({
  LocalPoseCamera: () => null,
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

const services = appDependencies as unknown as {
  profile: { mine: jest.Mock; linkedPhysiotherapist: jest.Mock };
  workouts: { listMine: jest.Mock };
  sessions: { listMine: jest.Mock };
  progress: { mine: jest.Mock };
  notes: { mine: jest.Mock };
};

// Test data only: values differ from the demo on purpose to prove the source.
const workout: Workout = {
  id: 'workout-1',
  patient_id: 'patient-1',
  created_by: 'professional-1',
  status: 'published',
  current_revision_id: 'revision-1',
  revision_number: 1,
  instructions: 'Orientação escrita pela profissional.',
  published_at: '2026-11-02T12:00:00Z',
  created_at: '2026-11-02T12:00:00Z',
  updated_at: '2026-11-02T12:00:00Z',
  items: [
    {
      id: 'item-1',
      position: 1,
      exercise_id: 'exercise-1',
      side: 'left',
      sets: 3,
      repetitions: 12,
      rest_duration_ms: 30000,
      rule_version: 'test-1',
      professional_guidance: null,
      parameters: {},
      exercise_snapshot: { name: 'Exercício aprovado de teste' },
    },
  ],
};
const completedSession: SessionSummary = {
  id: 'session-1',
  patient_id: 'patient-1',
  workout_id: 'workout-1',
  workout_revision_id: 'revision-1',
  status: 'completed',
  started_at: '2026-11-05T12:00:00.000Z',
  finished_at: '2026-11-05T12:10:00.000Z',
  active_duration_ms: 600000,
  prescribed_repetitions: 36,
  performed_repetitions: 36,
  score: 36,
};
const interruptedSession: SessionSummary = {
  ...completedSession,
  id: 'session-2',
  status: 'interrupted',
  started_at: '2026-11-04T12:00:00.000Z',
  performed_repetitions: 14,
};
const progress: ProgressSummary = {
  patient_id: 'patient-1',
  period_start: '2026-11-02T03:00:00.000Z',
  period_end: '2026-11-09T02:59:59.999Z',
  completed_sessions: 1,
  interrupted_sessions: 1,
  active_duration_ms: 900000,
  prescribed_repetitions: 72,
  performed_repetitions: 50,
  score: 50,
  generated_at: '2026-11-06T12:00:00Z',
};
let app: ReactTestRenderer.ReactTestRenderer;
const signOut = jest.fn();

beforeEach(() => {
  services.profile.mine.mockResolvedValue({ full_name: 'Joana Souza' });
  services.profile.linkedPhysiotherapist.mockResolvedValue({ full_name: null });
  services.workouts.listMine.mockResolvedValue(pageOf([workout]));
  services.sessions.listMine.mockResolvedValue(
    pageOf([completedSession, interruptedSession]),
  );
  services.progress.mine.mockResolvedValue(progress);
  services.notes.mine.mockResolvedValue(pageOf([]));
  mockFindDraft.mockResolvedValue(null);
});

afterEach(async () => {
  mockQueue.pending = [];
  jest.clearAllMocks();
  await act(async () => app.unmount());
});

async function render() {
  await act(async () => {
    app = ReactTestRenderer.create(
      <ScreenMessageProvider>
        <FrontendNavigator
          flow="patient"
          accountEmail="paciente@example.com"
          onSignOut={signOut}
        />
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

function countText(value: string) {
  return texts().filter(text => text.includes(value)).length;
}

function hasLabel(label: string) {
  return app.root.findAll(node => node.props.accessibilityLabel === label)
    .length;
}

async function press(label: string, role?: string) {
  const [target] = app.root.findAll(
    node =>
      typeof node.props.onPress === 'function' &&
      node.props.accessibilityLabel === label &&
      (!role || node.props.accessibilityRole === role),
  );
  await act(async () => target.props.onPress());
}

async function pressTab(label: string) {
  await press(`Aba ${label}`);
}

function expectNoDemoData() {
  for (const demo of [
    'Maria',
    'Elevação de braço sentado',
    'Dra. Ana Ribeiro',
    'Dados de exemplo',
    'Exemplo',
    'Área profissional',
  ]) {
    expect(hasText(demo)).toBe(false);
  }
}

test('home greets by the API name and shows the published prescription', async () => {
  await render();
  expect(hasText('Olá, Joana!')).toBe(true);
  expect(hasText('Exercício aprovado de teste')).toBe(true);
  expect(hasText('3 séries · 12 repetições · Seu braço esquerdo')).toBe(true);
  expect(hasText('Orientação escrita pela profissional.')).toBe(true);
  expect(hasText('Em breve')).toBe(false);
  expect(hasLabel('Iniciar treino')).toBeTruthy();
  expect(mockFindDraft).toHaveBeenCalledWith('workout-1', 'revision-1');
  expect(hasText('36 de 36 repetições')).toBe(true);
  expect(services.sessions.listMine).toHaveBeenCalledWith({ page_size: 1 });
  expectNoDemoData();
});

test('a local draft of the same revision offers to continue the workout', async () => {
  mockFindDraft.mockResolvedValue({ client_session_id: 'client-1' });
  await render();
  expect(hasLabel('Continuar treino')).toBeTruthy();
  expect(hasLabel('Iniciar treino')).toBe(0);
});

test('a failed draft lookup still lets the patient start', async () => {
  mockFindDraft.mockRejectedValue(new Error('storage'));
  await render();
  expect(hasLabel('Iniciar treino')).toBeTruthy();
});

test('without an approved exercise the patient sees empty states, never demo data', async () => {
  services.workouts.listMine.mockResolvedValue(pageOf([]));
  services.sessions.listMine.mockResolvedValue(pageOf([]));
  await render();
  expect(hasText('Nenhum treino publicado')).toBe(true);
  expect(hasText('Nenhuma sessão realizada ainda.')).toBe(true);
  expect(hasText('SEU TREINO')).toBe(false);
  expect(hasLabel('Iniciar treino')).toBe(0);
  expectNoDemoData();
  await pressTab('Exercícios');
  expect(hasText('Nenhum treino publicado')).toBe(true);
  expectNoDemoData();
});

test('pending requests show loading states', async () => {
  const never = () => new Promise(() => undefined);
  services.profile.mine.mockImplementation(never);
  services.workouts.listMine.mockImplementation(never);
  services.sessions.listMine.mockImplementation(never);
  await render();
  expect(hasText('Olá!')).toBe(true);
  expect(hasLabel('Carregando seu treino')).toBeTruthy();
  expect(hasLabel('Carregando a última atividade')).toBeTruthy();
});

test('an offline workout request shows an error and recovers on retry', async () => {
  services.profile.mine.mockRejectedValue(new ApiError('network', 'offline'));
  services.workouts.listMine
    .mockRejectedValueOnce(new ApiError('network', 'offline'))
    .mockResolvedValueOnce(pageOf([workout]));
  await render();
  expect(hasText('Olá!')).toBe(true);
  expect(hasText('Não foi possível carregar seu treino')).toBe(true);
  expect(hasText('Sem conexão com o servidor')).toBe(true);
  await press('Tentar novamente');
  expect(services.workouts.listMine).toHaveBeenCalledTimes(2);
  expect(hasText('Exercício aprovado de teste')).toBe(true);
  expect(hasText('Não foi possível carregar seu treino')).toBe(false);
});

test('a failed last activity keeps the rest of home usable', async () => {
  services.sessions.listMine
    .mockRejectedValueOnce(new ApiError('server', 'boom', 500))
    .mockResolvedValueOnce(pageOf([completedSession]));
  await render();
  expect(hasText('Ocorreu um erro inesperado')).toBe(true);
  expect(hasText('Exercício aprovado de teste')).toBe(true);
  await press('Tentar novamente');
  expect(hasText('36 de 36 repetições')).toBe(true);
});

test('exercises tab lists prescribed items, filters history and shows the current week', async () => {
  await render();
  await pressTab('Exercícios');
  expect(hasText('Exercícios prescritos')).toBe(true);
  expect(hasText('3 séries · 12 repetições · Seu braço esquerdo')).toBe(true);
  expect(hasText('Em breve')).toBe(false);
  expect(hasLabel('Iniciar treino')).toBeTruthy();

  await press('Histórico', 'tab');
  expect(services.sessions.listMine).toHaveBeenCalledWith({ page_size: 50 });
  // Home stays mounted behind the tab and also lists the last session.
  const completedRows = countText('Treino concluído');
  expect(hasText('Treino interrompido')).toBe(true);
  await press('Interrompidas', 'tab');
  expect(countText('Treino concluído')).toBe(completedRows - 1);
  expect(hasText('14 de 36 repetições')).toBe(true);

  await press('Progresso', 'tab');
  expect(services.progress.mine).toHaveBeenCalledWith(currentWeek(new Date()));
  expect(hasText('Semana de')).toBe(true);
  expect(hasLabel('Sessões concluídas: 1')).toBeTruthy();
  expect(hasLabel('Sessões interrompidas: 1')).toBeTruthy();
  expect(hasText('50 de 72 repetições prescritas')).toBe(true);
  expect(hasText('Conquistas')).toBe(false);
  expectNoDemoData();
});

test('history and progress show empty states without sessions', async () => {
  services.sessions.listMine.mockResolvedValue(pageOf([]));
  services.progress.mine.mockResolvedValue({
    ...progress,
    completed_sessions: 0,
    interrupted_sessions: 0,
    prescribed_repetitions: 0,
    performed_repetitions: 0,
    score: 0,
  });
  await render();
  await pressTab('Exercícios');
  await press('Histórico', 'tab');
  expect(hasText('Nenhuma sessão ainda')).toBe(true);
  await press('Progresso', 'tab');
  expect(hasText('Nenhuma sessão nesta semana')).toBe(true);
});

test('progress failures show an error state', async () => {
  services.progress.mine.mockRejectedValue(new ApiError('timeout', 'slow'));
  await render();
  await pressTab('Exercícios');
  await press('Progresso', 'tab');
  expect(hasText('Não foi possível carregar o progresso')).toBe(true);
});

test('home link opens the progress section of the exercises tab', async () => {
  await render();
  await press('Ver histórico e progresso');
  expect(hasText('Semana de')).toBe(true);
});

test('profile shows the API name, the account and an empty physiotherapist state', async () => {
  await render();
  await pressTab('Perfil');
  expect(hasText('Joana Souza')).toBe(true);
  expect(hasText('paciente@example.com')).toBe(true);
  expect(hasText('Meu fisioterapeuta')).toBe(true);
  expect(hasText('Dados do fisioterapeuta')).toBe(true);
  expect(hasText('Conversar')).toBe(false);
  expect(hasText('Informações')).toBe(false);
  expectNoDemoData();
  await press('Sair da conta');
  expect(signOut).toHaveBeenCalledTimes(1);
});

test('a profile failure offers a retry', async () => {
  // Home and Profile each request the profile once.
  services.profile.mine
    .mockRejectedValueOnce(new ApiError('access_denied', 'no', 403))
    .mockRejectedValueOnce(new ApiError('access_denied', 'no', 403))
    .mockResolvedValueOnce({ full_name: 'Joana Souza' });
  await render();
  await pressTab('Perfil');
  expect(hasText('Não foi possível carregar seu perfil')).toBe(true);
  expect(hasText('Você não tem permissão')).toBe(true);
  await press('Tentar novamente');
  expect(hasText('Joana Souza')).toBe(true);
});

test('physiotherapist details show the empty state', async () => {
  const InfoStack = createNativeStackNavigator();
  await act(async () => {
    app = ReactTestRenderer.create(
      <ScreenMessageProvider>
        <NavigationContainer>
          <InfoStack.Navigator screenOptions={{ headerShown: false }}>
            <InfoStack.Screen
              name="PhysiotherapistInfo"
              component={PhysiotherapistInfoScreen}
            />
          </InfoStack.Navigator>
        </NavigationContainer>
      </ScreenMessageProvider>,
    );
  });
  expect(hasText('Dados do fisioterapeuta')).toBe(true);
  expect(
    hasText(
      'As informações do seu fisioterapeuta ainda não aparecem no aplicativo.',
    ),
  ).toBe(true);
  expect(hasText('Registro profissional')).toBe(false);
  expectNoDemoData();
});

test('profile shows the linked physiotherapist name when the API has it', async () => {
  services.profile.linkedPhysiotherapist.mockResolvedValue({
    full_name: 'Dra. Teste Vinculada',
  });
  await render();
  await pressTab('Perfil');
  expect(hasText('Dra. Teste Vinculada')).toBe(true);
  expect(hasText('Seu fisioterapeuta')).toBe(true);
  expect(hasText('Dados do fisioterapeuta')).toBe(false);
  expect(hasText('CREFITO')).toBe(false);
});

test('without a link (404) the physiotherapist card keeps the empty state', async () => {
  services.profile.linkedPhysiotherapist.mockRejectedValue(
    new ApiError('not_found', 'x', 404, 'physiotherapist_not_found'),
  );
  await render();
  await pressTab('Perfil');
  expect(hasText('Dados do fisioterapeuta')).toBe(true);
  expect(hasText('Não foi possível carregar os dados do fisioterapeuta')).toBe(
    false,
  );
});

test('a physiotherapist request failure offers a retry', async () => {
  services.profile.linkedPhysiotherapist
    .mockRejectedValueOnce(new ApiError('network', 'offline'))
    .mockResolvedValueOnce({ full_name: 'Dra. Teste Vinculada' });
  await render();
  await pressTab('Perfil');
  expect(hasText('Não foi possível carregar os dados do fisioterapeuta')).toBe(
    true,
  );
  await press('Tentar novamente');
  expect(hasText('Dra. Teste Vinculada')).toBe(true);
});

test('physiotherapist details show the linked name', async () => {
  services.profile.linkedPhysiotherapist.mockResolvedValue({
    full_name: 'Dra. Teste Vinculada',
  });
  const InfoStack = createNativeStackNavigator();
  await act(async () => {
    app = ReactTestRenderer.create(
      <ScreenMessageProvider>
        <NavigationContainer>
          <InfoStack.Navigator screenOptions={{ headerShown: false }}>
            <InfoStack.Screen
              name="PhysiotherapistInfo"
              component={PhysiotherapistInfoScreen}
            />
          </InfoStack.Navigator>
        </NavigationContainer>
      </ScreenMessageProvider>,
    );
  });
  expect(hasText('Dra. Teste Vinculada')).toBe(true);
  expect(hasText('Dados do fisioterapeuta')).toBe(false);
});

test('an exercise from the reference library shows its source and the guidance', async () => {
  services.workouts.listMine.mockResolvedValue(
    pageOf([
      {
        ...workout,
        items: [
          {
            ...workout.items[0],
            professional_guidance: 'Orientação do item de teste.',
            exercise_snapshot: {
              name: 'Reference Item Test',
              source: {
                source:
                  'OpenExerciseBase (Ludwig Boltzmann Institute for Digital Health and Prevention)',
                external_id: 'EX-test-1',
                source_url: 'https://example.com/EX.json',
                license: 'CC BY-NC 4.0',
                license_url: 'https://creativecommons.org/licenses/by-nc/4.0/',
                attribution: 'Test attribution.',
              },
            },
          },
        ],
      },
    ]),
  );
  await render();
  expect(hasText('Reference Item Test')).toBe(true);
  expect(hasText('Fonte: OpenExerciseBase (CC BY-NC 4.0)')).toBe(true);
  expect(hasText('Orientação do item de teste.')).toBe(true);
  await pressTab('Exercícios');
  expect(countText('Fonte: OpenExerciseBase (CC BY-NC 4.0)')).toBe(2);
});

test('home and exercises show the pt-BR name and the first API image', async () => {
  services.workouts.listMine.mockResolvedValue(
    pageOf([
      {
        ...workout,
        items: [
          {
            ...workout.items[0],
            exercise_snapshot: {
              name: 'Reference Item Test',
              source: {
                source: 'OpenExerciseBase (Test)',
                license: 'CC BY-NC 4.0',
              },
              images: [
                { position: 1, url: '/api/v1/exercises/e-1/images/1' },
                { position: 2, url: '/api/v1/exercises/e-1/images/2' },
              ],
              localization: {
                language: 'pt-BR',
                name: 'Item de referência traduzido',
                instructions: '1. Passo de teste.',
                translated_by_name: 'Dra. Teste',
                translated_at: '2026-11-06T12:00:00Z',
              },
            },
          },
        ],
      },
    ]),
  );
  await render();
  const firstImageOnly = () =>
    app.root
      .findAllByType(Image)
      .map(node => node.props.accessibilityLabel)
      .filter(label => String(label).startsWith('Imagem'));
  expect(hasText('Item de referência traduzido')).toBe(true);
  expect(hasText('Reference Item Test')).toBe(false);
  expect(hasText('Texto original em inglês')).toBe(false);
  expect(firstImageOnly()).toEqual([
    'Imagem 1 de 2 do exercício Item de referência traduzido',
  ]);
  await pressTab('Exercícios');
  expect(countText('Item de referência traduzido')).toBe(2);
  expect(firstImageOnly()).toHaveLength(2);
  expect(
    countText('Imagem: OpenExerciseBase (CC BY-NC 4.0); parte do material'),
  ).toBe(2);
});

test('an untranslated library name has no English seal and keeps voice metadata', async () => {
  services.workouts.listMine.mockResolvedValue(
    pageOf([
      {
        ...workout,
        items: [
          {
            ...workout.items[0],
            exercise_snapshot: {
              name: 'Reference Item Test',
              source: {
                source: 'OpenExerciseBase (Test)',
                license: 'CC BY-NC 4.0',
              },
            },
          },
        ],
      },
    ]),
  );
  await render();
  expect(hasText('Texto original em inglês')).toBe(false);
  const english = () =>
    app.root.findAll(
      node =>
        node.props.accessibilityLanguage === 'en' &&
        typeof node.type !== 'string',
    );
  expect(english().length).toBeGreaterThan(0);
  await pressTab('Exercícios');
  expect(hasText('Texto original em inglês')).toBe(false);
});

test('a catalog exercise without provenance shows no source line', async () => {
  await render();
  expect(hasText('Fonte:')).toBe(false);
});

test('a session waiting in the local queue appears in the history', async () => {
  services.sessions.listMine.mockResolvedValue(pageOf([]));
  mockQueue.pending = [
    {
      owner_user_id: 'patient-user',
      state: 'pending',
      attempts: 1,
      next_attempt_at: null,
      last_error: null,
      created_at: '2026-11-06T12:10:00.000Z',
      updated_at: '2026-11-06T12:10:00.000Z',
      payload: {
        client_session_id: 'client-1',
        workout_id: 'workout-1',
        workout_revision_id: 'revision-1',
        status: 'interrupted',
        started_at: '2026-11-06T12:00:00.000Z',
        finished_at: '2026-11-06T12:10:00.000Z',
        active_duration_ms: 1000,
        low_confidence_summary: null,
        feedback_summary: null,
        items: [
          {
            workout_item_id: 'item-1',
            position: 1,
            completed_sets: 0,
            completed_repetitions: 5,
            active_duration_ms: 1000,
            interrupted: true,
          },
        ],
      },
    },
  ];
  await render();
  await pressTab('Exercícios');
  await press('Histórico', 'tab');
  expect(hasText('Nenhuma sessão ainda')).toBe(false);
  expect(hasText('Aguardando envio')).toBe(true);
  expect(hasText('5 repetições')).toBe(true);
  await press('Concluídas', 'tab');
  expect(hasText('Aguardando envio')).toBe(false);
});

test('home and history reload when the patient comes back to them', async () => {
  await render();
  const homeCalls = services.workouts.listMine.mock.calls.length;
  await pressTab('Exercícios');
  await press('Histórico', 'tab');
  const historyCalls = services.sessions.listMine.mock.calls.length;
  await pressTab('Início');
  expect(services.workouts.listMine.mock.calls.length).toBeGreaterThan(
    homeCalls + 1,
  );
  // Content stays on screen while it refreshes (no loading flash).
  expect(hasText('Olá, Joana!')).toBe(true);
  expect(hasText('Carregando seu treino')).toBe(false);
  await pressTab('Exercícios');
  expect(services.sessions.listMine.mock.calls.length).toBeGreaterThan(
    historyCalls,
  );
});

// Read-only notes marked "Paciente pode ver" (DEC-015); texts are test-only.
const notesPage = pageOf([
  {
    id: 'note-2',
    content: 'Recado de teste mais recente.',
    created_at: '2026-11-07T13:30:00Z',
    updated_at: '2026-11-08T13:30:00Z',
  },
  {
    id: 'note-1',
    content: 'Recado de teste antigo.',
    // Never edited: the backend stamps the two columns microseconds apart.
    created_at: '2026-11-05T13:30:00.000100Z',
    updated_at: '2026-11-05T13:30:00.000400Z',
  },
]);

test('home opens the physiotherapist notes with their dates', async () => {
  services.notes.mine.mockResolvedValue(notesPage);
  await render();
  await press('Recados do fisioterapeuta');
  expect(services.notes.mine).toHaveBeenCalledWith({ page_size: 50 });
  expect(hasText('Recado de teste mais recente.')).toBe(true);
  expect(hasText('Recado de teste antigo.')).toBe(true);
  expect(hasText('07/11/2026')).toBe(true);
  expect(hasText('Atualizado em 08/11/2026')).toBe(true);
  expect(countText('Atualizado em')).toBe(1);
  // Read only: no reply or contact.
  expect(hasText('Responder')).toBe(false);
  expect(hasText('WhatsApp')).toBe(false);
});

test('profile opens the notes and shows the empty state', async () => {
  await render();
  await pressTab('Perfil');
  await press('Recados do fisioterapeuta');
  expect(hasText('Nenhum recado')).toBe(true);
  expect(hasText('Seu fisioterapeuta ainda não deixou recados.')).toBe(true);
});

test('a notes failure shows the error in Portuguese and recovers on retry', async () => {
  services.notes.mine
    .mockRejectedValueOnce(new ApiError('network', 'offline'))
    .mockResolvedValueOnce(notesPage);
  await render();
  await press('Recados do fisioterapeuta');
  expect(hasText('Não foi possível carregar os recados')).toBe(true);
  expect(hasText('Sem conexão com o servidor')).toBe(true);
  expect(hasText('offline')).toBe(false);
  await press('Tentar novamente');
  expect(hasText('Recado de teste antigo.')).toBe(true);
});
