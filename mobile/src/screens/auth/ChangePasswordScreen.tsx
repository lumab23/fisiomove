import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { friendlyErrorMessage } from '../../api/errors';
import { useAuth } from '../../auth/AuthContext';
import { PASSWORD_MIN_LENGTH, validatePassword } from '../../auth/validation';
import { AuthLayout, authText } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { Icon } from '../../components/Icon';
import { PrimaryButton } from '../../components/PrimaryButton';
import { InlineError } from '../../components/ScreenStates';
import { colors, fonts, layout, spacing, typography } from '../../theme/theme';

/**
 * Mirrors the checks performed on submit: the minimum length from
 * `validatePassword`, the difference from the provisional password and the
 * confirmation. The maximum length is still enforced on submit.
 */
export function passwordChecklist(
  currentPassword: string,
  newPassword: string,
  confirmation: string,
) {
  return [
    {
      label: `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`,
      met: newPassword.length >= PASSWORD_MIN_LENGTH,
    },
    {
      label: 'Diferente da senha provisória',
      met: newPassword.length > 0 && newPassword !== currentPassword,
    },
    {
      label: 'As duas senhas são iguais',
      met: confirmation.length > 0 && newPassword === confirmation,
    },
  ];
}

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

  const checklist = passwordChecklist(
    currentPassword,
    newPassword,
    confirmation,
  );

  return (
    <AuthLayout>
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={authText.title}>
          Crie sua senha
        </Text>
        <Text style={authText.body}>
          Por segurança, troque a senha provisória antes de continuar.
        </Text>
      </View>
      <View style={styles.form}>
        <FormField
          label="Senha provisória"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          revealable
          editable={!busy}
        />
        <FormField
          label="Nova senha"
          value={newPassword}
          onChangeText={setNewPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          revealable
          editable={!busy}
        />
        <FormField
          label="Repita a senha"
          value={confirmation}
          onChangeText={setConfirmation}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          revealable
          returnKeyType="done"
          onSubmitEditing={submit}
          editable={!busy}
        />
        <View style={styles.checklist}>
          {checklist.map(item => (
            <View
              key={item.label}
              accessible
              accessibilityLabel={`${item.label}: ${
                item.met ? 'cumprido' : 'pendente'
              }`}
              style={styles.checkRow}
            >
              <Icon
                name={item.met ? 'check' : 'circle'}
                size={24}
                color={item.met ? colors.success : colors.textMuted}
              />
              <Text style={[styles.checkText, item.met && styles.checkMet]}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
        {error ? <InlineError message={error} /> : null}
        <PrimaryButton
          label="Salvar e começar"
          loading={busy}
          onPress={submit}
        />
      </View>
      <Text style={styles.exit} onPress={logout} accessibilityRole="button">
        Sair e entrar com outra conta
      </Text>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.md },
  form: { gap: spacing.lg },
  checklist: { gap: spacing.sm },
  checkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: layout.compactControlHeight,
  },
  checkText: {
    color: colors.textMuted,
    ...typography.bodySmall,
    flexShrink: 1,
    fontFamily: fonts.regular,
  },
  checkMet: { color: colors.success, fontFamily: fonts.bold },
  exit: {
    color: colors.primary,
    ...typography.bodySmall,
    fontFamily: fonts.bold,
    padding: spacing.md,
    textAlign: 'center',
  },
});
