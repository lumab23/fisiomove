import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  type EmitterSubscription,
} from 'react-native';

import type { PoseQualityPolicy } from './types';
import type { PoseFrame } from './types';
import {
  createPoseCameraAdapter,
  PoseCameraUnavailableError,
  type PoseCameraAdapter,
  type PoseStreamOptions,
} from './PoseCameraAdapter';

export type PoseCameraStatus =
  | 'idle'
  | 'requesting_permission'
  | 'permission_denied'
  | 'ready'
  | 'running'
  | 'paused_in_background'
  | 'unavailable'
  | 'error';

interface UsePoseCameraOptions {
  side: 'left' | 'right';
  quality: PoseQualityPolicy;
  target_inference_fps: number;
  adapter?: PoseCameraAdapter;
}

export function usePoseCamera({
  side,
  quality,
  target_inference_fps,
  adapter = defaultAdapter,
}: UsePoseCameraOptions) {
  const [status, setStatus] = useState<PoseCameraStatus>('idle');
  const [latestFrame, setLatestFrame] = useState<PoseFrame | null>(null);
  const [droppedFrames, setDroppedFrames] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const foreground = useRef(AppState.currentState === 'active');
  const subscriptions = useRef<EmitterSubscription[]>([]);
  const running = useRef(false);
  const resumeAfterBackground = useRef(false);
  const permissionGranted = useRef(false);
  const options = useMemo<PoseStreamOptions>(
    () => ({ side, quality, target_inference_fps }),
    [quality, side, target_inference_fps],
  );

  const removeSubscriptions = useCallback(() => {
    subscriptions.current.forEach(subscription => subscription.remove());
    subscriptions.current = [];
  }, []);

  const stop = useCallback(async () => {
    removeSubscriptions();
    if (!running.current) {
      return;
    }
    running.current = false;
    await adapter.stop();
    setStatus(foreground.current ? 'ready' : 'paused_in_background');
  }, [adapter, removeSubscriptions]);

  const start = useCallback(async () => {
    if (!foreground.current) {
      setStatus('paused_in_background');
      return;
    }
    if (running.current) {
      return;
    }
    if (!permissionGranted.current) {
      return;
    }
    setError(null);
    try {
      subscriptions.current = [
        adapter.onFrame(setLatestFrame),
        adapter.onFrameDropped(count =>
          setDroppedFrames(previous => previous + count),
        ),
        adapter.onError(message => {
          setError(message);
          setStatus('error');
        }),
      ];
      await adapter.start(options);
      running.current = true;
      setStatus('running');
    } catch (cause) {
      removeSubscriptions();
      setStatus(
        cause instanceof PoseCameraUnavailableError ? 'unavailable' : 'error',
      );
      setError(
        cause instanceof Error ? cause.message : 'Falha ao iniciar câmera.',
      );
    }
  }, [adapter, options, removeSubscriptions]);

  const requestPermission = useCallback(async () => {
    setStatus('requesting_permission');
    setError(null);
    try {
      const granted = await adapter.requestPermission();
      permissionGranted.current = granted;
      setStatus(granted ? 'ready' : 'permission_denied');
      return granted;
    } catch (cause) {
      setStatus(
        cause instanceof PoseCameraUnavailableError ? 'unavailable' : 'error',
      );
      setError(
        cause instanceof Error ? cause.message : 'Falha ao solicitar câmera.',
      );
      return false;
    }
  }, [adapter]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (next: AppStateStatus) => {
        foreground.current = next === 'active';
        if (!foreground.current) {
          resumeAfterBackground.current = running.current;
          stop().catch(() => undefined);
          setStatus('paused_in_background');
        } else if (resumeAfterBackground.current) {
          resumeAfterBackground.current = false;
          setStatus('ready');
          start().catch(() => undefined);
        }
      },
    );
    return () => {
      subscription.remove();
      stop().catch(() => undefined);
    };
  }, [start, stop]);

  return {
    status,
    latestFrame,
    droppedFrames,
    error,
    requestPermission,
    start,
    stop,
  };
}

const defaultAdapter = createPoseCameraAdapter();
