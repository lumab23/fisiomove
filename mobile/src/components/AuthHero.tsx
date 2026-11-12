import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useReduceMotion } from '../accessibility/useReduceMotion';
import { colors, motion, radii } from '../theme/theme';
import {
  AnimatedMascot,
  useAppActive,
  useScreenFocused,
} from './AnimatedMascot';

// Mascot proportions (viewBox 104 × 96) used to place the arms.
const VIEW_W = 104;
const VIEW_H = 96;
export const ARM_REST = '160deg';
export const ARM_RAISED = '20deg';
export const ARM_LEFT_REST = '-160deg';

// Arms pills in viewBox units. The shoulder (rotation pivot, bottom centre of
// the pill) sits inside the body, so its rounded end stays hidden behind it
// and both arms read as coming out of the body at rest and in motion.
export const HERO_ARM = { shoulderX: 88, shoulderY: 44, length: 40, width: 11 };
export const HERO_ARM_LEFT = {
  shoulderX: 16,
  shoulderY: 44,
  length: 40,
  width: 11,
};

function timing(
  value: Animated.Value,
  toValue: number,
  duration: number,
  easing = Easing.inOut(Easing.sin),
) {
  return Animated.timing(value, {
    toValue,
    duration,
    easing,
    useNativeDriver: true,
  });
}

/**
 * Large welcome mascot that breathes slowly, keeps two visible hands (one at
 * rest and one waving in a friendly "hello" gesture, returning naturally to rest),
 * and reacts warmly to petting. Purely decorative; it is meant for the welcome screen
 * only, never next to form fields. With Reduce Motion (or before the setting
 * is known) it shows both hands in resting pose and runs no animation at all.
 */
export function AuthHero({ width = 160 }: { width?: number }) {
  const reduceMotion = useReduceMotion();
  const focused = useScreenFocused();
  const appActive = useAppActive();
  const animate = reduceMotion === false && focused && appActive;
  const breath = useRef(new Animated.Value(0)).current;
  const arm = useRef(new Animated.Value(160)).current;

  useEffect(() => {
    if (!animate) {
      breath.setValue(0);
      arm.setValue(160);
      return;
    }
    const breathing = Animated.loop(
      Animated.sequence([
        timing(breath, 1, motion.breathMs / 2),
        timing(breath, 0, motion.breathMs / 2),
      ]),
    );
    const waving = Animated.loop(
      Animated.sequence([
        Animated.delay(motion.stretchEveryMs),
        // Lift arm up to waving position
        timing(arm, 25, 480, Easing.out(Easing.cubic)),
        // Wave back and forth like saying "oi"
        timing(arm, 42, 160, Easing.inOut(Easing.sin)),
        timing(arm, 16, 180, Easing.inOut(Easing.sin)),
        timing(arm, 42, 180, Easing.inOut(Easing.sin)),
        timing(arm, 16, 180, Easing.inOut(Easing.sin)),
        timing(arm, 25, 160, Easing.inOut(Easing.sin)),
        Animated.delay(150),
        // Return naturally to initial resting position
        timing(arm, 160, 520, Easing.inOut(Easing.cubic)),
      ]),
    );
    breathing.start();
    waving.start();
    return () => {
      breathing.stop();
      waving.stop();
      breath.setValue(0);
      arm.setValue(160);
    };
  }, [animate, arm, breath]);

  const unit = width / VIEW_W;
  const height = VIEW_H * unit;
  const scale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [1, motion.breathScale],
  });
  const rotate = arm.interpolate({
    inputRange: [-180, 180],
    outputRange: ['-180deg', '180deg'],
  });
  const armLength = HERO_ARM.length * unit;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="auth-hero"
      style={{ width, height }}
    >
      <Animated.View
        style={[
          { width, height },
          styles.originBottom,
          { transform: [{ scale }] },
        ]}
      >
        <AnimatedMascot
          kind="home"
          width={width}
          behindBody={
            <>
              <Animated.View
                testID="auth-hero-arm-left"
                style={[
                  styles.arm,
                  {
                    borderRadius: radii.pill,
                    height: armLength,
                    left:
                      (HERO_ARM_LEFT.shoulderX - HERO_ARM_LEFT.width / 2) *
                      unit,
                    top: HERO_ARM_LEFT.shoulderY * unit - armLength,
                    width: HERO_ARM_LEFT.width * unit,
                    transform: [{ rotate: ARM_LEFT_REST }],
                  },
                ]}
              />
              <Animated.View
                testID="auth-hero-arm"
                style={[
                  styles.arm,
                  {
                    borderRadius: radii.pill,
                    height: armLength,
                    left: (HERO_ARM.shoulderX - HERO_ARM.width / 2) * unit,
                    top: HERO_ARM.shoulderY * unit - armLength,
                    width: HERO_ARM.width * unit,
                    transform: [{ rotate }],
                  },
                ]}
              />
            </>
          }
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  originBottom: { transformOrigin: 'bottom' },
  arm: {
    backgroundColor: colors.accent,
    position: 'absolute',
    transformOrigin: 'bottom',
  },
});
