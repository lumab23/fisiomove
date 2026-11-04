import type { PropsWithChildren } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  colors as themeColors,
  fonts,
  layout,
  radii,
  spacing,
  typography,
} from './theme/theme';
export const colors = {
  ...themeColors,
  ink: themeColors.text,
  muted: themeColors.textMuted,
  purple: themeColors.primary,
  lavender: themeColors.surfaceMuted,
  mint: themeColors.successBackground,
  white: themeColors.surface,
};
export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compactButton,
        secondary && styles.secondary,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          compact && styles.compactButtonText,
          secondary && styles.secondaryText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Link({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}
export function Title({ children }: PropsWithChildren) {
  return (
    <Text accessibilityRole="header" style={styles.title}>
      {children}
    </Text>
  );
}
export function Body({ children }: PropsWithChildren) {
  return <Text style={styles.body}>{children}</Text>;
}
export function Card({
  title,
  children,
  white = false,
}: PropsWithChildren<{ title?: string; white?: boolean }>) {
  return (
    <View style={[styles.card, white && styles.white]}>
      {title && <Text style={styles.cardTitle}>{title}</Text>}
      {children}
    </View>
  );
}
export function Mascot({
  kind = 'pink',
  small = false,
}: {
  kind?: 'pink' | 'home' | 'gold';
  small?: boolean;
}) {
  const source =
    kind === 'home'
      ? require('./assets/mascot-home.png')
      : kind === 'gold'
        ? require('./assets/mascot-gold.png')
        : require('./assets/mascot-pink.png');
  return (
    <View
      style={[
        styles.mascot,
        kind === 'gold' && styles.mint,
        kind === 'home' && styles.homeMascot,
        small && styles.smallMascot,
      ]}
    >
      <Image
        source={source}
        style={[styles.mascotImage, small && styles.smallMascotImage]}
        resizeMode="contain"
        accessible={false}
      />
    </View>
  );
}
export function Companion({ children }: PropsWithChildren) {
  return (
    <View style={styles.companion}>
      <View style={styles.message}>
        <Text style={styles.messageText}>{children}</Text>
      </View>
      <Mascot small />
    </View>
  );
}
export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  demo: {
    fontFamily: fonts.regular,
    color: colors.muted,
    ...typography.caption,
  },
  title: {
    color: colors.ink,
    ...typography.heading,
    fontFamily: fonts.bold,
    flexShrink: 1,
  },
  body: {
    fontFamily: fonts.regular,
    color: colors.muted,
    ...typography.body,
  },
  heading: { gap: spacing.sm },
  card: {
    backgroundColor: colors.lavender,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.ink,
    ...typography.title,
    fontFamily: fonts.bold,
  },
  white: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: colors.purple,
    ...typography.caption,
    fontFamily: fonts.bold,
  },
  button: {
    minHeight: layout.controlHeight,
    borderRadius: radii.lg,
    backgroundColor: colors.purple,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: colors.white,
    ...typography.body,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  compactButton: {
    minHeight: layout.compactControlHeight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
  },
  compactButtonText: { ...typography.bodySmall },
  secondary: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
  },
  secondaryText: { color: colors.purple },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  link: {
    minHeight: layout.compactControlHeight,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  linkText: {
    color: colors.purple,
    ...typography.bodySmall,
    fontFamily: fonts.bold,
  },
  actions: { gap: spacing.md, marginTop: spacing.sm },
  mascot: {
    alignSelf: 'center',
    width: 118,
    height: 108,
    borderRadius: radii.xl,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotImage: { width: 104, height: 96 },
  mint: { backgroundColor: colors.mint },
  smallMascot: { width: 78, height: 78, borderRadius: 39 },
  smallMascotImage: { width: 74.88, height: 69.12 },
  homeMascot: {
    alignSelf: 'flex-end',
    width: 104,
    height: 96,
    backgroundColor: colors.white,
  },
  companion: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  message: {
    flex: 1,
    backgroundColor: colors.mint,
    borderRadius: radii.xl,
    padding: spacing.lg,
  },
  messageText: {
    color: colors.ink,
    ...typography.body,
    fontFamily: fonts.bold,
  },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  number: {
    color: colors.purple,
    ...typography.body,
    fontFamily: fonts.bold,
    minWidth: 24,
  },
  stepContent: { flex: 1, gap: spacing.sm },
  center: { alignItems: 'center', gap: spacing.xl },
  person: { width: 232, height: 280, alignSelf: 'center' },
  camera: {
    backgroundColor: colors.lavender,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  counter: {
    color: colors.ink,
    fontSize: 40,
    lineHeight: 48,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  notice: {
    color: colors.purple,
    ...typography.bodySmall,
    fontFamily: fonts.bold,
  },
});
