import type { UUID } from '../../contracts/common';
import type { SessionCompletion, SessionDraft } from '../../sync/types';

export interface SessionPlanItem {
  workout_item_id: UUID;
  position: number;
  sets: number;
  repetitions: number;
  rest_duration_ms: number;
}

export interface SessionItemProgress extends SessionPlanItem {
  completed_sets: number;
  completed_repetitions: number;
  repetitions_in_current_set: number;
  active_duration_ms: number;
}

export type SessionExecutionStatus =
  'ready' | 'active' | 'paused' | 'resting' | 'completed' | 'interrupted';

export interface SessionExecutionSnapshot {
  status: SessionExecutionStatus;
  active_duration_ms: number;
  current_item_index: number;
  items: SessionItemProgress[];
  rest_remaining_ms: number;
}

type ResumableStatus = 'active' | 'resting';

export class SessionExecution {
  private status: SessionExecutionStatus = 'ready';
  private resumeStatus: ResumableStatus = 'active';
  private activeDurationMs = 0;
  private lastTickAt: number | null = null;
  private restEndsAt: number | null = null;
  private pausedRestRemainingMs = 0;
  private currentItemIndex = 0;
  private readonly items: SessionItemProgress[];

  constructor(
    private readonly draft: SessionDraft,
    plan: readonly SessionPlanItem[],
    private readonly now: () => number = Date.now,
  ) {
    if (plan.length === 0) {
      throw new Error('A sessão precisa de pelo menos um item prescrito.');
    }
    this.items = plan.map(item => {
      if (
        !Number.isInteger(item.sets) ||
        item.sets <= 0 ||
        !Number.isInteger(item.repetitions) ||
        item.repetitions <= 0 ||
        !Number.isInteger(item.rest_duration_ms) ||
        item.rest_duration_ms < 0
      ) {
        throw new Error('A prescrição recebida não é válida.');
      }
      return {
        ...item,
        completed_sets: 0,
        completed_repetitions: 0,
        repetitions_in_current_set: 0,
        active_duration_ms: 0,
      };
    });
  }

  get sessionDraft(): SessionDraft {
    return this.draft;
  }

  start(): SessionExecutionSnapshot {
    if (this.status !== 'ready') {
      throw new Error('A sessão já foi iniciada.');
    }
    this.status = 'active';
    this.lastTickAt = this.now();
    return this.snapshot();
  }

  tick(): SessionExecutionSnapshot {
    const timestamp = this.now();
    if (this.status === 'active') {
      this.addActiveTime(timestamp);
    } else if (this.status === 'resting' && this.restEndsAt !== null) {
      if (timestamp >= this.restEndsAt) {
        const restEndedAt = this.restEndsAt;
        this.advanceAfterRest(restEndedAt);
        if (this.isActive()) {
          this.addActiveTime(timestamp);
        }
      }
    }
    return this.snapshot(timestamp);
  }

  completeRepetition(): SessionExecutionSnapshot {
    if (this.status !== 'active') {
      return this.snapshot();
    }
    const timestamp = this.now();
    this.addActiveTime(timestamp);
    const current = this.items[this.currentItemIndex];
    if (!current) {
      return this.snapshot(timestamp);
    }
    if (current.completed_sets >= current.sets) {
      return this.snapshot(timestamp);
    }

    current.repetitions_in_current_set += 1;
    current.completed_repetitions += 1;
    if (current.repetitions_in_current_set === current.repetitions) {
      current.completed_sets += 1;
      current.repetitions_in_current_set = 0;
      if (this.isPlanComplete()) {
        this.status = 'completed';
        this.lastTickAt = null;
      } else {
        this.beginRestOrAdvance(timestamp, current.rest_duration_ms);
      }
    }
    return this.snapshot(timestamp);
  }

  pause(): SessionExecutionSnapshot {
    if (this.status === 'active') {
      const timestamp = this.now();
      this.addActiveTime(timestamp);
      this.resumeStatus = 'active';
      this.status = 'paused';
      this.lastTickAt = null;
    } else if (this.status === 'resting') {
      const timestamp = this.now();
      this.resumeStatus = 'resting';
      this.pausedRestRemainingMs = Math.max(
        0,
        (this.restEndsAt ?? timestamp) - timestamp,
      );
      this.status = 'paused';
      this.restEndsAt = null;
    }
    return this.snapshot();
  }

