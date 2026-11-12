import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Pressable,
  StyleSheet,
} from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import Svg, { Ellipse, Path } from 'react-native-svg';

import { useReduceMotion } from '../accessibility/useReduceMotion';

export type MascotKind = 'pink' | 'home' | 'gold';

// Geometry copied from src/assets/mascot-*.svg (viewBox 104 × 96).
const BODY =
  'M22 9C42 1.66667 62 1.66667 82 9C96 13.6667 101.333 26 98 46L89 79C86.3333 88.3333 80 92.3333 70 91L25 87C15 85.6667 9.33333 79.3333 8 68L4 34C2.66667 22 8.66667 13.6667 22 9Z';
const MOUTH = 'M43 60C49 66 55.3333 66 62 60';
const INK = '#20243A';
const VIEW_W = 104;
const VIEW_H = 96;
const EYE = { rx: 5.4, ry: 7 };
const EYES = [38, 67];
const EYE_Y = 43;
const MOUTH_CENTER = { x: 52.5, y: 62 };
const MOUTH_BOX = { width: 32, height: 24 };

const bodyColor: Record<MascotKind, string> = {
  home: '#28B8B1',
  pink: '#F3B8D3',
  gold: '#F3C757',
};

// Each mascot keeps its own temperament: home is calm, pink (the guide)
// glances around more, gold (completion) celebrates once when it appears.
const personalities: Record<
  MascotKind,
  {
    blink: [number, number];
    doubleBlink: number;
    idle: [number, number];
    gazeChance: number;
    tiltDeg: number;
    breathMs: number;
    celebrate: boolean;
  }
> = {
  home: {
    blink: [3500, 7000],
    doubleBlink: 0.15,
    idle: [7000, 12000],
    gazeChance: 0.55,
    tiltDeg: 2,
    breathMs: 4800,
    celebrate: false,
  },
  pink: {
    blink: [3000, 6000],
    doubleBlink: 0.2,
    idle: [5000, 9000],
    gazeChance: 0.75,
    tiltDeg: 1.6,
    breathMs: 4200,
    celebrate: false,
  },
  gold: {
    blink: [3200, 6500],
    doubleBlink: 0.12,
    idle: [6000, 10000],
    gazeChance: 0.45,
    tiltDeg: 2.6,
    breathMs: 4400,
    celebrate: true,
  },
};

const NoNavigation = createContext<undefined>(undefined);

export function useScreenFocused() {
  const navigation = useContext(NavigationContext ?? NoNavigation);
  const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);
  useEffect(() => {
    if (!navigation) {
      return;
    }
    setFocused(navigation.isFocused());
    const offFocus = navigation.addListener('focus', () => setFocused(true));
    const offBlur = navigation.addListener('blur', () => setFocused(false));
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation]);
  return focused;
}

export function useAppActive() {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next =>
      setActive(next === 'active'),
    );
    return () => subscription.remove();
  }, []);
  return active;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const ease = Easing.inOut(Easing.sin);
function to(
  value: Animated.Value,
  toValue: number,
  duration: number,
  easing = ease,
) {
  return Animated.timing(value, {
    toValue,
    duration,
    easing,
    useNativeDriver: true,
  });
}

