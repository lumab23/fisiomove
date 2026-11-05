import {
  useNavigation,
  type CompositeNavigationProp,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Repetitions } from '../demo/model';
export type ExerciseSection = 'workout' | 'history' | 'progress';
export type PatientTabParamList = {
  PatientHome: undefined;
  PatientExercises: { section?: ExerciseSection } | undefined;
  PatientProfile: undefined;
};
export type FrontendStackParamList = {
  PatientTabs: NavigatorScreenParams<PatientTabParamList> | undefined;
  PatientPreparation: undefined;
  PhysiotherapistInfo: undefined;
  CameraPermission: undefined;
  VoicePermission: undefined;
  Calibration: undefined;
  PatientExercise: undefined;
  SessionRest: undefined;
  SessionPause: undefined;
  CameraAdjustment: undefined;
  MovementGuidance: undefined;
  ConfirmExit: undefined;
  SessionInterrupted: undefined;
  PatientCompletion: undefined;
  PatientList: undefined;
  PatientCreate: undefined;
  PatientDetails: undefined;
  WorkoutConfiguration: undefined;
  WorkoutReview: { repetitions: Repetitions };
  PatientMonitoring: undefined;
  NoteEditor: undefined;
  NoteReview: { text: string };
};
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
