import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { SegmentedControl } from '../../components/SegmentedControl';
import { useDemo, useDemoPatient } from '../../demo/DemoContext';
import { demoExercise } from '../../demo/model';
import {
  usePatientTabNavigation,
  type ExerciseSection,
  type PatientTabParamList,
} from '../../navigation/frontendTypes';
import { colors, fonts, radii } from '../../theme/theme';
import {
  Badge,
  Body,
  Button,
  Card,
  EmptyState,
  ListGroup,
  ListRow,
  SectionTitle,
  styles,
} from '../../ui';
import { formatSessionDate, SessionRow } from './SessionRow';

const sections = [
  ['workout', 'Meu treino'],
  ['history', 'Histórico'],
  ['progress', 'Progresso'],
] as const;

export function PatientExercisesScreen() {
  const navigation = usePatientTabNavigation();
  const route = useRoute<RouteProp<PatientTabParamList, 'PatientExercises'>>();
  const requested = route.params?.section;
  const [section, setSection] = useState<ExerciseSection>(
    requested ?? 'workout',
  );
  useEffect(() => {
    if (requested) {
      setSection(requested);
      navigation.setParams({ section: undefined });
    }
  }, [requested, navigation]);
  return (
    <Screen tab title="Exercícios">
      <SegmentedControl
        accessibilityLabel="Seções de exercícios"
        options={sections}
        value={section}
        onChange={setSection}
      />
      {section === 'workout' && <MyWorkout />}
      {section === 'history' && (
        <History onStart={() => setSection('workout')} />
      )}
      {section === 'progress' && (
        <Progress onStart={() => setSection('workout')} />
      )}
    </Screen>
  );
}

function MyWorkout() {
  const navigation = usePatientTabNavigation();
  const patient = useDemoPatient();
  const { dispatch } = useDemo();
  if (!patient.published) {
    return (
      <EmptyState title="Nenhum treino publicado">
        Seu fisioterapeuta ainda está preparando o treino.
      </EmptyState>
    );
  }
  return (
    <>
      <View style={exercises.section}>
        <SectionTitle>Exercícios prescritos</SectionTitle>
        <ListGroup>
          <ListRow
            icon="activity"
            title={demoExercise.name}
            description={`${demoExercise.series} séries · ${patient.repetitions} repetições · ${demoExercise.side}`}
          />
        </ListGroup>
      </View>
      {patient.note !== '' && (
        <Card white title="Orientação do profissional">
          <Body>{patient.note}</Body>
        </Card>
      )}
      <Button
        icon="play"
        label="Iniciar treino"
        accessibilityHint="Abre a preparação do exercício"
        onPress={() => {
          dispatch({ type: 'start' });
          navigation.navigate('PatientPreparation');
        }}
      />
    </>
  );
}

const filters = [
  ['all', 'Todas'],
  ['completed', 'Concluídas'],
  ['interrupted', 'Interrompidas'],
] as const;

function History({ onStart }: { onStart: () => void }) {
  const { state } = useDemo();
  const patient = useDemoPatient();
  const [filter, setFilter] = useState<(typeof filters)[number][0]>('all');
  const sessions = state.sessions.filter(
    session =>
      session.patientId === patient.id &&
      (filter === 'all' || session.completed === (filter === 'completed')),
  );
  return (
    <>
      <SegmentedControl
        compact
        accessibilityLabel="Filtrar sessões"
        options={filters}
        value={filter}
        onChange={setFilter}
      />
      {sessions.length ? (
        <ListGroup>
          {sessions.map(session => (
            <SessionRow key={session.id} session={session} />
          ))}
        </ListGroup>
      ) : (
        <EmptyState
          title={
            filter === 'all' ? 'Nenhuma sessão ainda' : 'Nenhuma sessão aqui'
          }
          action={
            filter === 'all'
              ? { label: 'Ver meu treino', icon: 'activity', onPress: onStart }
              : undefined
          }
        >
          {filter === 'all'
            ? 'Suas sessões aparecerão aqui depois do primeiro treino.'
            : 'Escolha outro filtro para ver as demais sessões.'}
        </EmptyState>
      )}
    </>
  );
}

function Progress({ onStart }: { onStart: () => void }) {
  const { state } = useDemo();
  const patient = useDemoPatient();
  const sessions = state.sessions.filter(s => s.patientId === patient.id);
  if (!sessions.length) {
    return (
      <EmptyState
        title="Nenhuma sessão ainda"
        action={{ label: 'Ver meu treino', icon: 'activity', onPress: onStart }}
      >
        Seu resumo aparecerá aqui depois do primeiro treino.
      </EmptyState>
    );
  }
  const completed = sessions.filter(s => s.completed);
  const last = sessions[0];
  const goal = demoExercise.series * last.repetitions;
  return (
    <>
      <View style={exercises.stats}>
        <Stat value={completed.length} label="Sessões concluídas" />
        <Stat
          value={sessions.length - completed.length}
          label="Sessões interrompidas"
        />
        <Stat
          value={sessions.reduce((sum, s) => sum + s.total, 0)}
          label="Repetições realizadas"
        />
      </View>
      <Card white title="Última sessão">
        <Text style={styles.eyebrow}>{formatSessionDate(last.date)}</Text>
        <Body>
          {last.total} de {goal} repetições da meta
        </Body>
        <View
          style={exercises.bar}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Repetições da meta"
          accessibilityValue={{ min: 0, max: goal, now: last.total }}
        >
          <View
            style={[
              exercises.barFill,
              { width: `${Math.min(100, (last.total / goal) * 100)}%` },
            ]}
          />
        </View>
        <Badge
          label={last.completed ? 'Meta do treino concluída' : 'Não concluída'}
          tone={last.completed ? 'success' : 'warning'}
        />
      </Card>
      <View style={exercises.section}>
        <SectionTitle>Conquistas</SectionTitle>
        {completed.length ? (
          <ListGroup>
            {completed.map(session => (
              <ListRow
                key={session.id}
                icon="award"
                title="Meta do treino concluída"
                description={formatSessionDate(session.date)}
              />
            ))}
          </ListGroup>
        ) : (
          <Body>Conclua um treino completo para registrar uma conquista.</Body>
        )}
        <Text style={styles.demo}>
          Conquistas acompanham a meta prescrita, sem incentivar repetições
          extras.
        </Text>
      </View>
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View
      style={exercises.stat}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text style={exercises.statValue}>{value}</Text>
      <Text style={exercises.statLabel}>{label}</Text>
    </View>
  );
}

const exercises = StyleSheet.create({
  section: { gap: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: {
    flexGrow: 1,
    flexBasis: 100,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 2,
  },
  statValue: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 34,
  },
  statLabel: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 20,
  },
  bar: {
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
});
