import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AccountContext } from './AccountContext';
import { colors } from '../theme/theme';
import {
  professionalTabRoutes,
  type FrontendStackParamList,
} from './frontendTypes';
import { PatientTabs } from './PatientTabs';

import { PhysiotherapistInfoScreen } from '../screens/patient/PhysiotherapistInfoScreen';
import { PatientNotesScreen } from '../screens/patient/PatientNotesScreen';
import {
  CalibrationScreen,
  CameraPermissionScreen,
  PatientPreparationScreen,
} from '../screens/patient/PreparationScreens';
import { PatientExerciseScreen } from '../screens/patient/PatientExerciseScreen';
import { DemoAutoCountScreen } from '../screens/patient/DemoAutoCountScreen';
import {
  ConfirmExitScreen,
  MovementGuidanceScreen,
  PatientCompletionScreen,
  SessionInterruptedScreen,
} from '../screens/patient/SessionScreens';
import { ActiveSessionProvider } from '../features/session/ActiveSession';
import { PatientListScreen } from '../screens/professional/PatientListScreen';
import { PatientCreateScreen } from '../screens/professional/PatientCreateScreen';
import { PatientDetailsScreen } from '../screens/professional/PatientDetailsScreen';
import {
  WorkoutConfigurationScreen,
  WorkoutReviewScreen,
} from '../screens/professional/WorkoutScreens';
import { NoteEditorScreen } from '../screens/professional/NoteScreens';
import { PatientMonitoringScreen } from '../screens/professional/PatientMonitoringScreen';
import { ProfessionalProfileScreen } from '../screens/professional/ProfessionalProfileScreen';
import { ProfessionalSettingsScreen } from '../screens/professional/ProfessionalSettingsScreen';
import {
  ExerciseLibraryDetailScreen,
  ExerciseLibraryScreen,
} from '../screens/professional/ExerciseLibraryScreens';
import { CatalogExerciseTranslationScreen } from '../screens/professional/ExerciseTranslation';

const Stack = createNativeStackNavigator<FrontendStackParamList>();
/**
 * Patient stack: tabs, the linked physiotherapist's details and the session
 * execution of the published workout (pause and rest are internal states of
 * `PatientExercise`, Q-T3). "Como fazer" opens over the execution and pauses it.
 * The live camera with its framing status is part of `PatientExercise`, so
 * there is no separate camera adjustment screen. Voice commands stay out of
 * the flow (DEC-009).
 */
export const patientScreens = {
  PatientTabs: PatientTabs,
  PhysiotherapistInfo: PhysiotherapistInfoScreen,
  PatientNotes: PatientNotesScreen,
  PatientPreparation: PatientPreparationScreen,
  CameraPermission: CameraPermissionScreen,
  Calibration: CalibrationScreen,
  PatientExercise: PatientExerciseScreen,
  DemoAutoCount: DemoAutoCountScreen,
  MovementGuidance: MovementGuidanceScreen,
  ConfirmExit: ConfirmExitScreen,
  SessionInterrupted: SessionInterruptedScreen,
  PatientCompletion: PatientCompletionScreen,
} as const;
/** Physiotherapist stack; every screen reads the API (phases 4, 7 and 8). */
export const physiotherapistScreens = {
  PatientList: PatientListScreen,
  PatientCreate: PatientCreateScreen,
  PatientDetails: PatientDetailsScreen,
  WorkoutConfiguration: WorkoutConfigurationScreen,
  WorkoutReview: WorkoutReviewScreen,
  PatientMonitoring: PatientMonitoringScreen,
  NoteEditor: NoteEditorScreen,
  ProfessionalSettings: ProfessionalSettingsScreen,
  ProfessionalProfile: ProfessionalProfileScreen,
  ExerciseLibrary: ExerciseLibraryScreen,
  ExerciseLibraryDetail: ExerciseLibraryDetailScreen,
  CatalogExerciseTranslation: CatalogExerciseTranslationScreen,
} as const;
export type FrontendFlow = 'patient' | 'physiotherapist';
export function FrontendNavigator({
  flow,
  accountEmail,
  onSignOut,
}: {
  flow: FrontendFlow;
  accountEmail?: string;
  onSignOut?: () => void;
}) {
  const screens = flow === 'patient' ? patientScreens : physiotherapistScreens;
  const navigator = (
    <AccountContext.Provider
      value={{ email: accountEmail, signOut: onSignOut }}
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
          initialRouteName={flow === 'patient' ? 'PatientTabs' : 'PatientList'}
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            gestureEnabled: true,
            freezeOnBlur: true,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          {Object.entries(screens).map(([name, component]) => (
            <Stack.Screen
              key={name}
              name={name as keyof FrontendStackParamList}
              component={component}
              options={{
                animation: professionalTabRoutes.includes(name)
                  ? 'fade'
                  : undefined,
              }}
            />
          ))}
        </Stack.Navigator>
      </NavigationContainer>
    </AccountContext.Provider>
  );
  // The session in memory belongs to the signed-in patient only.
  return flow === 'patient' ? (
    <ActiveSessionProvider>{navigator}</ActiveSessionProvider>
  ) : (
    navigator
  );
}
