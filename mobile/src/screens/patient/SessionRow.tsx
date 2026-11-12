import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import type { SessionSummary } from '../../contracts/domain';
import type { PendingSession } from '../../sync/types';
import { colors, fonts, spacing, typography } from '../../theme/theme';
import { Badge } from '../../ui';

export function formatSessionDate(date: string) {
  return new Date(date).toLocaleString('pt-BR', {
    timeZone: 'America/Fortaleza',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SessionRow({ session }: { session: SessionSummary }) {
  const completed = session.status === 'completed';
  const status = completed ? 'Treino concluído' : 'Treino interrompido';
  const date = formatSessionDate(session.started_at);
  const repetitions = `${session.performed_repetitions} de ${session.prescribed_repetitions} repetições`;
  return (
    <View
      style={row.container}
      accessible
      accessibilityLabel={`${status} em ${date}. ${repetitions}.`}
    >
      <Icon
        name={completed ? 'check' : 'alert'}
        size={24}
        color={completed ? colors.success : colors.warningText}
      />
      <View style={row.text}>
        <Text style={row.title}>{status}</Text>
        <Text style={row.meta}>{date}</Text>
        <Text style={row.meta}>{repetitions}</Text>
      </View>
      <Badge
        label={completed ? 'Concluído' : 'Interrompido'}
        tone={completed ? 'success' : 'warning'}
      />
    </View>
  );
}

/**
 * Session finished on this device and still in the local queue. The server
 * summary (with the prescribed total) appears once it is sent.
 */
export function PendingSessionRow({ pending }: { pending: PendingSession }) {
  const { payload } = pending;
  const completed = payload.status === 'completed';
  const status = completed ? 'Treino concluído' : 'Treino interrompido';
  const date = formatSessionDate(payload.started_at);
  const total = payload.items.reduce(
    (sum, item) => sum + item.completed_repetitions,
    0,
  );
  const repetitions = `${total} ${total === 1 ? 'repetição' : 'repetições'}`;
  const badge =
    pending.state === 'blocked' ? 'Não enviado' : 'Aguardando envio';
  return (
    <View
      style={row.container}
      accessible
      accessibilityLabel={`${status} em ${date}. ${repetitions}. ${badge}.`}
    >
      <Icon name="history" size={24} color={colors.textMuted} />
      <View style={row.text}>
        <Text style={row.title}>{status}</Text>
        <Text style={row.meta}>{date}</Text>
        <Text style={row.meta}>{repetitions}</Text>
      </View>
      <Badge label={badge} tone="warning" />
    </View>
  );
}

const row = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  text: { flex: 1, minWidth: 160, gap: spacing.xs },
  title: {
    color: colors.text,
    ...typography.body,
    fontFamily: fonts.bold,
  },
  meta: {
    color: colors.textMuted,
    ...typography.bodySmall,
    fontFamily: fonts.regular,
  },
});
