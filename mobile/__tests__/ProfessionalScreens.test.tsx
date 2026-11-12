import {
  mockNativeAlerts,
  pressNativeAlert,
  lastNativeAlert,
} from '../test-utils/nativeAlerts';
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
      delete: jest.fn(),
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
      unarchive: jest.fn(),
      delete: jest.fn(),
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
    notes: {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
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
  mockNativeAlerts();
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

async function selectExercise(label = 'Exercício aprovado de teste') {
  await press('Adicionar exercício');
  await press(label);
}

async function saveWorkout() {
  await press(
    pressables('Salvar rascunho').length ? 'Salvar rascunho' : 'Criar treino',
  );
}

async function openPatient() {
  await render();
  await press('Acompanhamento');
  await press('Joana Teste');
}

async function openRegistration() {
  await render();
  await press('Joana Teste');
}

test('lists the linked patients from the API', async () => {
  await render();
  expect(hasText('Joana Teste')).toBe(true);
  expect(hasText('1 paciente cadastrado')).toBe(false);
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
  await openRegistration();
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
  await press('Acompanhamento');
  await press('Pacientes');
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
  await openRegistration();
  await press('Redefinir senha provisória');
  expect(services.patients.resetTemporaryPassword).not.toHaveBeenCalled();
  expect(lastNativeAlert()[1]).toContain('deixará de funcionar');
  await press('Cancelar');
  expect(services.patients.resetTemporaryPassword).not.toHaveBeenCalled();
  await press('Redefinir senha provisória');
  await press('Confirmar');
  expect(services.patients.resetTemporaryPassword).toHaveBeenCalledWith(
    'patient-1',
  );
  expect(hasText('Nova-Provisoria-456')).toBe(true);
  await press('Já entreguei a senha');
  expect(hasText('Nova-Provisoria-456')).toBe(false);
});

test('with an empty catalog the picker offers import without creating an empty item', async () => {
  services.exercises.list.mockResolvedValue(pageOf([]));
  await openPatient();
  await press('Criar treino');
  expect(hasText('Adicione os exercícios do treino')).toBe(true);
  await press('Adicionar exercício');
  expect(hasText('O catálogo ainda não tem exercícios')).toBe(true);
  expect(pressables('Buscar na biblioteca de referência')).toHaveLength(1);
  await press('Voltar para Treino');
  await saveWorkout();
  expect(hasText('Adicione pelo menos um exercício ao treino.')).toBe(true);
  expect(services.workouts.create).not.toHaveBeenCalled();
});

test('workout values start empty and a single allowed side needs no choice', async () => {
  services.exercises.list.mockResolvedValue(
    pageOf([{ ...exercise, allowed_sides: ['left'] }]),
  );
  services.workouts.create.mockResolvedValue(draftWorkout);
  await openPatient();
  await press('Criar treino');
  expect(pressables('Lado esquerdo')).toHaveLength(0);
  await saveWorkout();
  expect(hasText('Adicione pelo menos um exercício ao treino.')).toBe(true);
  expect(services.workouts.create).not.toHaveBeenCalled();
  await selectExercise();
  for (const label of [
    'Séries',
    'Repetições por série',
    'Descanso (em segundos)',
  ]) {
    expect(field(label).props.value).toBe('');
  }
  // The only allowed side is used without asking.
  expect(pressables('Lado esquerdo')).toHaveLength(0);
  expect(pressables('Lado direito')).toHaveLength(0);
  await fill('Séries', '3');
  await fill('Repetições por série', '12');
  await fill('Descanso (em segundos)', '30');
  await saveWorkout();
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
        counting_rule: null,
      },
    ],
  });
  expect(hasText('Revisar treino')).toBe(true);
  expect(hasText('Rascunho salvo')).toBe(true);
});

const countingLabel = 'Contagem automática demonstrativa (flexão de cotovelo)';
const countingNotice =
  'Não validada clinicamente; os valores são de demonstração acadêmica.';

test('the editor no longer offers automatic counting; new items go without it', async () => {
  services.exercises.list.mockResolvedValue(
    pageOf([{ ...exercise, allowed_sides: ['left', 'bilateral'] }]),
  );
  services.workouts.create.mockResolvedValue(draftWorkout);
  await openPatient();
  await press('Criar treino');
  await selectExercise();
  expect(pressables(countingLabel)).toHaveLength(0);
  expect(hasText(countingNotice)).toBe(false);
  expect(hasText('Escolha o lado esquerdo ou direito para ativar.')).toBe(
    false,
  );
  // More than one allowed side: the physiotherapist chooses it.
  expect(pressables('Lado esquerdo')).toHaveLength(1);
  expect(pressables('Os dois lados')).toHaveLength(1);
  await press('Lado esquerdo');
  await fill('Séries', '3');
  await fill('Repetições por série', '12');
  await fill('Descanso (em segundos)', '30');
  await saveWorkout();
  expect(services.workouts.create).toHaveBeenCalledWith('patient-1', {
    instructions: null,
    items: [expect.objectContaining({ side: 'left', counting_rule: null })],
  });
});

