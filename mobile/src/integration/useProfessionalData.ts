import { useCallback } from 'react';
import { appDependencies } from '../app/dependencies';
import type { UUID } from '../contracts/common';
import type {
  Exercise,
  ExercisePage,
  LibraryExerciseDetail,
  LibraryExercisePage,
  LibrarySearchParams,
  NotePage,
  Patient,
  PhysiotherapistProfile,
  PatientPage,
  ProgressSummary,
  SessionPage,
  Workout,
  WorkoutPage,
} from '../contracts/domain';
import type { ProgressPeriod } from '../services/progress';
import { useResource, type Resource } from './usePatientData';

/** Largest page accepted by the API (`page_size <= 100`). */
export const maxPageSize = 100;

const never = () => false;
const emptyPage = (page: { items: unknown[] }) => page.items.length === 0;
const emptyProgress = (summary: ProgressSummary) =>
  summary.completed_sessions + summary.interrupted_sessions === 0;

const loadPatients = () =>
  appDependencies.patients.list({ page_size: maxPageSize });
const loadExercises = () =>
  appDependencies.exercises.list({ page_size: maxPageSize });

/** Patients linked to the authenticated physiotherapist (`GET /patients`). */
export function usePatients(): Resource<PatientPage> {
  return useResource(loadPatients, emptyPage);
}

export function usePatient(patientId: UUID): Resource<Patient> {
  const load = useCallback(
    () => appDependencies.patients.get(patientId),
    [patientId],
  );
  return useResource(load, never);
}

/**
 * Approved catalog only (`GET /exercises`). Empty until an exercise is
 * clinically approved (KI-003); never filled with local examples.
 */
export function useApprovedExercises(): Resource<ExercisePage> {
  return useResource(loadExercises, emptyPage);
}

/** One catalog exercise (`GET /exercises/{id}`), e.g. to edit its pt-BR text. */
export function useCatalogExercise(exerciseId: UUID): Resource<Exercise> {
  const load = useCallback(
    () => appDependencies.exercises.get(exerciseId),
    [exerciseId],
  );
  return useResource(load, never);
}

export function usePatientWorkouts(patientId: UUID): Resource<WorkoutPage> {
  const load = useCallback(
    () =>
      appDependencies.workouts.listForPatient(patientId, {
        page_size: maxPageSize,
      }),
    [patientId],
  );
  return useResource(load, emptyPage);
}

export function useWorkout(workoutId: UUID): Resource<Workout> {
  const load = useCallback(
    () => appDependencies.workouts.get(workoutId),
    [workoutId],
  );
  return useResource(load, never);
}

export function usePatientNotes(patientId: UUID): Resource<NotePage> {
  const load = useCallback(
    () => appDependencies.notes.list(patientId, { page_size: maxPageSize }),
    [patientId],
  );
  return useResource(load, emptyPage);
}

export function usePatientSessions(
  patientId: UUID,
  pageSize: number,
): Resource<SessionPage> {
  const load = useCallback(
    () =>
      appDependencies.sessions.listForPatient(patientId, {
        page_size: pageSize,
      }),
    [patientId, pageSize],
  );
  return useResource(load, emptyPage);
}

export function usePatientProgress(
  patientId: UUID,
  period: ProgressPeriod,
): Resource<ProgressSummary> {
  const { period_start, period_end } = period;
  const load = useCallback(
    () =>
      appDependencies.progress.forPatient(patientId, {
        period_start,
        period_end,
      }),
    [patientId, period_start, period_end],
  );
  return useResource(load, emptyProgress);
}

const loadOwnProfile = () => appDependencies.profile.physiotherapistProfile();

/** Own display name (`GET /me/physiotherapist-profile`); `null` until set. */
export function useOwnPhysiotherapistProfile(): Resource<PhysiotherapistProfile> {
  return useResource(loadOwnProfile, never);
}

/** Live search in the external reference library (physiotherapist only). */
export function useLibrarySearch(
  params: LibrarySearchParams,
): Resource<LibraryExercisePage> {
  const { query, body_part, page, page_size } = params;
  const load = useCallback(
    () =>
      appDependencies.exerciseLibrary.search({
        query,
        body_part,
        page,
        page_size,
      }),
    [query, body_part, page, page_size],
  );
  return useResource(load, emptyPage);
}

export function useLibraryExercise(
  externalId: string,
): Resource<LibraryExerciseDetail> {
  const load = useCallback(
    () => appDependencies.exerciseLibrary.get(externalId),
    [externalId],
  );
  return useResource(load, never);
}
