import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { LocalPoseCamera } from '../../features/vision/LocalPoseCamera';
import { MovementEngine } from '../../features/exercise-engine/MovementEngine';
import {
  demoRuleForExercise,
  poseFrameFromObservation,
} from '../../features/exercise-engine/demoElbowFlexion';
import type {
  MovementFeedback,
  MovementUpdate,
} from '../../features/exercise-engine/types';
import { Screen } from '../../components/Screen';
import { Badge, Body, Button, Card } from '../../ui';
import { colors, fonts, spacing, typography } from '../../theme/theme';

type Side = 'left' | 'right';

const feedbackText: Record<MovementFeedback, string> = {
  ready: 'Comece com o cotovelo estendido.',
  capture_adjustment: 'Mantenha ombro, cotovelo e punho visíveis.',
  low_confidence: 'Ajuste a iluminação e o enquadramento.',
  movement_in_progress: 'Movimento reconhecido.',
  rep_completed: 'Ciclo completo contado.',
  paused: 'Contagem pausada.',
};

const initialUpdate: MovementUpdate = {
  phase: 'awaiting_initial',
  repetitions: 0,
  feedback: 'capture_adjustment',
  angle_degrees: null,
};

/** Local, development-only counter demonstration; it does not create a session. */
export function DemoAutoCountScreen() {
  const focused = useIsFocused();
  const [side, setSide] = useState<Side>('left');
  const [update, setUpdate] = useState(initialUpdate);
  const rule = useMemo(
    () =>
      demoRuleForExercise(
        {
          code: 'demo-elbow-flexion',
          rule_version: 'demo-elbow-flexion:v1',
        },
        'demo-elbow-flexion:v1',
        side,
      )!,
    [side],
  );
  const engine = useMemo(
    () => new MovementEngine(rule, { smoothing_window_size: 4 }),
    [rule],
  );
  const onObservation = useCallback(
    (observation: Parameters<typeof poseFrameFromObservation>[0]) => {
      setUpdate(engine.update(poseFrameFromObservation(observation), side));
    },
    [engine, side],
  );
  const reset = useCallback(() => {
    engine.reset();
    setUpdate(initialUpdate);
  }, [engine]);
  const changeSide = (nextSide: Side) => {
    engine.reset();
    setUpdate(initialUpdate);
    setSide(nextSide);
  };

  return (
    <Screen back="Voltar" title="Contagem automática">
      <Badge label="Demonstração · não validada clinicamente" tone="warning" />
      <Card white title="Flexão e extensão do cotovelo">
        <Body>
          Mantenha ombro, cotovelo e punho visíveis. Dobre o cotovelo e volte à
          posição inicial; a contagem aumenta após o ciclo completo.
        </Body>
      </Card>
      <View style={styles.camera}>
        <LocalPoseCamera
          side={side}
          active={focused}
          onObservation={onObservation}
        />
      </View>
      <Card white title="Repetições">
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole="text"
          style={styles.count}
        >
          {update.repetitions}
        </Text>
        <Body>{feedbackText[update.feedback]}</Body>
        {update.angle_degrees !== null ? (
          <Body>{`Ângulo estimado: ${Math.round(update.angle_degrees)}°`}</Body>
        ) : null}
      </Card>
      <View style={styles.controls}>
        <Button
          label="Braço esquerdo"
          secondary={side !== 'left'}
          onPress={() => changeSide('left')}
        />
        <Button
          label="Braço direito"
          secondary={side !== 'right'}
          onPress={() => changeSide('right')}
        />
        <Button label="Reiniciar" secondary onPress={reset} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: { minHeight: 280 },
  count: {
    color: colors.primary,
    ...typography.display,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  controls: { gap: spacing.sm },
});
