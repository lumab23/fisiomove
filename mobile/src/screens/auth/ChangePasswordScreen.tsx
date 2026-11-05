import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { friendlyErrorMessage } from '../../api/errors';
import { useAuth } from '../../auth/AuthContext';
import { validatePassword } from '../../auth/validation';
import { AppHeader } from '../../components/AppHeader';
import { FormField } from '../../components/FormField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { InlineError } from '../../components/ScreenStates';
import {
  colors,
  fonts,
  layout,
  radii,
  spacing,
  typography,
} from '../../theme/theme';

export function ChangePasswordScreen() {
  const { changePassword, busy, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      AccessibilityInfo.announceForAccessibility(error);
    }
  }, [error]);

  const submit = async () => {
    const currentError = validatePassword(currentPassword);
    const newError = validatePassword(newPassword);
    if (currentError || newError) {
      setError(currentError ?? newError);
      return;
    }
    if (currentPassword === newPassword) {
      setError('A nova senha precisa ser diferente da senha temporária.');
      return;
    }
    if (newPassword !== confirmation) {
      setError('A confirmação não corresponde à nova senha.');
      return;
    }
    setError(null);
    try {
      await changePassword(currentPassword, newPassword);
      AccessibilityInfo.announceForAccessibility('Senha alterada com sucesso.');
    } catch (caught) {
      setError(friendlyErrorMessage(caught));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <AppHeader brand title="Crie uma nova senha" />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.intro}>
            <Text style={styles.subtitle}>
              Por segurança, troque a senha temporária antes de continuar.
            </Text>
          </View>
          <View style={styles.card}>
            <FormField
              label="Senha temporária"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              autoComplete="current-password"
              editable={!busy}
            />
            <FormField
              label="Nova senha"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoComplete="new-password"
              editable={!busy}
            />
            <FormField
              label="Confirme a nova senha"
              value={confirmation}
              onChangeText={setConfirmation}
              secureTextEntry
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={submit}
              editable={!busy}
            />
            <Text style={styles.hint}>Use entre 12 e 128 caracteres.</Text>
            {error ? <InlineError message={error} /> : null}
            <PrimaryButton
              label="Salvar nova senha"
              loading={busy}
              onPress={submit}
            />
          </View>
          <Text style={styles.exit} onPress={logout} accessibilityRole="button">
            Sair e entrar com outra conta
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: {
    flexGrow: 1,
    gap: spacing.xl,
    justifyContent: 'center',
    paddingHorizontal: layout.pageGutter,
    paddingVertical: spacing.xl,
  },
  intro: { gap: spacing.sm },
  subtitle: {
    color: colors.textMuted,
    ...typography.body,
    fontFamily: fonts.regular,
  },
  card: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.xl,
    gap: spacing.lg,
    padding: spacing.xl,
  },
  hint: { color: colors.textMuted, ...typography.caption },
  exit: {
    color: colors.primary,
    ...typography.bodySmall,
    fontFamily: fonts.bold,
    padding: spacing.md,
    textAlign: 'center',
  },
});
