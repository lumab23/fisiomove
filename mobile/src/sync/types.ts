import type { ISODateTime, UUID } from '../contracts/common';
import type { SessionResultInput } from '../contracts/domain';

export interface SessionDraft {
  owner_user_id: UUID;
  client_session_id: UUID;
  workout_id: UUID;
  workout_revision_id: UUID;
  started_at: ISODateTime;
}

export type PendingSyncState = 'pending' | 'syncing' | 'blocked' | 'paused';

export interface PendingSyncError {
  kind: string;
  code?: string;
  message: string;
  occurred_at: ISODateTime;
}

export interface PendingSession {
  owner_user_id: UUID;
  payload: SessionResultInput;
  state: PendingSyncState;
  attempts: number;
  next_attempt_at: ISODateTime | null;
  last_error: PendingSyncError | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface SessionSyncState {
  version: 1;
  owner_user_id: UUID;
  drafts: SessionDraft[];
  pending: PendingSession[];
}

export interface SessionCompletion {
  status: SessionResultInput['status'];
  finished_at: ISODateTime;
  active_duration_ms: number;
  low_confidence_summary: SessionResultInput['low_confidence_summary'];
  feedback_summary: SessionResultInput['feedback_summary'];
  items: SessionResultInput['items'];
}

export interface SyncReport {
  sent: number;
  remaining: number;
  blocked: number;
}
