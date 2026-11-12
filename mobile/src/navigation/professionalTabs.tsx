import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react';
import type { FrontendNavigation, FrontendResetState } from './frontendTypes';

export type ProfessionalTab = 'patients' | 'monitoring' | 'settings';
type StackRoutes = ReturnType<FrontendNavigation['getState']>['routes'];

/** Root route of each physiotherapist tab. */
export const professionalTabRoots = {
  patients: 'PatientList',
  monitoring: 'PatientMonitoring',
  settings: 'ProfessionalSettings',
} as const satisfies Record<ProfessionalTab, string>;

/**
 * Tab highlighted for the current route. The library belongs to
 * "Configurações", except when it was opened from the workout editor to pick
 * an exercise (`pickFor`): then it is part of the monitoring flow.
 */
export function professionalTabFor(
  route: string,
  params?: object,
): ProfessionalTab {
  if (
    [
      'PatientMonitoring',
      'PatientFollowUp',
      'ProfessionalPatientProgress',
      'WorkoutConfiguration',
      'WorkoutExercisePicker',
      'WorkoutReview',
      'NoteEditor',
    ].includes(route)
  ) {
    return 'monitoring';
  }
  if (route === 'CatalogExerciseTranslation') {
    return (params as { origin?: string } | undefined)?.origin === 'settings'
      ? 'settings'
      : 'monitoring';
  }
  if (route === 'ProfessionalSettings' || route === 'ProfessionalProfile') {
    return 'settings';
  }
  if (route === 'ExerciseLibrary' || route === 'ExerciseLibraryDetail') {
    const pickFor = (params as { pickFor?: unknown } | undefined)?.pickFor;
    return pickFor ? 'monitoring' : 'settings';
  }
  return 'patients';
}

type TabSwitching = {
  /** Last stack of each tab, restored when the tab is selected again. */
  history: Map<ProfessionalTab, StackRoutes>;
};

const TabSwitchingContext = createContext<TabSwitching | null>(null);

/**
 * The physiotherapist tabs live in the single stack: switching tabs swaps the
 * stack for the selected tab's own history without any animation, as the iOS
 * tab bar does. All stack transitions are globally disabled.
 */
export function useProfessionalTabSwitching() {
  const history = useRef(new Map<ProfessionalTab, StackRoutes>()).current;
  const value = useMemo(() => ({ history }), [history]);
  return { value };
}

export function ProfessionalTabSwitchingProvider({
  value,
  children,
}: PropsWithChildren<{ value: TabSwitching }>) {
  return (
    <TabSwitchingContext.Provider value={value}>
      {children}
    </TabSwitchingContext.Provider>
  );
}

/**
 * Opens a physiotherapist tab:
 * - another tab: restores its last stack instantly (its state is kept);
 * - the tab already selected: returns to its root, like tapping an iOS tab.
 */
export function useOpenProfessionalTab(navigation: FrontendNavigation) {
  const switching = useContext(TabSwitchingContext);
  return (target: ProfessionalTab) => {
    const state = navigation.getState();
    const routes = state.routes.slice(0, state.index + 1);
    const current = routes[routes.length - 1];
    const active = professionalTabFor(current.name, current.params);
    const root = professionalTabRoots[target];
    const reset = (next: StackRoutes) => {
      navigation.reset({
        index: next.length - 1,
        routes: next,
      } as FrontendResetState);
    };

    if (target === active) {
      if (routes.length === 1 && current.name === root) {
        return;
      }
      if (routes[0].name === root) {
        navigation.popToTop();
      } else {
        reset([{ key: `${root}-root`, name: root }] as StackRoutes);
      }
      return;
    }

    switching?.history.set(active, routes);
    reset(
      switching?.history.get(target) ??
        ([{ key: `${root}-root`, name: root }] as StackRoutes),
    );
  };
}
