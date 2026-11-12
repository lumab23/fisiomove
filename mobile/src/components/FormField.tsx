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
import { Icon, type IconName } from './Icon';

interface FormFieldProps extends TextInputProps {
  label: string;
  leadingIcon?: IconName;
  hideLabel?: boolean;
  error?: string;
  /**
   * Marks the field with the error border only, when the explanation is
   * already given by the toast (no repeated text under the field).
   */
  invalid?: boolean;
  /** Short guidance shown under the label and read as the field hint. */
  hint?: string;
  /** Hides the text and offers a "Mostrar senha" toggle below the field. */
  revealable?: boolean;
}

export function FormField({
  label,
  leadingIcon,
  hideLabel = false,
  error,
  invalid = false,
  hint,
  revealable = false,
  ...input
}: FormFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const errorId = error ? `${label.replace(/\s/g, '-')}-error` : undefined;
  const toggleLabel = revealed ? 'Ocultar senha' : 'Mostrar senha';
  return (
    <View style={styles.group}>
      {!hideLabel ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {error || invalid ? (
            <Text style={styles.errorIndicator} accessibilityElementsHidden>
              •
            </Text>
          ) : null}
        </View>
      ) : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View>
        {leadingIcon ? (
          <View pointerEvents="none" style={styles.leadingIcon}>
            <Icon name={leadingIcon} color={colors.textMuted} size={22} />
          </View>
        ) : null}
        <TextInput
          {...input}
          secureTextEntry={revealable ? !revealed : input.secureTextEntry}
          accessibilityLabel={label}
          accessibilityHint={
            error ??
            (invalid
              ? ['Campo a corrigir', hint].filter(Boolean).join('. ')
              : hint)
          }
          style={[
            styles.input,
            input.multiline ? styles.multiline : styles.singleLine,
            input.style,
            leadingIcon && styles.inputWithIcon,
            (error || invalid) && styles.inputError,
          ]}
          placeholderTextColor={colors.textMuted}
        />
      </View>
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
  leadingIcon: {
    position: 'absolute',
    left: spacing.lg,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1,
  },
  inputWithIcon: { paddingLeft: spacing.lg + 22 + spacing.md },
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
