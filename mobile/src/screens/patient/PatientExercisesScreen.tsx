import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { ExerciseImageGallery } from '../../components/ExerciseImageGallery';
import { Screen } from '../../components/Screen';
import { ErrorState, LoadingState } from '../../components/ScreenStates';
import { SegmentedControl } from '../../components/SegmentedControl';
import {
  currentWeek,
  useMyProgress,
  useMySessions,
  useMyWorkouts,
} from '../../integration/usePatientData';
import {
  usePatientTabNavigation,
  type ExerciseSection,
  type PatientTabParamList,
} from '../../navigation/frontendTypes';
import { colors, fonts, radii, spacing, typography } from '../../theme/theme';
import {
  Body,
  Card,
  EmptyState,
  ListGroup,
  ListRow,
  SectionTitle,
} from '../../ui';
import { useSessionSync } from '../../sync/SessionSyncContext';
import type { PendingSession } from '../../sync/types';
import { PendingSessionRow, SessionRow } from './SessionRow';
import { StartWorkoutButton } from './StartWorkoutButton';
import {
  exerciseImages,
  exerciseSourceText,
  exerciseText,
  originalLanguageSeal,
  prescriptionText,
  textLanguage,
} from './workoutText';

const sections = [
  ['workout', 'Meu treino'],
  ['history', 'Histórico'],
  ['progress', 'Progresso'],
] as const;

