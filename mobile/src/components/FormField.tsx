import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { colors } from '../theme/theme';

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function FormField({ label, error, ...input }: FormFieldProps) {
  const errorId = error ? `${label.replace(/\s/g, '-')}-error` : undefined;
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...input}
        accessibilityLabel={label}
        accessibilityHint={error}
        style={[styles.input, error && styles.inputError]}
        placeholderTextColor={colors.textMuted}
      />
      {error ? (
        <Text nativeID={errorId} style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: { color: colors.text, fontSize: 16, fontWeight: '700' },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 18,
    minHeight: 56,
    paddingHorizontal: 16,
  },
  inputError: { borderColor: colors.error, borderWidth: 2 },
  error: { color: colors.error, fontSize: 14 },
});
