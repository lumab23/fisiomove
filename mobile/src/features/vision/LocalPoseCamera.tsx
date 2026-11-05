import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  models,
  setTelemetryEnabled,
  useKeypointDetector,
  type KeypointDetection,
} from 'react-native-executorch';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
  type CameraFrameOutput,
} from 'react-native-vision-camera';
import {
  createResizer,
  type Resizer,
} from 'react-native-vision-camera-resizer';
import { scheduleOnRN } from 'react-native-worklets';
import type { CameraOrientation } from 'react-native-vision-camera';
import type { Side } from '../../contracts/domain';
import type { FrameOrientation } from './types';
import {
  toRawPoseObservation,
  type RawPoseObservation,
} from './RawPoseObservation';
import { toPreviewCoordinates } from './poseAssessment';
import { colors, fonts, radii, spacing, typography } from '../../theme/theme';

const detectorModel = models.keypointDetection.YOLO26_POSE.SIZE_384.DEFAULT;
setTelemetryEnabled(false);

interface LocalPoseCameraProps {
  side: Exclude<Side, 'bilateral'>;
  active: boolean;
  onObservation?: (observation: RawPoseObservation) => void;
  immersive?: boolean;
  style?: StyleProp<ViewStyle>;
}

type CocoDetection = KeypointDetection<
  'xyxy',
  | 'leftEye'
  | 'rightEye'
  | 'leftEar'
  | 'rightEar'
  | 'nose'
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftElbow'
  | 'rightElbow'
  | 'leftWrist'
  | 'rightWrist'
  | 'leftHip'
  | 'rightHip'
  | 'leftKnee'
  | 'rightKnee'
  | 'leftAnkle'
  | 'rightAnkle'
>;