test('editing keeps an existing counting rule and the review shows the seal', async () => {
  const counted: Workout = {
    ...draftWorkout,
    items: [
      { ...draftWorkout.items[0], counting_rule: 'demo-elbow-flexion:v1' },
    ],
  };
  services.workouts.listForPatient.mockResolvedValue(pageOf([counted]));
  services.workouts.get.mockResolvedValue(counted);
  services.workouts.update.mockResolvedValue(counted);
  await openPatient();
  await press('Treino · Rascunho');
  expect(hasText(`${countingLabel}: ativada.`)).toBe(true);
  expect(hasText(countingNotice)).toBe(true);
  await press('Editar treino');
  expect(pressables(countingLabel)).toHaveLength(0);
  await saveWorkout();
  expect(services.workouts.update).toHaveBeenCalledWith('workout-1', {
    instructions: null,
    items: [
      expect.objectContaining({ counting_rule: 'demo-elbow-flexion:v1' }),
    ],
  });
});

test('a review without the rule does not mention automatic counting', async () => {
  services.workouts.listForPatient.mockResolvedValue(pageOf([draftWorkout]));
  await openPatient();
  await press('Treino · Rascunho');
  expect(hasText(countingLabel)).toBe(false);
});

test('a library exercise without Portuguese text can be saved and uses the original name', async () => {
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
  services.workouts.create.mockResolvedValue(draftWorkout);
  await openPatient();
  await press('Criar treino');
  await selectExercise();
  await press('Lado esquerdo');
  await fill('Séries', '2');
  await fill('Repetições por série', '8');
  await fill('Descanso (em segundos)', '30');
  expect(pressables('Editar nome do exercício')).toHaveLength(1);

  await saveWorkout();
  expect(
    hasText('Adicione e revise a tradução em português antes de salvar.'),
  ).toBe(false);
  expect(services.workouts.create).toHaveBeenCalled();
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
  await selectExercise();
  await press('Lado direito');
  await fill('Séries', '1');
  await fill('Repetições por série', '1');
  await fill('Descanso (em segundos)', '0');
  await saveWorkout();
  expect(hasText('validador de parâmetros aprovado')).toBe(true);
  await saveWorkout();
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
  expect(lastNativeAlert()[0]).toBe('Arquivar este treino?');
  await press('Cancelar');
  expect(services.workouts.archive).not.toHaveBeenCalled();
  await press('Arquivar treino');
  await press('Confirmar');
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
  await saveWorkout();
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
  await press('Editar observação');
  await press('Paciente pode ver');
  await press('Salvar observação');
  expect(services.notes.list.mock.calls.length).toBeGreaterThanOrEqual(3);
  expect(services.notes.update).toHaveBeenCalledWith('note-1', {
    content: 'Anotação de teste.',
    visibility: 'patient_visible',
  });
});

test('monitoring shows the linked patient sessions and progress, without achievements', async () => {
  services.workouts.listForPatient.mockResolvedValue(pageOf([draftWorkout]));
  await openPatient();
  await press('Ver sessões de progresso');
  expect(hasText('Sessões concluídas: 1')).toBe(true);
  expect(hasText('Repetições: 36 de 36 prescritas')).toBe(true);
  expect(hasText('Treino concluído')).toBe(true);
  expect(hasText('Conquistas')).toBe(false);
  expect(services.sessions.listForPatient).toHaveBeenCalledWith('patient-1', {
    page_size: 10,
  });
});

test('monitoring without a selected patient and with no data shows empty states', async () => {
  services.workouts.listForPatient.mockResolvedValue(pageOf([draftWorkout]));
  await render();
  await press('Acompanhamento');
  expect(hasText('Joana Teste')).toBe(true);
  expect(services.sessions.listForPatient).not.toHaveBeenCalled();

  services.sessions.listForPatient.mockResolvedValue(pageOf([]));
  services.progress.forPatient.mockResolvedValue({
    ...progress,
    completed_sessions: 0,
  });
  await press('Joana Teste');
  await press('Ver sessões de progresso');
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
  await saveWorkout();
  expect(services.workouts.update).toHaveBeenCalledWith('workout-1', {
    instructions: null,
    items: [
      expect.objectContaining({
        professional_guidance: 'Orientação de teste da profissional.',
      }),
    ],
  });
});

test('long notes and patient guidance are not cut by the app', async () => {
  services.exercises.list.mockResolvedValue(pageOf([exercise]));
  await openPatient();
  await press('Escrever observação');
  expect(field('Observação').props.maxLength).toBeUndefined();
  await press('Voltar para Paciente');
  await press('Criar treino');
  await selectExercise();
  expect(field('Orientação para o paciente').props.maxLength).toBeUndefined();
});

test('a new temporary password is brought into view and announced', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  services.patients.activateAccess.mockResolvedValue(access);
  await openRegistration();
  const scroll = app.root.findAllByType(ScrollView).at(-1);
  const scrollTo = jest.fn();
  if (!scroll?.instance) {
    throw new Error('Missing scroll view');
  }
  scroll.instance.scrollTo = scrollTo;
  await press('Liberar acesso ao app');
  expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
  expect(announce).toHaveBeenCalledWith(
    'Sucesso. Acesso liberado. A senha provisória está no topo da tela.',
  );
  expect(JSON.stringify(announce.mock.calls)).not.toContain('Provisoria');
  announce.mockRestore();
});