  resume(): SessionExecutionSnapshot {
    if (this.status !== 'paused') {
      return this.snapshot();
    }
    const timestamp = this.now();
    if (this.resumeStatus === 'resting' && this.pausedRestRemainingMs > 0) {
      this.status = 'resting';
      this.restEndsAt = timestamp + this.pausedRestRemainingMs;
    } else {
      this.status = 'active';
      this.lastTickAt = timestamp;
    }
    this.pausedRestRemainingMs = 0;
    return this.snapshot(timestamp);
  }

  interrupt(): SessionCompletion {
    const timestamp = this.now();
    if (this.status === 'active') {
      this.addActiveTime(timestamp);
    }
    if (this.status === 'completed') {
      throw new Error('Uma sessão concluída não pode ser interrompida.');
    }
    this.status = 'interrupted';
    this.restEndsAt = null;
    this.lastTickAt = null;
    return this.buildCompletion('interrupted', timestamp);
  }

  completion(timestamp = this.now()): SessionCompletion {
    if (this.status !== 'completed') {
      throw new Error('A prescrição ainda não foi concluída.');
    }
    return this.buildCompletion('completed', timestamp);
  }

  private buildCompletion(
    status: 'completed' | 'interrupted',
    timestamp: number,
  ): SessionCompletion {
    return {
      status,
      finished_at: new Date(timestamp).toISOString(),
      active_duration_ms: this.activeDurationMs,
      low_confidence_summary: null,
      feedback_summary: null,
      items: this.items.map((item, index) => ({
        workout_item_id: item.workout_item_id,
        position: item.position,
        completed_sets: item.completed_sets,
        completed_repetitions: item.completed_repetitions,
        active_duration_ms: item.active_duration_ms,
        interrupted:
          status === 'interrupted' && index === this.currentItemIndex,
      })),
    };
  }

  snapshot(timestamp = this.now()): SessionExecutionSnapshot {
    return {
      status: this.status,
      active_duration_ms: this.activeDurationMs,
      current_item_index: this.currentItemIndex,
      items: this.items.map(item => ({ ...item })),
      rest_remaining_ms:
        this.status === 'resting' && this.restEndsAt !== null
          ? Math.max(0, this.restEndsAt - timestamp)
          : this.status === 'paused' && this.resumeStatus === 'resting'
            ? this.pausedRestRemainingMs
            : 0,
    };
  }

  private addActiveTime(timestamp: number): void {
    if (this.lastTickAt === null) {
      this.lastTickAt = timestamp;
      return;
    }
    const elapsed = Math.max(0, timestamp - this.lastTickAt);
    this.activeDurationMs += elapsed;
    const current = this.items[this.currentItemIndex];
    if (current) {
      current.active_duration_ms += elapsed;
    }
    this.lastTickAt = timestamp;
  }

  private beginRestOrAdvance(timestamp: number, duration: number): void {
    if (duration > 0) {
      this.status = 'resting';
      this.restEndsAt = timestamp + duration;
      this.lastTickAt = null;
      return;
    }
    this.advanceItem(timestamp);
  }

  private advanceAfterRest(timestamp: number): void {
    this.restEndsAt = null;
    this.advanceItem(timestamp);
  }

  private isActive(): boolean {
    return this.status === 'active';
  }

  private advanceItem(timestamp: number): void {
    const current = this.items[this.currentItemIndex];
    if (current && current.completed_sets < current.sets) {
      this.status = 'active';
      this.lastTickAt = timestamp;
      return;
    }
    this.currentItemIndex += 1;
    if (this.currentItemIndex >= this.items.length) {
      this.status = 'completed';
      this.lastTickAt = null;
      return;
    }
    this.status = 'active';
    this.lastTickAt = timestamp;
  }

  private isPlanComplete(): boolean {
    return this.items.every(item => item.completed_sets === item.sets);
  }
}
