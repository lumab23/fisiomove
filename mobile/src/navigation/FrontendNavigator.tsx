import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AccountContext } from '../demo/AccountAccess';
import { colors } from '../theme/theme';
import type { FrontendStackParamList } from './frontendTypes';
import { PatientHomeScreen } from '../screens/patient/PatientHomeScreen';
import { PatientWorkoutScreen } from '../screens/patient/PatientWorkoutScreen';
import {
  CalibrationScreen,
  CameraDeniedScreen,
  CameraPermissionScreen,
  PatientPreparationScreen,
  VoicePermissionScreen,
} from '../screens/patient/PreparationScreens';
import { PatientExerciseScreen } from '../screens/patient/PatientExerciseScreen';
import {
  CameraAdjustmentScreen,
  ConfirmExitScreen,
  MovementGuidanceScreen,
  PatientCompletionScreen,
  SessionInterruptedScreen,
  SessionPauseScreen,
  SessionRestScreen,
} from '../screens/patient/SessionScreens';
import {
  PatientHistoryScreen,
  PatientProgressScreen,
} from '../screens/patient/ProgressScreens';
import { PatientListScreen } from '../screens/professional/PatientListScreen';
import { PatientCreateScreen } from '../screens/professional/PatientCreateScreen';
import { PatientDetailsScreen } from '../screens/professional/PatientDetailsScreen';
import {
  WorkoutConfigurationScreen,
  WorkoutReviewScreen,
} from '../screens/professional/WorkoutScreens';
import {
  NoteEditorScreen,
  NoteReviewScreen,
} from '../screens/professional/NoteScreens';
import { PatientMonitoringScreen } from '../screens/professional/PatientMonitoringScreen';

const Stack = createNativeStackNavigator<FrontendStackParamList>();
export const frontendScreens = {
  PatientHome: PatientHomeScreen,
  PatientWorkout: PatientWorkoutScreen,
  PatientPreparation: PatientPreparationScreen,
  CameraPermission: CameraPermissionScreen,
  CameraDenied: CameraDeniedScreen,
  VoicePermission: VoicePermissionScreen,
  Calibration: CalibrationScreen,
  PatientExercise: PatientExerciseScreen,
  SessionRest: SessionRestScreen,
  SessionPause: SessionPauseScreen,
  CameraAdjustment: CameraAdjustmentScreen,
  MovementGuidance: MovementGuidanceScreen,
  ConfirmExit: ConfirmExitScreen,
  SessionInterrupted: SessionInterruptedScreen,
  PatientCompletion: PatientCompletionScreen,
  PatientProgress: PatientProgressScreen,
  PatientHistory: PatientHistoryScreen,
  PatientList: PatientListScreen,
  PatientCreate: PatientCreateScreen,
  PatientDetails: PatientDetailsScreen,
  WorkoutConfiguration: WorkoutConfigurationScreen,
  WorkoutReview: WorkoutReviewScreen,
  PatientMonitoring: PatientMonitoringScreen,
  NoteEditor: NoteEditorScreen,
  NoteReview: NoteReviewScreen,
} as const;
export function FrontendNavigator({
  onAccount,
  accountLabel = 'Acessar minha conta',
  initialRouteName = 'PatientHome',
}: {
  onAccount?: () => void;
  accountLabel?: string;
  initialRouteName?: 'PatientHome' | 'PatientList';
}) {
  return (
    <AccountContext.Provider value={{ action: onAccount, label: accountLabel }}>
      <NavigationContainer
        theme={{
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            background: colors.background,
            primary: colors.primary,
          },
        }}
      >
        <Stack.Navigator
          initialRouteName={initialRouteName}
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            gestureEnabled: false,
          }}
        >
          {Object.entries(frontendScreens).map(([name, component]) => (
            <Stack.Screen
              key={name}
              name={name as keyof FrontendStackParamList}
              component={component}
            />
          ))}
        </Stack.Navigator>
      </NavigationContainer>
    </AccountContext.Provider>
  );
}
