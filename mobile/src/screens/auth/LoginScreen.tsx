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

import { ApiError, friendlyErrorMessage } from '../../api/errors';
import { useAuth } from '../../auth/AuthContext';
import { validateEmail, validatePassword } from '../../auth/validation';
import { BrandHeader } from '../../components/BrandHeader';
import { FormField } from '../../components/FormField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, spacing } from '../../theme/theme';

export function LoginScreen() {
  const { login, busy } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      AccessibilityInfo.announceForAccessibility(error);
    }
  }, [error]);

  const submit = async () => {
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    setFieldErrors({
      email: emailError ?? undefined,
      password: passwordError ?? undefined,
    });
    setError(null);
    if (emailError || passwordError) {
      return;
    }
    try {
      await login({ email: email.trim().toLowerCase(), password });
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'invalid_credentials') {
        setError('E-mail ou senha incorretos. Confira e tente novamente.');
      } else {
        setError(friendlyErrorMessage(caught));
      }
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
              Entre no FisioMove
            </Text>
            <Text style={styles.subtitle}>
              Use o acesso entregue pelo seu fisioterapeuta ou administrador.
            </Text>
          </View>
          <View style={styles.card}>
            <FormField
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              error={fieldErrors.email}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              returnKeyType="next"
              editable={!busy}
            />
            <FormField
              label="Senha"
              value={password}
              onChangeText={setPassword}
              error={fieldErrors.password}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={submit}
              editable={!busy}
            />
            {error ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
            <PrimaryButton
              label="Entrar"
              loading={busy}
              onPress={submit}
              accessibilityHint="Acessa sua conta com o e-mail e a senha informados"
            />
          </View>
          <Text style={styles.support}>
            Não compartilhe sua senha. Em caso de dificuldade, procure o
            profissional responsável pelo seu acesso.
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
    padding: spacing.lg,
  },
  intro: { gap: spacing.sm },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 39,
  },
  subtitle: { color: colors.textMuted, fontSize: 18, lineHeight: 27 },
  card: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 24,
    gap: spacing.md,
    padding: spacing.lg,
  },
  error: {
    backgroundColor: colors.errorBackground,
    borderRadius: 12,
    color: colors.error,
    fontSize: 16,
    lineHeight: 22,
    padding: spacing.md,
  },
  support: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
