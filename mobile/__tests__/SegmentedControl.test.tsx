import React from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SegmentedControl } from '../src/components/SegmentedControl';
import { layout } from '../src/theme/theme';

const options = [
  ['a', 'Primeira'],
  ['b', 'Segunda'],
] as const;

async function render(compact: boolean) {
  let app: ReactTestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    app = ReactTestRenderer.create(
      <SegmentedControl
        options={options}
        value="a"
        onChange={() => undefined}
        accessibilityLabel="Filtro"
        compact={compact}
      />,
    );
  });
  return app!;
}

function optionMinHeights(app: ReactTestRenderer.ReactTestRenderer) {
  return app.root
    .findAll(
      node => node.props.accessibilityRole === 'tab' && !!node.props.style,
    )
    .map(node => {
      const style =
        typeof node.props.style === 'function'
          ? node.props.style({ pressed: false })
          : node.props.style;
      return StyleSheet.flatten(style).minHeight;
    });
}

test('compact variant respects layout.compactControlHeight', async () => {
  const app = await render(true);
  const heights = optionMinHeights(app);
  expect(heights.length).toBeGreaterThan(0);
  heights.forEach(height => expect(height).toBe(layout.compactControlHeight));
  expect(layout.compactControlHeight).toBeGreaterThanOrEqual(48);
});

test('default variant keeps the minimum touch target of 48', async () => {
  const app = await render(false);
  const heights = optionMinHeights(app);
  expect(heights.length).toBeGreaterThan(0);
  heights.forEach(height => expect(height).toBeGreaterThanOrEqual(48));
});
