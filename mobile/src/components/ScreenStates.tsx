import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card } from '../ui';
import { colors, fonts, radii, spacing, typography } from '../theme/theme';
import { useScreenMessage } from './ScreenMessage';

export function LoadingState({ label }: { label: string }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={styles.loading}
    >
      <View style={[styles.skeleton, styles.skeletonTitle]} />
      <View style={[styles.skeleton, styles.skeletonLine]} />
      <View style={[styles.skeleton, styles.skeletonShort]} />
    </View>
  );
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card white>
      <Text accessibilityRole="header" style={styles.stateTitle}>
        {title}
      </Text>
      <Body>{message}</Body>
      {actionLabel && onAction ? (
        <Button secondary label={actionLabel} onPress={onAction} />
      ) : null}
    </Card>
  );
}

export function ErrorState({
  title = 'Não foi possível carregar',
  message,
  retryLabel = 'Tentar novamente',
  onRetry,
}: {
  title?: string;
  message: string;
  retryLabel?: string;
  onRetry: () => void;
}) {
  const { show } = useScreenMessage();
  const shown = useRef<string | null>(null);
  const text = `${title}. ${message}`;
  useEffect(() => {
    if (shown.current === text) return;
    shown.current = text;
    show(text, 'error');
  }, [show, text]);
  return (
    <View style={styles.errorAction}>
      <Button secondary label={retryLabel} onPress={onRetry} />
    </View>
  );
}

export function InlineError({
  message,
  static: isStatic,
}: {
  message: string;
  /** Keep the message visible on screen (e.g. form validation). */
  static?: boolean;
}) {
  const { show } = useScreenMessage();
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!message || isStatic || shown.current === message) return;
    shown.current = message;
    show(message, 'error');
  }, [isStatic, message, show]);
  if (!isStatic) return null;
  return (
    <View style={styles.inlineError} accessibilityRole="alert">
      <Text style={styles.inlineErrorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.xl,
  },
  skeleton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    height: 16,
  },
  skeletonTitle: { height: 24, width: '60%' },
  skeletonLine: { width: '100%' },
  skeletonShort: { width: '72%' },
  stateTitle: {
    color: colors.text,
    ...typography.title,
    fontFamily: fonts.bold,
  },
  errorAction: { alignItems: 'flex-start' },
  inlineError: {
    backgroundColor: colors.errorBackground,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  inlineErrorText: {
    color: colors.error,
    ...typography.bodySmall,
    fontFamily: fonts.regular,
  },
});
