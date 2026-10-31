import type { UUID } from '../contracts/common';
import type {
  PendingSession,
  PublicSessionSyncStatus,
  SyncReport,
} from './types';

export function selectSessionSyncStatus(
  clientSessionId: UUID,
  pending?: PendingSession,
  report?: SyncReport | null,
): PublicSessionSyncStatus | null {
  if (pending?.payload.client_session_id === clientSessionId) {
    if (pending.state === 'syncing') {
      return 'syncing';
    }
    if (pending.state === 'blocked') {
      return 'permanent_error';
    }
    if (pending.state === 'paused' || pending.last_error) {
      return 'retryable_error';
    }
    return 'pending';
  }
  return report?.sent_client_session_ids.includes(clientSessionId)
    ? 'synced'
    : null;
}
