import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotion } from '../accessibility/useReduceMotion';
import {
  colors,
  elevation,
  fonts,
  layout,
  radii,
  spacing,
  typography,
} from '../theme/theme';
import { Icon, type IconName } from './Icon';
import type { ScreenMessage } from './ScreenMessage';

const tones: Record<
  ScreenMessage['tone'],
  { icon: IconName; color: string; background: string; label: string }
> = {
  success: {
    icon: 'check',
    color: colors.success,
    background: colors.successBackground,
    label: 'Sucesso',
  },
  error: {
    icon: 'alert',
    color: colors.error,
    background: colors.errorBackground,
    label: 'Erro',
  },
  warning: {
    icon: 'alert',
    color: colors.warningText,
    background: colors.warningBackground,
    label: 'Aviso',
  },
  info: {
    icon: 'info',
    color: colors.primary,
    background: colors.surfaceMuted,
    label: 'Informação',
  },
};

/** One global, dismissible message. Its reserved space never covers controls. */
export function Toast({
  message,
  onDismiss,
}: {
  message: ScreenMessage;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const [screenReader, setScreenReader] = useState<boolean | null>(null);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const tone = tones[message.tone];

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then(value => mounted && setScreenReader(value))
      .catch(() => mounted && setScreenReader(true));
    const reader = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setScreenReader,
    );
    const app = AppState.addEventListener('change', state =>
      setActive(state === 'active'),
    );
    AccessibilityInfo.announceForAccessibility(
      `${tone.label}. ${message.text}`,
    );
    return () => {
      mounted = false;
      reader.remove();
      app.remove();
    };
  }, [message.text, tone.label]);

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: reduceMotion === false ? 220 : 0,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduceMotion, active]);

  useEffect(() => {
    // Assistive technology users dismiss explicitly; background time does not
    // consume reading time. Long/error messages remain readable for longer.
    if (screenReader !== false || !active) return;
    const duration = Math.max(
      message.tone === 'error' ? 8000 : 4500,
      message.text.length * 65,
    );
    let timer: ReturnType<typeof setTimeout>;
    const timeout = setTimeout(() => {
      const animation = Animated.timing(progress, {
        toValue: 0,
        duration: reduceMotion === false ? 180 : 0,
        useNativeDriver: true,
      });
      animation.start();
      if (reduceMotion === false) timer = setTimeout(onDismiss, 180);
      else onDismiss();
    }, duration);
    return () => {
      clearTimeout(timeout);
      clearTimeout(timer);
      progress.stopAnimation();
    };
  }, [active, message, onDismiss, progress, reduceMotion, screenReader]);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.slot,
        {
          paddingLeft: Math.max(insets.left, spacing.lg),
          paddingRight: Math.max(insets.right, spacing.lg),
          paddingBottom: Math.max(insets.bottom, spacing.md),
        },
      ]}
    >
      <Animated.View
        testID="feedback-toast"
        style={[
          styles.toast,
          {
            opacity: progress,
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [8, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={[styles.icon, { backgroundColor: tone.background }]}>
          <Icon name={tone.icon} size={22} color={tone.color} />
        </View>
        <Text accessibilityRole="alert" style={styles.text}>
          {message.text}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar mensagem"
          onPress={onDismiss}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Icon name="close" size={20} color={colors.textMuted} />
        </Pressable>
      </Animated.View>
    </View>
  );
}
const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.sm,
    zIndex: 9999,
    elevation: 99,
  },
  toast: {
    ...elevation.card,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.lg,
    paddingVertical: spacing.sm,
    paddingRight: spacing.xs,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  icon: { padding: spacing.sm, borderRadius: radii.pill },
  text: {
    ...typography.bodySmall,
    fontFamily: fonts.regular,
    color: colors.text,
    flex: 1,
    paddingVertical: spacing.xs,
  },
  close: {
    minWidth: layout.compactControlHeight,
    minHeight: layout.compactControlHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
