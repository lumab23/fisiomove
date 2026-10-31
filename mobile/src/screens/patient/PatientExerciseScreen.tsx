import { useCallback } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  useFocusEffect,
  useIsFocused,
  usePreventRemove,
} from '@react-navigation/native';
import { CameraPreview } from '../../components/CameraPreview';
import { Screen, s } from '../../components/Screen';
import { Body, Button, styles } from '../../ui';
import { useDemo } from '../../demo/DemoContext';
import { useFrontendNavigation } from '../../navigation/frontendTypes';
import { colors, fonts } from '../../theme/theme';
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
      <CameraPreview compact>
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
      </CameraPreview>
    </Screen>
  );
}
const exercise = StyleSheet.create({
  feedback: {
    alignSelf: 'center',
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  feedbackDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FA805F',
  },
  feedbackText: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  counterHint: {
    color: colors.primary,
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: 'center',
  },
  control: { flex: 1, minWidth: 96 },
  counter: {
    backgroundColor: colors.surfaceMuted,
    padding: 12,
    borderRadius: 20,
    gap: 4,
    minWidth: 96,
  },
  count: {
    color: colors.text,
    fontSize: 32,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  action: {
    backgroundColor: colors.accent,
    minHeight: 64,
    padding: 16,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 28,
    textAlign: 'center',
    fontFamily: fonts.bold,
  },
});
