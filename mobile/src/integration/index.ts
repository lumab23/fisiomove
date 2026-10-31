export { useAuth } from '../auth/AuthContext';
export type { AuthStatus } from '../auth/AuthContext';
export type { AuthenticatedUser, UserRole } from '../contracts/auth';
export type * from '../contracts/common';
export type * from '../contracts/domain';
export type {
  AuthStackParamList,
  PatientStackParamList,
  PhysiotherapistStackParamList,
} from '../navigation/types';
export { useSessionSync } from '../sync/SessionSyncContext';
export type {
  PendingSession,
  PublicSessionSyncStatus,
  SessionCompletion,
  SessionDraft,
  SyncReport,
} from '../sync/types';
export { selectSessionSyncStatus } from '../sync/status';
export { failureState, resolvedState } from './asyncState';
export type { AsyncState } from './asyncState';

import { appDependencies } from '../app/dependencies';

export const mobileServices = {
  exercises: appDependencies.exercises,
  workouts: appDependencies.workouts,
  patients: appDependencies.patients,
  notes: appDependencies.notes,
  sessions: appDependencies.sessions,
  progress: appDependencies.progress,
};
