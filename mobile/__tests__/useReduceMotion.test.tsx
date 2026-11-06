import React from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useReduceMotion } from '../src/accessibility/useReduceMotion';

let listener: ((value: boolean) => void) | undefined;
const remove = jest.fn();

function Probe() {
  return <Text>{String(useReduceMotion())}</Text>;
}

beforeEach(() => {
  listener = undefined;
  remove.mockClear();
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockImplementation((_event, handler) => {
      listener = handler as (value: boolean) => void;
      return { remove } as unknown as ReturnType<
        typeof AccessibilityInfo.addEventListener
      >;
    });
});

afterEach(() => jest.restoreAllMocks());

async function render(initial: Promise<boolean>) {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockReturnValue(initial);
  let app!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    app = ReactTestRenderer.create(<Probe />);
  });
  const text = () => app.root.findByType(Text).props.children;
  return { app, text };
}

test('is unknown until the system answers, then follows it', async () => {
  let answer!: (value: boolean) => void;
  const { app, text } = await render(
    new Promise<boolean>(resolve => {
      answer = resolve;
    }),
  );
  expect(text()).toBe('null');
  await act(async () => answer(true));
  expect(text()).toBe('true');
  await act(async () => app.unmount());
});

test('reacts to the setting changing and unsubscribes on unmount', async () => {
  const { app, text } = await render(Promise.resolve(false));
  expect(text()).toBe('false');
  await act(async () => listener?.(true));
  expect(text()).toBe('true');
  await act(async () => app.unmount());
  expect(remove).toHaveBeenCalled();
});

test('stays unknown when the system query fails', async () => {
  const { app, text } = await render(Promise.reject(new Error('unavailable')));
  expect(text()).toBe('null');
  await act(async () => app.unmount());
});
