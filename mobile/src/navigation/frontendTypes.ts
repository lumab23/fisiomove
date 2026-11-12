import {
  useNavigation,
  type CompositeNavigationProp,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { UUID } from '../contracts/common';
import type {
  PatientStackParamList,
  PhysiotherapistStackParamList,
} from './types';
export type ExerciseSection = 'workout' | 'history' | 'progress';
export type PatientTabParamList = {
  PatientHome: undefined;
  PatientExercises: { section?: ExerciseSection } | undefined;
  PatientSettings: undefined;
};
/**
 * Route IDs follow the shared contracts in `./types` (LMI-07). Before the
 * session exists, execution routes carry the workout and its revision; after
 * "Começar exercício" they carry only the local `clientSessionId`.
 * Each professional tab has its own list and detail route. Routes carry IDs only: never names, texts or
 * temporary passwords.
 */
export type FrontendStackParamList = {
  PatientTabs: NavigatorScreenParams<PatientTabParamList> | undefined;
  PatientPreparation: PatientStackParamList['PatientPreparation'];
  PhysiotherapistInfo: undefined;
  /** Read-only notes from the physiotherapist (DEC-015). */
  PatientNotes: undefined;
  /** Patient's own profile information. */
  PatientSelfProfile: undefined;
  CameraPermission: PatientStackParamList['PatientPreparation'];
  Calibration: PatientStackParamList['PatientPreparation'];
  PatientExercise: PatientStackParamList['PatientExercise'];
  DemoAutoCount: undefined;
  /** "Como fazer" of the current item; opening it pauses the session. */
  MovementGuidance: ActiveSessionParams;
  ConfirmExit: ActiveSessionParams;
  SessionInterrupted: ActiveSessionParams;
  PatientCompletion: PatientStackParamList['PatientCompletion'];
  PatientList: undefined;
  PatientCreate: undefined;
  PatientDetails: PhysiotherapistStackParamList['PatientDetails'];
  PatientEdit: PhysiotherapistStackParamList['PatientEdit'];
  WorkoutConfiguration: PhysiotherapistStackParamList['WorkoutConfiguration'] & {
    /** Catalog exercise chosen in the library for one draft item. */
    picked?: PickedExercise;
  };
  WorkoutExercisePicker: LibraryPickTarget;
  WorkoutReview: { patientId: UUID; workoutId: UUID };
  PatientMonitoring: undefined;
  PatientFollowUp: { patientId: UUID };
  ProfessionalPatientProgress: { patientId: UUID };
  NoteEditor: { patientId: UUID; noteId?: UUID };
  ProfessionalSettings: undefined;
  ProfessionalProfile: undefined;
  /** `pickFor` opens the library to choose an exercise for the editor. */
  ExerciseLibrary: { pickFor?: LibraryPickTarget } | undefined;
  /** Provider id of a reference item (not a catalog exercise UUID). */
  ExerciseLibraryDetail: { externalId: string; pickFor?: LibraryPickTarget };
  /** pt-BR text of a catalog exercise (DEC-011); catalog exercise UUID. */
  CatalogExerciseTranslation: { exerciseId: UUID; origin?: 'settings' };
};
/** Routes of a session already prepared on this device. */
export type ActiveSessionParams = { clientSessionId: UUID };
/**
 * Workout editor item waiting for an exercise from the library. `itemKey` is
 * the editor's local key for the draft item (no names or texts).
 */
export type LibraryPickTarget = {
  patientId: UUID;
  workoutId?: UUID;
  itemKey: string;
};
export type PickedExercise = { itemKey: string; exerciseId: UUID };
export type FrontendNavigation =
  NativeStackNavigationProp<FrontendStackParamList>;
export type PatientTabNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<PatientTabParamList>,
  FrontendNavigation
>;
export function useFrontendNavigation() {
  return useNavigation<FrontendNavigation>();
}
export function usePatientTabNavigation() {
  return useNavigation<PatientTabNavigation>();
}
/**
 * State accepted by `reset`. Routes taken from the current state keep their
 * key and nested state, which the runtime accepts as they are.
 */
export type FrontendResetState = Parameters<FrontendNavigation['reset']>[0];
/**
 * The tabs route already in the stack. Reusing it keeps the state of the tabs
 * while leaving the flow instantly without creating another tabs route.
 */
export function patientTabsRoute(navigation: FrontendNavigation) {
  return navigation
    .getState()
    ?.routes.find(route => route.name === 'PatientTabs');
}
/** Leaves the current flow with the tabs as the only route. */
export function resetToPatientTabs(
  navigation: FrontendNavigation,
  section?: ExerciseSection,
) {
  const params: FrontendStackParamList['PatientTabs'] = section
    ? { screen: 'PatientExercises', params: { section } }
    : { screen: 'PatientHome' };
  const tabs = patientTabsRoute(navigation);
  navigation.reset({
    index: 0,
    routes: [tabs ? { ...tabs, params } : { name: 'PatientTabs', params }],
  } as FrontendResetState);
}
