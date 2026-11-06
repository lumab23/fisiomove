import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import App from '../App';
jest.mock('../src/app/AppProviders', () => {
  const { Text } = require('react-native');
  return { AppProviders: () => <Text>Provedores autenticados</Text> };
});
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
test('opens the authentication providers', async () => {
  let app!: ReactTestRenderer.ReactTestRenderer;
  await act(() => {
    app = ReactTestRenderer.create(<App />);
  });
  const json = JSON.stringify(app.toJSON());
  expect(json).toContain('Provedores autenticados');
  expect(json).not.toContain('Voltar à demonstração');
  await act(() => app.unmount());
});
