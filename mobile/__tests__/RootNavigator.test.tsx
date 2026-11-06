import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import type { AuthenticatedUser } from '../src/contracts/auth';
import { RootNavigator } from '../src/navigation/RootNavigator';

const mockAuth: {
  status: string;
  user: AuthenticatedUser | null;
  busy: boolean;
  login: jest.Mock;
  logout: jest.Mock;
} = {
  status: 'unauthenticated',
  user: null,
  busy: false,
  login: jest.fn(),
  logout: jest.fn().mockResolvedValue(undefined),
};
jest.mock('../src/auth/AuthContext', () => ({ useAuth: () => mockAuth }));
// Reports which flow was mounted.
jest.mock('../src/navigation/FrontendNavigator', () => {
  const { Text } = require('react-native');
  return {
    FrontendNavigator: ({ flow }: { flow: string }) => (
      <Text>{`${flow}:mounted`}</Text>
    ),
  };
});
jest.mock('../src/sync/SessionSyncContext', () => ({
  useSessionSync: () => ({}),
}));
jest.mock('../src/components/ScreenMessage', () => ({
  useScreenMessage: () => ({ show: jest.fn(), clear: jest.fn() }),
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

const user: AuthenticatedUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'pessoa@example.com',
  role: 'patient',
  is_active: true,
  must_change_password: false,
  created_at: '2026-10-25T00:00:00Z',
  updated_at: '2026-10-25T00:00:00Z',
};

let app: ReactTestRenderer.ReactTestRenderer;
afterEach(async () => {
  mockAuth.status = 'unauthenticated';
  mockAuth.user = null;
  await act(async () => app.unmount());
});

async function render() {
  await act(async () => {
    app = ReactTestRenderer.create(<RootNavigator />);
  });
  return JSON.stringify(app.toJSON());
}

test('without a session the app opens on the welcome screen', async () => {
  const json = await render();
  expect(json).toContain('Olá! Vamos nos movimentar?');
  expect(json).toContain('Entrar');
  expect(json).toContain('Primeiro acesso');
  expect(json).not.toContain('patient:');
});

test('the patient flow mounts the patient stack', async () => {
  mockAuth.status = 'authenticated';
  mockAuth.user = user;
  expect(await render()).toContain('patient:mounted');
});

test('the physiotherapist flow mounts the professional stack', async () => {
  mockAuth.status = 'authenticated';
  mockAuth.user = { ...user, role: 'physiotherapist' };
  expect(await render()).toContain('physiotherapist:mounted');
});

test('each role reaches only its own routes', () => {
  const { patientScreens, physiotherapistScreens } = jest.requireActual(
    '../src/navigation/FrontendNavigator',
  );
  const patient = Object.keys(patientScreens);
  const professional = Object.keys(physiotherapistScreens);
  expect(patient.filter(name => professional.includes(name))).toEqual([]);
  // Execution of the published workout lives in the patient stack; voice
  // commands, pause and rest screens are out of the flow (DEC-009, Q-T3).
  expect(patient.sort()).toEqual([
    'Calibration',
    'CameraPermission',
    'ConfirmExit',
    'MovementGuidance',
    'PatientCompletion',
    'PatientExercise',
    'PatientPreparation',
    'PatientTabs',
    'PhysiotherapistInfo',
    'SessionInterrupted',
  ]);
  for (const name of [
    'VoicePermission',
    'SessionPause',
    'SessionRest',
    'CameraAdjustment',
  ]) {
    expect(patient).not.toContain(name);
    expect(professional).not.toContain(name);
  }
  // The reference library and patient management are professional only.
  for (const name of [
    'PatientList',
    'PatientDetails',
    'PatientMonitoring',
    'ProfessionalProfile',
    'ExerciseLibrary',
    'ExerciseLibraryDetail',
  ]) {
    expect(professional).toContain(name);
    expect(patient).not.toContain(name);
  }
  expect(professional).not.toContain('PatientTabs');
});
