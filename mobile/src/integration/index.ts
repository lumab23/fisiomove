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
export {
  currentWeek,
  useMyNotes,
  useMyProgress,
  useMySessions,
  useMyWorkouts,
  useLinkedPhysiotherapist,
  usePatientProfile,
} from './usePatientData';
export type { Resource } from './usePatientData';
export {
  maxPageSize,
  useApprovedExercises,
  useCatalogExercise,
  useLibraryExercise,
  useLibrarySearch,
  useOwnPhysiotherapistProfile,
  usePatient,
  usePatientNotes,
  usePatientProgress,
  usePatients,
  usePatientSessions,
  usePatientWorkouts,
  useWorkout,
} from './useProfessionalData';

import { appDependencies } from '../app/dependencies';

export const mobileServices = {
  exercises: appDependencies.exercises,
  exerciseLibrary: appDependencies.exerciseLibrary,
  workouts: appDependencies.workouts,
  patients: appDependencies.patients,
  profile: appDependencies.profile,
  notes: appDependencies.notes,
  sessions: appDependencies.sessions,
  progress: appDependencies.progress,
};
