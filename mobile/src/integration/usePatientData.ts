import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ApiError } from '../api/errors';
import { appDependencies } from '../app/dependencies';
import type {
  LinkedPhysiotherapist,
  OwnNotePage,
  PatientSelfProfile,
  ProgressSummary,
  SessionPage,
  WorkoutPage,
} from '../contracts/domain';
import type { ProgressPeriod } from '../services/progress';
import { failureState, resolvedState, type AsyncState } from './asyncState';

export type Resource<T> = {
  state: AsyncState<T>;
  /** Loads again showing the loading state (retry after a failure). */
  reload: () => void;
  /** Loads again keeping the current content on screen until it resolves. */
  refresh: () => void;
};

/**
 * Loads once on mount and again on `reload`/`refresh`. `load` and `isEmpty`
 * must be stable (module-level or memoized), otherwise the request repeats.
 */
export function useResource<T>(
  load: () => Promise<T>,
  isEmpty: (value: T) => boolean,
): Resource<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const silent = useRef(false);
  useEffect(() => {
    let active = true;
    if (!silent.current) {
      setState({ status: 'loading' });
    }
    silent.current = false;
    load().then(
      data => {
        if (active) {
          setState(resolvedState(data, isEmpty));
        }
      },
      (cause: unknown) => {
        if (active) {
          setState(failureState<T>(cause));
        }
      },
    );
    return () => {
      active = false;
    };
  }, [load, isEmpty, attempt]);
  const reload = useCallback(() => setAttempt(value => value + 1), []);
  const refresh = useCallback(() => {
    silent.current = true;
    setAttempt(value => value + 1);
  }, []);
  return { state, reload, refresh };
}

/**
 * Refreshes when the screen regains focus (e.g. back from a session), not on
 * the first focus: mounting already loads. Needs a navigation context.
 */
function useRefreshOnFocus<T>(resource: Resource<T>): Resource<T> {
  const { refresh } = resource;
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      refresh();
    }, [refresh]),
  );
  return resource;
}

const never = () => false;
const emptyPage = (page: { items: unknown[] }) => page.items.length === 0;
const emptyProgress = (summary: ProgressSummary) =>
  summary.completed_sessions + summary.interrupted_sessions === 0;

const loadProfile = () => appDependencies.profile.mine();
const loadWorkouts = () => appDependencies.workouts.listMine();

export function usePatientProfile(): Resource<PatientSelfProfile> {
  return useResource(loadProfile, never);
}

// Without an active link the API answers 404: same empty state as a null name.
const loadLinkedPhysiotherapist = () =>
  appDependencies.profile
    .linkedPhysiotherapist()
    .catch((cause: unknown): LinkedPhysiotherapist => {
      if (
        cause instanceof ApiError &&
        cause.kind === 'not_found' &&
        cause.code === 'physiotherapist_not_found'
      ) {
        return { full_name: null };
      }
      throw cause;
    });
const unnamed = (value: { full_name: string | null }) => !value.full_name;

/** Name of the linked physiotherapist; `empty` when unknown or unlinked. */
export function useLinkedPhysiotherapist(): Resource<LinkedPhysiotherapist> {
  return useResource(loadLinkedPhysiotherapist, unnamed);
}

/** Published workouts of the authenticated patient (`GET /me/workouts`). */
export function useMyWorkouts(): Resource<WorkoutPage> {
  return useRefreshOnFocus(useResource(loadWorkouts, emptyPage));
}

/** Most recent sessions first (`GET /me/sessions`). */
export function useMySessions(pageSize: number): Resource<SessionPage> {
  const load = useCallback(
    () => appDependencies.sessions.listMine({ page_size: pageSize }),
    [pageSize],
  );
  return useRefreshOnFocus(useResource(load, emptyPage));
}

/** Page size of the notes screen (volume of the TCC, KI-010). */
export const myNotesPageSize = 50;
const loadMyNotes = () =>
  appDependencies.notes.mine({ page_size: myNotesPageSize });

/** Notes the physiotherapist marked visible (`GET /me/notes`, DEC-015). */
export function useMyNotes(): Resource<OwnNotePage> {
  return useRefreshOnFocus(useResource(loadMyNotes, emptyPage));
}

export function useMyProgress(
  period: ProgressPeriod,
): Resource<ProgressSummary> {
  const { period_start, period_end } = period;
  const load = useCallback(
    () => appDependencies.progress.mine({ period_start, period_end }),
    [period_start, period_end],
  );
  return useRefreshOnFocus(useResource(load, emptyProgress));
}

/**
 * Current week in the device's time zone, Monday 00:00 to Sunday 23:59:59.999.
 * Presentation choice (Q-P7), not a clinical rule.
 */
export function currentWeek(now: Date): ProgressPeriod {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return {
    period_start: start.toISOString(),
    period_end: end.toISOString(),
  };
}
