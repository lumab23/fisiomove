/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('../src/app/AppProviders', () => {
  const ReactModule = require('react');
  const { Text } = require('react-native');
  return {
    AppProviders: () =>
      ReactModule.createElement(Text, null, 'Aplicação carregada'),
  };
});

test('renders correctly', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  expect(renderer!.toJSON()).not.toBeNull();
});
