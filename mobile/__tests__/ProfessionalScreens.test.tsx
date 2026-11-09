import React from 'react';
import {
  AccessibilityInfo,
  Image,
  Linking,
  ScrollView,
  Text,
} from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ApiError } from '../src/api/errors';
import { appDependencies } from '../src/app/dependencies';
import { FormField } from '../src/components/FormField';
import { ScreenMessageProvider } from '../src/components/ScreenMessage';
import type {
  Exercise,
  LibraryExerciseDetail,
  LibraryExercisePage,
  Note,
  Patient,
  PatientAccessResult,
  ProgressSummary,
  SessionSummary,
  Workout,
} from '../src/contracts/domain';
import { FrontendNavigator } from '../src/navigation/FrontendNavigator';
import { pageOf } from '../test-utils/helpers';

jest.mock('../src/app/dependencies', () => ({
  appDependencies: {
    patients: {
      list: jest.fn(),
      get: jest.fn(),
      create: jest.fn(),
      activateAccess: jest.fn(),
      resetTemporaryPassword: jest.fn(),
    },
    workouts: {
      listForPatient: jest.fn(),
      get: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      publish: jest.fn(),
      archive: jest.fn(),
    },
    exercises: {
      list: jest.fn(),
      get: jest.fn(),
      updateLocalization: jest.fn(),
    },
    api: {
      imageSource: (url: string) => ({
        uri: `http://api.test${url}`,
        headers: { Authorization: 'Bearer test' },
      }),
      refreshAuthentication: jest.fn(),
    },
    exerciseLibrary: {
      search: jest.fn(),
      get: jest.fn(),
      addToCatalog: jest.fn(),
    },
    profile: {
      physiotherapistProfile: jest.fn(),
      updatePhysiotherapistProfile: jest.fn(),
    },
    notes: { list: jest.fn(), create: jest.fn(), update: jest.fn() },
    sessions: { listForPatient: jest.fn() },
    progress: { forPatient: jest.fn() },
  },
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
// The patient stack (imported with the navigator) reads the local session queue.
jest.mock('../src/sync/SessionSyncContext', () => ({
  useSessionSync: () => ({}),
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

type Mocked<T> = { [K in keyof T]: { [M in keyof T[K]]: jest.Mock } };
const services = appDependencies as unknown as Mocked<
  Pick<
    typeof appDependencies,
    | 'patients'
    | 'workouts'
    | 'exercises'
    | 'exerciseLibrary'
    | 'profile'
    | 'notes'
    | 'sessions'
    | 'progress'
  >
>;

// Test data only: no value here is a clinical prescription.
const patient: Patient = {
  id: 'patient-1',
  full_name: 'Joana Teste',
  email: 'joana@example.com',
  phone: null,
  is_active: true,
  has_access: false,
  access_is_active: false,
  must_change_password: false,
  created_at: '2026-11-01T12:00:00Z',
  updated_at: '2026-11-01T12:00:00Z',
};
const exercise: Exercise = {
  id: 'exercise-1',
  code: 'test-only',
  name: 'Exercício aprovado de teste',
  instructions: 'Instrução aprovada de teste.',
  allowed_sides: ['left', 'right'],
  rule_version: 'test-1',
  supported_parameters: {},
  is_active: true,
  approval_status: 'approved',
  approved_rule_version: 'test-1',
};
const draftWorkout: Workout = {
  id: 'workout-1',
  patient_id: 'patient-1',
  created_by: 'professional-1',
  status: 'draft',
  current_revision_id: 'revision-1',
  revision_number: 1,
  instructions: null,
  published_at: null,
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
const note: Note = {
  id: 'note-1',
  patient_id: 'patient-1',
  author_id: 'professional-1',
  content: 'Anotação de teste.',
  visibility: 'professional_only',
  created_at: '2026-11-02T12:00:00Z',
  updated_at: '2026-11-02T12:00:00Z',
};
const access: PatientAccessResult = {
  patient_id: 'patient-1',
  user_id: 'user-1',
  email: 'joana@example.com',
  temporary_password: 'Provisoria-Teste-123',
  must_change_password: true,
  action: 'activated',
};
const session: SessionSummary = {
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
const progress: ProgressSummary = {
  patient_id: 'patient-1',
  period_start: '2026-11-02T03:00:00.000Z',
  period_end: '2026-11-09T02:59:59.999Z',
  completed_sessions: 1,
  interrupted_sessions: 0,
  active_duration_ms: 600000,
  prescribed_repetitions: 36,
  performed_repetitions: 36,
  score: 36,
  generated_at: '2026-11-06T12:00:00Z',
};
// Shapes follow docs/contracts/exercise-library.md; names are test-only.
const attribution = {
  source: 'Fonte de teste',
  license: 'CC BY-NC 4.0',
  license_url: 'https://creativecommons.org/licenses/by-nc/4.0/',
  source_url: 'https://example.com/source.json',
  changes: 'Only selected descriptive fields are shown.',
};
const usageNotice = 'External reference material. Not clinically approved.';
const libraryPage: LibraryExercisePage = {
  ...pageOf([
    {
      external_id: 'EX-test-1',
      name: 'Reference Item Test',
      categories: ['mobility'],
      body_parts: ['shoulders', 'full body'],
      equipment: [],
      image_url: null,
      review_status: 'accepted',
    },
  ]),
  usage_notice: usageNotice,
  attribution,
};
const libraryDetail: LibraryExerciseDetail = {
  external_id: 'EX-test-1',
  name: 'Reference Item Test',
  categories: ['mobility'],
  body_parts: ['shoulders'],
  equipment: ['chair'],
  instructions: [
    { step_number: 2, description: 'Second step text.' },
    { step_number: 1, description: 'First step text.' },
  ],
  instructions_language: 'en',
  image_urls: ['https://example.com/images/EX-test-1/image_1.png'],
  review_status: 'accepted_with_edits',
  created_by: 'ai',
  usage_notice: usageNotice,
  attribution: { ...attribution, source_url: 'https://example.com/EX.json' },
  catalog_exercise: null,
};
// Catalog exercise created from the library item (sides chosen in the test).
const importedExercise: Exercise = {
  ...exercise,
  id: 'exercise-imported',
  code: 'oeb-test',
  name: 'Reference Item Test',
  instructions: '1. First step text.\n2. Second step text.',
  allowed_sides: ['right'],
  rule_version: 'library-reference-no-camera-rule:v1',
  approved_rule_version: 'library-reference-no-camera-rule:v1',
  source: {
    source:
      'OpenExerciseBase (Ludwig Boltzmann Institute for Digital Health and Prevention)',
    external_id: 'EX-test-1',
    source_url: 'https://example.com/EX.json',
    license: 'CC BY-NC 4.0',
    license_url: 'https://creativecommons.org/licenses/by-nc/4.0/',
    attribution: 'Name and instructions from a test source.',
  },
};

let app: ReactTestRenderer.ReactTestRenderer;

beforeEach(() => {
  services.patients.list.mockResolvedValue(pageOf([patient]));
  services.patients.get.mockResolvedValue(patient);
  services.workouts.listForPatient.mockResolvedValue(pageOf([]));
  services.workouts.get.mockResolvedValue(draftWorkout);
  services.exercises.list.mockResolvedValue(pageOf([exercise]));
  services.notes.list.mockResolvedValue(pageOf([]));
  services.sessions.listForPatient.mockResolvedValue(pageOf([session]));
  services.progress.forPatient.mockResolvedValue(progress);
  services.profile.physiotherapistProfile.mockResolvedValue({
    full_name: null,
  });
  services.exerciseLibrary.search.mockResolvedValue(libraryPage);
  services.exerciseLibrary.get.mockResolvedValue(libraryDetail);
  services.exerciseLibrary.addToCatalog.mockResolvedValue(importedExercise);
  services.exercises.get.mockResolvedValue(importedExercise);
});

afterEach(async () => {
  jest.clearAllMocks();
  await act(async () => app.unmount());
});

const signOut = jest.fn();

async function render() {
  await act(async () => {
    app = ReactTestRenderer.create(
      <ScreenMessageProvider>
        <FrontendNavigator flow="physiotherapist" onSignOut={signOut} />
      </ScreenMessageProvider>,
    );
  });
}

function selectedTab() {
  return app.root
    .findAll(
      node =>
        node.props.accessibilityRole === 'tab' &&
        node.props.accessibilityState?.selected === true &&
        typeof node.type !== 'string',
    )
    .at(-1)?.props.accessibilityLabel;
}

async function openSettings(item?: string) {
  await render();
  await press('Configurações');
  if (item) {
    await press(item);
  }
}

function texts() {
  return app.root
    .findAllByType(Text)
    .map(node => [node.props.children].flat().join(''));
}

function hasText(value: string) {
  return texts().some(text => text.includes(value));
}

function pressables(label: string) {
  return app.root.findAll(
    node =>
      typeof node.props.onPress === 'function' &&
      node.props.accessibilityLabel === label &&
      typeof node.type !== 'string',
  );
}

// Screens below in the stack stay mounted; the focused one is rendered last.
async function press(label: string) {
  const target = pressables(label).at(-1);
  if (!target) {
    throw new Error(`Missing control: ${label}`);
  }
  await act(async () => target.props.onPress());
}

function field(label: string) {
  const found = app.root
    .findAllByType(FormField)
    .find(node => node.props.label === label);
  if (!found) {
    throw new Error(`Missing field: ${label}`);
  }
  return found;
}

async function fill(label: string, value: string) {
  await act(async () => field(label).props.onChangeText(value));
}

async function openPatient() {
  await render();
  await press('Joana Teste');
}

test('lists the linked patients from the API', async () => {
  await render();
  expect(hasText('Joana Teste')).toBe(true);
  expect(hasText('1 paciente cadastrado')).toBe(true);
  expect(hasText('Acesso ao app não liberado')).toBe(true);
  expect(services.patients.list).toHaveBeenCalledWith({ page_size: 100 });
});

test('patient list shows loading, empty and recoverable failure states', async () => {
  services.patients.list.mockImplementation(() => new Promise(() => undefined));
  await render();
  expect(pressables('Cadastrar paciente')).toHaveLength(1);
  expect(
    app.root.findAll(
      node => node.props.accessibilityLabel === 'Carregando pacientes',
    ).length,
  ).toBeGreaterThan(0);
  await act(async () => app.unmount());

  services.patients.list.mockResolvedValue(pageOf([]));
  await render();
  expect(hasText('Nenhum paciente cadastrado')).toBe(true);
  await act(async () => app.unmount());

  services.patients.list
    .mockRejectedValueOnce(new ApiError('network', 'offline'))
    .mockResolvedValueOnce(pageOf([patient]));
  await render();
  expect(hasText('Sem conexão com o servidor')).toBe(true);
  await press('Tentar novamente');
  expect(hasText('Joana Teste')).toBe(true);
});

test('creating a patient validates fields and sends only name, e-mail and phone', async () => {
  services.patients.create
    .mockRejectedValueOnce(
      new ApiError('conflict', 'conflict', 409, 'email_conflict'),
    )
    .mockResolvedValueOnce({ ...patient, id: 'patient-2' });
  await render();
  await press('Cadastrar paciente');
  await press('Cadastrar paciente');
  expect(hasText('Informe o nome completo.')).toBe(true);
  expect(services.patients.create).not.toHaveBeenCalled();

  await fill('Nome completo', '  Joana Teste ');
  await fill('E-mail (opcional)', 'joana@example.com');
  await press('Cadastrar paciente');
  expect(hasText('Este e-mail já é usado por outra conta.')).toBe(true);
  await press('Cadastrar paciente');
  expect(services.patients.create).toHaveBeenLastCalledWith({
    full_name: 'Joana Teste',
    email: 'joana@example.com',
    phone: null,
  });
  expect(services.patients.get).toHaveBeenCalledWith('patient-2');
  expect(hasText('Paciente cadastrado.')).toBe(true);
});

test('the temporary password is shown once, outside the navigation state', async () => {
  services.patients.activateAccess.mockResolvedValue(access);
  await openPatient();
  await press('Liberar acesso ao app');
  expect(services.patients.activateAccess).toHaveBeenCalledWith('patient-1');
  expect(hasText('Provisoria-Teste-123')).toBe(true);
  expect(hasText('canal seguro')).toBe(true);
  const routeParams = app.root
    .findAll(node => node.props.route?.params !== undefined)
    .map(node => node.props.route.params);
  expect(routeParams.length).toBeGreaterThan(0);
  expect(JSON.stringify(routeParams)).not.toContain('Provisoria');

  // Leaving the screen discards it; returning to it does not show it again.
  await press('Ver acompanhamento');
  await press('Voltar para Joana Teste');
  expect(hasText('Acesso ao aplicativo')).toBe(true);
  expect(hasText('Provisoria-Teste-123')).toBe(false);
  expect(services.patients.activateAccess).toHaveBeenCalledTimes(1);
});

test('forgotten password: a new temporary password needs confirmation', async () => {
  services.patients.get.mockResolvedValue({
    ...patient,
    has_access: true,
    access_is_active: true,
  });
  services.patients.resetTemporaryPassword.mockResolvedValue({
    ...access,
    temporary_password: 'Nova-Provisoria-456',
  });
  await openPatient();
  await press('Redefinir senha provisória');
  expect(services.patients.resetTemporaryPassword).not.toHaveBeenCalled();
  expect(hasText('deixará de funcionar')).toBe(true);
  await press('Gerar nova senha provisória');
  expect(services.patients.resetTemporaryPassword).toHaveBeenCalledWith(
    'patient-1',
  );
  expect(hasText('Nova-Provisoria-456')).toBe(true);
  await press('Já entreguei a senha');
  expect(hasText('Nova-Provisoria-456')).toBe(false);
});

test('with an empty catalog the editor offers the reference library', async () => {
  services.exercises.list.mockResolvedValue(pageOf([]));
  await openPatient();
  expect(hasText('Nenhum treino criado')).toBe(true);
  await press('Criar treino');
  expect(hasText('Nenhum exercício aprovado no catálogo')).toBe(false);
  expect(
    hasText(
      'Use exercícios do catálogo ou adicione da biblioteca de referência.',
    ),
  ).toBe(true);
  expect(pressables('Buscar na biblioteca de referência')).toHaveLength(1);
  await press('Salvar rascunho');
  expect(hasText('Escolha um exercício do catálogo.')).toBe(true);
  expect(services.workouts.create).not.toHaveBeenCalled();
});

test('workout values start empty and sides come from allowed_sides', async () => {
  services.exercises.list.mockResolvedValue(
    pageOf([{ ...exercise, allowed_sides: ['left'] }]),
  );
  services.workouts.create.mockResolvedValue(draftWorkout);
  await openPatient();
  await press('Criar treino');
  for (const label of [
    'Séries',
    'Repetições por série',
    'Descanso entre séries (segundos)',
  ]) {
    expect(field(label).props.value).toBe('');
  }
  expect(pressables('Lado esquerdo')).toHaveLength(0);

  await press('Salvar rascunho');
  expect(hasText('Escolha um exercício do catálogo.')).toBe(true);
  expect(services.workouts.create).not.toHaveBeenCalled();

  await press('Exercício aprovado de teste');
  expect(pressables('Lado esquerdo')).toHaveLength(1);
  expect(pressables('Lado direito')).toHaveLength(0);
  await press('Lado esquerdo');
  await fill('Séries', '3');
  await fill('Repetições por série', '12');
  await fill('Descanso entre séries (segundos)', '30');
  await press('Salvar rascunho');
  expect(services.workouts.create).toHaveBeenCalledWith('patient-1', {
    instructions: null,
    items: [
      {
        position: 1,
        exercise_id: 'exercise-1',
        side: 'left',
        sets: 3,
        repetitions: 12,
        rest_duration_ms: 30000,
        professional_guidance: null,
      },
    ],
  });
  expect(hasText('Revisar treino')).toBe(true);
  expect(hasText('Rascunho salvo')).toBe(true);
});

test('a library exercise needs reviewed Portuguese text before saving', async () => {
  services.exercises.list.mockResolvedValue(
    pageOf([
      {
        ...exercise,
        source: {
          source: 'OpenExerciseBase (Test Institute)',
          external_id: 'EX-test-1',
          source_url: 'https://example.com/EX-test-1.json',
          license: 'CC BY-NC 4.0',
          license_url: 'https://creativecommons.org/licenses/by-nc/4.0/',
          attribution: 'Attribution for test data.',
        },
        localization: null,
      },
    ]),
  );
  await openPatient();
  await press('Criar treino');
  await press('Exercício aprovado de teste');
  await press('Lado esquerdo');
  await fill('Séries', '2');
  await fill('Repetições por série', '8');
  await fill('Descanso entre séries (segundos)', '30');
  expect(pressables('Escrever tradução em português')).toHaveLength(1);

  await press('Salvar rascunho');
  expect(
    hasText('Adicione e revise a tradução em português antes de salvar.'),
  ).toBe(true);
  expect(services.workouts.create).not.toHaveBeenCalled();
});

test('pending parameter contracts and unsupported sides get clear messages', async () => {
  services.workouts.create
    .mockRejectedValueOnce(
      new ApiError('conflict', 'x', 409, 'parameter_contract_pending'),
    )
    .mockRejectedValueOnce(
      new ApiError('validation', 'x', 422, 'unsupported_side'),
    );
  await openPatient();
  await press('Criar treino');
  await press('Exercício aprovado de teste');
  await press('Lado direito');
  await fill('Séries', '1');
  await fill('Repetições por série', '1');
  await fill('Descanso entre séries (segundos)', '0');
  await press('Salvar rascunho');
  expect(hasText('validador de parâmetros aprovado')).toBe(true);
  await press('Salvar rascunho');
  expect(hasText('O lado escolhido não é permitido')).toBe(true);
});

test('a draft is published and archiving asks for confirmation', async () => {
  services.workouts.listForPatient.mockResolvedValue(pageOf([draftWorkout]));
  services.workouts.publish.mockResolvedValue({
    ...draftWorkout,
    status: 'published',
  });
  services.workouts.archive.mockResolvedValue({
    ...draftWorkout,
    status: 'archived',
  });
  await openPatient();
  await press('Treino · Rascunho');
  expect(hasText('3 séries · 12 repetições · Lado esquerdo')).toBe(true);
  expect(hasText('Descanso de 30 segundos')).toBe(true);
  await press('Publicar treino');
  expect(services.workouts.publish).toHaveBeenCalledWith('workout-1');
  expect(services.workouts.get).toHaveBeenCalledTimes(2);

  await press('Arquivar treino');
  expect(services.workouts.archive).not.toHaveBeenCalled();
  expect(hasText('Arquivar este treino?')).toBe(true);
  await press('Arquivar treino');
  expect(services.workouts.archive).toHaveBeenCalledWith('workout-1');
});

test('editing keeps the prescribed values typed by the physiotherapist', async () => {
  services.workouts.listForPatient.mockResolvedValue(pageOf([draftWorkout]));
  services.workouts.update.mockResolvedValue(draftWorkout);
  await openPatient();
  await press('Treino · Rascunho');
  await press('Editar treino');
  expect(field('Séries').props.value).toBe('3');
  await fill('Repetições por série', '10');
  await press('Salvar rascunho');
  expect(services.workouts.update).toHaveBeenCalledWith('workout-1', {
    instructions: null,
    items: [expect.objectContaining({ repetitions: 10, sets: 3 })],
  });
});

test('notes require content and an explicit visibility', async () => {
  services.notes.create.mockResolvedValue(note);
  await openPatient();
  expect(hasText('Nenhuma observação registrada')).toBe(true);
  await press('Escrever observação');
  await press('Salvar observação');
  expect(hasText('Escreva a observação antes de salvar.')).toBe(true);
  expect(hasText('Escolha quem pode ver a observação.')).toBe(true);
  await fill('Observação', 'Anotação de teste.');
  await press('Só para o fisioterapeuta');
  await press('Salvar observação');
  expect(services.notes.create).toHaveBeenCalledWith('patient-1', {
    content: 'Anotação de teste.',
    visibility: 'professional_only',
  });
});

test('an existing note is edited with its visibility', async () => {
  services.notes.list.mockResolvedValue(pageOf([note]));
  services.notes.update.mockResolvedValue(note);
  await openPatient();
  expect(hasText('Só para o fisioterapeuta')).toBe(true);
  await press('Anotação de teste.');
  await press('Paciente pode ver');
  await press('Salvar observação');
  expect(services.notes.update).toHaveBeenCalledWith('note-1', {
    content: 'Anotação de teste.',
    visibility: 'patient_visible',
  });
});

test('monitoring shows the linked patient sessions and progress, without achievements', async () => {
  await openPatient();
  await press('Ver acompanhamento');
  expect(hasText('Sessões concluídas: 1')).toBe(true);
  expect(hasText('Repetições: 36 de 36 prescritas')).toBe(true);
  expect(hasText('Treino concluído')).toBe(true);
  expect(hasText('Conquistas')).toBe(false);
  expect(services.sessions.listForPatient).toHaveBeenCalledWith('patient-1', {
    page_size: 10,
  });
});

test('monitoring without a selected patient and with no data shows empty states', async () => {
  await render();
  await press('Acompanhamento');
  expect(hasText('Escolha um paciente')).toBe(true);
  expect(services.sessions.listForPatient).not.toHaveBeenCalled();

  services.sessions.listForPatient.mockResolvedValue(pageOf([]));
  services.progress.forPatient.mockResolvedValue({
    ...progress,
    completed_sessions: 0,
  });
  await press('Ver pacientes');
  await press('Joana Teste');
  await press('Acompanhamento');
  expect(hasText('Nenhuma sessão nesta semana')).toBe(true);
  expect(hasText('Nenhuma sessão registrada')).toBe(true);
  expect(hasText('conquista')).toBe(false);
});

test('editing a workout keeps the professional guidance of each item', async () => {
  const guided: Workout = {
    ...draftWorkout,
    items: [
      {
        ...draftWorkout.items[0],
        professional_guidance: 'Orientação de teste da profissional.',
      },
    ],
  };
  services.workouts.listForPatient.mockResolvedValue(pageOf([guided]));
  services.workouts.get.mockResolvedValue(guided);
  services.workouts.update.mockResolvedValue(guided);
  await openPatient();
  await press('Treino · Rascunho');
  await press('Editar treino');
  await press('Salvar rascunho');
  expect(services.workouts.update).toHaveBeenCalledWith('workout-1', {
    instructions: null,
    items: [
      expect.objectContaining({
        professional_guidance: 'Orientação de teste da profissional.',
      }),
    ],
  });
});

test('long notes and workout instructions are not cut by the app', async () => {
  services.exercises.list.mockResolvedValue(pageOf([exercise]));
  await openPatient();
  await press('Escrever observação');
  expect(field('Observação').props.maxLength).toBeUndefined();
  await press('Voltar para Paciente');
  await press('Criar treino');
  expect(
    field('Orientações gerais (opcional)').props.maxLength,
  ).toBeUndefined();
});

test('a new temporary password is brought into view and announced', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  services.patients.activateAccess.mockResolvedValue(access);
  await openPatient();
  const scroll = app.root.findAllByType(ScrollView).at(-1);
  const scrollTo = jest.fn();
  if (!scroll?.instance) {
    throw new Error('Missing scroll view');
  }
  scroll.instance.scrollTo = scrollTo;
  await press('Liberar acesso ao app');
  expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
  expect(announce).toHaveBeenCalledWith(
    'Acesso liberado. A senha provisória está no topo da tela.',
  );
  expect(JSON.stringify(announce.mock.calls)).not.toContain('Provisoria');
  announce.mockRestore();
});

test('the physiotherapist edits the own display name', async () => {
  services.profile.updatePhysiotherapistProfile
    .mockRejectedValueOnce(new ApiError('network', 'offline'))
    .mockResolvedValueOnce({ full_name: 'Dra. Teste' });
  await openSettings('Meu perfil');
  expect(hasText('Você ainda não informou seu nome')).toBe(true);
  expect(field('Nome de exibição').props.value).toBe('');
  await fill('Nome de exibição', ' A ');
  await press('Salvar nome');
  expect(hasText('Informe o nome com pelo menos 2 letras.')).toBe(true);
  expect(services.profile.updatePhysiotherapistProfile).not.toHaveBeenCalled();

  await fill('Nome de exibição', '  Dra. Teste ');
  await press('Salvar nome');
  expect(hasText('Sem conexão com o servidor')).toBe(true);
  await press('Salvar nome');
  expect(
    services.profile.updatePhysiotherapistProfile,
  ).toHaveBeenLastCalledWith({ full_name: 'Dra. Teste' });
  expect(hasText('Nome salvo.')).toBe(true);
});

test('the own profile shows the saved name and recovers from a failure', async () => {
  services.profile.physiotherapistProfile
    .mockRejectedValueOnce(new ApiError('network', 'offline'))
    .mockResolvedValueOnce({ full_name: 'Dra. Teste' });
  await openSettings('Meu perfil');
  expect(hasText('Sem conexão com o servidor')).toBe(true);
  await press('Tentar novamente');
  expect(field('Nome de exibição').props.value).toBe('Dra. Teste');
  expect(hasText('Este é o nome que seus pacientes veem')).toBe(true);
});

test('the reference library lists items with the seal, notice and attribution', async () => {
  await openSettings('Biblioteca de referência');
  expect(services.exerciseLibrary.search).toHaveBeenLastCalledWith({
    query: undefined,
    body_part: undefined,
    page: 1,
    page_size: 20,
  });
  expect(hasText(usageNotice)).toBe(true);
  expect(hasText('Reference Item Test')).toBe(true);
  expect(hasText('Ombros, full body')).toBe(true);
  expect(hasText('Fonte: Fonte de teste')).toBe(true);
  expect(hasText('Licença: CC BY-NC 4.0')).toBe(true);
  expect(hasText(attribution.changes)).toBe(true);
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await press('Abrir a licença CC BY-NC 4.0');
  expect(open).toHaveBeenCalledWith(attribution.license_url);
  open.mockRestore();
});

test('library search and the upper-limb shortcut filter on the server', async () => {
  await openSettings('Biblioteca de referência');
  await fill('Buscar pelo nome (em inglês)', '  raise ');
  await press('Buscar');
  expect(services.exerciseLibrary.search).toHaveBeenLastCalledWith({
    query: 'raise',
    body_part: undefined,
    page: 1,
    page_size: 20,
  });
  for (const label of [
    'Ombros',
    'Parte superior das costas',
    'Peito',
    'Tríceps',
    'Bíceps',
    'Antebraços',
    'Punhos',
    'Pescoço',
  ]) {
    expect(pressables(label)).toHaveLength(1);
  }
  services.exerciseLibrary.search.mockResolvedValue({
    ...libraryPage,
    ...pageOf([]),
  });
  await press('Ombros');
  expect(services.exerciseLibrary.search).toHaveBeenLastCalledWith({
    query: 'raise',
    body_part: 'shoulders',
    page: 1,
    page_size: 20,
  });
  expect(hasText('Nenhum exercício encontrado')).toBe(true);
  await press('Limpar filtros');
  expect(services.exerciseLibrary.search).toHaveBeenLastCalledWith({
    query: undefined,
    body_part: undefined,
    page: 1,
    page_size: 20,
  });
});

test('an unavailable library shows a specific error and retries', async () => {
  services.exerciseLibrary.search
    .mockRejectedValueOnce(
      new ApiError('server', 'x', 503, 'external_library_unavailable'),
    )
    .mockResolvedValueOnce(libraryPage);
  await openSettings('Biblioteca de referência');
  expect(hasText('Biblioteca indisponível no momento')).toBe(true);
  expect(hasText('Reference Item Test')).toBe(false);
  await press('Tentar novamente');
  expect(hasText('Reference Item Test')).toBe(true);
});

test('library details show original steps, AI origin and no prescription values', async () => {
  await openSettings('Biblioteca de referência');
  await press('Reference Item Test');
  expect(services.exerciseLibrary.get).toHaveBeenCalledWith('EX-test-1');
  expect(hasText('Material de referência — ainda não está no catálogo')).toBe(
    true,
  );
  expect(hasText(usageNotice)).toBe(true);
  expect(hasText('Texto de referência')).toBe(true);
  expect(hasText('Conteúdo gerado por IA')).toBe(true);
  expect(hasText('Situação de revisão na fonte: accepted_with_edits')).toBe(
    true,
  );
  const steps = texts();
  expect(steps.indexOf('First step text.')).toBeLessThan(
    steps.indexOf('Second step text.'),
  );
  expect(
    app.root.findAll(
      node =>
        node.props.accessibilityLanguage === 'en' &&
        node.props.children === 'First step text.',
    ).length,
  ).toBeGreaterThan(0);
  expect(hasText('Fonte: Fonte de teste')).toBe(true);
  for (const label of [
    'Adicionar e usar neste treino',
    'Salvar rascunho',
    'Criar treino',
  ]) {
    expect(pressables(label)).toHaveLength(0);
  }
  const labels = app.root
    .findAllByType(FormField)
    .map(node => node.props.label);
  expect(labels).not.toContain('Séries');
  expect(labels).not.toContain('Repetições por série');
  expect(
    hasText(
      'Séries, repetições e descanso são definidos por você em cada treino.',
    ),
  ).toBe(true);
});

test('library details from a professional author do not claim AI', async () => {
  services.exerciseLibrary.get.mockResolvedValue({
    ...libraryDetail,
    created_by: 'professional',
  });
  await openSettings('Biblioteca de referência');
  await press('Reference Item Test');
  expect(hasText('Conteúdo gerado por IA')).toBe(false);
  expect(hasText('Autoria informada pela fonte: professional')).toBe(true);
});

test('settings is the third tab with profile, library and sign out', async () => {
  await render();
  expect(hasText('Outros acessos')).toBe(false);
  expect(pressables('Sair da conta')).toHaveLength(0);
  expect(pressables('Meu perfil')).toHaveLength(0);
  expect(selectedTab()).toBe('Pacientes');
  await press('Configurações');
  expect(selectedTab()).toBe('Configurações');
  for (const label of ['Meu perfil', 'Biblioteca de referência']) {
    expect(pressables(label)).toHaveLength(1);
  }
  await press('Meu perfil');
  expect(selectedTab()).toBe('Configurações');
  await press('Configurações');
  await press('Biblioteca de referência');
  expect(selectedTab()).toBe('Configurações');
  await press('Configurações');
  await press('Sair da conta');
  expect(signOut).toHaveBeenCalledTimes(1);
});

test('adding to the catalog requires an explicit side choice', async () => {
  await openSettings('Biblioteca de referência');
  await press('Reference Item Test');
  for (const label of ['Lado esquerdo', 'Lado direito', 'Os dois lados']) {
    const [option] = pressables(label);
    expect(option.props.accessibilityRole).toBe('checkbox');
    expect(option.props.accessibilityState).toEqual({ checked: false });
  }
  await press('Adicionar ao catálogo');
  expect(hasText('Escolha pelo menos um lado.')).toBe(true);
  expect(services.exerciseLibrary.addToCatalog).not.toHaveBeenCalled();

  services.exerciseLibrary.get.mockResolvedValue({
    ...libraryDetail,
    catalog_exercise: {
      exercise_id: 'exercise-imported',
      approval_status: 'approved',
      added_by_me: true,
    },
  });
  await press('Lado esquerdo');
  await press('Lado direito');
  await press('Lado esquerdo');
  await press('Os dois lados');
  await press('Adicionar ao catálogo');
  expect(services.exerciseLibrary.addToCatalog).toHaveBeenCalledWith(
    'EX-test-1',
    ['right', 'bilateral'],
  );
  expect(hasText('Adicionado ao catálogo por você')).toBe(true);
  expect(pressables('Adicionar ao catálogo')).toHaveLength(0);
  expect(hasText('Fonte: Fonte de teste')).toBe(true);
});

test.each([
  [
    { approval_status: 'approved', added_by_me: false },
    'Adicionado ao catálogo por outro fisioterapeuta',
  ],
  [{ approval_status: 'revoked', added_by_me: true }, 'Retirado do catálogo'],
] as const)('catalog seal for %j', async (status, seal) => {
  services.exerciseLibrary.get.mockResolvedValue({
    ...libraryDetail,
    catalog_exercise: { exercise_id: 'exercise-imported', ...status },
  });
  await openSettings('Biblioteca de referência');
  await press('Reference Item Test');
  expect(hasText(seal)).toBe(true);
  expect(pressables('Adicionar ao catálogo')).toHaveLength(0);
  expect(hasText('Fonte: Fonte de teste')).toBe(true);
});

test.each([
  [
    409,
    'catalog_exercise_revoked',
    'Este exercício foi retirado do catálogo e não pode ser adicionado de novo por aqui.',
  ],
  [
    422,
    'library_exercise_without_instructions',
    'A fonte não informa os passos deste exercício, por isso ele não pode entrar no catálogo.',
  ],
  [
    503,
    'external_library_unavailable',
    'A biblioteca externa não respondeu e nada foi salvo. Tente de novo em alguns instantes.',
  ],
])('adding to the catalog explains a %i %s', async (status, code, text) => {
  services.exerciseLibrary.addToCatalog.mockRejectedValueOnce(
    new ApiError('server', 'x', status, code),
  );
  await openSettings('Biblioteca de referência');
  await press('Reference Item Test');
  await press('Lado direito');
  await press('Adicionar ao catálogo');
  expect(hasText(text)).toBe(true);
  expect(hasText('Material de referência — ainda não está no catálogo')).toBe(
    true,
  );
});

test('the editor requires Portuguese before saving an exercise from the library', async () => {
  services.exercises.list.mockResolvedValue(pageOf([]));
  services.workouts.create.mockResolvedValue(draftWorkout);
  await openPatient();
  await press('Criar treino');
  await fill('Orientações gerais (opcional)', 'Texto geral de teste.');
  await fill('Séries', '2');
  await press('Buscar na biblioteca de referência');
  expect(hasText('Escolha um exercício e adicione-o ao catálogo')).toBe(true);
  // Pick mode belongs to the patient's flow, not to "Configurações".
  expect(selectedTab()).toBe('Pacientes');
  await press('Reference Item Test');
  expect(selectedTab()).toBe('Pacientes');
  expect(pressables('Adicionar ao catálogo')).toHaveLength(0);
  await press('Lado direito');
  await press('Adicionar e usar neste treino');
  expect(services.exerciseLibrary.addToCatalog).toHaveBeenCalledWith(
    'EX-test-1',
    ['right'],
  );
  expect(services.exercises.get).toHaveBeenCalledWith('exercise-imported');

  // Back in the same editor: the draft survived, only the exercise was set.
  expect(hasText('Material de referência')).toBe(false);
  expect(hasText('Biblioteca de referência')).toBe(false);
  expect(services.exercises.list).toHaveBeenCalledTimes(1);
  expect(field('Orientações gerais (opcional)').props.value).toBe(
    'Texto geral de teste.',
  );
  expect(field('Séries').props.value).toBe('2');
  expect(field('Repetições por série').props.value).toBe('');
  expect(field('Descanso entre séries (segundos)').props.value).toBe('');
  expect(field('Orientação para o paciente (opcional)').props.value).toBe('');
  const [picked] = pressables('Reference Item Test');
  expect(picked.props.accessibilityState).toEqual({ checked: true });
  expect(pressables('Lado direito')[0].props.accessibilityState).toEqual({
    checked: false,
  });
  expect(hasText('Fonte: OpenExerciseBase (CC BY-NC 4.0)')).toBe(true);

  await press('Lado direito');
  await fill('Repetições por série', '8');
  await fill('Descanso entre séries (segundos)', '0');
  await fill('Orientação para o paciente (opcional)', '  Faça devagar.  ');
  await press('Salvar rascunho');
  expect(
    hasText('Adicione e revise a tradução em português antes de salvar.'),
  ).toBe(true);
  expect(services.workouts.create).not.toHaveBeenCalled();
});

test('an exercise already in the catalog is used without adding it again', async () => {
  services.exercises.list.mockResolvedValue(pageOf([]));
  services.exerciseLibrary.get.mockResolvedValue({
    ...libraryDetail,
    catalog_exercise: {
      exercise_id: 'exercise-imported',
      approval_status: 'approved',
      added_by_me: false,
    },
  });
  await openPatient();
  await press('Criar treino');
  await press('Buscar na biblioteca de referência');
  await press('Reference Item Test');
  expect(pressables('Adicionar e usar neste treino')).toHaveLength(0);
  await press('Usar neste treino');
  expect(services.exerciseLibrary.addToCatalog).not.toHaveBeenCalled();
  expect(hasText('Material de referência')).toBe(false);
  expect(
    pressables('Reference Item Test').at(-1)?.props.accessibilityState,
  ).toEqual({ checked: true });
});

test('a failure loading the picked exercise is shown in the editor', async () => {
  services.exercises.list.mockResolvedValue(pageOf([]));
  services.exercises.get.mockRejectedValueOnce(new ApiError('network', 'x'));
  await openPatient();
  await press('Criar treino');
  await press('Buscar na biblioteca de referência');
  await press('Reference Item Test');
  await press('Lado direito');
  await press('Adicionar e usar neste treino');
  expect(hasText('Sem conexão com o servidor')).toBe(true);
  expect(hasText('Criar treino')).toBe(true);
});

// DEC-010/DEC-011: test-only texts; no clinical value.
const translation = {
  language: 'pt-BR' as const,
  name: 'Item de referência de teste',
  instructions: '1. Primeiro passo de teste.\n2. Segundo passo de teste.',
  translated_by_name: 'Dra. Teste',
  translated_at: '2026-11-06T12:00:00Z',
};
const translatedExercise: Exercise = {
  ...importedExercise,
  images: [
    { position: 1, url: '/api/v1/exercises/exercise-imported/images/1' },
    { position: 2, url: '/api/v1/exercises/exercise-imported/images/2' },
  ],
  localization: translation,
};
const republish =
  'Para o paciente ver a tradução e as imagens, salve o treino de novo e publique.';

test('adding to the catalog sends the pt-BR text only with both fields', async () => {
  await openSettings('Biblioteca de referência');
  await press('Reference Item Test');
  expect(hasText('Nome original')).toBe(true);
  await press('Lado direito');
  await fill('Nome em português (opcional)', 'Item de referência de teste');
  await press('Adicionar ao catálogo');
  expect(
    hasText(
      'Escreva também os passos em português, ou deixe os dois campos vazios.',
    ),
  ).toBe(true);
  expect(services.exerciseLibrary.addToCatalog).not.toHaveBeenCalled();

  await fill(
    'Passos em português (opcional)',
    '1. Primeiro passo de teste.\n\nSegundo passo de teste.',
  );
  await press('Adicionar ao catálogo');
  expect(services.exerciseLibrary.addToCatalog).toHaveBeenCalledWith(
    'EX-test-1',
    ['right'],
    {
      name: 'Item de referência de teste',
      instructions: ['Primeiro passo de teste.', 'Segundo passo de teste.'],
    },
  );
});

test('the translation of a catalog exercise is edited with the original beside it', async () => {
  services.exerciseLibrary.get.mockResolvedValue({
    ...libraryDetail,
    catalog_exercise: {
      exercise_id: 'exercise-imported',
      approval_status: 'approved',
      added_by_me: false,
    },
  });
  services.exercises.updateLocalization.mockResolvedValue(translatedExercise);
  await openSettings('Biblioteca de referência');
  await press('Reference Item Test');
  await press('Tradução em português');
  expect(services.exercises.get).toHaveBeenCalledWith('exercise-imported');
  expect(hasText('Texto de referência')).toBe(true);
  expect(hasText('1. First step text.')).toBe(true);
  expect(hasText(republish)).toBe(true);

  await press('Salvar tradução');
  expect(hasText('Escreva o nome em português.')).toBe(true);
  expect(services.exercises.updateLocalization).not.toHaveBeenCalled();

  await fill('Nome em português', 'Item de referência de teste');
  await fill('Passos em português', 'Primeiro passo de teste.');
  await press('Salvar tradução');
  expect(services.exercises.updateLocalization).toHaveBeenCalledWith(
    'exercise-imported',
    {
      name: 'Item de referência de teste',
      instructions: ['Primeiro passo de teste.'],
    },
  );
  expect(hasText(`Tradução salva. ${republish}`)).toBe(true);
});

test('an existing translation is prefilled and a 404 is explained', async () => {
  services.exercises.get.mockResolvedValue(translatedExercise);
  services.exercises.updateLocalization.mockRejectedValueOnce(
    new ApiError('not_found', 'x', 404, 'exercise_not_found'),
  );
  services.exerciseLibrary.get.mockResolvedValue({
    ...libraryDetail,
    catalog_exercise: {
      exercise_id: 'exercise-imported',
      approval_status: 'approved',
      added_by_me: true,
    },
  });
  await openSettings('Biblioteca de referência');
  await press('Reference Item Test');
  await press('Tradução em português');
  expect(field('Nome em português').props.value).toBe(
    'Item de referência de teste',
  );
  expect(field('Passos em português').props.value).toBe(
    'Primeiro passo de teste.\nSegundo passo de teste.',
  );
  expect(hasText('Tradução atual feita por Dra. Teste.')).toBe(true);
  await press('Salvar tradução');
  expect(
    hasText(
      'Este exercício não está mais no catálogo. A tradução não foi salva.',
    ),
  ).toBe(true);
});

test('the editor shows the pt-BR text, the original and the first API image', async () => {
  services.exercises.list.mockResolvedValue(pageOf([translatedExercise]));
  await openPatient();
  await press('Criar treino');
  await press('Item de referência de teste (original: Reference Item Test)');
  expect(hasText('Em português (o paciente vê este texto)')).toBe(true);
  expect(hasText('2. Segundo passo de teste.')).toBe(true);
  expect(hasText('Referência da fonte')).toBe(true);
  const english = app.root.findAll(
    node =>
      node.props.accessibilityLanguage === 'en' &&
      typeof node.type !== 'string',
  );
  expect(english.map(node => [node.props.children].flat().join(''))).toEqual(
    expect.arrayContaining(['1. First step text.\n2. Second step text.']),
  );
  const images = app.root.findAllByType(Image);
  expect(images.map(node => node.props.accessibilityLabel)).toEqual([
    'Imagem 1 de 2 do exercício Item de referência de teste',
  ]);
  expect(images[0].props.source.uri).toBe(
    'http://api.test/api/v1/exercises/exercise-imported/images/1',
  );
  expect(hasText('Adaptado de OpenExerciseBase (CC BY-NC 4.0).')).toBe(true);
  expect(pressables('Editar tradução em português')).toHaveLength(1);

  // Back from the translation screen, the editor reloads that exercise.
  services.exercises.get.mockResolvedValue({
    ...translatedExercise,
    localization: { ...translation, name: 'Nome revisado de teste' },
  });
  await press('Editar tradução em português');
  await press('Voltar para Exercício');
  expect(services.exercises.get).toHaveBeenLastCalledWith('exercise-imported');
  expect(
    hasText('Nome revisado de teste (original: Reference Item Test)'),
  ).toBe(true);
});

test('the review shows the snapshot pt-BR name, the original and the image', async () => {
  const reviewed: Workout = {
    ...draftWorkout,
    items: [
      {
        ...draftWorkout.items[0],
        exercise_id: 'exercise-imported',
        exercise_snapshot: {
          name: 'Reference Item Test',
          source: {
            source: 'OpenExerciseBase (Test)',
            license: 'CC BY-NC 4.0',
          },
          images: [
            {
              position: 1,
              url: '/api/v1/exercises/exercise-imported/images/1',
            },
          ],
          localization: translation,
        },
      },
    ],
  };
  services.workouts.listForPatient.mockResolvedValue(pageOf([reviewed]));
  services.workouts.get.mockResolvedValue(reviewed);
  await openPatient();
  await press('Treino · Rascunho');
  expect(hasText('Item de referência de teste')).toBe(true);
  expect(hasText('Nome da biblioteca: Reference Item Test')).toBe(true);
  expect(
    app.root.findAllByType(Image).map(node => node.props.accessibilityLabel),
  ).toEqual(['Imagem 1 de 1 do exercício Item de referência de teste']);
  await press('Tradução em português');
  expect(services.exercises.get).toHaveBeenCalledWith('exercise-imported');
});
