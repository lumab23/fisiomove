import type { Side } from '../../contracts/domain';
import type { SessionCompletion } from '../../sync/types';
import type { PoseFrame } from '../vision/types';
import type { MovementEngine } from '../exercise-engine/MovementEngine';
import type { MovementUpdate } from '../exercise-engine/types';
import type {
  SessionExecution,
  SessionExecutionSnapshot,
} from './SessionExecution';

export interface SessionFrameUpdate {
  movement: MovementUpdate;
  session: SessionExecutionSnapshot;
}

export class SessionController {
  constructor(
    private readonly movement: MovementEngine,
    private readonly execution: SessionExecution,
    private readonly side: Exclude<Side, 'bilateral'>,
  ) {}

  start(): SessionExecutionSnapshot {
    return this.execution.start();
  }

  onPoseFrame(frame: PoseFrame): SessionFrameUpdate {
    const movement = this.movement.update(frame, this.side);
    const session =
      movement.feedback === 'rep_completed'
        ? this.execution.completeRepetition()
        : this.execution.snapshot();
    return { movement, session };
  }

  tick(): SessionExecutionSnapshot {
    return this.execution.tick();
  }

  pause(): SessionExecutionSnapshot {
    this.movement.setPaused(true);
    return this.execution.pause();
  }

  resume(): SessionExecutionSnapshot {
    const snapshot = this.execution.resume();
    this.movement.setPaused(false);
    return snapshot;
  }

  interrupt(): SessionCompletion {
    this.movement.setPaused(true);
    return this.execution.interrupt();
  }

  completion(): SessionCompletion {
    return this.execution.completion();
  }
}

export class FeedbackInterval {
  private lastAnnouncementAt: number | null = null;

  constructor(private readonly minimumIntervalMs: number) {
    if (!Number.isFinite(minimumIntervalMs) || minimumIntervalMs < 0) {
      throw new Error('O intervalo entre alertas precisa ser válido.');
    }
  }

  shouldAnnounce(timestampMs: number): boolean {
    if (
      this.lastAnnouncementAt !== null &&
      timestampMs - this.lastAnnouncementAt < this.minimumIntervalMs
    ) {
      return false;
    }
    this.lastAnnouncementAt = timestampMs;
    return true;
  }
}
