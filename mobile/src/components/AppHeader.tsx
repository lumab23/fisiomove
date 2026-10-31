import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  colors,
  fonts,
  layout,
  radii,
  spacing,
  typography,
} from '../theme/theme';

interface AppHeaderProps {
  title?: string;
  backLabel?: string;
  onBack?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

/** Fixed shared header used by app and authentication screens. */
export function AppHeader({
  title,
  backLabel,
  onBack,
  actionLabel,
  onAction,
}: AppHeaderProps) {
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
              <Text style={styles.backIcon}>‹</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.brand}>FisioMove</Text>
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
  brand: {
    color: colors.primary,
    fontFamily: fonts.bold,
    ...typography.brand,
    textAlign: 'center',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    height: layout.compactControlHeight,
    justifyContent: 'center',
    width: layout.compactControlHeight,
  },
  backIcon: {
    color: colors.primary,
    fontFamily: fonts.regular,
    ...typography.icon,
    marginTop: -4,
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