test('the physiotherapist edits the own display name', async () => {
  services.profile.updatePhysiotherapistProfile
    .mockRejectedValueOnce(new ApiError('network', 'offline'))
    .mockResolvedValueOnce({ full_name: 'Dra. Teste' });
  await openSettings('Meu perfil');
  expect(hasText('Informações pessoais')).toBe(true);
  expect(hasText('Não informado')).toBe(true);
  expect(pressables('Salvar')).toHaveLength(0);
  expect(
    app.root.findAllByType(FormField).some(node => node.props.label === 'Nome'),
  ).toBe(false);

  await press('Editar nome');
  expect(field('Nome').props.value).toBe('');
  await fill('Nome', 'Rascunho');
  await press('Cancelar');
  expect(hasText('Rascunho')).toBe(false);
  expect(hasText('Não informado')).toBe(true);

  await press('Editar nome');
  await fill('Nome', ' A ');
  await press('Salvar');
  expect(hasText('Informe o nome com pelo menos 2 letras.')).toBe(true);
  expect(services.profile.updatePhysiotherapistProfile).not.toHaveBeenCalled();

  await fill('Nome', '  Dra. Teste ');
  await press('Salvar');
  expect(hasText('Sem conexão com o servidor')).toBe(true);
  await press('Salvar');
  expect(
    services.profile.updatePhysiotherapistProfile,
  ).toHaveBeenLastCalledWith({ full_name: 'Dra. Teste' });
  expect(hasText('Nome salvo.')).toBe(true);
  expect(pressables('Salvar')).toHaveLength(0);
  expect(hasText('Dra. Teste')).toBe(true);
  expect(pressables('Editar nome')).toHaveLength(1);
});

test('the own profile shows the saved name and recovers from a failure', async () => {
  services.profile.physiotherapistProfile
    .mockRejectedValueOnce(new ApiError('network', 'offline'))
    .mockResolvedValueOnce({ full_name: 'Dra. Teste' });
  await openSettings('Meu perfil');
  expect(hasText('Sem conexão com o servidor')).toBe(true);
  await press('Tentar novamente');
  expect(hasText('Dra. Teste')).toBe(true);
  expect(hasText('Seus pacientes veem este nome')).toBe(true);
  await press('Editar nome');
  expect(field('Nome').props.value).toBe('Dra. Teste');
});

test('the reference library lists items with attribution', async () => {
  await openSettings('Biblioteca de referência');
  expect(services.exerciseLibrary.search).toHaveBeenLastCalledWith({
    query: undefined,
    body_part: undefined,
    page: 1,
    page_size: 20,
  });
  expect(hasText(usageNotice)).toBe(false);
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

test('the fixed English notices of the library appear in Portuguese', async () => {
  const englishNotice =
    'External reference material. A physiotherapist may add it to the FisioMove catalog for academic use; prescription values are always set by the physiotherapist.';
  const englishAttribution =
    'Only selected descriptive fields are shown; text is kept in the original language without edits. Performance metrics and variations are omitted.';
  services.exerciseLibrary.search.mockResolvedValue({
    ...libraryPage,
    usage_notice: englishNotice,
    attribution: {
      ...attribution,
      changes: englishAttribution,
    },
  });
  services.exerciseLibrary.get.mockResolvedValue({
    ...libraryDetail,
    usage_notice: englishNotice,
    attribution: {
      ...attribution,
      changes: englishAttribution,
    },
  });
  await openSettings('Biblioteca de referência');
  expect(hasText('Material de referência externo.')).toBe(false);
  expect(hasText('Mostramos só alguns campos descritivos')).toBe(true);
  expect(hasText('External reference material')).toBe(false);
  expect(hasText('Only selected descriptive fields')).toBe(false);
  await press('Reference Item Test');
  expect(hasText('Material de referência externo.')).toBe(false);
  expect(hasText('Mostramos só alguns campos descritivos')).toBe(true);
  expect(hasText('External reference material')).toBe(false);
  expect(hasText('Only selected descriptive fields')).toBe(false);
  expect(hasText('texto em inglês')).toBe(false);
});

test('library search and the upper-limb shortcut filter on the server', async () => {
  await openSettings('Biblioteca de referência');
  await fill('Buscar exercícios (em inglês)', '  raise ');
  await act(async () =>
    field('Buscar exercícios (em inglês)').props.onSubmitEditing(),
  );
  expect(services.exerciseLibrary.search).toHaveBeenLastCalledWith({
    query: 'raise',
    body_part: undefined,
    page: 1,
    page_size: 20,
  });
  expect(pressables('Ombros')).toHaveLength(0);
  expect(pressables('Buscar')).toHaveLength(0);
  await press('Filtrar exercícios');
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
    body_part: undefined,
    page: 1,
    page_size: 20,
  });
  await press('Aplicar filtros');
  expect(pressables('Ombros')).toHaveLength(0);
  expect(pressables('Remover filtro: Ombros')).toHaveLength(1);
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
    false,
  );
  expect(hasText(usageNotice)).toBe(false);
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
  expect(signOut).not.toHaveBeenCalled();
  await press('Cancelar');
  expect(signOut).not.toHaveBeenCalled();
  await press('Sair da conta');
  await press('Confirmar');
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
    false,
  );
  expect(pressables('Adicionar ao catálogo')).toHaveLength(1);
});

