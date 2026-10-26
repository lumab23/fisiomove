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

export class SessionSyncService {
  private readonly running = new Map<UUID, Promise<SyncReport>>();

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
    const state = await this.store.load(ownerUserId);
    const draft: SessionDraft = {
      owner_user_id: ownerUserId,
      client_session_id: this.idFactory(),
      workout_id: workoutId,
      workout_revision_id: workoutRevisionId,
      started_at: this.now().toISOString(),
    };
    state.drafts.push(draft);
    await this.store.save(state);
    return draft;
  }

  async finishDraft(
    ownerUserId: UUID,
    clientSessionId: UUID,
    completion: SessionCompletion,
  ): Promise<PendingSession> {
    const state = await this.store.load(ownerUserId);
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
    const pending = this.addPending(state, ownerUserId, payload);
    await this.store.save(state);
    return pending;
  }

  async enqueue(
    ownerUserId: UUID,
    payload: SessionResultInput,
  ): Promise<PendingSession> {
    const state = await this.store.load(ownerUserId);
    const pending = this.addPending(state, ownerUserId, payload);
    await this.store.save(state);
    return pending;
  }

  async list(ownerUserId: UUID): Promise<PendingSession[]> {
    return (await this.store.load(ownerUserId)).pending;
  }

  sync(ownerUserId: UUID): Promise<SyncReport> {
    const current = this.running.get(ownerUserId);
    if (current) {
      return current;
    }
    const run = this.performSync(ownerUserId).finally(() => {
      this.running.delete(ownerUserId);
    });
    this.running.set(ownerUserId, run);
    return run;
  }

  async retryNow(
    ownerUserId: UUID,
    clientSessionId: UUID,
  ): Promise<SyncReport> {
    const state = await this.store.load(ownerUserId);
    const pending = state.pending.find(
      item => item.payload.client_session_id === clientSessionId,
    );
    if (pending) {
      pending.state = 'pending';
      pending.next_attempt_at = null;
      pending.updated_at = this.now().toISOString();
      await this.store.save(state);
    }
    return this.sync(ownerUserId);
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

  private async performSync(ownerUserId: UUID): Promise<SyncReport> {
    const state = await this.store.load(ownerUserId);
    let sent = 0;
    for (const pending of [...state.pending]) {
      if (!this.canAttempt(pending)) {
        continue;
      }
      pending.state = 'syncing';
      pending.updated_at = this.now().toISOString();
      await this.store.save(state);
      try {
        await this.sessions.create(pending.payload);
        state.pending = state.pending.filter(
          item =>
            item.payload.client_session_id !==
            pending.payload.client_session_id,
        );
        sent += 1;
        await this.store.save(state);
      } catch (error) {
        this.recordFailure(pending, error);
        await this.store.save(state);
        if (error instanceof ApiError && error.kind === 'session_expired') {
          break;
        }
      }
    }
    return {
      sent,
      remaining: state.pending.length,
      blocked: state.pending.filter(item => item.state === 'blocked').length,
    };
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
