import { ApiError } from '../api/errors';
import type { UUID } from '../contracts/common';
import type { SessionResultInput } from '../contracts/domain';
import type { SessionService } from '../services/sessions';
import { v4 as uuidV4 } from 'uuid';
import type { SessionSyncStore } from './SessionSyncStore';
import type {
  PendingSession,
  SessionCompletion,
  SessionDraft,
  SessionSyncState,
  SyncReport,
} from './types';
import { sanitizeSessionResult } from './validation';

const MAX_AUTOMATIC_ATTEMPTS = 8;
const MAX_BACKOFF_MS = 30 * 60 * 1000;

interface RunningSync {
  promise: Promise<SyncReport>;
  controller: AbortController;
}

export class SessionSyncService {
  private readonly running = new Map<UUID, RunningSync>();
  /** Tail of the queue that serializes store writes per owner. */
  private readonly writes = new Map<UUID, Promise<void>>();

  constructor(
    private readonly sessions: SessionService,
    private readonly store: SessionSyncStore,
    private readonly now: () => Date = () => new Date(),
    private readonly idFactory: () => UUID = createUuid,
  ) {}

  async prepare(
    ownerUserId: UUID,
    workoutId: UUID,
    workoutRevisionId: UUID,
  ): Promise<SessionDraft> {
    return this.update(ownerUserId, state => {
      const draft: SessionDraft = {
        owner_user_id: ownerUserId,
        client_session_id: this.idFactory(),
        workout_id: workoutId,
        workout_revision_id: workoutRevisionId,
        started_at: this.now().toISOString(),
      };
      state.drafts.push(draft);
      return draft;
    });
  }

  async finishDraft(
    ownerUserId: UUID,
    clientSessionId: UUID,
    completion: SessionCompletion,
  ): Promise<PendingSession> {
    return this.update(ownerUserId, state => {
      const draft = state.drafts.find(
        item => item.client_session_id === clientSessionId,
      );
      if (!draft || draft.owner_user_id !== ownerUserId) {
        throw new ApiError(
          'not_found',
          'A sessão preparada não pertence ao usuário autenticado.',
          404,
          'session_draft_not_found',
        );
      }
      const payload: SessionResultInput = {
        client_session_id: draft.client_session_id,
        workout_id: draft.workout_id,
        workout_revision_id: draft.workout_revision_id,
        started_at: draft.started_at,
        ...completion,
      };
      state.drafts = state.drafts.filter(
        item => item.client_session_id !== clientSessionId,
      );
      return this.addPending(state, ownerUserId, payload);
    });
  }

  async enqueue(
    ownerUserId: UUID,
    payload: SessionResultInput,
  ): Promise<PendingSession> {
    return this.update(ownerUserId, state =>
      this.addPending(state, ownerUserId, payload),
    );
  }

  async list(ownerUserId: UUID): Promise<PendingSession[]> {
    return (await this.store.load(ownerUserId)).pending;
  }

  async getDraft(
    ownerUserId: UUID,
    clientSessionId: UUID,
  ): Promise<SessionDraft | null> {
    const state = await this.store.load(ownerUserId);
    return (
      state.drafts.find(draft => draft.client_session_id === clientSessionId) ??
      null
    );
  }

  /**
   * Most recent local draft of this owner for the same workout revision.
   * Local only: never calls the API.
   */
  async findDraft(
    ownerUserId: UUID,
    workoutId: UUID,
    workoutRevisionId: UUID,
  ): Promise<SessionDraft | null> {
    const state = await this.store.load(ownerUserId);
    const matches = state.drafts.filter(
      draft =>
        draft.owner_user_id === ownerUserId &&
        draft.workout_id === workoutId &&
        draft.workout_revision_id === workoutRevisionId,
    );
    return (
      matches.sort((left, right) =>
        right.started_at.localeCompare(left.started_at),
      )[0] ?? null
    );
  }

  /**
   * Removes a local draft that will not be finished (DEC-009). Pending
   * results are never touched. Returns whether a draft was removed.
   */
  async discardDraft(
    ownerUserId: UUID,
    clientSessionId: UUID,
  ): Promise<boolean> {
    return (
      (await this.removeDrafts(
        ownerUserId,
        draft => draft.client_session_id === clientSessionId,
      )) > 0
    );
  }

  /**
   * Removes drafts of this workout prepared for another revision: the
   * physiotherapist published a new one and they can no longer be finished.
   * Drafts of other workouts and pending results are kept. Returns how many
   * drafts were removed.
   */
  async discardOutdatedDrafts(
    ownerUserId: UUID,
    workoutId: UUID,
    currentRevisionId: UUID,
  ): Promise<number> {
    return this.removeDrafts(
      ownerUserId,
      draft =>
        draft.workout_id === workoutId &&
        draft.workout_revision_id !== currentRevisionId,
    );
  }

  sync(ownerUserId: UUID): Promise<SyncReport> {
    const current = this.running.get(ownerUserId);
    if (current) {
      return current.promise;
    }
    const controller = new AbortController();
    const promise = this.performSync(ownerUserId, controller.signal).finally(
      () => {
        const active = this.running.get(ownerUserId);
        if (active?.promise === promise) {
          this.running.delete(ownerUserId);
        }
      },
    );
    this.running.set(ownerUserId, { promise, controller });
    return promise;
  }

  cancel(ownerUserId: UUID): void {
    this.running.get(ownerUserId)?.controller.abort();
  }

  async retryNow(
    ownerUserId: UUID,
    clientSessionId: UUID,
  ): Promise<SyncReport> {
    await this.update(ownerUserId, state => {
      const pending = state.pending.find(
        item => item.payload.client_session_id === clientSessionId,
      );
      if (pending) {
        pending.state = 'pending';
        pending.next_attempt_at = null;
        pending.updated_at = this.now().toISOString();
      }
    });
    return this.sync(ownerUserId);
  }