test('the editor requires Portuguese before saving an exercise from the library', async () => {
  services.exercises.list.mockResolvedValue(pageOf([]));
  services.workouts.create.mockResolvedValue(draftWorkout);
  await openPatient();
  await press('Criar treino');
  await press('Adicionar exercício');
  await press('Buscar na biblioteca de referência');
  expect(hasText('Escolha um exercício e adicione-o ao catálogo')).toBe(false);
  // Pick mode belongs to the patient's flow, not to "Configurações".
  expect(selectedTab()).toBe('Acompanhamento');
  await press('Reference Item Test');
  expect(selectedTab()).toBe('Acompanhamento');
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
  expect(services.exercises.list).toHaveBeenCalledTimes(2);
  expect(field('Séries').props.value).toBe('');
  expect(field('Repetições por série').props.value).toBe('');
  expect(field('Descanso (em segundos)').props.value).toBe('');
  expect(field('Orientação para o paciente').props.value).toBe('');
  expect(hasText('Reference Item Test')).toBe(true);
  // The only allowed side (right) is used without a selector.
  expect(pressables('Lado direito')).toHaveLength(0);
  expect(pressables('Editar nome do exercício')).toHaveLength(1);

  await fill('Séries', '2');
  await fill('Repetições por série', '8');
  await fill('Descanso (em segundos)', '0');
  await fill('Orientação para o paciente', '  Faça devagar.  ');
  await saveWorkout();
  expect(
    hasText('Adicione e revise a tradução em português antes de salvar.'),
  ).toBe(false);
  expect(services.workouts.create).toHaveBeenCalledWith('patient-1', {
    instructions: null,
    items: [
      {
        position: 1,
        exercise_id: 'exercise-imported',
        side: 'right',
        sets: 2,
        repetitions: 8,
        rest_duration_ms: 0,
        professional_guidance: 'Faça devagar.',
        counting_rule: null,
      },
    ],
  });
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
  await press('Adicionar exercício');
  await press('Buscar na biblioteca de referência');
  await press('Reference Item Test');
  expect(pressables('Adicionar e usar neste treino')).toHaveLength(0);
  await press('Usar neste treino');
  expect(services.exerciseLibrary.addToCatalog).not.toHaveBeenCalled();
  expect(hasText('Material de referência')).toBe(false);
  expect(hasText('Reference Item Test')).toBe(true);
});