export function LocalPoseCamera({
  side,
  active,
  onObservation,
  immersive = false,
  style,
}: LocalPoseCameraProps) {
  // The patient faces the screen during the exercise, so the front camera
  // must point toward them while the display and live landmarks remain visible.
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [latest, setLatest] = useState<RawPoseObservation | null>(null);
  const [displayLandmarks, setDisplayLandmarks] = useState<
    RawPoseObservation['landmarks']
  >({});
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [inferenceError, setInferenceError] = useState<string | null>(null);
  const [droppedFrames, setDroppedFrames] = useState(0);
  const [appState, setAppState] = useState(AppState.currentState);
  const onObservationRef = useRef(onObservation);
  const previousDisplayRef = useRef<DisplayLandmarks | null>(null);
  onObservationRef.current = onObservation;

  const detector = useKeypointDetector(detectorModel);
  const detectKeypointsWorklet = detector.detectKeypointsWorklet;
  const [resizer, setResizer] = useState<Resizer | null>(null);
  const [resizerError, setResizerError] = useState<string | null>(null);
  const detectorReady = detector.isReady;

  useEffect(() => {
    let canceled = false;
    let createdResizer: Resizer | undefined;
    createResizer({
      width: 384,
      height: 384,
      channelOrder: 'rgb',
      dataType: 'uint8',
      scaleMode: 'contain',
      pixelLayout: 'interleaved',
    })
      .then(created => {
        createdResizer = created;
        if (canceled) {
          created.dispose();
        } else {
          setResizer(created);
        }
      })
      .catch((error: unknown) => {
        setResizerError(
          error instanceof Error
            ? error.message
            : 'Falha ao preparar os frames.',
        );
      });
    return () => {
      canceled = true;
      createdResizer?.dispose();
      setResizer(null);
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  const onPoseDetection = useCallback(
    (
      detection: CocoDetection | undefined,
      timestamp: number,
      width: number,
      height: number,
      orientation: CameraOrientation,
      isMirrored: boolean,
      inferenceDuration: number,
    ) => {
      const raw = toRawPoseObservation(detection, {
        timestamp_ms: timestamp,
        image_width: width,
        image_height: height,
        orientation: mapOrientation(orientation),
        is_mirrored: isMirrored,
        inference_duration_ms: inferenceDuration,
      });
      const smoothed = smoothDisplayLandmarks(raw, previousDisplayRef.current);
      previousDisplayRef.current = {
        timestamp_ms: raw.timestamp_ms,
        landmarks: smoothed,
      };
      setLatest(raw);
      setDisplayLandmarks(smoothed);
      setInferenceError(null);
      // Keep the original detections for movement logic; smoothing is visual only.
      onObservationRef.current?.(raw);
    },
    [],
  );

  const onInferenceFailure = useCallback((message: string) => {
    setInferenceError(message);
  }, []);
  const recordDroppedFrame = useCallback(() => {
    setDroppedFrames(count => count + 1);
  }, []);

  const frameOutput: CameraFrameOutput = useFrameOutput({
    targetResolution: { width: 640, height: 480 },
    pixelFormat: 'yuv',
    enablePhysicalBufferRotation: true,
    enablePreviewSizedOutputBuffers: true,
    dropFramesWhileBusy: true,
    onFrame(frame) {
      'worklet';
      const currentResizer = resizer;
      const detect = detectKeypointsWorklet;
      if (!currentResizer || !detectorReady || !detect) {
        frame.dispose();
        return;
      }
      let resized: ReturnType<typeof currentResizer.resize> | undefined;
      try {
        resized = currentResizer.resize(frame);
        const startedAt = Date.now();
        const results = detect({
          data: new Uint8Array(resized.getPixelBuffer()),
          width: 384,
          height: 384,
          format: 'rgb',
          layout: 'hwc',
        });
        scheduleOnRN(
          onPoseDetection,
          results[0] as CocoDetection | undefined,
          Date.now(),
          frame.width,
          frame.height,
          frame.orientation,
          frame.isMirrored,
          Date.now() - startedAt,
        );
      } catch (error) {
        scheduleOnRN(
          onInferenceFailure,
          error instanceof Error ? error.message : 'Falha na inferência local.',
        );
      } finally {
        resized?.dispose();
        frame.dispose();
      }
    },
    onFrameDropped() {
      'worklet';
      scheduleOnRN(recordDroppedFrame);
    },
  });

  const outputs = useMemo(() => [frameOutput], [frameOutput]);
  const request = useCallback(async () => {
    setPermissionRequested(true);
    await requestPermission();
  }, [requestPermission]);

  if (!hasPermission) {
    return (
      <View style={[styles.message, immersive && styles.immersiveMessage]}>
        <Text style={styles.title}>Permissão da câmera necessária</Text>
        <Text style={styles.body}>
          A imagem é analisada no aparelho e não é enviada ao servidor.
        </Text>
        {!permissionRequested ? (
          <Text
            accessibilityRole="button"
            onPress={request}
            style={styles.action}
          >
            Permitir câmera
          </Text>
        ) : (
          <Text style={styles.body}>
            Se negada, habilite a câmera nos Ajustes.
          </Text>
        )}
      </View>
    );
  }
  if (!device) {
    return (
      <View style={[styles.message, immersive && styles.immersiveMessage]}>
        <Text style={styles.body}>Nenhuma câmera frontal encontrada.</Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, immersive && styles.immersive, style]}
      onLayout={event =>
        setPreviewSize({
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        })
      }
    >
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        outputs={outputs}
        isActive={active && appState === 'active'}
        orientationSource="interface"
        resizeMode="contain"
      />
      <View pointerEvents="none" style={styles.overlay}>
        {!detector.isReady || !resizer ? (
          <ActivityIndicator color="#fff" />
        ) : null}
        {immersive ? (
          <ImmersiveStatus
            error={inferenceError ?? resizerError ?? detector.error?.message}
            ready={detector.isReady && resizer !== null}
            visible={countVisibleArmPoints(latest, side) === 3}
          />
        ) : null}
        {immersive ? null : (
          <>
            <Text style={styles.badge}>
              {inferenceError ??
                resizerError ??
                detector.error?.message ??
                `${side === 'left' ? 'Lado esquerdo' : 'Lado direito'} · ${countVisibleArmPoints(latest, side)}/3 pontos`}
            </Text>
            <Text style={styles.badge}>
              {latest
                ? `${latest.inference_duration_ms} ms · análise local · ${droppedFrames} quadros descartados`
                : 'Aguardando pose'}
            </Text>
          </>
        )}
        {latest &&
          Object.entries(displayLandmarks).map(([id, point]) => {
            if (!point || !id.startsWith(`${side}_`)) return null;
            const position = previewPoint(latest, point, previewSize);
            return (
              <View
                key={id}
                style={[
                  styles.landmark,
                  { left: position.x - 6, top: position.y - 6 },
                ]}
              />
            );
          })}
      </View>
    </View>
  );
}

function ImmersiveStatus({
  error,
  ready,
  visible,
}: {
  error?: string | null;
  ready: boolean;
  visible: boolean;
}) {
  const text = error
    ? 'Não foi possível analisar a imagem agora.'
    : !ready
      ? 'Preparando a câmera…'
      : visible
        ? 'Braço visível'
        : 'Mostre o braço inteiro para a câmera';
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={[styles.status, visible && !error && styles.statusOk]}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  immersive: { flex: 1, minHeight: 0, borderRadius: 0 },
  immersiveMessage: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  status: {
    ...typography.bodySmall,
    fontFamily: fonts.bold,
    color: colors.surface,
    backgroundColor: colors.cameraOverlay,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    overflow: 'hidden',
  },
  statusOk: { backgroundColor: colors.success },
  container: {
    minHeight: 280,
    overflow: 'hidden',
    backgroundColor: colors.cameraSurface,
    borderRadius: radii.md,
  },
  message: { padding: spacing.xl, gap: spacing.md, alignItems: 'center' },
  title: {
    ...typography.body,
    fontFamily: fonts.bold,
    color: colors.cameraSurface,
  },
  body: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
  },
  action: {
    color: colors.cameraLandmark,
    fontFamily: fonts.bold,
    padding: spacing.md,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  badge: {
    color: colors.surface,
    backgroundColor: colors.cameraOverlay,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    overflow: 'hidden',
  },
  landmark: {
    position: 'absolute',
    width: spacing.md,
    height: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.cameraLandmark,
  },
});

function previewPoint(
  observation: RawPoseObservation,
  point: { x: number; y: number },
  preview: { width: number; height: number },
): { x: number; y: number } {
  const oriented = toPreviewCoordinates(
    point,
    observation.orientation,
    observation.is_mirrored,
  );
  const aspect = observation.image_width / observation.image_height;
  const previewAspect = preview.width / Math.max(1, preview.height);
  if (aspect > previewAspect) {
    const contentHeight = preview.width / aspect;
    return {
      x: oriented.x * preview.width,
      y: (preview.height - contentHeight) / 2 + oriented.y * contentHeight,
    };
  }
  const contentWidth = preview.height * aspect;
  return {
    x: (preview.width - contentWidth) / 2 + oriented.x * contentWidth,
    y: oriented.y * preview.height,
  };
}

function mapOrientation(orientation: CameraOrientation): FrameOrientation {
  switch (orientation) {
    case 'up':
      return 'portrait';
    case 'down':
      return 'portrait-upside-down';
    case 'left':
      return 'landscape-left';
    case 'right':
      return 'landscape-right';
  }
}

function countVisibleArmPoints(
  observation: RawPoseObservation | null,
  side: Exclude<Side, 'bilateral'>,
): number {
  if (!observation) return 0;
  const prefix = side === 'left' ? 'left' : 'right';
  return ['shoulder', 'elbow', 'wrist'].filter(
    part =>
      observation.landmarks[
        `${prefix}_${part}` as keyof RawPoseObservation['landmarks']
      ],
  ).length;
}

interface DisplayLandmarks {
  timestamp_ms: number;
  landmarks: RawPoseObservation['landmarks'];
}

const DISPLAY_SMOOTHING_ALPHA = 0.22;
const DISPLAY_SMOOTHING_MAX_GAP_MS = 300;

function smoothDisplayLandmarks(
  observation: RawPoseObservation,
  previous: DisplayLandmarks | null,
): RawPoseObservation['landmarks'] {
  if (
    !previous ||
    observation.timestamp_ms - previous.timestamp_ms >
      DISPLAY_SMOOTHING_MAX_GAP_MS
  ) {
    return observation.landmarks;
  }

  const smoothed: RawPoseObservation['landmarks'] = {};
  for (const [id, point] of Object.entries(observation.landmarks) as [
    keyof RawPoseObservation['landmarks'],
    NonNullable<
      RawPoseObservation['landmarks'][keyof RawPoseObservation['landmarks']]
    >,
  ][]) {
    const prior = previous.landmarks[id];
    smoothed[id] = prior
      ? {
          ...point,
          x: prior.x + (point.x - prior.x) * DISPLAY_SMOOTHING_ALPHA,
          y: prior.y + (point.y - prior.y) * DISPLAY_SMOOTHING_ALPHA,
        }
      : point;
  }
  return smoothed;
}