  /**
   * Sends pending results one at a time. The store is never held during the
   * request: each write reloads the latest state inside the owner queue, so a
   * draft discarded or a result finished meanwhile is not overwritten.
   */
  private async performSync(
    ownerUserId: UUID,
    signal: AbortSignal,
  ): Promise<SyncReport> {
    let sent = 0;
    const sentClientSessionIds: UUID[] = [];
    const attempted = new Set<UUID>();
    while (!signal.aborted) {
      const next = await this.update(ownerUserId, state => {
        const candidate = state.pending.find(
          item =>
            !attempted.has(item.payload.client_session_id) &&
            this.canAttempt(item),
        );
        if (signal.aborted || !candidate) {
          return null;
        }
        candidate.state = 'syncing';
        candidate.updated_at = this.now().toISOString();
        return candidate.payload;
      });
      if (!next) {
        break;
      }
      const clientSessionId = next.client_session_id;
      attempted.add(clientSessionId);
      let failure: { error: unknown } | null = null;
      try {
        if (signal.aborted) {
          throw new Error('request aborted');
        }
        await this.sessions.create(next, { signal });
      } catch (error) {
        failure = { error };
      }
      const stop = await this.update(ownerUserId, state => {
        const current = state.pending.find(
          item => item.payload.client_session_id === clientSessionId,
        );
        if (!failure) {
          state.pending = state.pending.filter(item => item !== current);
          sent += 1;
          sentClientSessionIds.push(clientSessionId);
          return false;
        }
        if (signal.aborted) {
          if (current) {
            current.state = 'pending';
            current.next_attempt_at = null;
            current.updated_at = this.now().toISOString();
          }
          return true;
        }
        if (current) {
          this.recordFailure(current, failure.error);
        }
        return (
          failure.error instanceof ApiError &&
          failure.error.kind === 'session_expired'
        );
      });
      if (stop) {
        break;
      }
    }
    const state = await this.store.load(ownerUserId);
    return {
      sent,
      remaining: state.pending.length,
      blocked: state.pending.filter(item => item.state === 'blocked').length,
      sent_client_session_ids: sentClientSessionIds,
    };
  }

  private async removeDrafts(
    ownerUserId: UUID,
    shouldRemove: (draft: SessionDraft) => boolean,
  ): Promise<number> {
    return this.update(ownerUserId, state => {
      const before = state.drafts.length;
      state.drafts = state.drafts.filter(draft => !shouldRemove(draft));
      return before - state.drafts.length;
    });
  }

  /**
   * Load, change and save the owner's state with no other write in between.
   * Writes of the same owner run in call order; a failed write does not
   * block the next one.
   */
  private update<T>(
    ownerUserId: UUID,
    change: (state: SessionSyncState) => T,
  ): Promise<T> {
    const previous = this.writes.get(ownerUserId) ?? Promise.resolve();
    const result = previous.then(async () => {
      const state = await this.store.load(ownerUserId);
      const value = change(state);
      await this.store.save(state);
      return value;
    });
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.writes.set(ownerUserId, tail);
    tail.then(() => {
      if (this.writes.get(ownerUserId) === tail) {
        this.writes.delete(ownerUserId);
      }
    });
    return result;
  }

  private addPending(
    state: SessionSyncState,
    ownerUserId: UUID,
    payload: SessionResultInput,
  ): PendingSession {
    const sanitizedPayload = sanitizeSessionResult(payload);
    const existing = state.pending.find(
      item =>
        item.payload.client_session_id === sanitizedPayload.client_session_id,
    );
    if (existing) {
      if (stableJson(existing.payload) !== stableJson(sanitizedPayload)) {
        throw new ApiError(
          'conflict',
          'O identificador local já foi usado com outro resultado.',
          409,
          'local_idempotency_conflict',
        );
      }
      return existing;
    }
    const timestamp = this.now().toISOString();
    const pending: PendingSession = {
      owner_user_id: ownerUserId,
      payload: sanitizedPayload,
      state: 'pending',
      attempts: 0,
      next_attempt_at: null,
      last_error: null,
      created_at: timestamp,
      updated_at: timestamp,
    };
    state.pending.push(pending);
    return pending;
  }

  private canAttempt(pending: PendingSession): boolean {
    if (pending.state === 'blocked' || pending.state === 'paused') {
      return false;
    }
    return (
      !pending.next_attempt_at ||
      pending.next_attempt_at <= this.now().toISOString()
    );
  }

  private recordFailure(pending: PendingSession, error: unknown): void {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError('unexpected', 'Falha inesperada ao sincronizar.');
    pending.attempts += 1;
    pending.last_error = {
      kind: apiError.kind,
      code: apiError.code,
      message: apiError.message,
      occurred_at: this.now().toISOString(),
    };
    pending.updated_at = this.now().toISOString();

    if (apiError.kind === 'session_expired') {
      pending.state = 'pending';
      pending.next_attempt_at = null;
      return;
    }
    if (!apiError.isTransient) {
      pending.state = 'blocked';
      pending.next_attempt_at = null;
      return;
    }
    if (pending.attempts >= MAX_AUTOMATIC_ATTEMPTS) {
      pending.state = 'paused';
      pending.next_attempt_at = null;
      return;
    }
    const backoff = Math.min(
      2 ** (pending.attempts - 1) * 5_000,
      MAX_BACKOFF_MS,
    );
    pending.state = 'pending';
    pending.next_attempt_at = new Date(
      this.now().getTime() + backoff,
    ).toISOString();
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function createUuid(): UUID {
  return uuidV4();
}