test('a failure loading the picked exercise is shown in the editor', async () => {
  services.exercises.list.mockResolvedValue(pageOf([]));
  services.exercises.get.mockRejectedValueOnce(new ApiError('network', 'x'));
  await openPatient();
  await press('Criar treino');
  await press('Adicionar exercício');
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
  expect(selectedTab()).toBe('Configurações');
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

test('the editor card shows the pt-BR name and the pencil opens the name page', async () => {
  services.exercises.list.mockResolvedValue(pageOf([translatedExercise]));
  await openPatient();
  await press('Criar treino');
  await selectExercise(
    'Item de referência de teste (original: Reference Item Test)',
  );
  // Only the name and the prescription fields: no steps, images or source.
  expect(hasText('Item de referência de teste')).toBe(true);
  expect(pressables('Ver orientações do exercício')).toHaveLength(0);
  expect(app.root.findAllByType(Image)).toHaveLength(0);
  expect(hasText('Adaptado de OpenExerciseBase (CC BY-NC 4.0).')).toBe(false);
  expect(hasText('Repetições e descanso valem para todas as séries')).toBe(
    false,
  );
  for (const label of ['Trocar exercício', 'Remover este exercício']) {
    expect(pressables(label)).toHaveLength(1);
  }

  // Back from the name page, the editor reloads that exercise.
  services.exercises.get.mockResolvedValue({
    ...translatedExercise,
    localization: { ...translation, name: 'Nome revisado de teste' },
  });
  await press('Editar nome do exercício');
  expect(hasText('Tradução para o português')).toBe(true);
  await press('Voltar para Exercício');
  expect(services.exercises.get).toHaveBeenLastCalledWith('exercise-imported');
  expect(hasText('Nome revisado de teste')).toBe(true);
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
  expect(hasText('Fonte: OpenExerciseBase')).toBe(false);
  expect(hasText('Adaptado de OpenExerciseBase')).toBe(false);
  expect(hasText('Imagem: OpenExerciseBase')).toBe(false);
  expect(pressables('Tradução em português')).toHaveLength(0);
  for (const label of ['Editar treino', 'Arquivar treino', 'Apagar treino']) {
    expect(pressables(label)).toHaveLength(1);
    expect(pressables(label)[0].findAllByType(Text)).toHaveLength(0);
  }
});

test('tabs switch without stacking screens and keep each tab history', async () => {
  await render();
  await press('Joana Teste');
  expect(pressables('Voltar para Pacientes')).toHaveLength(1);

  await press('Configurações');
  await press('Meu perfil');
  expect(selectedTab()).toBe('Configurações');
  // The patients stack is not kept underneath the settings tab.
  expect(pressables('Voltar para Pacientes')).toHaveLength(0);

  await press('Pacientes');
  expect(selectedTab()).toBe('Pacientes');
  expect(hasText('Informações pessoais')).toBe(false);
  // Back on the patient's details, where the tab was left.
  expect(pressables('Voltar para Pacientes')).toHaveLength(1);

  await press('Configurações');
  expect(hasText('Informações pessoais')).toBe(true);
  // Tapping the selected tab returns to its root.
  await press('Configurações');
  expect(hasText('Informações pessoais')).toBe(false);
  expect(pressables('Meu perfil')).toHaveLength(1);
});

test('professional tabs keep registration and follow-up details separate', async () => {
  await openRegistration();
  expect(hasText('Contato')).toBe(true);
  expect(hasText('Acesso ao aplicativo')).toBe(true);
  expect(pressables('Criar treino')).toHaveLength(0);
  expect(pressables('Escrever observação')).toHaveLength(0);
  expect(services.workouts.listForPatient).not.toHaveBeenCalled();
  expect(services.notes.list).not.toHaveBeenCalled();
  await press('Acompanhamento');
  expect(selectedTab()).toBe('Acompanhamento');
  expect(hasText('Joana Teste')).toBe(true);
  expect(hasText('Contato')).toBe(false);
  expect(hasText('Acesso ao aplicativo')).toBe(false);
  expect(pressables('Cadastrar paciente')).toHaveLength(0);
  expect(services.sessions.listForPatient).not.toHaveBeenCalled();
  await press('Joana Teste');
  expect(hasText('Treinos')).toBe(true);
  expect(hasText('Observações')).toBe(true);
  expect(hasText('Contato')).toBe(false);
  expect(hasText('Acesso ao aplicativo')).toBe(false);
  expect(pressables('Criar treino')).toHaveLength(1);
  expect(pressables('Escrever observação')).toHaveLength(1);
  await press('Pacientes');
  expect(selectedTab()).toBe('Pacientes');
  expect(hasText('Contato')).toBe(true);
  expect(pressables('Criar treino')).toHaveLength(0);
  await press('Acompanhamento');
  expect(selectedTab()).toBe('Acompanhamento');
  expect(hasText('Contato')).toBe(false);
  await press('Voltar para Acompanhamento');
  expect(hasText('Joana Teste')).toBe(true);
  expect(pressables('Criar treino')).toHaveLength(0);
});

test('the shared directory filters patients in both tabs', async () => {
  await render();
  await fill('Buscar paciente', 'sem resultado');
  expect(hasText('Nenhum paciente encontrado')).toBe(true);
  await press('Limpar busca');
  expect(pressables('Joana Teste')).toHaveLength(1);
  await press('Acompanhamento');
  await fill('Buscar paciente', 'sem resultado');
  expect(hasText('Nenhum paciente encontrado')).toBe(true);
  await press('Limpar busca');
  expect(pressables('Joana Teste')).toHaveLength(1);
});

test('follow-up updates the exclusive workout action after creation and removal', async () => {
  services.workouts.create.mockResolvedValue(draftWorkout);
  await openPatient();
  expect(pressables('Criar treino')).toHaveLength(1);
  expect(pressables('Ver sessões de progresso')).toHaveLength(0);
  await press('Criar treino');
  await selectExercise();
  await press('Lado esquerdo');
  await fill('Séries', '3');
  await fill('Repetições por série', '12');
  await fill('Descanso (em segundos)', '30');
  services.workouts.listForPatient.mockResolvedValue(pageOf([draftWorkout]));
  await saveWorkout();
  await press('Voltar para Paciente');
  expect(pressables('Criar treino')).toHaveLength(0);
  expect(pressables('Ver sessões de progresso')).toHaveLength(1);
  await press('Ver sessões de progresso');
  expect(services.sessions.listForPatient).toHaveBeenCalledWith('patient-1', {
    page_size: 10,
  });
  services.workouts.listForPatient.mockResolvedValue(pageOf([]));
  await press('Voltar para Joana Teste');
  expect(pressables('Criar treino')).toHaveLength(1);
  expect(pressables('Ver sessões de progresso')).toHaveLength(0);
});

test('follow-up does not assume an empty workout list during loading or failure', async () => {
  services.workouts.listForPatient.mockRejectedValueOnce(
    new ApiError('network', 'offline'),
  );
  await openPatient();
  expect(pressables('Criar treino')).toHaveLength(0);
  expect(pressables('Ver sessões de progresso')).toHaveLength(0);
  services.workouts.listForPatient.mockImplementation(
    () => new Promise(() => undefined),
  );
  await press('Tentar novamente');
  expect(pressables('Criar treino')).toHaveLength(0);
  expect(pressables('Ver sessões de progresso')).toHaveLength(0);
});

test('patient deletion uses a native destructive confirmation and preserves error feedback', async () => {
  services.patients.delete
    .mockRejectedValueOnce(new ApiError('network', 'offline'))
    .mockResolvedValueOnce(undefined);
  await openRegistration();
  await press('Excluir paciente');
  expect(lastNativeAlert()[0]).toBe('Excluir paciente');
  expect(
    lastNativeAlert()[2]?.find(button => button.text === 'Confirmar')?.style,
  ).toBe('destructive');
  expect(services.patients.delete).not.toHaveBeenCalled();
  await press('Cancelar');
  expect(services.patients.delete).not.toHaveBeenCalled();
  await press('Excluir paciente');
  await press('Confirmar');
  expect(services.patients.delete).toHaveBeenCalledWith('patient-1');
  expect(hasText('Paciente excluído.')).toBe(false);
  expect(hasText('Sem conexão com o servidor')).toBe(true);
  await press('Excluir paciente');
  await press('Confirmar');
  expect(hasText('Paciente excluído.')).toBe(true);
});

test('library search debounces typing, resets pagination and cancels drafts on closing filters', async () => {
  jest.useFakeTimers();
  try {
    services.exerciseLibrary.search.mockResolvedValue({
      ...libraryPage,
      pages: 2,
    });
    await openSettings('Biblioteca de referência');
    await press('Próxima página');
    expect(services.exerciseLibrary.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );
    const before = services.exerciseLibrary.search.mock.calls.length;
    await fill('Buscar exercícios (em inglês)', 'r');
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    await fill('Buscar exercícios (em inglês)', 'raise');
    await act(async () => {
      jest.advanceTimersByTime(349);
    });
    expect(services.exerciseLibrary.search).toHaveBeenCalledTimes(before);
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(services.exerciseLibrary.search).toHaveBeenLastCalledWith({
      query: 'raise',
      body_part: undefined,
      page: 1,
      page_size: 20,
    });
    await press('Filtrar exercícios');
    await press('Ombros');
    await press('Fechar filtros');
    expect(pressables('Remover filtro: Ombros')).toHaveLength(0);
    await press('Filtrar exercícios');
    expect(
      pressables('Todas as partes')[0].props.accessibilityState.checked,
    ).toBe(true);
    await press('Ombros');
    await press('Aplicar filtros');
    expect(services.exerciseLibrary.search).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: 'raise',
        body_part: 'shoulders',
        page: 1,
      }),
    );
    await press('Remover filtro: Ombros');
    expect(services.exerciseLibrary.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: 'raise', body_part: undefined }),
    );
    await press('Filtrar exercícios');
    await press('Ombros');
    await press('Aplicar filtros');
    await press('Filtrar exercícios');
    await press('Limpar filtros');
    expect(pressables('Remover filtro: Ombros')).toHaveLength(0);
    expect(services.exerciseLibrary.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: 'raise', body_part: undefined }),
    );
  } finally {
    jest.useRealTimers();
  }
});

