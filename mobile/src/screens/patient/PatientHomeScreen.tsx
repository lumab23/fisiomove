import { StyleSheet, Text, View } from 'react-native';
import { ExerciseImageGallery } from '../../components/ExerciseImageGallery';
import { Icon } from '../../components/Icon';
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
  EmptyState,
  Link,
  ListGroup,
  Mascot,
  SectionTitle,
} from '../../ui';
import { SessionRow } from './SessionRow';
import { StartWorkoutButton } from './StartWorkoutButton';
import {
  exerciseImages,
  exerciseSourceText,
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
        <Mascot kind="home" small />
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
        <Link
          label="Ver histórico e progresso  ›"
          onPress={() =>
            navigation.navigate('PatientExercises', { section: 'progress' })
          }
        />
      </View>
      <View style={home.safety} accessible>
        <Icon name="info" size={20} color={colors.textMuted} />
        <Text style={home.safetyText}>
          Se sentir dor ou desconforto, pare e siga a orientação do seu
          fisioterapeuta.
        </Text>
      </View>
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
    return (
      <EmptyState title="Nenhum treino publicado">
        Seu fisioterapeuta ainda está preparando o treino.
      </EmptyState>
    );
  }
  return (
    <View style={home.hero}>
      <Text style={home.eyebrow}>SEU TREINO</Text>
      {workout.items.map(item => {
        const text = exerciseText(item);
        const source = exerciseSourceText(item);
        return (
          <View key={item.id} style={home.item}>
            <Text
              accessibilityRole="header"
              accessibilityLanguage={textLanguage(text.original)}
              style={home.title}
            >
              {text.name}
            </Text>
            <ExerciseImageGallery
              inverse
              limit={1}
              images={exerciseImages(item.exercise_snapshot)}
              exerciseName={text.name}
            />
            <Text style={home.meta}>{prescriptionText(item)}</Text>
            {item.professional_guidance ? (
              <Text style={home.meta}>{item.professional_guidance}</Text>
            ) : null}
            {source ? <Text style={home.meta}>{source}</Text> : null}
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

const home = StyleSheet.create({
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
  safety: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  safetyText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 23,
  },
});
