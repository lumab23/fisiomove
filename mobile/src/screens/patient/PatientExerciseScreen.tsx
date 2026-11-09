import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useFocusEffect,
  useIsFocused,
  usePreventRemove,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReduceMotion } from '../../accessibility/useReduceMotion';
import { friendlyErrorMessage } from '../../api/errors';
import { Icon, type IconName } from '../../components/Icon';
import { Screen } from '../../components/Screen';
import { InlineError } from '../../components/ScreenStates';
import {
  currentWorkoutItem,
  useActiveSession,
  type ActiveSession,
} from '../../features/session/ActiveSession';
import { useSessionResult } from '../../features/session/useSessionResult';
import { LocalPoseCamera } from '../../features/vision/LocalPoseCamera';
import { MovementEngine } from '../../features/exercise-engine/MovementEngine';
import {
  demoRuleForExercise,
  poseFrameFromObservation,
} from '../../features/exercise-engine/demoElbowFlexion';
import {
  resetToPatientTabs,
  useFrontendNavigation,
  type FrontendStackParamList,
} from '../../navigation/frontendTypes';
import {
  colors,
  fonts,
  layout,
  radii,
  spacing,
  typography,
} from '../../theme/theme';
import { Button, EmptyState } from '../../ui';
import {
  exerciseSourceText,
  exerciseText,
  sideLabels,
  textLanguage,
} from './workoutText';

/** Screen refresh while active or resting; not a clinical value. */
const CLOCK_REFRESH_MS = 1000;

/**
 * Execution of the published workout: reads the in-memory session;
 * repetitions are counted by touch (DEC-008). Pause and rest are internal
 * states (Q-T3); leaving the screen or the app pauses (RN20).
 */
export function PatientExerciseScreen() {
  const navigation = useFrontendNavigation();
  const { clientSessionId } =
    useRoute<RouteProp<FrontendStackParamList, 'PatientExercise'>>().params;
  const { session } = useActiveSession(clientSessionId);
  if (!session) {
    return (
      <Screen back="Voltar" title="Treino">
        <EmptyState
          title="Não encontramos o treino em andamento"
          action={{
            label: 'Voltar aos exercícios',
            onPress: () => resetToPatientTabs(navigation, 'workout'),
          }}
        >
          Abra seus exercícios e toque em Continuar treino.
        </EmptyState>
      </Screen>
    );
  }
  return <Execution session={session} />;
}

