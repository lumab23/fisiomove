import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { DemoProvider } from '../src/demo/DemoContext';
import { seedState, type DemoState } from '../src/demo/model';
import { FrontendNavigator } from '../src/navigation/FrontendNavigator';

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
jest.mock('../src/features/vision/LocalPoseCamera', () => ({
  LocalPoseCamera: () => null,
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

let app: ReactTestRenderer.ReactTestRenderer;

async function render(
  props: React.ComponentProps<typeof FrontendNavigator> = {},
  initialState: DemoState = seedState,
) {
  await act(async () => {
    app = ReactTestRenderer.create(
      <DemoProvider initialState={initialState}>
        <FrontendNavigator {...props} />
      </DemoProvider>,
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

async function press(label: string, role?: string) {
  const target = app.root.find(
    node =>
      typeof node.props.onPress === 'function' &&
      node.props.accessibilityLabel === label &&
      (!role || node.props.accessibilityRole === role),
  );
  await act(async () => target.props.onPress());
}

async function pressTab(label: string) {
  const [target] = app.root.findAll(
    node =>
      typeof node.props.onPress === 'function' &&
      node.props.accessibilityLabel === `Aba ${label}`,
  );
  await act(async () => target.props.onPress());
}

afterEach(async () => {
  mockCamera.initial = 'not-determined';
  mockCamera.result = 'authorized';
  await act(async () => app.unmount());
});

test('home prioritises the prescribed workout and starts the session flow', async () => {
  await render();
  expect(hasText('Olá, Maria!')).toBe(true);
  expect(hasText('TREINO DE HOJE')).toBe(true);
  expect(hasText('Ver área profissional')).toBe(false);
  await press('Iniciar treino');
  expect(hasText('Prepare o celular')).toBe(true);
});

test('home shows an empty state when no workout is published', async () => {
  await render(
    {},
    {
      ...seedState,
      patients: seedState.patients.map(p => ({ ...p, published: false })),
    },
  );
  expect(hasText('Nenhum treino publicado')).toBe(true);
  expect(hasText('TREINO DE HOJE')).toBe(false);
});

test('tabs reach exercises sections and profile', async () => {
  await render();
  await pressTab('Exercícios');
  expect(hasText('Exercícios prescritos')).toBe(true);
  await press('Histórico', 'tab');
  expect(hasText('Nenhuma sessão ainda')).toBe(true);
  await press('Progresso', 'tab');
  expect(hasText('Seu resumo aparecerá aqui')).toBe(true);
  await pressTab('Perfil');
  expect(hasText('Maria Oliveira')).toBe(true);
  expect(hasText('Meu fisioterapeuta')).toBe(true);
  expect(hasText('Área profissional (demo)')).toBe(true);
});

test('home link opens the progress section of the exercises tab', async () => {
  await render();
  await press('Ver histórico e progresso');
  expect(hasText('Seu resumo aparecerá aqui')).toBe(true);
});

test('authenticated patients do not see the professional demo', async () => {
  await render({
    professionalDemo: false,
    accountLabel: 'Sair da conta',
    accountEmail: 'paciente@example.com',
    onAccount: jest.fn(),
  });
  await pressTab('Perfil');
  expect(hasText('Área profissional (demo)')).toBe(false);
  expect(hasText('paciente@example.com')).toBe(true);
  expect(hasText('Sair da conta')).toBe(true);
  expect(hasText('Entrar com minha conta')).toBe(false);
});

test('a completed session appears on home, history and progress', async () => {
  const session = {
    id: 'demo-1',
    patientId: 'maria',
    patientName: 'Maria Oliveira',
    date: '2026-11-05T12:00:00.000Z',
    repetitions: 8 as const,
    total: 16,
    completed: true,
  };
  await render({}, { ...seedState, sessions: [session] });
  expect(hasText('16 de 16 repetições')).toBe(true);
  await pressTab('Exercícios');
  await press('Progresso', 'tab');
  expect(hasText('Sessões concluídas')).toBe(true);
  expect(hasText('Meta do treino concluída')).toBe(true);
});

test('profile shows the physiotherapist contact and opens their details', async () => {
  await render();
  await pressTab('Perfil');
  expect(hasText('Dra. Ana Ribeiro')).toBe(true);
  expect(hasText('Dados de exemplo')).toBe(true);
  await press('Informações');
  expect(hasText('Registro profissional')).toBe(true);
});

test('immersive session counts only taps and unlocks the series at the goal', async () => {
  await render();
  await press('Iniciar treino');
  await press('Continuar');
  await press('Ativar câmera');
  await press('Começar exercício');
  expect(hasText('Repetição')).toBe(true);
  expect(hasText('Contar repetição')).toBe(true);
  for (let i = 0; i < 8; i += 1) {
    await press('Contar repetição');
  }
  expect(hasText('Concluir série 1')).toBe(true);
  expect(hasText('Contar repetição')).toBe(false);
});

async function openCameraStep() {
  await press('Iniciar treino');
  await press('Continuar');
}

test('asks for the camera with one clear action and lets the patient decline', async () => {
  await render();
  await openCameraStep();
  expect(hasText('Vamos ativar sua câmera?')).toBe(true);
  expect(hasText('Ativar câmera')).toBe(true);
  await press('Agora não');
  expect(hasText('Prepare o celular')).toBe(true);
});

test('a denied request stays in the flow with guidance instead of retrying', async () => {
  mockCamera.result = 'denied';
  await render();
  await openCameraStep();
  await press('Ativar câmera');
  expect(hasText('A câmera está desativada')).toBe(true);
  expect(hasText('Ativar câmera')).toBe(false);
  expect(hasText('Tentar')).toBe(false);
  await press('Como permitir a câmera');
  expect(hasText('Abrir Ajustes do celular')).toBe(true);
  await press('Voltar aos exercícios');
  expect(hasText('Exercícios prescritos')).toBe(true);
});

test('a previously blocked camera shows settings guidance right away', async () => {
  mockCamera.initial = 'denied';
  await render();
  await openCameraStep();
  expect(hasText('A câmera está desativada')).toBe(true);
  expect(hasText('Vamos ativar sua câmera?')).toBe(false);
});

test('a restricted camera explains the block without a permission request', async () => {
  mockCamera.initial = 'restricted';
  await render();
  await openCameraStep();
  expect(hasText('A câmera está bloqueada neste celular')).toBe(true);
  expect(hasText('Ativar câmera')).toBe(false);
});

test('an already allowed camera skips the permission step', async () => {
  mockCamera.initial = 'authorized';
  await render();
  await openCameraStep();
  expect(hasText('Começar exercício')).toBe(true);
});
