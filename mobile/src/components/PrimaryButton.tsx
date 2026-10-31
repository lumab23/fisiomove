import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import {
  colors,
  fonts,
  layout,
  radii,
  spacing,
  typography,
} from '../theme/theme';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
}

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  accessibilityHint,
}: PrimaryButtonProps) {
  const unavailable = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: loading, disabled: unavailable }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && !unavailable && styles.pressed,
        unavailable && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={colors.surface}
          accessibilityLabel="Carregando"
        />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    justifyContent: 'center',
    minHeight: layout.controlHeight,
    paddingHorizontal: spacing.lg,
  },
  pressed: { backgroundColor: colors.primaryPressed },
  disabled: { opacity: 0.55 },
  label: {
    color: colors.surface,
    ...typography.bodySmall,
    fontFamily: fonts.bold,
  },
});
