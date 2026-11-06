import { useEffect, useState } from 'react';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { ApiError, friendlyErrorMessage } from '../../api/errors';
import { useAuth } from '../../auth/AuthContext';
import { validateEmail, validatePassword } from '../../auth/validation';
import { AuthLayout, authText } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { InlineError } from '../../components/ScreenStates';
import type { AuthStackParamList } from '../../navigation/types';
import { colors, fonts, radii, spacing, typography } from '../../theme/theme';

const STEPS = 2;

function StepProgress({ step }: { step: 1 | 2 }) {
  const label = `Passo ${step} de ${STEPS}`;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 1, max: STEPS, now: step }}
      style={styles.progress}
    >
      <Text style={styles.progressLabel}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${(step / STEPS) * 100}%` }]} />
      </View>
    </View>
  );
}

export function LoginScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList, 'Login'>>();
  const { login, busy } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
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

  const continueToPassword = () => {
    const emailError = validateEmail(email);
    setFieldErrors({ email: emailError ?? undefined });
    setError(null);
    if (emailError) {
      return;
    }
    setStep(2);
  };

  const back = () => {
    if (busy) {
      return;
    }
    if (step === 2) {
      // The typed e-mail stays in state, so returning keeps it.
      setPassword('');
      setFieldErrors({});
      setError(null);
      setStep(1);
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const submit = async () => {
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    setFieldErrors({
      email: emailError ?? undefined,
      password: passwordError ?? undefined,
    });
    setError(null);
    if (emailError) {
      setStep(1);
      return;
    }
    if (passwordError) {
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

  // The system back (Android button, iOS swipe) on the password step returns
  // to the e-mail step, like the visible "Voltar", instead of leaving.
  usePreventRemove(step === 2, back);

  const canGoBack = step === 2 || navigation.canGoBack();

  return (
    <AuthLayout onBack={canGoBack ? back : undefined}>
      <StepProgress step={step} />
      {step === 1 ? (
        <View style={styles.form}>
          <Text accessibilityRole="header" style={authText.title}>
            Qual é o seu e-mail?
          </Text>
          <FormField
            label="E-mail"
            hint="É o mesmo que seu fisioterapeuta cadastrou."
            value={email}
            onChangeText={value => {
              setEmail(value);
              setFieldErrors(current => ({ ...current, email: undefined }));
            }}
            error={fieldErrors.email}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={continueToPassword}
            editable={!busy}
          />
          <PrimaryButton label="Continuar" onPress={continueToPassword} />
        </View>
      ) : (
        <View style={styles.form}>
          <Text accessibilityRole="header" style={authText.title}>
            Agora, a sua senha
          </Text>
          <Text style={authText.body}>{email.trim().toLowerCase()}</Text>
          <FormField
            label="Senha"
            value={password}
            onChangeText={value => {
              setPassword(value);
              setFieldErrors(current => ({ ...current, password: undefined }));
            }}
            error={fieldErrors.password}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            autoFocus
            revealable
            returnKeyType="done"
            onSubmitEditing={submit}
            editable={!busy}
          />
          {error ? <InlineError message={error} /> : null}
          <PrimaryButton label="Entrar" loading={busy} onPress={submit} />
          <Text style={styles.support}>
            Não compartilhe sua senha. Em caso de dificuldade, procure o
            profissional responsável pelo seu acesso.
          </Text>
        </View>
      )}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  progress: { gap: spacing.sm },
  progressLabel: {
    color: colors.textMuted,
    ...typography.bodySmall,
    fontFamily: fonts.bold,
  },
  track: {
    backgroundColor: colors.border,
    borderRadius: radii.pill,
    height: spacing.sm,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: '100%',
  },
  support: {
    color: colors.textMuted,
    ...typography.caption,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
});
