import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import App from '../App';
jest.mock('../src/app/AppProviders', () => ({ AppProviders: () => null }));
jest.mock('../src/navigation/FrontendNavigator', () => {
  const { Text } = require('react-native');
  return { FrontendNavigator: () => <Text>Demonstração navegável</Text> };
});
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
test('opens the local frontend without mounting authentication or API providers', async () => {
  let app!: ReactTestRenderer.ReactTestRenderer;
  await act(() => {
    app = ReactTestRenderer.create(<App />);
  });
  expect(JSON.stringify(app.toJSON())).toContain('Demonstração navegável');
  await act(() => app.unmount());
});
