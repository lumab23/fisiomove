import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  useIsFocused,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import { useCameraPermission } from 'react-native-vision-camera';
import { friendlyErrorMessage } from '../../api/errors';
import { Screen } from '../../components/Screen';
import {
  ErrorState,
  InlineError,
  LoadingState,
} from '../../components/ScreenStates';
import type { Workout } from '../../contracts/domain';
import { useActiveSession } from '../../features/session/ActiveSession';
import {
  CameraMessage,
  CameraSettingsSteps,
} from '../../features/vision/CameraGuidance';
import { LocalPoseCamera } from '../../features/vision/LocalPoseCamera';
import { useWorkout } from '../../integration/useProfessionalData';
import {
  resetToPatientTabs,
  useFrontendNavigation,
  type FrontendStackParamList,
} from '../../navigation/frontendTypes';
import type { PatientStackParamList } from '../../navigation/types';
import { useSessionSync } from '../../sync/SessionSyncContext';
import { Body, Button, Card, EmptyState, Mascot, styles } from '../../ui';
import { exerciseText, sideLabels, textLanguage } from './workoutText';

type WorkoutRoute = PatientStackParamList['PatientPreparation'];

export const workoutUpdatedText =
  'Seu treino foi atualizado pelo fisioterapeuta';

/**
 * Published workout of the route revision. A 404 (edited back to draft or
 * archived) or another revision means the prescription changed.
 */
function useRouteWorkout({ workoutId, workoutRevisionId }: WorkoutRoute) {
  const { state, reload } = useWorkout(workoutId);
  if (state.status === 'idle' || state.status === 'loading') {
    return { status: 'loading' as const };
  }
  if (state.status === 'failure') {
    return state.kind === 'not_found'
      ? { status: 'outdated' as const }
      : { status: 'failure' as const, message: state.message, reload };
  }
  const workout = state.data;
  if (
    workout.status !== 'published' ||
    workout.current_revision_id !== workoutRevisionId ||
    workout.items.length === 0
  ) {
    return { status: 'outdated' as const };
  }
  return { status: 'ready' as const, workout };
}

/** First item by position: the one framed before the session starts. */
function firstItem(workout: Workout) {
  return [...workout.items].sort(
    (left, right) => left.position - right.position,
  )[0];
}

function WorkoutGate({
  route,
  back,
  title,
  children,
}: {
  route: WorkoutRoute;
  back: string;
  title?: string;
  children: (workout: Workout) => ReactNode;
}) {
  const result = useRouteWorkout(route);
  if (result.status === 'ready') {
    return <>{children(result.workout)}</>;
  }
  return (
    <Screen back={back} title={title}>
      {result.status === 'loading' ? (
        <LoadingState label="Carregando seu treino" />
      ) : result.status === 'failure' ? (
        <ErrorState
          title="Não foi possível carregar seu treino"
          message={result.message}
          onRetry={result.reload}
        />
      ) : (
        <OutdatedWorkout route={route} />
      )}
    </Screen>
  );
}

/** Discards the draft of the old revision (DEC-009) and sends the patient back. */
function OutdatedWorkout({ route }: { route: WorkoutRoute }) {
  const navigation = useFrontendNavigation();
  const { findDraft, discardDraft } = useSessionSync();
  const { workoutId, workoutRevisionId } = route;
  useEffect(() => {
    findDraft(workoutId, workoutRevisionId)
      .then(draft => draft && discardDraft(draft.client_session_id))
      .catch(() => undefined);
  }, [discardDraft, findDraft, workoutId, workoutRevisionId]);
  return (
    <EmptyState
      title={workoutUpdatedText}
      action={{
        label: 'Ver meu treino',
        icon: 'activity',
        onPress: () => resetToPatientTabs(navigation, 'workout'),
      }}
    >
      Confira o treino novo antes de começar.
    </EmptyState>
  );
}

/** Preparation, permission and framing share the same route params. */
function useWorkoutRoute(): WorkoutRoute {
  return useRoute<RouteProp<FrontendStackParamList, 'PatientPreparation'>>()
    .params;
}

export function PatientPreparationScreen() {
  const route = useWorkoutRoute();
  return (
    <WorkoutGate route={route} back="Voltar" title="Prepare o celular">
      {workout => <Preparation route={route} workout={workout} />}
    </WorkoutGate>
  );
}

