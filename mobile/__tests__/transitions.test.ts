import {
  resetToPatientTabs,
  type FrontendNavigation,
} from '../src/navigation/frontendTypes';
import { transitionOptions } from '../src/navigation/transitions';

test.each(['push', 'modal', 'confirmation'] as const)(
  '%s routes disable native navigation animations',
  kind => {
    expect(transitionOptions(kind)).toEqual({
      animation: 'none',
      animationDuration: 0,
      gestureEnabled: false,
      fullScreenGestureEnabled: false,
      presentation: kind === 'push' ? 'card' : 'fullScreenModal',
    });
  },
);

test('leaving a patient flow reuses the tabs route, without losing tab state', () => {
  const tabs = { key: 'tabs-1', name: 'PatientTabs', state: { index: 1 } };
  const reset = jest.fn();
  const navigation = {
    getState: () => ({
      routes: [tabs, { key: 'prep-1', name: 'PatientPreparation' }],
    }),
    reset,
  } as unknown as FrontendNavigation;
  resetToPatientTabs(navigation, 'workout');
  expect(reset).toHaveBeenCalledWith({
    index: 0,
    routes: [
      {
        ...tabs,
        params: { screen: 'PatientExercises', params: { section: 'workout' } },
      },
    ],
  });
});
