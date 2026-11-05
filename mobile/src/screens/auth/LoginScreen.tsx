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
        <AppHeader brand title="Entre no FisioMove" />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.intro}>
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
            {error ? <InlineError message={error} /> : null}
            <PrimaryButton label="Entrar" loading={busy} onPress={submit} />
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
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radii.xl,
  },
  support: {
    color: colors.textMuted,
    ...typography.caption,
    textAlign: 'center',
  },
});
