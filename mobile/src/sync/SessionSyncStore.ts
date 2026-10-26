import type { UUID } from '../contracts/common';
import type { SecureJsonStorage } from '../storage/secureJsonStorage';
import type { SessionSyncState } from './types';

const serviceFor = (ownerUserId: UUID) =>
  `br.edu.fisiomove.sync.${ownerUserId}`;

export class SessionSyncStore {
  constructor(private readonly storage: SecureJsonStorage) {}

  async load(ownerUserId: UUID): Promise<SessionSyncState> {
    const stored = await this.storage.get<SessionSyncState>(
      serviceFor(ownerUserId),
    );
    if (
      !stored ||
      stored.version !== 1 ||
      stored.owner_user_id !== ownerUserId ||
      !Array.isArray(stored.drafts) ||
      !Array.isArray(stored.pending)
    ) {
      return emptyState(ownerUserId);
    }
    return {
      ...stored,
      drafts: stored.drafts.filter(item => item.owner_user_id === ownerUserId),
      pending: stored.pending
        .filter(item => item.owner_user_id === ownerUserId)
        .map(item =>
          item.state === 'syncing' ? { ...item, state: 'pending' } : item,
        ),
    };
  }

  save(state: SessionSyncState): Promise<void> {
    return this.storage.set(serviceFor(state.owner_user_id), state);
  }

  remove(ownerUserId: UUID): Promise<void> {
    return this.storage.remove(serviceFor(ownerUserId));
  }
}

function emptyState(ownerUserId: UUID): SessionSyncState {
  return { version: 1, owner_user_id: ownerUserId, drafts: [], pending: [] };
}