function Execution({ session }: { session: ActiveSession }) {
  const navigation = useFrontendNavigation();
  const { start, tick, countRepetition, pause, resume } = useActiveSession();
  const { snapshot, draft } = session;
  const clientSessionId = draft.client_session_id;
  const focused = useIsFocused();
  const reduceMotion = useReduceMotion();
  const pulse = useRef(new Animated.Value(1)).current;
  const result = useSessionResult(session.execution, draft);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  usePreventRemove(focused && !finished, () =>
    navigation.navigate('ConfirmExit', { clientSessionId }),
  );
  useEffect(() => {
    if (finished) {
      navigation.replace('PatientCompletion', { clientSessionId });
    }
  }, [clientSessionId, finished, navigation]);

  useEffect(() => {
    start();
  }, [start]);
  const running = snapshot.status === 'active' || snapshot.status === 'resting';
  useEffect(() => {
    if (!focused || !running) {
      return;
    }
    const timer = setInterval(tick, CLOCK_REFRESH_MS);
    return () => clearInterval(timer);
  }, [focused, running, tick]);

  // Leaving the screen or the app pauses counting and time (RN20).
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      const subscription = AppState.addEventListener('change', next => {
        if (next !== 'active') {
          pause();
        }
      });
      return () => {
        StatusBar.setBarStyle('dark-content');
        subscription.remove();
        pause();
      };
    }, [pause]),
  );

  const progress = snapshot.items[snapshot.current_item_index];
  const item = currentWorkoutItem(session);
  const demoRule = useMemo(
    () =>
      demoRuleForExercise(item.exercise_snapshot, item.rule_version, item.side),
    [item.exercise_snapshot, item.rule_version, item.side],
  );
  const movementEngine = useMemo(
    () =>
      demoRule
        ? new MovementEngine(demoRule, { smoothing_window_size: 4 })
        : null,
    [demoRule],
  );
  const automaticCount = demoRule !== null;
  const count = progress?.repetitions_in_current_set ?? 0;
  const goal = progress?.repetitions ?? item.repetitions;
  const sets = progress?.sets ?? item.sets;
  const setNumber = Math.min((progress?.completed_sets ?? 0) + 1, sets);
  const source = exerciseSourceText(item);
  const text = exerciseText(item);

  useEffect(() => {
    movementEngine?.setPaused(snapshot.status !== 'active');
  }, [movementEngine, snapshot.status]);

  const onPoseObservation = useCallback(
    (observation: Parameters<typeof poseFrameFromObservation>[0]) => {
      if (snapshot.status !== 'active' || !movementEngine || !demoRule) {
        return;
      }
      const side = item.side;
      if (side === 'bilateral') return;
      const update = movementEngine.update(
        poseFrameFromObservation(observation),
        side,
      );
      if (update.feedback === 'rep_completed') {
        countRepetition();
      }
    },
    [countRepetition, demoRule, item.side, movementEngine, snapshot.status],
  );

  useEffect(() => {
    if (count === 0 || reduceMotion !== false) {
      return;
    }
    pulse.setValue(1.15);
    Animated.spring(pulse, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, [count, pulse, reduceMotion]);

  const complete = async () => {
    setError(null);
    try {
      await result.complete();
      setFinished(true);
    } catch (cause) {
      setError(friendlyErrorMessage(cause));
    }
  };

  // Opening "Como fazer" pauses the session; the patient resumes manually.
  const openGuidance = () => {
    pause();
    navigation.navigate('MovementGuidance', { clientSessionId });
  };

  const paused = snapshot.status === 'paused';
  const restSeconds = Math.ceil(snapshot.rest_remaining_ms / 1000);

  return (
    <View style={exercise.root}>
      <View style={exercise.cameraArea}>
        <LocalPoseCamera
          immersive
          side={item.side}
          active={focused && snapshot.status === 'active'}
          onObservation={automaticCount ? onPoseObservation : undefined}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView edges={['top', 'left', 'right']} style={exercise.top}>
          <View style={exercise.titleBlock}>
            <Text style={exercise.itemLabel}>
              Exercício {snapshot.current_item_index + 1} de{' '}
              {snapshot.items.length}
            </Text>
            <Text
              accessibilityRole="header"
              accessibilityLanguage={textLanguage(text.original)}
              style={exercise.title}
            >
              {text.name}
            </Text>
            <Text style={exercise.subtitle}>{sideLabels[item.side]}</Text>
            {automaticCount ? (
              <Text style={exercise.demoNotice}>
                Contagem demonstrativa · não validada clinicamente
              </Text>
            ) : null}
          </View>
          <View style={exercise.controls}>
            {paused ? (
              <FloatingControl icon="play" label="Continuar" onPress={resume} />
            ) : (
              <FloatingControl icon="pause" label="Pausar" onPress={pause} />
            )}
            <FloatingControl
              icon="info"
              label="Como fazer"
              onPress={openGuidance}
            />
            <FloatingControl
              icon="close"
              label="Encerrar"
              onPress={() =>
                navigation.navigate('ConfirmExit', { clientSessionId })
              }
            />
          </View>
        </SafeAreaView>
      </View>

      <SafeAreaView edges={['bottom', 'left', 'right']} style={exercise.panel}>
        <View style={exercise.counterRow}>
          <View
            accessible
            accessibilityLabel={`Repetição ${count} de ${goal}`}
            accessibilityLiveRegion="polite"
          >
            <Text style={exercise.counterLabel}>Repetição</Text>
            <View style={exercise.countLine}>
              <Animated.Text
                style={[exercise.count, { transform: [{ scale: pulse }] }]}
              >
                {count}
              </Animated.Text>
              <Text style={exercise.goal}> de {goal}</Text>
            </View>
          </View>
          <View style={exercise.seriesPill}>
            <Text style={exercise.seriesText}>
              Série {setNumber} de {sets}
            </Text>
          </View>
        </View>
        <View
          style={exercise.bar}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Progresso da série"
          accessibilityValue={{ min: 0, max: goal, now: count }}
        >
          <View
            style={[exercise.barFill, { width: `${(count / goal) * 100}%` }]}
          />
        </View>
        {item.professional_guidance ? (
          <Text
            style={exercise.guidance}
            numberOfLines={3}
            accessibilityLabel={`Orientação do profissional: ${item.professional_guidance}`}
          >
            {item.professional_guidance}
          </Text>
        ) : null}
        {source ? <Text style={exercise.source}>{source}</Text> : null}
        {error ? <InlineError message={error} /> : null}
        {snapshot.status === 'active' && !automaticCount ? (
          <Button
            icon="check"
            label="Contar repetição"
            accessibilityHint="Toque ao terminar cada repetição"
            onPress={countRepetition}
          />
        ) : null}
        {paused ? (
          <Button icon="play" label="Continuar exercício" onPress={resume} />
        ) : null}
        {snapshot.status === 'completed' ? (
          <Button
            icon="check"
            label="Concluir treino"
            disabled={result.saving}
            onPress={complete}
          />
        ) : null}
        <Text style={exercise.hint} accessibilityLiveRegion="polite">
          {snapshot.status === 'resting'
            ? `Descanso: ${restSeconds} s`
            : paused
              ? 'Treino pausado. A contagem está parada.'
              : snapshot.status === 'completed'
                ? 'Você fez tudo o que foi prescrito.'
                : automaticCount
                  ? 'A contagem aumenta ao completar o movimento demonstrativo.'
                  : 'Toque ao terminar cada repetição.'}
        </Text>
      </SafeAreaView>
    </View>
  );
}

function FloatingControl({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [exercise.control, pressed && exercise.pressed]}
    >
      <View style={exercise.controlCircle}>
        <Icon name={icon} size={24} color={colors.primary} />
      </View>
      <Text style={exercise.controlLabel}>{label}</Text>
    </Pressable>
  );
}

