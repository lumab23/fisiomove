import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { friendlyErrorMessage } from '../../api/errors';
import { useAuth } from '../../auth/AuthContext';
import { BrandHeader } from '../../components/BrandHeader';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, spacing } from '../../theme/theme';

export function AuthLoadingScreen() {
  const { status, bootstrapError, retryBootstrap } = useAuth();
  const failed = status === 'error';
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <BrandHeader />
        <View style={styles.center}>
          {failed ? (
            <>
              <Text style={styles.title} accessibilityRole="header">
                Não foi possível conectar
              </Text>
              <Text style={styles.message}>
                {friendlyErrorMessage(bootstrapError)}
              </Text>
              <PrimaryButton
                label="Tentar novamente"
                onPress={retryBootstrap}
              />
            </>
          ) : (
            <>
              <ActivityIndicator
                size="large"
                color={colors.primary}
                accessibilityLabel="Verificando acesso"
              />
              <Text style={styles.message}>
                Verificando seu acesso com segurança…
              </Text>
            </>
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
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: 27,
    textAlign: 'center',
  },
});
