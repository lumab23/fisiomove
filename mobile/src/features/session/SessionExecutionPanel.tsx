import { useEffect, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, spacing } from '../../theme/theme';
import type { FeedbackInterval } from './SessionController';
import type { SessionExecutionSnapshot } from './SessionExecution';

interface Props {
  snapshot: SessionExecutionSnapshot;
  currentExerciseName: string;
  feedbackMessage: string;
  onPause(): void;
  onResume(): void;
  onComplete(): void;
  onInterrupt(): void;
  onTick(): void;
  onAudioFeedback?(message: string): void;
  busy?: boolean;
  feedbackInterval: FeedbackInterval;
  mascot?: ReactNode;
}

export function SessionExecutionPanel({
  snapshot,
  currentExerciseName,
  feedbackMessage,
  onPause,
  onResume,
  onComplete,
  onInterrupt,
  onTick,
  onAudioFeedback,
  busy = false,
  feedbackInterval,
  mascot,
}: Props) {
  useEffect(() => {
    if (feedbackMessage && feedbackInterval.shouldAnnounce(Date.now())) {
      AccessibilityInfo.announceForAccessibility(feedbackMessage);
      onAudioFeedback?.(feedbackMessage);
    }
  }, [feedbackInterval, feedbackMessage, onAudioFeedback]);

  useEffect(() => {
    if (snapshot.status !== 'active' && snapshot.status !== 'resting') {
      return;
    }
    const timer = setInterval(onTick, 250);
    return () => clearInterval(timer);
  }, [onTick, snapshot.status]);

  const current = snapshot.items[snapshot.current_item_index];
  const repetitions = current?.completed_repetitions ?? 0;
  const sets = current?.completed_sets ?? 0;

  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <Text style={styles.eyebrow}>SESSÃO</Text>
      <Text style={styles.title} accessibilityRole="header">
        {snapshot.status === 'resting'
          ? 'Tempo de descanso'
          : currentExerciseName}
      </Text>
      {mascot}
      <Text style={styles.feedback} accessibilityRole="alert">
        {feedbackMessage}
      </Text>
      <View style={styles.metrics}>
        <Metric label="Séries" value={String(sets)} />
        <Metric label="Repetições" value={String(repetitions)} />
        <Metric
          label={
            snapshot.status === 'resting' ? 'Descanso (s)' : 'Tempo ativo (s)'
          }
          value={String(
            Math.ceil(
              snapshot.status === 'resting'
                ? snapshot.rest_remaining_ms / 1000
                : snapshot.active_duration_ms / 1000,
            ),
          )}
        />
      </View>
      <View style={styles.actions}>
        {snapshot.status === 'completed' ? (
          <Action
            label={busy ? 'Salvando sessão…' : 'Concluir e salvar'}
            disabled={busy}
            onPress={onComplete}
          />
        ) : null}
        {snapshot.status === 'paused' ? (
          <Action label="Retomar" onPress={onResume} />
        ) : snapshot.status === 'active' || snapshot.status === 'resting' ? (
          <Action label="Pausar" onPress={onPause} />
        ) : null}
        {snapshot.status !== 'completed' &&
        snapshot.status !== 'interrupted' ? (
          <Action
            label="Interromper sessão"
            variant="secondary"
            disabled={busy}
            onPress={() =>
              Alert.alert(
                'Interromper sessão?',
                'O progresso parcial desta sessão será preservado.',
                [
                  { text: 'Continuar sessão', style: 'cancel' },
                  {
                    text: 'Interromper',
                    style: 'destructive',
                    onPress: onInterrupt,
                  },
                ],
              )
            }
          />
        ) : null}
      </View>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Action({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
}: {
  label: string;
  onPress(): void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondaryButton,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'secondary' && styles.secondaryButtonText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  feedback: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
    padding: spacing.md,
  },
  metrics: { flexDirection: 'row', gap: spacing.sm },
  metric: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 14,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  metricValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  metricLabel: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  actions: { gap: spacing.sm },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderColor: colors.error,
    borderWidth: 1,
  },
  buttonText: { color: colors.surface, fontSize: 16, fontWeight: '700' },
  secondaryButtonText: { color: colors.error },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
});
