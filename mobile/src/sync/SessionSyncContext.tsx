import NetInfo from '@react-native-community/netinfo';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  lastReport: SyncReport | null;
  refresh(): Promise<void>;
  syncNow(): Promise<SyncReport>;
  prepare(workoutId: UUID, workoutRevisionId: UUID): Promise<SessionDraft>;
  getDraft(clientSessionId: UUID): Promise<SessionDraft | null>;
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
  const [lastReport, setLastReport] = useState<SyncReport | null>(null);
  const ownerId = user?.role === 'patient' ? user.id : null;
  const ownerIdRef = useRef<UUID | null>(ownerId);
  ownerIdRef.current = ownerId;

  const requireOwner = useCallback((): UUID => {
    if (!ownerId) {
      throw new Error(
        'A sincronização de sessões exige uma paciente autenticada.',
      );
    }
    return ownerId;
  }, [ownerId]);

  const refresh = useCallback(async () => {
    const requestedOwner = ownerId;
    try {
      const currentPending = requestedOwner
        ? await appDependencies.sessionSync.list(requestedOwner)
        : [];
      if (ownerIdRef.current === requestedOwner) {
        setPending(currentPending);
        setLoadError(null);
      }
    } catch (error) {
      if (ownerIdRef.current === requestedOwner) {
        setLoadError(error);
      }
      throw error;
    }
  }, [ownerId]);

  const syncOwner = useCallback(async (currentOwner: UUID) => {
    if (ownerIdRef.current === currentOwner) {
      setSyncing(true);
    }
    try {
      const report = await appDependencies.sessionSync.sync(currentOwner);
      if (ownerIdRef.current === currentOwner) {
        setLastReport(report);
      }
      return report;
    } finally {
      const currentPending =
        await appDependencies.sessionSync.list(currentOwner);
      if (ownerIdRef.current === currentOwner) {
        setSyncing(false);
        setPending(currentPending);
      }
    }
  }, []);

  const syncNow = useCallback(
    () => syncOwner(requireOwner()),
    [requireOwner, syncOwner],
  );

  useEffect(() => {
    setSyncing(false);
    setLastReport(null);
    refresh().catch(() => undefined);
    if (!ownerId) {
      return;
    }
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable !== false) {
        syncNow().catch(() => undefined);
      }
    });
    return () => {
      unsubscribe();
      appDependencies.sessionSync.cancel(ownerId);
    };
  }, [ownerId, refresh, syncNow]);

  const value = useMemo<SessionSyncContextValue>(
    () => ({
      pending,
      syncing,
      loadError,
      lastReport,
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
      getDraft(clientSessionId) {
        return appDependencies.sessionSync.getDraft(
          requireOwner(),
          clientSessionId,
        );
      },
      async finishDraft(clientSessionId, completion) {
        const currentOwner = requireOwner();
        const result = await appDependencies.sessionSync.finishDraft(
          currentOwner,
          clientSessionId,
          completion,
        );
        await refresh();
        syncOwner(currentOwner).catch(() => undefined);
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
    [
      pending,
      syncing,
      loadError,
      lastReport,
      refresh,
      syncNow,
      syncOwner,
      requireOwner,
    ],
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
