import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  colors,
  fonts,
  layout,
  radii,
  spacing,
  typography,
} from '../theme/theme';
import { AnimatedMascot } from './AnimatedMascot';
import { BrandLogo } from './BrandLogo';
import { Icon } from './Icon';

interface AuthLayoutProps {
  /** Content of the soft top band; defaults to a small, still mascot. */
  hero?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}

/**
 * Shared frame of the authentication screens: a soft top band with the brand
 * and the mascot, followed by scrollable content that survives large fonts and
 * the keyboard. It does not depend on navigation, so the boot screen can use it.
 */
export function AuthLayout({
  hero,
  onBack,
  backLabel = 'Voltar',
  children,
}: PropsWithChildren<AuthLayoutProps>) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.band, { paddingTop: insets.top + spacing.sm }]}>
            <View style={styles.topRow}>
              <View style={styles.slot}>
                {onBack ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={backLabel}
                    onPress={onBack}
                    style={({ pressed }) => [
                      styles.back,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Icon name="back" size={22} color={colors.primary} />
                    <Text style={styles.backText}>{backLabel}</Text>
                  </Pressable>
                ) : null}
              </View>
              <BrandLogo />
            </View>
            <View style={styles.hero}>
              {hero ?? <AnimatedMascot kind="home" width={72} still />}
            </View>
          </View>
          <View style={styles.content}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  scroll: { flexGrow: 1 },
  band: {
    backgroundColor: colors.surfaceMuted,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: layout.pageGutter,
  },
  topRow: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
    maxWidth: layout.contentMaxWidth,
    minHeight: layout.compactControlHeight,
    width: '100%',
  },
  slot: { minWidth: layout.compactControlHeight },
  back: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: layout.compactControlHeight,
    paddingRight: spacing.md,
  },
  backText: {
    color: colors.primary,
    ...typography.bodySmall,
    fontFamily: fonts.bold,
  },
  pressed: { opacity: 0.64 },
  hero: { alignItems: 'center' },
  content: {
    alignSelf: 'center',
    flexGrow: 1,
    gap: spacing.xl,
    maxWidth: layout.contentMaxWidth,
    paddingHorizontal: layout.pageGutter,
    paddingVertical: spacing.xl,
    width: '100%',
  },
});

/** Text styles shared by the authentication screens. */
export const authText = StyleSheet.create({
  title: {
    color: colors.text,
    ...typography.heading,
    fontFamily: fonts.bold,
  },
  body: {
    color: colors.textMuted,
    ...typography.body,
    fontFamily: fonts.regular,
  },
});
