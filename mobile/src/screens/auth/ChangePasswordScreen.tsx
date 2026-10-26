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
import { BrandHeader } from '../../components/BrandHeader';
import { FormField } from '../../components/FormField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, spacing } from '../../theme/theme';

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
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <BrandHeader />
          <View style={styles.intro}>
            <Text style={styles.title} accessibilityRole="header">
              Crie uma nova senha
            </Text>
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
            {error ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
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
    gap: spacing.lg,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  intro: { gap: spacing.sm },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 38,
  },
  subtitle: { color: colors.textMuted, fontSize: 18, lineHeight: 27 },
  card: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 24,
    gap: spacing.md,
    padding: spacing.lg,
  },
  hint: { color: colors.textMuted, fontSize: 14 },
  error: {
    backgroundColor: colors.errorBackground,
    borderRadius: 12,
    color: colors.error,
    fontSize: 16,
    padding: spacing.md,
  },
  exit: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
    padding: spacing.md,
    textAlign: 'center',
  },
});
