import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Repetitions } from '../demo/model';
export type FrontendStackParamList = {
  PatientHome: undefined;
  PatientWorkout: undefined;
  PatientPreparation: undefined;
  CameraPermission: undefined;
  CameraDenied: undefined;
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
  PatientProgress: undefined;
  PatientHistory: undefined;
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
export function useFrontendNavigation() {
  return useNavigation<FrontendNavigation>();
}
