import type { PropsWithChildren } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors as themeColors, fonts } from './theme/theme';
export const colors = {
  ...themeColors,
  ink: themeColors.text,
  muted: themeColors.textMuted,
  purple: themeColors.primary,
  lavender: themeColors.surfaceMuted,
  teal: themeColors.accent,
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
  scroll: { flexGrow: 1, alignItems: 'center' },
  page: {
    width: '100%',
    maxWidth: 560,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 24,
    flexGrow: 1,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  brand: { color: colors.purple, fontSize: 20, fontFamily: fonts.bold },
  accent: {
    width: 46,
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.teal,
  },
  demo: {
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  title: {
    color: colors.ink,
    fontSize: 29,
    lineHeight: 37,
    fontFamily: fonts.bold,
    flexShrink: 1,
  },
  body: {
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 18,
    lineHeight: 26,
  },
  heading: { gap: 10 },
  card: {
    backgroundColor: colors.lavender,
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 23,
    lineHeight: 30,
    fontFamily: fonts.bold,
  },
  white: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: colors.purple,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.bold,
  },
  button: {
    minHeight: 64,
    borderRadius: 20,
    backgroundColor: colors.purple,
    paddingHorizontal: 18,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: colors.white,
    fontSize: 20,
    lineHeight: 28,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  compactButton: {
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  compactButtonText: { fontSize: 16, lineHeight: 22 },
  secondary: { backgroundColor: colors.lavender },
  secondaryText: { color: colors.purple },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  link: { minHeight: 48, justifyContent: 'center', paddingVertical: 10 },
  linkText: {
    color: colors.purple,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: fonts.bold,
  },
  actions: { gap: 12, marginTop: 8 },
  mascot: {
    alignSelf: 'center',
    width: 118,
    height: 108,
    borderRadius: 28,
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
  companion: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  message: {
    flex: 1,
    backgroundColor: colors.mint,
    borderRadius: 20,
    padding: 16,
  },
  messageText: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 25,
    fontFamily: fonts.bold,
  },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  number: {
    color: colors.purple,
    fontSize: 20,
    lineHeight: 28,
    fontFamily: fonts.bold,
    minWidth: 24,
  },
  stepContent: { flex: 1, gap: 10 },
  center: { alignItems: 'center', gap: 24 },
  person: { width: 230.4, height: 278.4, alignSelf: 'center' },
  camera: {
    backgroundColor: '#ece7f7',
    borderRadius: 24,
    padding: 16,
    gap: 16,
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
    fontSize: 16,
    lineHeight: 23,
    fontFamily: fonts.bold,
  },
});
