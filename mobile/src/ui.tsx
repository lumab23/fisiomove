import { Children, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AnimatedMascot } from './components/AnimatedMascot';
import { Icon, type IconName } from './components/Icon';
import {
  colors as themeColors,
  elevation,
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
  inverse = false,
  icon,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  compact?: boolean;
  inverse?: boolean;
  icon?: IconName;
  accessibilityHint?: string;
}) {
  const textColor = inverse
    ? colors.primary
    : secondary
      ? colors.purple
      : colors.white;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compactButton,
        secondary && styles.secondary,
        inverse && styles.inverse,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {icon && <Icon name={icon} size={20} color={textColor} />}
      <Text
        style={[
          styles.buttonText,
          compact && styles.compactButtonText,
          { color: textColor },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function SectionTitle({ children }: PropsWithChildren) {
  return (
    <Text accessibilityRole="header" style={styles.sectionTitle}>
      {children}
    </Text>
  );
}
export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'inverse';
}) {
  return (
    <View style={[styles.badge, badgeTones[tone].box]}>
      <Text style={[styles.badgeText, badgeTones[tone].text]}>{label}</Text>
    </View>
  );
}
export function ListRow({
  icon,
  title,
  description,
  onPress,
  accessibilityHint,
  titleLanguage,
}: {
  icon: IconName;
  title: string;
  description?: string;
  onPress?: () => void;
  accessibilityHint?: string;
  /** e.g. `"en"` for a title kept in its original language. */
  titleLanguage?: string;
}) {
  const content = (
    <>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.rowText}>
        <Text accessibilityLanguage={titleLanguage} style={styles.rowTitle}>
          {title}
        </Text>
        {description && (
          <Text style={styles.rowDescription}>{description}</Text>
        )}
      </View>
      {onPress && (
        <Icon name="chevronRight" size={20} color={colors.textMuted} />
      )}
    </>
  );
  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint ?? description}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {content}
    </Pressable>
  );
}
export function ListGroup({ children }: PropsWithChildren) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.white, styles.group]}>
      {items.map((child, index) => (
        <View key={index} style={index > 0 && styles.divider}>
          {child}
        </View>
      ))}
    </View>
  );
}
export function EmptyState({
  title,
  children,
  action,
}: PropsWithChildren<{
  title: string;
  action?: { label: string; icon?: IconName; onPress: () => void };
}>) {
  return (
    <View style={[styles.card, styles.white, styles.empty]}>
      <Mascot small />
      <Text accessibilityRole="header" style={styles.emptyTitle}>
        {title}
      </Text>
      <Text style={[styles.body, styles.centerText]}>{children}</Text>
      {action && (
        <View style={styles.emptyAction}>
          <Button
            secondary
            icon={action.icon}
            label={action.label}
            onPress={action.onPress}
          />
        </View>
      )}
    </View>
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
      accessibilityLabel={label.replace(/[‹›]/g, '').trim()}
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
  return (
    <View
      style={[
        styles.mascot,
        kind === 'gold' && styles.mint,
        kind === 'home' && styles.homeMascot,
        small && styles.smallMascot,
      ]}
    >
      <AnimatedMascot kind={kind} width={small ? 74.88 : 104} />
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
    ...elevation.card,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: fonts.bold,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 64,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
  },
  rowPressed: { backgroundColor: colors.background },
  group: { borderRadius: radii.xl, overflow: 'hidden' },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: fonts.bold,
  },
  rowDescription: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fonts.regular,
  },
  empty: { alignItems: 'center', paddingVertical: 28 },
  emptyTitle: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  centerText: { textAlign: 'center' },
  emptyAction: { alignSelf: 'stretch', marginTop: 4 },
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
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: colors.white,
    ...typography.body,
    fontFamily: fonts.bold,
    textAlign: 'center',
    flexShrink: 1,
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
  inverse: { backgroundColor: colors.white },
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
const badgeTones = {
  neutral: StyleSheet.create({
    box: { backgroundColor: colors.lavender },
    text: { color: colors.purple },
  }),
  success: StyleSheet.create({
    box: { backgroundColor: colors.successBackground },
    text: { color: colors.success },
  }),
  warning: StyleSheet.create({
    box: { backgroundColor: colors.warningBackground },
    text: { color: colors.warningText },
  }),
  inverse: StyleSheet.create({
    box: { backgroundColor: 'rgba(255,255,255,0.18)' },
    text: { color: colors.onPrimary },
  }),
};