function Preparation({
  route,
  workout,
}: {
  route: WorkoutRoute;
  workout: Workout;
}) {
  const navigation = useFrontendNavigation();
  const { hasPermission: cameraReady } = useCameraPermission();
  return (
    <Screen
      back="Voltar"
      title="Prepare o celular"
      footer={
        <Button
          label="Continuar"
          onPress={() =>
            navigation.navigate(
              cameraReady ? 'Calibration' : 'CameraPermission',
              route,
            )
          }
        />
      }
    >
      <Mascot />
      <Card white>
        {[
          'Apoie o celular em um local firme.',
          'Sente-se de frente para a câmera.',
          firstItem(workout).side === 'bilateral'
            ? 'Deixe os dois braços inteiros visíveis.'
            : 'Deixe o braço inteiro visível.',
        ].map((instruction, index) => (
          <View key={instruction} style={styles.step}>
            <Text style={styles.number}>{index + 1}</Text>
            <View style={styles.stepContent}>
              <Body>{instruction}</Body>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

export function CameraPermissionScreen() {
  const navigation = useFrontendNavigation();
  const route = useWorkoutRoute();
  const { status, requestPermission } = useCameraPermission();
  const [asked, setAsked] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  useEffect(() => {
    if (status === 'authorized') {
      navigation.replace('Calibration', route);
    }
  }, [navigation, route, status]);
  const backToExercises = () => resetToPatientTabs(navigation, 'workout');
  const activate = async () => {
    setRequesting(true);
    try {
      await requestPermission();
    } finally {
      setAsked(true);
      setRequesting(false);
    }
  };
  if (status === 'authorized') {
    return <Screen back="Preparação" />;
  }
  if (status === 'restricted') {
    return (
      <Screen back="Preparação">
        <CameraMessage
          icon="cameraOff"
          title="A câmera está bloqueada neste celular"
          description="Os ajustes do aparelho não deixam usar a câmera. Peça ajuda a quem cuida das configurações do seu celular."
        >
          <Button
            secondary
            label="Voltar aos exercícios"
            onPress={backToExercises}
          />
        </CameraMessage>
      </Screen>
    );
  }
  if (status === 'denied' || asked) {
    return (
      <Screen back="Preparação">
        <CameraMessage
          icon="cameraOff"
          title="A câmera está desativada"
          description="Para acompanhar seus movimentos durante o exercício, precisamos acessar a câmera do seu dispositivo."
        >
          {showSteps ? (
            <CameraSettingsSteps />
          ) : (
            <Button
              label="Como permitir a câmera"
              onPress={() => setShowSteps(true)}
            />
          )}
          <Button
            secondary
            label="Voltar aos exercícios"
            onPress={backToExercises}
          />
        </CameraMessage>
      </Screen>
    );
  }
  return (
    <Screen back="Preparação">
      <CameraMessage
        icon="camera"
        title="Vamos ativar sua câmera?"
        description="A câmera ajuda a acompanhar seus movimentos durante o exercício."
      >
        <Button
          icon="camera"
          label="Ativar câmera"
          disabled={requesting}
          onPress={activate}
        />
        <Button
          secondary
          label="Agora não"
          onPress={() => navigation.goBack()}
        />
      </CameraMessage>
      <Text style={[styles.demo, preparation.centered]}>
        As imagens ficam só no seu celular e não são enviadas.
      </Text>
    </Screen>
  );
}

/** "Confira o enquadramento" (Q-P5): live camera only; no calibration. */
export function CalibrationScreen() {
  const route = useWorkoutRoute();
  return (
    <WorkoutGate
      route={route}
      back="Preparação"
      title="Confira o enquadramento"
    >
      {workout => <Framing route={route} workout={workout} />}
    </WorkoutGate>
  );
}

function Framing({
  route,
  workout,
}: {
  route: WorkoutRoute;
  workout: Workout;
}) {
  const navigation = useFrontendNavigation();
  const isFocused = useIsFocused();
  const { discardOutdatedDrafts, findDraft, prepare } = useSessionSync();
  const { begin } = useActiveSession();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const item = firstItem(workout);
  const text = exerciseText(item);
  const bothArms = item.side === 'bilateral';

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      // The draft is created only here and reused for the same revision.
      // Drafts of an older revision of this workout can never be finished.
      await discardOutdatedDrafts(route.workoutId, route.workoutRevisionId);
      const draft =
        (await findDraft(route.workoutId, route.workoutRevisionId)) ??
        (await prepare(route.workoutId, route.workoutRevisionId));
      begin(workout, draft);
      navigation.replace('PatientExercise', {
        clientSessionId: draft.client_session_id,
      });
    } catch (cause) {
      setError(friendlyErrorMessage(cause));
      setStarting(false);
    }
  };

  return (
    <Screen
      back="Preparação"
      title="Confira o enquadramento"
      footer={
        <>
          {error ? <InlineError message={error} /> : null}
          <Button
            label="Começar exercício"
            disabled={starting}
            onPress={start}
          />
        </>
      }
    >
      <Card>
        <LocalPoseCamera side={item.side} active={isFocused} />
      </Card>
      <Card white>
        <Text
          accessibilityLanguage={textLanguage(text.original)}
          style={styles.cardTitle}
        >
          {text.name}
        </Text>
        <Body>{sideLabels[item.side]}</Body>
        <Body>
          {bothArms
            ? 'Veja se os dois braços aparecem inteiros na imagem.'
            : 'Veja se o braço aparece inteiro na imagem.'}
        </Body>
        <Text style={styles.demo}>
          Os pontos são estimativas; não validam o movimento.
        </Text>
      </Card>
    </Screen>
  );
}

const preparation = StyleSheet.create({
  centered: { textAlign: 'center' },
});
