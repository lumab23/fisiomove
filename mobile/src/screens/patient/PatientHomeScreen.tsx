import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import {
  ErrorState,
  InlineError,
  LoadingState,
} from '../../components/ScreenStates';
import type { SessionPage, WorkoutPage } from '../../contracts/domain';
import {
  useMySessions,
  useMyWorkouts,
  usePatientProfile,
  type Resource,
} from '../../integration/usePatientData';
import { usePatientTabNavigation } from '../../navigation/frontendTypes';
import { colors, fonts, radii, spacing } from '../../theme/theme';
import {
  Button,
  Link,
  ListGroup,
  ListRow,
  Mascot,
  SectionTitle,
  styles as ui,
} from '../../ui';
import { notesTitle } from './PatientNotesScreen';
import { SessionRow } from './SessionRow';
import { StartWorkoutButton } from './StartWorkoutButton';
import {
  exerciseText,
  prescriptionText,
  textLanguage,
} from './workoutText';

export function firstNameOf(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

export function PatientHomeScreen() {
  const navigation = usePatientTabNavigation();
  const profile = usePatientProfile();
  const workouts = useMyWorkouts();
  const sessions = useMySessions(1);
  const firstName =
    profile.state.status === 'success'
      ? firstNameOf(profile.state.data.full_name)
      : '';
  return (
    <Screen tab>
      <View style={home.greeting}>
        <Text accessibilityRole="header" style={home.hello}>
          {firstName ? `Olá, ${firstName}!` : 'Olá!'}
        </Text>
      </View>
      <WorkoutSummary
        resource={workouts}
        onOpen={() =>
          navigation.navigate('PatientExercises', { section: 'workout' })
        }
      />
      <View style={home.section}>
        <SectionTitle>Última atividade</SectionTitle>
        <LastActivity resource={sessions} />
        {sessions.state.status === 'success' &&
        sessions.state.data.items.length > 0 ? (
          <Link
            label="Ver histórico e progresso  ›"
            onPress={() =>
              navigation.navigate('PatientExercises', { section: 'progress' })
            }
          />
        ) : null}
      </View>
      <ListGroup>
        <ListRow
          icon="message"
          title={notesTitle}
          accessibilityHint="Abre os recados que seu fisioterapeuta deixou para você"
          onPress={() => navigation.navigate('PatientNotes')}
        />
      </ListGroup>
    </Screen>
  );
}

function WorkoutSummary({
  resource: { state, reload },
  onOpen,
}: {
  resource: Resource<WorkoutPage>;
  onOpen: () => void;
}) {
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
  const workout = state.data.items[0];
  if (state.status === 'empty' || !workout) {
    return <NoWorkoutCard />;
  }
  return (
    <View style={home.hero}>
      <Text style={home.eyebrow}>SEU TREINO</Text>
      {workout.items.map(item => {
        const text = exerciseText(item);
        return (
          <View key={item.id} style={home.item}>
            <Text
              accessibilityRole="header"
              accessibilityLanguage={textLanguage(text.original)}
              style={home.title}
            >
              {text.name}
            </Text>
            <Text style={home.meta}>{prescriptionText(item)}</Text>
            {item.professional_guidance ? (
              <Text style={home.meta}>{item.professional_guidance}</Text>
            ) : null}
          </View>
        );
      })}
      {workout.instructions ? (
        <View style={home.note}>
          <Text style={home.noteLabel}>Orientação do profissional</Text>
          <Text style={home.noteText}>{workout.instructions}</Text>
        </View>
      ) : null}
      <StartWorkoutButton inverse workout={workout} />
      <Button
        inverse
        compact
        icon="activity"
        label="Ver meu treino"
        accessibilityHint="Abre a lista de exercícios prescritos"
        onPress={onOpen}
      />
    </View>
  );
}

function LastActivity({
  resource: { state, reload },
}: {
  resource: Resource<SessionPage>;
}) {
  if (state.status === 'idle' || state.status === 'loading') {
    return <LoadingState label="Carregando a última atividade" />;
  }
  if (state.status === 'failure') {
    return (
      <>
        <InlineError message={state.message} />
        <Link label="Tentar novamente" onPress={reload} />
      </>
    );
  }
  const last = state.data.items[0];
  if (state.status === 'empty' || !last) {
    return <Text style={home.muted}>Nenhuma sessão realizada ainda.</Text>;
  }
  return (
    <ListGroup>
      <SessionRow session={last} />
    </ListGroup>
  );
}

/**
 * Compact horizontal card: texts on the left, the pink mascot on the right.
 * The mascot keeps a fixed size and never shrinks; the texts take the rest of
 * the width and wrap (large fonts grow the card instead of squeezing it).
 */
function NoWorkoutCard() {
  return (
    <View style={[ui.card, ui.white, home.noWorkout]}>
      <View style={home.noWorkoutText}>
        <Text accessibilityRole="header" style={home.noWorkoutTitle}>
          Nenhum treino disponível
        </Text>
        <Text style={ui.body}>
          Seu fisioterapeuta está preparando seu treino.
        </Text>
      </View>
      <View style={home.noWorkoutMascot}>
        <Mascot small />
      </View>
    </View>
  );
}

const home = StyleSheet.create({
  noWorkout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.lg,
    paddingLeft: spacing.xl,
    paddingRight: spacing.lg,
  },
  noWorkoutText: { flex: 1, minWidth: 0, gap: spacing.xs },
  noWorkoutTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 26,
  },
  noWorkoutMascot: { flexShrink: 0 },
  greeting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  hello: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 26,
    lineHeight: 32,
  },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  item: { gap: spacing.xs },
  eyebrow: {
    color: colors.onPrimaryMuted,
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  title: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 28,
  },
  meta: {
    color: colors.onPrimaryMuted,
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 24,
  },
  note: {
    backgroundColor: colors.primaryPressed,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  noteLabel: {
    color: colors.onPrimaryMuted,
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 20,
  },
  noteText: {
    color: colors.onPrimary,
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 24,
  },
  section: { gap: spacing.sm },
  muted: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 24,
  },
});
