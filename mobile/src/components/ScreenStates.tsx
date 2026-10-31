import { StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card } from '../ui';
import { colors, fonts, radii, spacing, typography } from '../theme/theme';

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
  return (
    <Card white>
      <Text accessibilityRole="alert" style={styles.errorTitle}>
        {title}
      </Text>
      <Body>{message}</Body>
      <Button label={retryLabel} onPress={onRetry} />
    </Card>
  );
}

export function InlineError({ message }: { message: string }) {
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
  errorTitle: {
    color: colors.error,
    ...typography.title,
    fontFamily: fonts.bold,
  },
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
