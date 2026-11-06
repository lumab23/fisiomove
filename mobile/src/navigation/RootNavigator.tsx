import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { ChangePasswordScreen } from '../screens/auth/ChangePasswordScreen';
import { AuthLoadingScreen } from '../screens/auth/AuthLoadingScreen';
import { FirstAccessScreen } from '../screens/auth/FirstAccessScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
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
        <AuthStack.Navigator
          screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
        >
          <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="FirstAccess" component={FirstAccessScreen} />
        </AuthStack.Navigator>
      </NavigationContainer>
    );
  }
  const flow = selectAuthenticatedFlow(user);
  if (flow === 'change-password') {
    return (
      <NavigationContainer theme={theme}>
        <AuthStack.Navigator
          screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
        >
          <AuthStack.Screen
            name="ChangePassword"
            component={ChangePasswordScreen}
          />
        </AuthStack.Navigator>
      </NavigationContainer>
    );
  }
  const signOut = () => {
    logout().catch(() => undefined);
  };
  // Both flows read the API; there is no demonstration data at runtime.
  return (
    <FrontendNavigator
      flow={flow}
      accountEmail={user.email}
      onSignOut={signOut}
    />
  );
}
