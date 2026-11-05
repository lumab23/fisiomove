import { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  AppState,
  Image,
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
} from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Icon, type IconName } from '../../components/Icon';
import { useDemo } from '../../demo/DemoContext';
import { demoExercise } from '../../demo/model';
import { LocalPoseCamera } from '../../features/vision/LocalPoseCamera';
import { useFrontendNavigation } from '../../navigation/frontendTypes';
import { colors, fonts, radii, spacing } from '../../theme/theme';
import { Button } from '../../ui';

export function PatientExerciseScreen() {
  const navigation = useFrontendNavigation();
  const { state, dispatch } = useDemo();
  const { active } = state;
  const focused = useIsFocused();
  const pulse = useRef(new Animated.Value(1)).current;
  usePreventRemove(focused, () => navigation.navigate('ConfirmExit'));
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      const subscription = AppState.addEventListener('change', next => {
        if (next !== 'active') {
          navigation.navigate('SessionPause');
        }
      });
      return () => {
        StatusBar.setBarStyle('dark-content');
        subscription.remove();
      };
    }, [navigation]),
  );
  useEffect(() => {
    if (active.count === 0) {
      return;
    }
    pulse.setValue(1.15);
    Animated.spring(pulse, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, [active.count, pulse]);

  const seriesDone = active.count >= active.goal;
  const finishSeries = () => {
    if (active.series === 1) {
      navigation.navigate('SessionRest');
      return;
    }
    dispatch({
      type: 'finish',
      completed: true,
      id: active.id,
      date: new Date().toISOString(),
    });
    navigation.navigate('PatientCompletion');
  };

  return (
    <View style={exercise.root}>
      <View style={exercise.cameraArea}>
        <LocalPoseCamera
          immersive
          side="right"
          active={focused}
          style={StyleSheet.absoluteFill}
        />
        <Svg
          pointerEvents="none"
          style={exercise.topShade}
          width="100%"
          height="100%"
        >
          <Defs>
            <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000" stopOpacity="0.55" />
              <Stop offset="1" stopColor="#000" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#shade)" />
        </Svg>
        <SafeAreaView edges={['top', 'left', 'right']} style={exercise.top}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Como fazer o movimento"
            accessibilityHint="Abre as instruções do exercício"
            onPress={() => navigation.navigate('MovementGuidance')}
            style={({ pressed }) => [
              exercise.demo,
              pressed && exercise.pressed,
            ]}
          >
            <Image
              source={require('../../assets/person.png')}
              resizeMode="contain"
              style={exercise.demoImage}
              accessible={false}
            />
            <Text style={exercise.demoLabel}>Como fazer</Text>
          </Pressable>
          <View style={exercise.titleBlock}>
            <Text accessibilityRole="header" style={exercise.title}>
              {demoExercise.name}
            </Text>
            <Text style={exercise.subtitle}>{demoExercise.side}</Text>
          </View>
        </SafeAreaView>
        <View style={exercise.controls}>
          <FloatingControl
            icon="pause"
            label="Pausar"
            onPress={() => navigation.navigate('SessionPause')}
          />
          <FloatingControl
            icon="info"
            label="Instruções"
            onPress={() => navigation.navigate('MovementGuidance')}
          />
          <FloatingControl
            icon="close"
            label="Encerrar"
            onPress={() => navigation.navigate('ConfirmExit')}
          />
        </View>
      </View>

      <SafeAreaView edges={['bottom', 'left', 'right']} style={exercise.panel}>
        <View style={exercise.counterRow}>
          <View
            accessible
            accessibilityLabel={`Repetição ${active.count} de ${active.goal}`}
            accessibilityLiveRegion="polite"
          >
            <Text style={exercise.counterLabel}>Repetição</Text>
            <View style={exercise.countLine}>
              <Animated.Text
                style={[exercise.count, { transform: [{ scale: pulse }] }]}
              >
                {active.count}
              </Animated.Text>
              <Text style={exercise.goal}> de {active.goal}</Text>
            </View>
          </View>
          <View style={exercise.seriesPill}>
            <Text style={exercise.seriesText}>
              Série {active.series} de {demoExercise.series}
            </Text>
          </View>
        </View>
        <View
          style={exercise.bar}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Progresso da série"
          accessibilityValue={{ min: 0, max: active.goal, now: active.count }}
        >
          <View
            style={[
              exercise.barFill,
              { width: `${(active.count / active.goal) * 100}%` },
            ]}
          />
        </View>
        {seriesDone ? (
          <Button
            icon="check"
            label={active.series === 1 ? 'Concluir série 1' : 'Concluir treino'}
            onPress={finishSeries}
          />
        ) : (
          <Button
            icon="check"
            label="Contar repetição"
            accessibilityHint="Toque ao terminar cada repetição"
            onPress={() => dispatch({ type: 'repeat' })}
          />
        )}
        <Text style={exercise.hint}>
          {seriesDone
            ? 'Série completa. Respire e siga quando estiver pronto.'
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

const shadowText = {
  textShadowColor: 'rgba(0,0,0,0.6)',
  textShadowRadius: 4,
  textShadowOffset: { width: 0, height: 1 },
};

const exercise = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cameraSurface },
  cameraArea: { flex: 1, overflow: 'hidden' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 180 },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  demo: {
    width: 88,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radii.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  demoImage: { width: 64, height: 76 },
  demoLabel: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 18,
  },
  titleBlock: { flex: 1, gap: 2, paddingTop: spacing.xs },
  title: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 28,
    ...shadowText,
  },
  subtitle: {
    color: colors.onPrimary,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 22,
    ...shadowText,
  },
  controls: {
    position: 'absolute',
    right: spacing.md,
    top: '30%',
    gap: spacing.lg,
  },
  control: { alignItems: 'center', gap: spacing.xs, minWidth: 64 },
  controlCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlLabel: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 18,
    ...shadowText,
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
    fontSize: 15,
    lineHeight: 20,
  },
  countLine: { flexDirection: 'row', alignItems: 'baseline' },
  count: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 48,
    lineHeight: 56,
  },
  goal: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 30,
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
    fontSize: 16,
    lineHeight: 22,
  },
  bar: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  hint: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
});
