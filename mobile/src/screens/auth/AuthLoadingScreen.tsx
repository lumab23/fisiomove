import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { friendlyErrorMessage } from '../../api/errors';
import { useAuth } from '../../auth/AuthContext';
import { AppHeader } from '../../components/AppHeader';
import { ErrorState, LoadingState } from '../../components/ScreenStates';
import { colors, spacing } from '../../theme/theme';

export function AuthLoadingScreen() {
  const { status, bootstrapError, retryBootstrap } = useAuth();
  const failed = status === 'error';
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <AppHeader title={failed ? 'FisioMove' : 'Acessando sua conta'} />
        <View style={styles.center}>
          {failed ? (
            <ErrorState
              title="A conexão falhou"
              message={friendlyErrorMessage(bootstrapError)}
              onRetry={retryBootstrap}
            />
          ) : (
            <LoadingState label="Verificando seu acesso com segurança" />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { flex: 1, padding: spacing.lg },
  center: { flex: 1, gap: spacing.lg, justifyContent: 'center' },
});
