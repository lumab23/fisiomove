import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

/** Disable navigation motion globally, including interactive back swipes. */
export const instantTransition = {
  animation: 'none',
  animationDuration: 0,
  gestureEnabled: false,
  fullScreenGestureEnabled: false,
} as const satisfies NativeStackNavigationOptions;

/** Only the layering differs; every route opens and closes instantly. */
export type Transition = 'push' | 'modal' | 'confirmation';
export function transitionOptions(
  transition: Transition,
): NativeStackNavigationOptions {
  return {
    ...instantTransition,
    presentation: transition === 'push' ? 'card' : 'fullScreenModal',
  };
}
