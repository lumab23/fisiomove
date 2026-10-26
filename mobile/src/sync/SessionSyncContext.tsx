import NetInfo from '@react-native-community/netinfo';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { appDependencies } from '../app/dependencies';
import { useAuth } from '../auth/AuthContext';
import type { UUID } from '../contracts/common';
import type { SessionResultInput } from '../contracts/domain';
import type {
  SessionCompletion,
  SessionDraft,
  PendingSession,
  SyncReport,
} from './types';

interface SessionSyncContextValue {
  pending: PendingSession[];
  syncing: boolean;
  loadError: unknown;
  refresh(): Promise<void>;
  syncNow(): Promise<SyncReport>;
  prepare(workoutId: UUID, workoutRevisionId: UUID): Promise<SessionDraft>;
  finishDraft(
    clientSessionId: UUID,
    completion: SessionCompletion,
  ): Promise<PendingSession>;
  enqueue(payload: SessionResultInput): Promise<PendingSession>;
  retryNow(clientSessionId: UUID): Promise<SyncReport>;
}

const SessionSyncContext = createContext<SessionSyncContextValue | null>(null);

export function SessionSyncProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingSession[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const ownerId = user?.role === 'patient' ? user.id : null;

  const requireOwner = useCallback((): UUID => {
    if (!ownerId) {
      throw new Error(
        'A sincronização de sessões exige uma paciente autenticada.',
      );
    }
    return ownerId;
  }, [ownerId]);

  const refresh = useCallback(async () => {
    try {
      setPending(
        ownerId ? await appDependencies.sessionSync.list(ownerId) : [],
      );
      setLoadError(null);
    } catch (error) {
      setLoadError(error);
      throw error;
    }
  }, [ownerId]);

  const syncNow = useCallback(async () => {
    const currentOwner = requireOwner();
    setSyncing(true);
    try {
      return await appDependencies.sessionSync.sync(currentOwner);
    } finally {
      setSyncing(false);
      setPending(await appDependencies.sessionSync.list(currentOwner));
    }
  }, [requireOwner]);

  useEffect(() => {
    refresh().catch(() => undefined);
    if (!ownerId) {
      return;
    }
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable !== false) {
        syncNow().catch(() => undefined);
      }
    });
    return unsubscribe;
  }, [ownerId, refresh, syncNow]);

  const value = useMemo<SessionSyncContextValue>(
    () => ({
      pending,
      syncing,
      loadError,
      refresh,
      syncNow,
      async prepare(workoutId, workoutRevisionId) {
        const draft = await appDependencies.sessionSync.prepare(
          requireOwner(),
          workoutId,
          workoutRevisionId,
        );
        await refresh();
        return draft;
      },
      async finishDraft(clientSessionId, completion) {
        const result = await appDependencies.sessionSync.finishDraft(
          requireOwner(),
          clientSessionId,
          completion,
        );
        await refresh();
        return result;
      },
      async enqueue(payload) {
        const result = await appDependencies.sessionSync.enqueue(
          requireOwner(),
          payload,
        );
        await refresh();
        return result;
      },
      async retryNow(clientSessionId) {
        const result = await appDependencies.sessionSync.retryNow(
          requireOwner(),
          clientSessionId,
        );
        await refresh();
        return result;
      },
    }),
    [pending, syncing, loadError, refresh, syncNow, requireOwner],
  );

  return (
    <SessionSyncContext.Provider value={value}>
      {children}
    </SessionSyncContext.Provider>
  );
}

export function useSessionSync(): SessionSyncContextValue {
  const value = useContext(SessionSyncContext);
  if (!value) {
    throw new Error(
      'useSessionSync precisa estar dentro de SessionSyncProvider.',
    );
  }
  return value;
}