test('notes have explicit edit and delete actions and delete only after native confirmation', async () => {
  services.notes.list.mockResolvedValue(pageOf([note]));
  services.notes.delete.mockResolvedValue(undefined);
  await openPatient();
  expect(pressables('Anotação de teste.')).toHaveLength(0);
  expect(pressables('Editar observação')).toHaveLength(1);
  expect(pressables('Excluir observação')).toHaveLength(1);
  await press('Excluir observação');
  expect(lastNativeAlert()[0]).toBe('Deseja excluir esta observação?');
  expect(
    lastNativeAlert()[2]?.map(button => [button.text, button.style]),
  ).toEqual([
    ['Cancelar', 'cancel'],
    ['Excluir', 'destructive'],
  ]);
  expect(services.notes.delete).not.toHaveBeenCalled();
  await press('Cancelar');
  expect(services.notes.delete).not.toHaveBeenCalled();
  await press('Excluir observação');
  services.notes.list.mockResolvedValue(pageOf([]));
  await act(async () => {
    pressNativeAlert('Excluir');
  });
  expect(services.notes.delete).toHaveBeenCalledWith('note-1');
  expect(hasText('Observação excluída.')).toBe(true);
  expect(hasText('Nenhuma observação registrada')).toBe(true);
  expect(pressables('Editar observação')).toHaveLength(0);
});

test('failed note deletion preserves the card and reports an error', async () => {
  services.notes.list.mockResolvedValue(pageOf([note]));
  services.notes.delete.mockRejectedValue(
    new ApiError('access_denied', 'denied', 403, 'note_author_required'),
  );
  await openPatient();
  await press('Excluir observação');
  await act(async () => {
    pressNativeAlert('Excluir');
  });
  expect(hasText('Somente o autor pode excluir esta observação.')).toBe(true);
  expect(hasText('Observação excluída.')).toBe(false);
  expect(pressables('Editar observação')).toHaveLength(1);
  expect(pressables('Excluir observação')).toHaveLength(1);
});

async function fillExercise(index: number, label: string, value: string) {
  const target = app.root
    .findAllByType(FormField)
    .filter(node => node.props.label === label)[index];
  expect(target).toBeDefined();
  await act(async () => target.props.onChangeText(value));
}
function exerciseValue(index: number, label: string) {
  return app.root
    .findAllByType(FormField)
    .filter(node => node.props.label === label)[index]?.props.value;
}
test('builds several cards in order and saves them together', async () => {
  const second = {
    ...exercise,
    id: 'exercise-2',
    name: 'Segundo exercício de teste',
    allowed_sides: ['right'],
  };
  services.exercises.list.mockResolvedValue(pageOf([exercise, second]));
  services.workouts.create.mockResolvedValue(draftWorkout);
  await openPatient();
  await press('Criar treino');
  await selectExercise();
  expect(hasText('Orientações gerais')).toBe(false);
  await press('Lado esquerdo');
  await press('Adicionar série');
  expect(field('Séries').props.value).toBe('1');
  expect(pressables('Remover série')[0].props.accessibilityState.disabled).toBe(
    true,
  );
  await press('Adicionar série');
  await press('Adicionar série');
  await press('Remover série');
  expect(field('Séries').props.value).toBe('2');
  await fill('Repetições por série', '6');
  await fill('Descanso (em segundos)', '15');
  await fill('Orientação para o paciente', 'Orientação do primeiro.');

  // The add button stays below the list and appends a new card.
  expect(pressables('Adicionar exercício')).toHaveLength(1);
  await press('Adicionar exercício');
  await fill('Buscar no catálogo', 'nao existe');
  expect(hasText('Nenhum exercício encontrado')).toBe(true);
  await press('Voltar para Treino');
  expect(exerciseValue(0, 'Séries')).toBe('2');
  expect(pressables('Remover este exercício')).toHaveLength(1);
  await selectExercise('Segundo exercício de teste');
  expect(pressables('Remover este exercício')).toHaveLength(2);
  expect(exerciseValue(0, 'Repetições por série')).toBe('6');
  expect(exerciseValue(1, 'Séries')).toBe('');
  await fillExercise(1, 'Séries', '4');
  await fillExercise(1, 'Repetições por série', '8');
  await fillExercise(1, 'Descanso (em segundos)', '20');
  await fillExercise(1, 'Orientação para o paciente', 'Orientação do segundo.');
  expect(pressables('Adicionar exercício')).toHaveLength(1);
  expect(services.workouts.create).not.toHaveBeenCalled();
  await saveWorkout();
  expect(services.workouts.create).toHaveBeenCalledTimes(1);
  expect(services.workouts.create).toHaveBeenCalledWith('patient-1', {
    instructions: null,
    items: [
      expect.objectContaining({
        position: 1,
        exercise_id: 'exercise-1',
        side: 'left',
        sets: 2,
        repetitions: 6,
        rest_duration_ms: 15000,
        professional_guidance: 'Orientação do primeiro.',
      }),
      expect.objectContaining({
        position: 2,
        exercise_id: 'exercise-2',
        side: 'right',
        sets: 4,
        repetitions: 8,
        rest_duration_ms: 20000,
        professional_guidance: 'Orientação do segundo.',
      }),
    ],
  });
  expect(hasText('Revisar treino')).toBe(true);
  expect(services.workouts.publish).not.toHaveBeenCalled();
});

