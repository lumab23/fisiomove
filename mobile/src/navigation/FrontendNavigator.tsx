import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AccountContext } from '../demo/AccountAccess';
import { colors } from '../theme/theme';
import type { FrontendStackParamList } from './frontendTypes';
import { PatientTabs } from './PatientTabs';
import { PhysiotherapistInfoScreen } from '../screens/patient/PhysiotherapistInfoScreen';
import {
  CalibrationScreen,
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
  PatientTabs: PatientTabs,
  PhysiotherapistInfo: PhysiotherapistInfoScreen,
  PatientPreparation: PatientPreparationScreen,
  CameraPermission: CameraPermissionScreen,
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
  accountEmail,
  professionalDemo = true,
  initialRouteName = 'PatientTabs',
}: {
  onAccount?: () => void;
  accountLabel?: string;
  accountEmail?: string;
  professionalDemo?: boolean;
  initialRouteName?: 'PatientTabs' | 'PatientList';
}) {
  return (
    <AccountContext.Provider
      value={{
        action: onAccount,
        label: accountLabel,
        email: accountEmail,
        professionalDemo,
      }}
    >
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
            animation: 'slide_from_right',
            gestureEnabled: true,
            freezeOnBlur: true,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          {Object.entries(frontendScreens).map(([name, component]) => (
            <Stack.Screen
              key={name}
              name={name as keyof FrontendStackParamList}
              component={component}
              options={{
                animation:
                  name === 'PatientList' || name === 'PatientMonitoring'
                    ? 'fade'
                    : undefined,
              }}
            />
          ))}
        </Stack.Navigator>
      </NavigationContainer>
    </AccountContext.Provider>
  );
}
