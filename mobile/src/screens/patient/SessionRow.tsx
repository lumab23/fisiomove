import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { demoExercise, type DemoSession } from '../../demo/model';
import { colors, fonts } from '../../theme/theme';
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

export function SessionRow({ session }: { session: DemoSession }) {
  const goal = demoExercise.series * session.repetitions;
  return (
    <View
      style={row.container}
      accessible
      accessibilityLabel={`${session.completed ? 'Treino concluído' : 'Treino interrompido'} em ${formatSessionDate(session.date)}. ${session.total} de ${goal} repetições.`}
    >
      <Icon
        name={session.completed ? 'check' : 'alert'}
        size={24}
        color={session.completed ? colors.success : colors.warningText}
      />
      <View style={row.text}>
        <Text style={row.title}>{demoExercise.name}</Text>
        <Text style={row.meta}>{formatSessionDate(session.date)}</Text>
        <Text style={row.meta}>
          {session.total} de {goal} repetições
        </Text>
      </View>
      <Badge
        label={session.completed ? 'Concluído' : 'Interrompido'}
        tone={session.completed ? 'success' : 'warning'}
      />
    </View>
  );
}

const row = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
  },
  text: { flex: 1, minWidth: 160, gap: 2 },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 17,
    lineHeight: 24,
  },
  meta: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
  },
});