test('removing a card keeps the others and can return to an empty workout', async () => {
  const second = {
    ...exercise,
    id: 'exercise-2',
    name: 'Segundo exercício de teste',
  };
  services.exercises.list.mockResolvedValue(pageOf([exercise, second]));
  await openPatient();
  await press('Criar treino');
  await selectExercise();
  await fill('Séries', '2');
  await selectExercise('Segundo exercício de teste');
  await fillExercise(1, 'Séries', '4');
  await fillExercise(1, 'Repetições por série', '8');
  await act(async () =>
    pressables('Remover este exercício')[0].props.onPress(),
  );
  expect(exerciseValue(0, 'Séries')).toBe('4');
  expect(exerciseValue(0, 'Repetições por série')).toBe('8');
  await press('Remover este exercício');
  expect(hasText('Adicione os exercícios do treino')).toBe(true);
  expect(pressables('Adicionar exercício')).toHaveLength(1);
  await saveWorkout();
  expect(services.workouts.create).not.toHaveBeenCalled();
});

test('changing an exercise keeps typed values and uses the only allowed side', async () => {
  const second = {
    ...exercise,
    id: 'exercise-2',
    name: 'Segundo exercício de teste',
    allowed_sides: ['right'],
  };
  services.exercises.list.mockResolvedValue(pageOf([exercise, second]));
  await openPatient();
  await press('Criar treino');
  await selectExercise();
  await press('Lado esquerdo');
  await fill('Séries', '2');
  await fill('Repetições por série', '6');
  await press('Trocar exercício');
  await press('Segundo exercício de teste');
  expect(exerciseValue(0, 'Séries')).toBe('2');
  expect(exerciseValue(0, 'Repetições por série')).toBe('6');
  // The new exercise allows only the right side: no selector is shown.
  expect(pressables('Lado esquerdo')).toHaveLength(0);
  expect(pressables('Lado direito')).toHaveLength(0);
});

test('an existing workout keeps its general instructions when saved again', async () => {
  const withInstructions: Workout = {
    ...draftWorkout,
    instructions: 'Texto preservado.',
  };
  services.workouts.listForPatient.mockResolvedValue(
    pageOf([withInstructions]),
  );
  services.workouts.get.mockResolvedValue(withInstructions);
  services.workouts.update.mockResolvedValue(withInstructions);
  await openPatient();
  await press('Treino · Rascunho');
  await press('Editar treino');
  expect(pressables('Orientações gerais (opcional)')).toHaveLength(0);
  await saveWorkout();
  expect(services.workouts.update).toHaveBeenCalledWith(
    'workout-1',
    expect.objectContaining({ instructions: 'Texto preservado.' }),
  );
});

test('catalog search includes exercises from subsequent API pages', async () => {
  const second = {
    ...exercise,
    id: 'exercise-2',
    name: 'Exercício da segunda página',
  };
  services.exercises.list.mockImplementation(params =>
    Promise.resolve({
      ...pageOf(params?.page === 2 ? [second] : [exercise]),
      total: 101,
      pages: 2,
    }),
  );
  services.exercises.get.mockResolvedValue(second);
  await openPatient();
  await press('Criar treino');
  await press('Adicionar exercício');
  await fill('Buscar no catálogo', 'segunda pagina');
  expect(services.exercises.list).toHaveBeenCalledWith({
    page: 2,
    page_size: 100,
  });
  await press('Exercício da segunda página');
  expect(services.exercises.get).toHaveBeenCalledWith('exercise-2');
  expect(pressables('Remover este exercício')).toHaveLength(1);
  expect(field('Séries').props.value).toBe('');
});