export function AnimatedMascot({
  kind = 'pink',
  width = VIEW_W,
  still = false,
  behindBody,
}: {
  kind?: MascotKind;
  width?: number;
  /** Draws the resting pose only: no idle loop and no tap reaction. */
  still?: boolean;
  behindBody?: React.ReactNode;
}) {
  const scale = width / VIEW_W;
  const height = VIEW_H * scale;
  const personality = personalities[kind];
  const focused = useScreenFocused();
  const appActive = useAppActive();
  const reduceMotion = useReduceMotion();
  const animate = !still && focused && appActive && reduceMotion === false;

  const blink = useRef(new Animated.Value(1)).current;
  const squint = useRef(new Animated.Value(1)).current;
  const gazeX = useRef(new Animated.Value(0)).current;
  const gazeY = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;
  const nod = useRef(new Animated.Value(0)).current;
  const smile = useRef(new Animated.Value(0)).current;
  const celebrated = useRef(false);
  const reactionAnim = useRef<Animated.CompositeAnimation | null>(null);

  const react = useRef<() => void>(() => {});
  react.current = () => {
    reactionAnim.current?.stop();
    const reactions = [
      Animated.sequence([
        to(squint, 0.4, 140, Easing.out(Easing.quad)),
        Animated.delay(380),
        to(squint, 1, 220),
      ]),
      Animated.sequence([
        to(smile, 1, 160, Easing.out(Easing.quad)),
        Animated.delay(360),
        to(smile, 0, 240),
      ]),
    ];
    if (reduceMotion === false) {
      reactions.push(
        Animated.sequence([
          to(nod, 1, 170, Easing.out(Easing.quad)),
          to(nod, 0, 280),
        ]),
      );
    }
    const anim = Animated.parallel(reactions);
    reactionAnim.current = anim;
    anim.start(() => {
      if (reactionAnim.current === anim) {
        reactionAnim.current = null;
      }
    });
  };

  useEffect(() => {
    if (!animate) {
      return;
    }
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, run: () => void) => {
      timers.push(
        setTimeout(() => {
          if (alive) {
            run();
          }
        }, ms),
      );
    };
    const blinkOnce = (done?: () => void) =>
      Animated.sequence([
        to(blink, 0.08, 70, Easing.in(Easing.quad)),
        Animated.delay(40),
        to(blink, 1, 120, Easing.out(Easing.quad)),
      ]).start(() => done?.());
    const scheduleBlink = (wait: number) =>
      later(wait, () =>
        blinkOnce(() => {
          if (Math.random() < personality.doubleBlink) {
            later(150, () => blinkOnce());
          }
          scheduleBlink(rand(...personality.blink));
        }),
      );
    const glance = (done: () => void) => {
      const side = Math.random() < 0.5 ? -1 : 1;
      const down = kind === 'pink' && Math.random() < 0.4 ? 1 : 0;
      if (Math.random() < 0.4) {
        blinkOnce();
      }
      Animated.sequence([
        Animated.parallel([
          to(gazeX, side, 260, Easing.out(Easing.quad)),
          to(gazeY, down, 260, Easing.out(Easing.quad)),
        ]),
        Animated.delay(rand(1100, 2000)),
        Animated.parallel([to(gazeX, 0, 340), to(gazeY, 0, 340)]),
      ]).start(done);
    };
    const lean = (done: () => void) => {
      Animated.sequence([
        to(tilt, Math.random() < 0.5 ? -1 : 1, 720),
        Animated.delay(rand(900, 1600)),
        to(tilt, 0, 820),
      ]).start(done);
    };
    const scheduleIdle = (wait: number) =>
      later(wait, () => {
        const next = () => scheduleIdle(rand(...personality.idle));
        if (Math.random() < personality.gazeChance) {
          glance(next);
        } else {
          lean(next);
        }
      });
    const breathing = Animated.loop(
      Animated.sequence([
        to(breath, 1, personality.breathMs * 0.45),
        to(breath, 0, personality.breathMs * 0.55),
      ]),
    );
    breathing.start();
    scheduleBlink(rand(800, 3500));
    scheduleIdle(rand(2500, personality.idle[0]));
    if (personality.celebrate && !celebrated.current) {
      celebrated.current = true;
      later(450, () => react.current());
    }
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      breathing.stop();
      reactionAnim.current?.stop();
      reactionAnim.current = null;
      [blink, gazeX, gazeY, tilt, breath, squint, smile, nod].forEach(value =>
        value.stopAnimation(),
      );
      blink.setValue(1);
      squint.setValue(1);
      smile.setValue(0);
      nod.setValue(0);
      gazeX.setValue(0);
      gazeY.setValue(0);
      tilt.setValue(0);
      breath.setValue(0);
    };
  }, [
    animate,
    blink,
    breath,
    gazeX,
    gazeY,
    kind,
    nod,
    personality,
    smile,
    squint,
    tilt,
  ]);

  const eyeScale = Animated.multiply(blink, squint);
  const eyeShiftX = Animated.multiply(gazeX, 1.6 * scale);
  const eyeShiftY = Animated.multiply(gazeY, 1.2 * scale);
  const rotate = tilt.interpolate({
    inputRange: [-1, 1],
    outputRange: [`-${personality.tiltDeg}deg`, `${personality.tiltDeg}deg`],
  });
  const bodyScale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.012],
  });
  const faceLift = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -0.6 * scale],
  });
  const nodDip = nod.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2.5 * scale],
  });
  const mouthX = smile.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });
  const mouthY = smile.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.35],
  });

  return (
    <Pressable
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      onPress={still ? undefined : () => react.current()}
      style={{ width, height }}
    >
      <Animated.View
        style={[
          { width, height },
          mascot.originBottom,
          { transform: [{ translateY: nodDip }, { rotate }] },
        ]}
      >
        {behindBody}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            mascot.originBottom,
            { transform: [{ scaleY: bodyScale }] },
          ]}
        >
          <Svg width={width} height={height} viewBox="0 0 104 96">
            <Path d={BODY} fill={bodyColor[kind]} />
          </Svg>
        </Animated.View>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ translateY: faceLift }] },
          ]}
        >
          {EYES.map(cx => (
            <Animated.View
              key={cx}
              style={{
                ...mascot.eye,
                left: (cx - EYE.rx) * scale,
                top: (EYE_Y - EYE.ry) * scale,
                width: EYE.rx * 2 * scale,
                height: EYE.ry * 2 * scale,
                transform: [
                  { translateX: eyeShiftX },
                  { translateY: eyeShiftY },
                  { scaleY: eyeScale },
                ],
              }}
            >
              <Svg
                width={EYE.rx * 2 * scale}
                height={EYE.ry * 2 * scale}
                viewBox={`0 0 ${EYE.rx * 2} ${EYE.ry * 2}`}
              >
                <Ellipse
                  cx={EYE.rx}
                  cy={EYE.ry}
                  rx={EYE.rx}
                  ry={EYE.ry}
                  fill={INK}
                />
              </Svg>
            </Animated.View>
          ))}
          <Animated.View
            style={[
              mascot.mouth,
              {
                left: (MOUTH_CENTER.x - MOUTH_BOX.width / 2) * scale,
                top: (MOUTH_CENTER.y - MOUTH_BOX.height / 2) * scale,
                width: MOUTH_BOX.width * scale,
                height: MOUTH_BOX.height * scale,
                transform: [{ scaleX: mouthX }, { scaleY: mouthY }],
              },
            ]}
          >
            <Svg
              width={width}
              height={height}
              viewBox="0 0 104 96"
              style={[
                mascot.mouthSvg,
                {
                  left: -(MOUTH_CENTER.x - MOUTH_BOX.width / 2) * scale,
                  top: -(MOUTH_CENTER.y - MOUTH_BOX.height / 2) * scale,
                },
              ]}
            >
              <Path
                d={MOUTH}
                stroke={INK}
                strokeWidth={4}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const mascot = StyleSheet.create({
  originBottom: { transformOrigin: 'bottom' },
  eye: { position: 'absolute' },
  mouth: { position: 'absolute' },
  mouthSvg: { position: 'absolute' },
});
