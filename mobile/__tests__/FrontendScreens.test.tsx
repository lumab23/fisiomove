import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { DemoProvider } from '../src/demo/DemoContext';
import { FormField } from '../src/components/FormField';
import { Button, Link } from '../src/ui';
import { PatientCreateScreen } from '../src/screens/professional/PatientCreateScreen';
import { NoteEditorScreen } from '../src/screens/professional/NoteScreens';
import { WorkoutConfigurationScreen } from '../src/screens/professional/WorkoutScreens';
const mockNavigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  canGoBack: () => true,
  getState: () => ({ routes: [{ name: 'PatientDetails' }], index: 0 }),
};
jest.mock('../src/navigation/frontendTypes', () => ({
  useFrontendNavigation: () => mockNavigation,
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: {} }),
  useFocusEffect: () => undefined,
}));
let app: ReactTestRenderer.ReactTestRenderer;
async function render(screen: React.ReactNode) {
  await act(() => {
    app = ReactTestRenderer.create(<DemoProvider>{screen}</DemoProvider>);
  });
}
async function click(label: string) {
  const target = [
    ...app.root.findAllByType(Button),
    ...app.root.findAllByType(Link),
  ].find(node => node.props.label === label);
  if (!target) {
    throw new Error(`Missing button: ${label}`);
  }
  await act(() => target.props.onPress());
}
async function fill(label: string, value: string) {
  await act(() =>
    app.root
      .findAllByType(FormField)
      .find(node => node.props.label === label)!
      .props.onChangeText(value),
  );
}
afterEach(async () => {
  jest.clearAllMocks();
  if (app) {
    await act(() => app.unmount());
  }
});
test('registration reports errors and creates a selected patient before configuring their workout', async () => {
  await render(<PatientCreateScreen />);
  await click('Cadastrar e configurar treino');
  expect(JSON.stringify(app.toJSON())).toContain('Informe o nome');
  expect(mockNavigation.replace).not.toHaveBeenCalled();
  await fill('NOME', 'Ana Santos');
  await fill('IDENTIFICAÇÃO', 'Paciente 002');
  await fill('CONTATO', '(85) 90000-0000');
  await click('Cadastrar e configurar treino');
  expect(mockNavigation.replace).toHaveBeenCalledWith('WorkoutConfiguration');
});
test('empty observation cannot be submitted; reviewing preserves user text', async () => {
  await render(<NoteEditorScreen />);
  await click('Revisar observação');
  expect(JSON.stringify(app.toJSON())).toContain('Escreva uma orientação');
  await fill(
    'Sua orientação',
    'Orientação fictícia digitada pela profissional.',
  );
  await click('Revisar observação');
  expect(mockNavigation.navigate).toHaveBeenCalledWith('NoteReview', {
    text: 'Orientação fictícia digitada pela profissional.',
  });
});
test('workout editing is explicit and passes the selected value to publication review', async () => {
  await render(<WorkoutConfigurationScreen />);
  await click('Usar 10 repetições  ›');
  await click('Salvar alterações');
  expect(mockNavigation.navigate).toHaveBeenCalledWith('WorkoutReview', {
    repetitions: 10,
  });
});
