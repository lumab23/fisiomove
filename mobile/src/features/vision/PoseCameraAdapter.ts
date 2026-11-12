import {
  NativeEventEmitter,
  NativeModules,
  type EmitterSubscription,
} from 'react-native';

import type { PoseFrame, PoseQualityPolicy } from './types';

export interface PoseStreamOptions {
  side: 'left' | 'right';
  quality: PoseQualityPolicy;
  target_inference_fps: number;
}

export interface PoseCameraAdapter {
  requestPermission(): Promise<boolean>;
  start(options: PoseStreamOptions): Promise<void>;
  stop(): Promise<void>;
  onFrame(listener: (frame: PoseFrame) => void): EmitterSubscription;
  onFrameDropped(listener: (count: number) => void): EmitterSubscription;
  onError(listener: (message: string) => void): EmitterSubscription;
}

interface NativePoseModule {
  requestCameraPermission(): Promise<boolean>;
  startPoseStream(options: PoseStreamOptions): Promise<void>;
  stopPoseStream(): Promise<void>;
  addListener(eventName: 'poseFrame' | 'poseFrameDropped' | 'poseError'): void;
  removeListeners(count: number): void;
}

interface DroppedFrameEvent {
  count: number;
}

interface PoseErrorEvent {
  message: string;
}

export class PoseCameraUnavailableError extends Error {
  constructor() {
    super(
      'O adaptador nativo de câmera e pose ainda não foi integrado a este build.',
    );
    this.name = 'PoseCameraUnavailableError';
  }
}

export function createPoseCameraAdapter(): PoseCameraAdapter {
  const nativeModule = NativeModules.FisioMovePose as
    NativePoseModule | undefined;
  if (!nativeModule) {
    return unavailableAdapter;
  }
  const emitter = new NativeEventEmitter(nativeModule);
  return {
    requestPermission: () => nativeModule.requestCameraPermission(),
    start: options => nativeModule.startPoseStream(options),
    stop: () => nativeModule.stopPoseStream(),
    onFrame: listener =>
      emitter.addListener('poseFrame', payload => {
        if (isPoseFrame(payload)) {
          listener(payload);
        }
      }),
    onFrameDropped: listener =>
      emitter.addListener('poseFrameDropped', payload => {
        const event = payload as Partial<DroppedFrameEvent>;
        if (typeof event.count === 'number' && Number.isFinite(event.count)) {
          listener(event.count);
        }
      }),
    onError: listener =>
      emitter.addListener('poseError', payload => {
        const event = payload as Partial<PoseErrorEvent>;
        if (typeof event.message === 'string') {
          listener(event.message);
        }
      }),
  };
}

function isPoseFrame(payload: object): payload is PoseFrame {
  const value = payload as Partial<PoseFrame>;
  return (
    typeof value.timestamp_ms === 'number' &&
    typeof value.image_width === 'number' &&
    typeof value.image_height === 'number' &&
    typeof value.orientation === 'string' &&
    typeof value.is_mirrored === 'boolean' &&
    typeof value.inference_duration_ms === 'number' &&
    typeof value.landmarks === 'object' &&
    value.landmarks !== null
  );
}

const unavailableAdapter: PoseCameraAdapter = {
  async requestPermission() {
    throw new PoseCameraUnavailableError();
  },
  async start() {
    throw new PoseCameraUnavailableError();
  },
  async stop() {
    throw new PoseCameraUnavailableError();
  },
  onFrame() {
    throw new PoseCameraUnavailableError();
  },
  onFrameDropped() {
    throw new PoseCameraUnavailableError();
  },
  onError() {
    throw new PoseCameraUnavailableError();
  },
};
