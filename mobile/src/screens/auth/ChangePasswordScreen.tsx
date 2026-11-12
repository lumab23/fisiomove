import { useSignOutConfirmation } from '../../components/SignOutConfirmation';
import { useScreenMessage } from '../../components/ScreenMessage';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { friendlyErrorMessage } from '../../api/errors';
import { useAuth } from '../../auth/AuthContext';
import { PASSWORD_MIN_LENGTH, validatePassword } from '../../auth/validation';
import { AuthLayout, authText } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { Icon } from '../../components/Icon';
import { PrimaryButton } from '../../components/PrimaryButton';
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

type PasswordField = 'current' | 'new' | 'confirmation';

export function ChangePasswordScreen() {
  const { changePassword, busy, logout } = useAuth();
  const { requestSignOut } = useSignOutConfirmation(logout);
  const { show } = useScreenMessage();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  // The toast explains the problem; the field to fix only gets the border.
  const [invalid, setInvalid] = useState<PasswordField | null>(null);
  const reject = (field: PasswordField, message: string) => {
    setInvalid(field);
    show(message, 'error');
  };

  const submit = async () => {
    const currentError = validatePassword(currentPassword);
    const newError = validatePassword(newPassword);
    if (currentError) {
      reject('current', currentError);
      return;
    }
    if (newError) {
      reject('new', newError);
      return;
    }
    if (currentPassword === newPassword) {
      reject('new', 'A nova senha precisa ser diferente da senha temporária.');
      return;
    }
    if (newPassword !== confirmation) {
      reject('confirmation', 'A confirmação não corresponde à nova senha.');
      return;
    }
    setInvalid(null);
    try {
      await changePassword(currentPassword, newPassword);
      show('Senha alterada com sucesso.', 'success');
    } catch (caught) {
      show(friendlyErrorMessage(caught), 'error');
    }
  };
  const edit =
    (field: PasswordField, set: (value: string) => void) => (value: string) => {
      set(value);
      setInvalid(current => (current === field ? null : current));
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
          onChangeText={edit('current', setCurrentPassword)}
          invalid={invalid === 'current'}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          revealable
          editable={!busy}
        />
        <FormField
          label="Nova senha"
          value={newPassword}
          onChangeText={edit('new', setNewPassword)}
          invalid={invalid === 'new'}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          revealable
          editable={!busy}
        />
        <FormField
          label="Repita a senha"
          value={confirmation}
          onChangeText={edit('confirmation', setConfirmation)}
          invalid={invalid === 'confirmation'}
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
        <PrimaryButton
          label="Salvar e começar"
          loading={busy}
          onPress={submit}
        />
      </View>
      <Text
        style={styles.exit}
        onPress={requestSignOut}
        accessibilityLabel="Sair e entrar com outra conta"
        accessibilityRole="button"
      >
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
