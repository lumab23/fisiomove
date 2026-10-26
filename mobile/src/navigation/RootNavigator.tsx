import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import { ChangePasswordScreen } from '../screens/auth/ChangePasswordScreen';
import { AuthLoadingScreen } from '../screens/auth/AuthLoadingScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import {
  PatientCompletionScreen,
  PatientCreateScreen,
  PatientDetailsScreen,
  PatientExerciseScreen,
  PatientHomeScreen,
  PatientListScreen,
  PatientMonitoringScreen,
  PatientPreparationScreen,
  PatientProgressScreen,
  PatientWorkoutScreen,
  WorkoutConfigurationScreen,
} from '../screens/dev/DevelopmentDestinationScreen';
import { colors } from '../theme/theme';
import { selectAuthenticatedFlow } from './flow';
import type {
  AuthStackParamList,
  PatientStackParamList,
  PhysiotherapistStackParamList,
} from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const PatientStack = createNativeStackNavigator<PatientStackParamList>();
const PhysiotherapistStack =
  createNativeStackNavigator<PhysiotherapistStackParamList>();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    primary: colors.primary,
  },
};

const screenOptions = { headerShown: false, animation: 'fade' as const };

export function RootNavigator() {
  const { status, user } = useAuth();

  if (status === 'booting' || status === 'error') {
    return <AuthLoadingScreen />;
  }

  if (status === 'unauthenticated' || !user) {
    return (
      <NavigationContainer theme={theme}>
        <AuthStack.Navigator screenOptions={screenOptions}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
        </AuthStack.Navigator>
      </NavigationContainer>
    );
  }

  const flow = selectAuthenticatedFlow(user);
  if (flow === 'change-password') {
    return (
      <NavigationContainer theme={theme}>
        <AuthStack.Navigator screenOptions={screenOptions}>
          <AuthStack.Screen
            name="ChangePassword"
            component={ChangePasswordScreen}
          />
        </AuthStack.Navigator>
      </NavigationContainer>
    );
  }

  if (flow === 'patient') {
    return (
      <NavigationContainer theme={theme}>
        <PatientStack.Navigator screenOptions={screenOptions}>
          <PatientStack.Screen
            name="PatientHome"
            component={PatientHomeScreen}
          />
          <PatientStack.Screen
            name="PatientWorkout"
            component={PatientWorkoutScreen}
          />
          <PatientStack.Screen
            name="PatientPreparation"
            component={PatientPreparationScreen}
          />
          <PatientStack.Screen
            name="PatientExercise"
            component={PatientExerciseScreen}
          />
          <PatientStack.Screen
            name="PatientCompletion"
            component={PatientCompletionScreen}
          />
          <PatientStack.Screen
            name="PatientProgress"
            component={PatientProgressScreen}
          />
        </PatientStack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer theme={theme}>
      <PhysiotherapistStack.Navigator screenOptions={screenOptions}>
        <PhysiotherapistStack.Screen
          name="PatientList"
          component={PatientListScreen}
        />
        <PhysiotherapistStack.Screen
          name="PatientCreate"
          component={PatientCreateScreen}
        />
        <PhysiotherapistStack.Screen
          name="PatientDetails"
          component={PatientDetailsScreen}
        />
        <PhysiotherapistStack.Screen
          name="WorkoutConfiguration"
          component={WorkoutConfigurationScreen}
        />
        <PhysiotherapistStack.Screen
          name="PatientMonitoring"
          component={PatientMonitoringScreen}
        />
      </PhysiotherapistStack.Navigator>
    </NavigationContainer>
  );
}
