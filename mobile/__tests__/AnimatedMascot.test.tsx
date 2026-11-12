import React from 'react';
import { AccessibilityInfo, Animated, AppState } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { AnimatedMascot } from '../src/components/AnimatedMascot';

let app: ReactTestRenderer.ReactTestRenderer | undefined;
let loopStop: jest.Mock;

beforeEach(() => {
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true,
  });
  loopStop = jest.fn();
  const loop = Animated.loop;
  jest.spyOn(Animated, 'loop').mockImplementation((...args) => {
    const animation = loop(...args);
    return { ...animation, start: () => undefined, stop: loopStop };
  });
});

afterEach(async () => {
  await act(async () => app?.unmount());
  app = undefined;
  jest.restoreAllMocks();
});

async function render(reduceMotion: boolean) {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(reduceMotion);
  await act(async () => {
    app = ReactTestRenderer.create(<AnimatedMascot kind="home" />);
  });
  return app!;
}

test('starts idle breathing and stops it when unmounted', async () => {
  const rendered = await render(false);
  expect(Animated.loop).toHaveBeenCalledTimes(1);
  await act(async () => rendered.unmount());
  app = undefined;
  expect(loopStop).toHaveBeenCalled();
});

test('stays still when reduce motion is enabled', async () => {
  await render(true);
  expect(Animated.loop).not.toHaveBeenCalled();
});

test('reacts to a tap without exposing a screen reader control', async () => {
  const rendered = await render(false);
  const [target] = rendered.root.findAll(
    node =>
      typeof node.props.onPress === 'function' &&
      node.props.accessible === false,
  );
  expect(target).toBeDefined();
  await act(async () => target.props.onPress());
});

test('mouth remains visible and mounted during tap reaction (carinho) and repeated taps', async () => {
  const rendered = await render(false);
  const [target] = rendered.root.findAll(
    node =>
      typeof node.props.onPress === 'function' &&
      node.props.accessible === false,
  );
  expect(target).toBeDefined();

  const findMouth = () =>
    rendered.root.findAll(
      node =>
        node.props.d === 'M43 60C49 66 55.3333 66 62 60' &&
        node.props.fill === 'none',
    );

  // Mouth exists before tap
  expect(findMouth().length).toBe(1);

  // Tap to pet (carinho)
  await act(async () => target.props.onPress());
  expect(findMouth().length).toBe(1);

  // Rapid repeated taps
  await act(async () => {
    target.props.onPress();
    target.props.onPress();
    target.props.onPress();
  });
  expect(findMouth().length).toBe(1);
});
