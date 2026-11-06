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
  PatientProfile: undefined;
};
/**
 * Route IDs follow the shared contracts in `./types` (LMI-07). Before the
 * session exists, execution routes carry the workout and its revision; after
 * "Começar exercício" they carry only the local `clientSessionId`.
 * `PatientMonitoring` stays optional because the "Acompanhamento" tab can open
 * it without a selected patient. Routes carry IDs only: never names, texts or
 * temporary passwords.
 */
export type FrontendStackParamList = {
  PatientTabs: NavigatorScreenParams<PatientTabParamList> | undefined;
  PatientPreparation: PatientStackParamList['PatientPreparation'];
  PhysiotherapistInfo: undefined;
  CameraPermission: PatientStackParamList['PatientPreparation'];
  Calibration: PatientStackParamList['PatientPreparation'];
  PatientExercise: PatientStackParamList['PatientExercise'];
  /** "Como fazer" of the current item; opening it pauses the session. */
  MovementGuidance: ActiveSessionParams;
  ConfirmExit: ActiveSessionParams;
  SessionInterrupted: ActiveSessionParams;
  PatientCompletion: PatientStackParamList['PatientCompletion'];
  PatientList: undefined;
  PatientCreate: undefined;
  PatientDetails: PhysiotherapistStackParamList['PatientDetails'];
  WorkoutConfiguration: PhysiotherapistStackParamList['WorkoutConfiguration'] & {
    /** Catalog exercise chosen in the library for one draft item. */
    picked?: PickedExercise;
  };
  WorkoutReview: { patientId: UUID; workoutId: UUID };
  PatientMonitoring:
    PhysiotherapistStackParamList['PatientMonitoring'] | undefined;
  NoteEditor: { patientId: UUID; noteId?: UUID };
  ProfessionalSettings: undefined;
  ProfessionalProfile: undefined;
  /** `pickFor` opens the library to choose an exercise for the editor. */
  ExerciseLibrary: { pickFor?: LibraryPickTarget } | undefined;
  /** Provider id of a reference item (not a catalog exercise UUID). */
  ExerciseLibraryDetail: { externalId: string; pickFor?: LibraryPickTarget };
  /** pt-BR text of a catalog exercise (DEC-011); catalog exercise UUID. */
  CatalogExerciseTranslation: { exerciseId: UUID };
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
/** Root route of each physiotherapist tab (fade transition). */
export const professionalTabRoutes: readonly string[] = [
  'PatientList',
  'PatientMonitoring',
  'ProfessionalSettings',
];
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
export function resetToPatientTabs(
  navigation: FrontendNavigation,
  section?: ExerciseSection,
) {
  navigation.reset({
    index: 0,
    routes: [
      {
        name: 'PatientTabs',
        params: section
          ? { screen: 'PatientExercises', params: { section } }
          : { screen: 'PatientHome' },
      },
    ],
  });
}
