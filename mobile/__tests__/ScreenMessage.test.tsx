import React, { useEffect } from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Screen } from '../src/components/Screen';
import {
  ScreenMessageProvider,
  useScreenMessage,
} from '../src/components/ScreenMessage';

jest.mock('../src/navigation/frontendTypes', () => ({
  useFrontendNavigation: () => ({
    canGoBack: () => true,
    goBack: jest.fn(),
    navigate: jest.fn(),
    getState: () => ({ routes: [{ name: 'PatientHome' }], index: 0 }),
  }),
}));
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ name: 'PatientHome', params: {} }),
  useFocusEffect: () => undefined,
  useIsFocused: () => true,
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

function Show({ text, tone }: { text: string; tone?: 'info' | 'error' }) {
  const { show } = useScreenMessage();
  useEffect(() => show(text, tone), [show, text, tone]);
  return null;
}

let app: ReactTestRenderer.ReactTestRenderer;
beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  await act(async () => app.unmount());
  jest.useRealTimers();
});

async function render(children: React.ReactNode) {
  await act(async () => {
    app = ReactTestRenderer.create(
      <ScreenMessageProvider>
        <Screen title="Teste">{children}</Screen>
      </ScreenMessageProvider>,
    );
  });
}

function alerts() {
  return app.root
    .findAllByType(Text)
    .filter(node => node.props.accessibilityRole === 'alert');
}

test('Screen shows a message without the demonstration and clears it', async () => {
  await render(<Show text="Observação salva." />);
  expect(alerts()).toHaveLength(1);
  expect(alerts()[0].props.children).toBe('Observação salva.');
  await act(async () => {
    jest.advanceTimersByTime(2800);
  });
  expect(alerts()).toHaveLength(0);
});