// Text over the camera always sits on `cameraOverlay` (contrast ≥ 4.5:1).
const exercise = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cameraSurface },
  cameraArea: { flex: 1, overflow: 'hidden' },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.cameraOverlay,
  },
  itemLabel: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
    ...typography.caption,
  },
  title: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
    ...typography.title,
  },
  subtitle: {
    color: colors.onPrimary,
    fontFamily: fonts.regular,
    ...typography.bodySmall,
  },
  demoNotice: {
    color: colors.warning,
    fontFamily: fonts.bold,
    ...typography.caption,
  },
  controls: { gap: spacing.md },
  control: { alignItems: 'center', gap: spacing.xs },
  controlCircle: {
    width: layout.controlHeight,
    height: layout.controlHeight,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlLabel: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
    ...typography.caption,
    backgroundColor: colors.cameraOverlay,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.7 },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    marginTop: -radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  counterLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bold,
    ...typography.bodySmall,
  },
  countLine: { flexDirection: 'row', alignItems: 'baseline' },
  count: {
    color: colors.primary,
    fontFamily: fonts.bold,
    ...typography.display,
  },
  goal: {
    color: colors.text,
    fontFamily: fonts.bold,
    ...typography.title,
  },
  seriesPill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  seriesText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    ...typography.bodySmall,
  },
  bar: {
    height: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  guidance: {
    color: colors.text,
    fontFamily: fonts.regular,
    ...typography.bodySmall,
  },
  source: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    ...typography.caption,
  },
  hint: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    ...typography.bodySmall,
    textAlign: 'center',
  },
});