/** History shows the most recent sessions returned in one page. */
const historyPageSize = 50;

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
  const { state, reload } = useMyWorkouts();
  if (state.status === 'idle' || state.status === 'loading') {
    return <LoadingState label="Carregando seu treino" />;
  }
  if (state.status === 'failure') {
    return (
      <ErrorState
        title="Não foi possível carregar seu treino"
        message={state.message}
        onRetry={reload}
      />
    );
  }
  const workouts = state.data.items;
  if (state.status === 'empty' || !workouts.length) {
    return (
      <EmptyState title="Nenhum treino publicado">
        Seu fisioterapeuta ainda está preparando o treino.
      </EmptyState>
    );
  }
  return (
    <>
      {workouts.map((workout, index) => (
        <View key={workout.id} style={exercises.section}>
          <SectionTitle>
            {workouts.length > 1
              ? `Treino ${index + 1}`
              : 'Exercícios prescritos'}
          </SectionTitle>
          <ListGroup>
            {workout.items.map(item => {
              const text = exerciseText(item);
              const images = exerciseImages(item.exercise_snapshot);
              return (
                <View key={item.id}>
                  <ListRow
                    icon="activity"
                    title={text.name}
                    titleLanguage={textLanguage(text.original)}
                    description={[
                      text.original ? originalLanguageSeal : null,
                      prescriptionText(item),
                      item.professional_guidance,
                      exerciseSourceText(item),
                    ]
                      .filter(Boolean)
                      .join('\n')}
                  />
                  {images.length ? (
                    <View style={exercises.image}>
                      <ExerciseImageGallery
                        limit={1}
                        images={images}
                        exerciseName={text.name}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </ListGroup>
          {workout.instructions ? (
            <Card white title="Orientação do profissional">
              <Body>{workout.instructions}</Body>
            </Card>
          ) : null}
          <StartWorkoutButton workout={workout} />
        </View>
      ))}
    </>
  );
}

const filters = [
  ['all', 'Todas'],
  ['completed', 'Concluídas'],
  ['interrupted', 'Interrompidas'],
] as const;

function History({ onStart }: { onStart: () => void }) {
  const { state, reload, refresh } = useMySessions(historyPageSize);
  const { pending, lastReport } = useSessionSync();
  const [filter, setFilter] = useState<(typeof filters)[number][0]>('all');
  // A session sent in the background moves from the local queue to the API.
  const seenReport = useRef(lastReport);
  useEffect(() => {
    if (lastReport !== seenReport.current) {
      seenReport.current = lastReport;
      if (lastReport?.sent) {
        refresh();
      }
    }
  }, [lastReport, refresh]);
  if (state.status === 'idle' || state.status === 'loading') {
    return <LoadingState label="Carregando seu histórico" />;
  }
  const waiting = pending.filter(
    item => filter === 'all' || item.payload.status === filter,
  );
  if (state.status === 'failure') {
    return (
      <>
        <PendingSessions items={waiting} />
        <ErrorState
          title="Não foi possível carregar o histórico"
          message={state.message}
          onRetry={reload}
        />
      </>
    );
  }
  if (state.status === 'empty' && !pending.length) {
    return (
      <EmptyState
        title="Nenhuma sessão ainda"
        action={{ label: 'Ver meu treino', icon: 'activity', onPress: onStart }}
      >
        Suas sessões aparecerão aqui depois do primeiro treino.
      </EmptyState>
    );
  }
  const sessions = state.data.items.filter(
    session => filter === 'all' || session.status === filter,
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
      <PendingSessions items={waiting} />
      {sessions.length ? (
        <ListGroup>
          {sessions.map(session => (
            <SessionRow key={session.id} session={session} />
          ))}
        </ListGroup>
      ) : waiting.length ? null : (
        <EmptyState title="Nenhuma sessão aqui">
          Escolha outro filtro para ver as demais sessões.
        </EmptyState>
      )}
    </>
  );
}

/** Sessions saved on this device and not yet accepted by the API. */
function PendingSessions({ items }: { items: PendingSession[] }) {
  if (!items.length) {
    return null;
  }
  return (
    <ListGroup>
      {items.map(item => (
        <PendingSessionRow
          key={item.payload.client_session_id}
          pending={item}
        />
      ))}
    </ListGroup>
  );
}

function formatDay(date: string) {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

function Progress({ onStart }: { onStart: () => void }) {
  const [period] = useState(() => currentWeek(new Date()));
  const { state, reload } = useMyProgress(period);
  const weekLabel = `Semana de ${formatDay(period.period_start)} a ${formatDay(
    period.period_end,
  )}`;
  let summary: React.ReactNode;
  if (state.status === 'idle' || state.status === 'loading') {
    summary = <LoadingState label="Carregando seu progresso" />;
  } else if (state.status === 'failure') {
    summary = (
      <ErrorState
        title="Não foi possível carregar o progresso"
        message={state.message}
        onRetry={reload}
      />
    );
  } else if (state.status === 'empty') {
    summary = (
      <EmptyState
        title="Nenhuma sessão nesta semana"
        action={{ label: 'Ver meu treino', icon: 'activity', onPress: onStart }}
      >
        Seu resumo da semana aparecerá aqui depois do primeiro treino.
      </EmptyState>
    );
  } else {
    const data = state.data;
    const prescribed = data.prescribed_repetitions;
    const performed = Math.min(data.performed_repetitions, prescribed);
    summary = (
      <>
        <View style={exercises.stats}>
          <Stat value={data.completed_sessions} label="Sessões concluídas" />
          <Stat
            value={data.interrupted_sessions}
            label="Sessões interrompidas"
          />
          <Stat
            value={data.performed_repetitions}
            label="Repetições realizadas"
          />
        </View>
        {prescribed > 0 ? (
          <Card white title="Repetições da semana">
            <Body>
              {data.performed_repetitions} de {prescribed} repetições prescritas
            </Body>
            <View
              style={exercises.bar}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel="Repetições prescritas na semana"
              accessibilityValue={{ min: 0, max: prescribed, now: performed }}
            >
              <View
                style={[
                  exercises.barFill,
                  { width: `${(performed / prescribed) * 100}%` },
                ]}
              />
            </View>
          </Card>
        ) : null}
      </>
    );
  }
  return (
    <>
      <Text style={exercises.period}>{weekLabel}</Text>
      {summary}
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
  section: { gap: spacing.md },
  image: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  period: {
    color: colors.textMuted,
    ...typography.bodySmall,
    fontFamily: fonts.regular,
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
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
