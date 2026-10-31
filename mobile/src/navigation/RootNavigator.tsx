import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { DemoProvider } from '../demo/DemoContext';
import { ChangePasswordScreen } from '../screens/auth/ChangePasswordScreen';
import { AuthLoadingScreen } from '../screens/auth/AuthLoadingScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { colors } from '../theme/theme';
import { selectAuthenticatedFlow } from './flow';
import { FrontendNavigator } from './FrontendNavigator';
import type { AuthStackParamList } from './types';
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    primary: colors.primary,
  },
};
export function RootNavigator() {
  const { status, user, logout } = useAuth();
  if (status === 'booting' || status === 'error') {
    return <AuthLoadingScreen />;
  }
  if (status === 'unauthenticated' || !user) {
    return (
      <NavigationContainer theme={theme}>
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
        </AuthStack.Navigator>
      </NavigationContainer>
    );
  }
  const flow = selectAuthenticatedFlow(user);
  if (flow === 'change-password') {
    return (
      <NavigationContainer theme={theme}>
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen
            name="ChangePassword"
            component={ChangePasswordScreen}
          />
        </AuthStack.Navigator>
      </NavigationContainer>
    );
  }
  // Phase one is explicitly a UI demo. Auth/API services remain independently available.
  return (
    <DemoProvider>
      <FrontendNavigator
        initialRouteName={flow === 'patient' ? 'PatientHome' : 'PatientList'}
        onAccount={() => {
          logout().catch(() => undefined);
        }}
        accountLabel="Sair da conta"
      />
    </DemoProvider>
  );
}
