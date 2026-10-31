import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import {
  colors,
  fonts,
  layout,
  radii,
  spacing,
  typography,
} from '../theme/theme';

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
        style={[
          styles.input,
          input.multiline && styles.multiline,
          input.style,
          error && styles.inputError,
        ]}
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
  group: { gap: spacing.sm },
  label: {
    color: colors.primary,
    ...typography.bodySmall,
    fontFamily: fonts.bold,
  },
  input: {
    fontFamily: fonts.regular,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    ...typography.body,
    minHeight: layout.controlHeight,
    paddingHorizontal: spacing.md,
  },
  multiline: {
    minHeight: 160,
    paddingVertical: spacing.md,
    textAlignVertical: 'top',
  },
  inputError: { borderColor: colors.error, borderWidth: 2 },
  error: { color: colors.error, ...typography.caption },
});
