import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useReduceMotion } from '../accessibility/useReduceMotion';
import { colors, motion, radii } from '../theme/theme';
import {
  AnimatedMascot,
  useAppActive,
  useScreenFocused,
} from './AnimatedMascot';

// Mascot proportions (viewBox 104 × 96) used to place the stretching arm.
const VIEW_W = 104;
const VIEW_H = 96;
const ARM_REST = '160deg';
const ARM_RAISED = '20deg';
// Arm pill in viewBox units. The shoulder (rotation pivot, bottom centre of
// the pill) sits inside the body, so its rounded end stays hidden behind it
// and the arm reads as coming out of the body at rest and while stretching.
export const HERO_ARM = { shoulderX: 88, shoulderY: 44, length: 40, width: 11 };

function timing(value: Animated.Value, toValue: number, duration: number) {
  return Animated.timing(value, {
    toValue,
    duration,
    easing: Easing.inOut(Easing.sin),
    useNativeDriver: true,
  });
}

/**
 * Large welcome mascot that breathes slowly and, now and then, raises an arm
 * as if stretching. Purely decorative; it is meant for the welcome screen
 * only, never next to form fields. With Reduce Motion (or before the setting
 * is known) it shows the resting pose and runs no animation at all.
 */
export function AuthHero({ width = 160 }: { width?: number }) {
  const reduceMotion = useReduceMotion();
  const focused = useScreenFocused();
  const appActive = useAppActive();
  const animate = reduceMotion === false && focused && appActive;
  const breath = useRef(new Animated.Value(0)).current;
  const arm = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      breath.setValue(0);
      arm.setValue(0);
      return;
    }
    const breathing = Animated.loop(
      Animated.sequence([
        timing(breath, 1, motion.breathMs / 2),
        timing(breath, 0, motion.breathMs / 2),
      ]),
    );
    const stretching = Animated.loop(
      Animated.sequence([
        Animated.delay(motion.stretchEveryMs),
        timing(arm, 1, motion.stretchMs),
        Animated.delay(motion.stretchHoldMs),
        timing(arm, 0, motion.stretchMs),
      ]),
    );
    breathing.start();
    stretching.start();
    return () => {
      breathing.stop();
      stretching.stop();
      breath.setValue(0);
      arm.setValue(0);
    };
  }, [animate, arm, breath]);

  const unit = width / VIEW_W;
  const height = VIEW_H * unit;
  const scale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [1, motion.breathScale],
  });
  const rotate = arm.interpolate({
    inputRange: [0, 1],
    outputRange: [ARM_REST, ARM_RAISED],
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
        <AnimatedMascot kind="home" width={width} />
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
