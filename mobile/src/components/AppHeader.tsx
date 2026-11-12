import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  colors,
  fonts,
  layout,
  radii,
  spacing,
  typography,
} from '../theme/theme';
import { BrandLogo } from './BrandLogo';
import { Icon } from './Icon';

interface AppHeaderProps {
  title?: string;
  backLabel?: string;
  onBack?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  /** Branded header for login and loading screens; internal screens omit it. */
  brand?: boolean;
}

export function AppHeader({
  title,
  backLabel,
  onBack,
  actionLabel,
  onAction,
  brand = false,
}: AppHeaderProps) {
  if (!brand) {
    if (!title && !onBack) {
      return null;
    }
    return (
      <View style={styles.page}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Voltar para ${backLabel ?? 'a tela anterior'}`}
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Icon name="back" size={22} color={colors.primary} />
            <Text numberOfLines={1} style={styles.backText}>
              {backLabel ?? 'Voltar'}
            </Text>
          </Pressable>
        ) : null}
        {title ? (
          <Text accessibilityRole="header" style={styles.pageTitle}>
            {title}
          </Text>
        ) : null}
      </View>
    );
  }
  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <View style={styles.slot}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={backLabel ?? 'Voltar'}
              onPress={onBack}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.pressed,
              ]}
            >
              <Icon name="back" size={22} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>
        <BrandLogo />
        <View style={[styles.slot, styles.actionSlot]}>
          {onAction && actionLabel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={actionLabel}
              onPress={onAction}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.actionIcon}>⋯</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {title ? (
        <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    alignSelf: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: layout.pageGutter,
    paddingTop: spacing.md,
    gap: spacing.xs,
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    zIndex: 1,
  },
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: layout.compactControlHeight,
    paddingRight: spacing.md,
    maxWidth: '100%',
  },
  backText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    ...typography.bodySmall,
    flexShrink: 1,
  },
  pageTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    ...typography.heading,
    textAlign: 'center',
  },
  header: {
    alignSelf: 'center',
    backgroundColor: colors.background,
    justifyContent: 'center',
    minHeight: layout.headerHeight,
    paddingHorizontal: layout.pageGutter,
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    zIndex: 1,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 48,
    justifyContent: 'space-between',
  },
  slot: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: layout.compactControlHeight,
  },
  actionSlot: { alignItems: 'flex-end' },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    height: layout.compactControlHeight,
    justifyContent: 'center',
    width: layout.compactControlHeight,
  },
  actionIcon: {
    color: colors.primary,
    fontFamily: fonts.bold,
    ...typography.title,
  },
  title: {
    color: colors.text,
    ...typography.title,
    fontFamily: fonts.bold,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  pressed: { opacity: 0.64 },
});
