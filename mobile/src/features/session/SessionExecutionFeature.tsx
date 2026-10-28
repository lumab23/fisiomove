import { useCallback, type ReactNode } from 'react';

import type { SessionDraft } from '../../sync/types';
import type { SessionController } from './SessionController';
import type { FeedbackInterval } from './SessionController';
import type { SessionExecutionSnapshot } from './SessionExecution';
import { SessionExecutionPanel } from './SessionExecutionPanel';
import { useSessionResult } from './useSessionResult';

interface Props {
  controller: SessionController;
  draft: SessionDraft;
  snapshot: SessionExecutionSnapshot;
  currentExerciseName: string;
  feedbackMessage: string;
  feedbackInterval: FeedbackInterval;
  stopCamera(): Promise<void>;
  onSnapshot(snapshot: SessionExecutionSnapshot): void;
  onSaved?(): void;
  onError?(error: unknown): void;
  onAudioFeedback?(message: string): void;
  mascot?: ReactNode;
}

export function SessionExecutionFeature({
  controller,
  draft,
  snapshot,
  currentExerciseName,
  feedbackMessage,
  feedbackInterval,
  stopCamera,
  onSnapshot,
  onSaved,
  onError,
  onAudioFeedback,
  mascot,
}: Props) {
  const result = useSessionResult(controller, draft, stopCamera);
  const runFinalization = useCallback(
    async (finalize: () => Promise<unknown>) => {
      try {
        await finalize();
        onSaved?.();
      } catch (error) {
        onError?.(error);
      }
    },
    [onError, onSaved],
  );

  return (
    <SessionExecutionPanel
      snapshot={snapshot}
      currentExerciseName={currentExerciseName}
      feedbackMessage={feedbackMessage}
      onPause={() => onSnapshot(controller.pause())}
      onResume={() => onSnapshot(controller.resume())}
      onComplete={() => runFinalization(result.complete)}
      onInterrupt={() => runFinalization(result.interrupt)}
      onTick={() => onSnapshot(controller.tick())}
      onAudioFeedback={onAudioFeedback}
      busy={result.saving}
      feedbackInterval={feedbackInterval}
      mascot={mascot}
    />
  );
}