test('creates another workout for the same patient without replacing existing workouts', async () => {
  const second = { ...draftWorkout, id: 'workout-2' };
  services.workouts.listForPatient.mockResolvedValue(pageOf([draftWorkout]));
  services.workouts.create.mockResolvedValue(second);
  services.workouts.get.mockResolvedValue(second);
  await openPatient();
  expect(pressables('Treino · Rascunho')).toHaveLength(1);
  expect(pressables('Ver sessões de progresso')).toHaveLength(1);
  await press('Criar outro treino');
  expect(hasText('Adicione os exercícios do treino')).toBe(true);
  await selectExercise();
  await press('Lado esquerdo');
  await fill('Séries', '2');
  await fill('Repetições por série', '8');
  await fill('Descanso (em segundos)', '20');
  services.workouts.listForPatient.mockResolvedValue(
    pageOf([draftWorkout, second]),
  );
  await saveWorkout();
  expect(services.workouts.create).toHaveBeenCalledWith(
    'patient-1',
    expect.objectContaining({
      items: [
        expect.objectContaining({
          exercise_id: 'exercise-1',
          sets: 2,
          repetitions: 8,
        }),
      ],
    }),
  );
  expect(services.workouts.update).not.toHaveBeenCalled();
  await press('Voltar para Paciente');
  expect(pressables('Treino · Rascunho')).toHaveLength(2);
  expect(pressables('Criar outro treino')).toHaveLength(1);
});

test.each([
  ['published', 'Publicado'],
  ['archived', 'Arquivado'],
] as const)(
  'review icons preserve permissions for %s workouts',
  async (status, label) => {
    const current = { ...draftWorkout, status };
    services.workouts.listForPatient.mockResolvedValue(pageOf([current]));
    services.workouts.get.mockResolvedValue(current);
    await openPatient();
    await press(`Treino · ${label}`);
    expect(pressables('Editar treino')).toHaveLength(1);
    expect(pressables('Arquivar treino')).toHaveLength(
      status === 'archived' ? 0 : 1,
    );
    expect(pressables('Desarquivar treino')).toHaveLength(
      status === 'archived' ? 1 : 0,
    );
    expect(pressables('Apagar treino')).toHaveLength(
      status === 'archived' ? 1 : 0,
    );
  },
);
test('the delete review icon keeps its native confirmation before deleting a draft', async () => {
  services.workouts.listForPatient.mockResolvedValue(pageOf([draftWorkout]));
  services.workouts.delete.mockResolvedValue(undefined);
  await openPatient();
  await press('Treino · Rascunho');
  await press('Apagar treino');
  expect(lastNativeAlert()[0]).toBe('Apagar este treino?');
  expect(services.workouts.delete).not.toHaveBeenCalled();
  await press('Cancelar');
  expect(services.workouts.delete).not.toHaveBeenCalled();
  await press('Apagar treino');
  services.workouts.listForPatient.mockResolvedValue(pageOf([]));
  await press('Confirmar');
  expect(services.workouts.delete).toHaveBeenCalledWith('workout-1');
  expect(hasText('Treino apagado.')).toBe(true);
});

test('unarchives a workout after native confirmation and returns it to draft', async () => {
  const archived = { ...draftWorkout, status: 'archived' };
  services.workouts.listForPatient.mockResolvedValue(pageOf([archived]));
  services.workouts.get.mockResolvedValue(archived);
  services.workouts.unarchive.mockResolvedValue(draftWorkout);
  await openPatient();
  await press('Treino · Arquivado');
  await press('Desarquivar treino');
  expect(lastNativeAlert()[0]).toBe('Desarquivar este treino?');
  expect(
    lastNativeAlert()[2]?.find(button => button.text === 'Confirmar')?.style,
  ).toBe('default');
  await press('Cancelar');
  expect(services.workouts.unarchive).not.toHaveBeenCalled();
  await press('Desarquivar treino');
  services.workouts.get.mockResolvedValue(draftWorkout);
  await press('Confirmar');
  expect(services.workouts.unarchive).toHaveBeenCalledWith('workout-1');
  expect(services.workouts.publish).not.toHaveBeenCalled();
  expect(pressables('Publicar treino')).toHaveLength(1);
  expect(pressables('Desarquivar treino')).toHaveLength(0);
});
test('editing an archived workout only restores it to draft when saved', async () => {
  const archived = { ...draftWorkout, status: 'archived' };
  services.workouts.listForPatient.mockResolvedValue(pageOf([archived]));
  services.workouts.get.mockResolvedValue(archived);
  services.workouts.update.mockResolvedValue(draftWorkout);
  await openPatient();
  await press('Treino · Arquivado');
  await press('Editar treino');
  expect(field('Séries').props.value).toBe('3');
  expect(services.workouts.unarchive).not.toHaveBeenCalled();
  await saveWorkout();
  expect(services.workouts.update).toHaveBeenCalledWith(
    'workout-1',
    expect.anything(),
  );
  expect(services.workouts.publish).not.toHaveBeenCalled();
});
test('archived workout deletion preserves the session-history error', async () => {
  const archived = { ...draftWorkout, status: 'archived' };
  services.workouts.listForPatient.mockResolvedValue(pageOf([archived]));
  services.workouts.get.mockResolvedValue(archived);
  services.workouts.delete.mockRejectedValueOnce(
    new ApiError('conflict', 'history', 409, 'workout_has_sessions'),
  );
  await openPatient();
  await press('Treino · Arquivado');
  await press('Apagar treino');
  await press('Confirmar');
  expect(services.workouts.delete).toHaveBeenCalledWith('workout-1');
  expect(
    hasText('Este treino já tem sessões registradas e não pode ser apagado.'),
  ).toBe(true);
  expect(pressables('Desarquivar treino')).toHaveLength(1);
});
