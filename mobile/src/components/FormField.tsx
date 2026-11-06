import { useState } from 'react';
import {
  Pressable,
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
import { Icon } from './Icon';

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string;
  /** Short guidance shown under the label and read as the field hint. */
  hint?: string;
  /** Hides the text and offers a "Mostrar senha" toggle below the field. */
  revealable?: boolean;
}

export function FormField({
  label,
  error,
  hint,
  revealable = false,
  ...input
}: FormFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const errorId = error ? `${label.replace(/\s/g, '-')}-error` : undefined;
  const toggleLabel = revealed ? 'Ocultar senha' : 'Mostrar senha';
  return (
    <View style={styles.group}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {error ? (
          <Text style={styles.errorIndicator} accessibilityElementsHidden>
            •
          </Text>
        ) : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <TextInput
        {...input}
        secureTextEntry={revealable ? !revealed : input.secureTextEntry}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        style={[
          styles.input,
          input.multiline ? styles.multiline : styles.singleLine,
          input.style,
          error && styles.inputError,
        ]}
        placeholderTextColor={colors.textMuted}
      />
      {revealable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={toggleLabel}
          accessibilityHint={`Campo ${label}`}
          onPress={() => setRevealed(value => !value)}
          style={({ pressed }) => [styles.reveal, pressed && styles.pressed]}
        >
          <Icon
            name={revealed ? 'eyeOff' : 'eye'}
            size={22}
            color={colors.primary}
          />
          <Text style={styles.revealText}>{toggleLabel}</Text>
        </Pressable>
      ) : null}
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
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: {
    color: colors.primary,
    ...typography.bodySmall,
    fontFamily: fonts.bold,
  },
  hint: {
    color: colors.textMuted,
    ...typography.bodySmall,
    fontFamily: fonts.regular,
  },
  reveal: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: layout.compactControlHeight,
    paddingRight: spacing.md,
  },
  revealText: {
    color: colors.primary,
    ...typography.bodySmall,
    fontFamily: fonts.bold,
  },
  pressed: { opacity: 0.64 },
  errorIndicator: { color: colors.error, fontSize: 16, lineHeight: 18 },
  input: {
    fontFamily: fonts.regular,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.body.fontSize,
    minHeight: layout.controlHeight,
    paddingHorizontal: spacing.md,
  },
  // No lineHeight on a single line: on iOS it misaligns the text and lets a
  // long value wrap out of the box. The text scrolls horizontally instead.
  singleLine: { paddingVertical: 0, textAlignVertical: 'center' },
  multiline: {
    lineHeight: typography.body.lineHeight,
    minHeight: 160,
    paddingVertical: spacing.md,
    textAlignVertical: 'top',
  },
  inputError: { borderColor: colors.error, borderWidth: 2 },
  error: { color: colors.error, ...typography.caption },
});
