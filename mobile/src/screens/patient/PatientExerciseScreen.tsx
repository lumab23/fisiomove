import { useCallback } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  useFocusEffect,
  useIsFocused,
  usePreventRemove,
} from '@react-navigation/native';
import { Screen, s } from '../../components/Screen';
import { Body, Button, styles } from '../../ui';
import { useDemo } from '../../demo/DemoContext';
import { useFrontendNavigation } from '../../navigation/frontendTypes';
import {
  colors,
  fonts,
  layout,
  radii,
  spacing,
  typography,
} from '../../theme/theme';
import { LocalPoseCamera } from '../../features/vision/LocalPoseCamera';
export function PatientExerciseScreen() {
  const navigation = useFrontendNavigation();
  const { state, dispatch } = useDemo();
  const { active } = state;
  const focused = useIsFocused();
  usePreventRemove(focused, () => navigation.navigate('ConfirmExit'));
  useFocusEffect(
    useCallback(() => {
      const subscription = AppState.addEventListener('change', next => {
        if (next !== 'active') {
          navigation.navigate('SessionPause');
        }
      });
      return () => subscription.remove();
    }, [navigation]),
  );
  const next = () => {
    dispatch({ type: 'completeSeries' });
    if (active.series === 1) {
      navigation.navigate('SessionRest');
    } else {
      dispatch({
        type: 'finish',
        completed: true,
        id: active.id,
        date: new Date().toISOString(),
      });
      navigation.navigate('PatientCompletion');
    }
  };
  return (
    <Screen
      title="Exercício em andamento"
      footer={
        <>
          <Pressable
            accessibilityRole="button"
            onPress={next}
            style={exercise.action}
          >
            <Text style={exercise.actionText}>
              {active.series === 1
                ? 'Ver 1ª série concluída'
                : 'Ver resultado simulado'}
            </Text>
          </Pressable>
          <Button
            secondary
            label="Encerrar treino"
            onPress={() => navigation.navigate('ConfirmExit')}
          />
        </>
      }
    >
      <View style={s.row}>
        <View style={s.column}>
          <Text accessibilityRole="header" style={styles.cardTitle}>
            Elevação do braço
          </Text>
          <Body>Série {active.series} de 2</Body>
        </View>
        <Pressable
          style={exercise.counter}
          accessibilityRole="button"
          accessibilityLabel="Simular uma repetição"
          accessibilityValue={{
            text: `${active.count} de ${active.goal} repetições`,
          }}
          accessibilityState={{ disabled: active.count === active.goal }}
          disabled={active.count === active.goal}
          accessibilityHint="Toque para acrescentar uma repetição ilustrativa"
          onPress={() => dispatch({ type: 'repeat' })}
        >
          <Text style={styles.eyebrow}>SÉRIE {active.series}/2</Text>
          <Text accessibilityLiveRegion="polite" style={exercise.count}>
            {active.count}/{active.goal}
          </Text>
          <Text style={exercise.counterHint}>Contar +1</Text>
        </Pressable>
      </View>
      <View style={exercise.cameraPanel}>
        <Text style={exercise.cameraLabel}>CÂMERA E POSE AO VIVO</Text>
        <LocalPoseCamera side="right" active={focused} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver orientação"
          onPress={() => navigation.navigate('MovementGuidance')}
          style={exercise.feedback}
        >
          <View style={exercise.feedbackDot} />
          <Text style={exercise.feedbackText}>Ver orientação ›</Text>
        </Pressable>
        <View style={s.row}>
          <View style={exercise.control}>
            <Button
              compact
              secondary
              label="Pausar"
              onPress={() => navigation.navigate('SessionPause')}
            />
          </View>
          <View style={exercise.control}>
            <Button
              compact
              secondary
              label="Ajustar câmera"
              onPress={() => navigation.navigate('CameraAdjustment')}
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}
const exercise = StyleSheet.create({
  feedback: {
    alignSelf: 'center',
    minHeight: layout.compactControlHeight,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  cameraPanel: {
    padding: spacing.lg,
    gap: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cameraLabel: {
    color: colors.primary,
    fontFamily: fonts.bold,
    ...typography.caption,
    textAlign: 'center',
  },
  feedbackDot: {
    width: spacing.md,
    height: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.warning,
  },
  feedbackText: {
    color: colors.text,
    fontFamily: fonts.bold,
    ...typography.bodySmall,
  },
  counterHint: {
    color: colors.primary,
    fontFamily: fonts.regular,
    ...typography.label,
    textAlign: 'center',
  },
  control: { flex: 1, minWidth: 96 },
  counter: {
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: radii.xl,
    gap: spacing.xs,
    minWidth: 96,
  },
  count: {
    color: colors.text,
    ...typography.display,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  action: {
    backgroundColor: colors.accent,
    minHeight: layout.controlHeight,
    padding: spacing.lg,
    borderRadius: radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    color: colors.text,
    ...typography.body,
    textAlign: 'center',
    fontFamily: fonts.bold,
  },
});
