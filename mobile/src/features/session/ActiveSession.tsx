import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import type { UUID } from '../../contracts/common';
import type { Workout } from '../../contracts/domain';
import { demoRuleForItem } from '../exercise-engine/demoElbowFlexion';
import type { SessionDraft } from '../../sync/types';
import {
  SessionExecution,
  type SessionExecutionSnapshot,
  type SessionPlanItem,
} from './SessionExecution';

/**
 * Session being executed by the patient. Kept only in memory (Q-T2): routes
 * carry IDs and read the workout, the draft and the progress from here.
 */
export interface ActiveSession {
  draft: SessionDraft;
  workout: Workout;
  execution: SessionExecution;
  snapshot: SessionExecutionSnapshot;
}

interface ActiveSessionContextValue {
  session: ActiveSession | null;
  /** Builds the plan from the validated workout of the same revision. */
  begin(workout: Workout, draft: SessionDraft): ActiveSession;
  start(): void;
  tick(): void;
  /** Repetition counted by touch (DEC-008). */
  countRepetition(): void;
  /** Repetition completed by the demonstration engine (DEC-013). */
  countCameraRepetition(): void;
  /** "Contar manualmente": engine off for the current item (DEC-013). */
  switchToManualCounting(): void;
  pause(): void;
  resume(): void;
  clear(): void;
}

const ActiveSessionContext = createContext<ActiveSessionContextValue | null>(
  null,
);

/**
 * Prescription exactly as published: sets, repetitions and rest of each
 * `WorkoutItem`, in the order of `position`. No default values.
 */
export function sessionPlanFrom(workout: Workout): SessionPlanItem[] {
  return [...workout.items]
    .sort((left, right) => left.position - right.position)
    .map(item => ({
      workout_item_id: item.id,
      position: item.position,
      sets: item.sets,
      repetitions: item.repetitions,
      rest_duration_ms: item.rest_duration_ms,
      // Only a rule the app can run; anything else is counted by touch.
      counting_rule: demoRuleForItem(item.counting_rule, item.side)
        ? item.counting_rule
        : null,
    }));
}

/** Repetitions already counted in the whole session. */
export function countedRepetitions(snapshot: SessionExecutionSnapshot) {
  return snapshot.items.reduce(
    (total, item) => total + item.completed_repetitions,
    0,
  );
}

type Running = Omit<ActiveSession, 'snapshot'>;

export function ActiveSessionProvider({
  children,
  now = Date.now,
}: PropsWithChildren<{ now?: () => number }>) {
  const runningRef = useRef<Running | null>(null);
  const [running, setRunning] = useState<Running | null>(null);
  const [snapshot, setSnapshot] = useState<SessionExecutionSnapshot | null>(
    null,
  );

  const begin = useCallback(
    (workout: Workout, draft: SessionDraft): ActiveSession => {
      if (
        workout.status !== 'published' ||
        workout.id !== draft.workout_id ||
        workout.current_revision_id !== draft.workout_revision_id
      ) {
        throw new Error('O treino não corresponde à sessão preparada.');
      }
      const execution = new SessionExecution(
        draft,
        sessionPlanFrom(workout),
        now,
      );
      const next = { draft, workout, execution };
      const first = execution.snapshot();
      runningRef.current = next;
      setRunning(next);
      setSnapshot(first);
      return { ...next, snapshot: first };
    },
    [now],
  );

  const run = useCallback(
    (step: (execution: SessionExecution) => SessionExecutionSnapshot) => {
      const current = runningRef.current;
      if (current) {
        setSnapshot(step(current.execution));
      }
    },
    [],
  );

  // Stable actions: screens use them in effects and focus callbacks.
  const start = useCallback(
    () =>
      run(execution =>
        execution.snapshot().status === 'ready'
          ? execution.start()
          : execution.snapshot(),
      ),
    [run],
  );
  const tick = useCallback(() => run(execution => execution.tick()), [run]);
  const countRepetition = useCallback(
    () => run(execution => execution.completeRepetition()),
    [run],
  );
  const countCameraRepetition = useCallback(
    () => run(execution => execution.completeRepetition('camera')),
    [run],
  );
  const switchToManualCounting = useCallback(
    () => run(execution => execution.switchToManualCounting()),
    [run],
  );
  const pause = useCallback(() => run(execution => execution.pause()), [run]);
  const resume = useCallback(() => run(execution => execution.resume()), [run]);

  const clear = useCallback(() => {
    runningRef.current = null;
    setRunning(null);
    setSnapshot(null);
  }, []);

  const value = useMemo<ActiveSessionContextValue>(
    () => ({
      session: running && snapshot ? { ...running, snapshot } : null,
      begin,
      start,
      tick,
      countRepetition,
      countCameraRepetition,
      switchToManualCounting,
      pause,
      resume,
      clear,
    }),
    [
      running,
      snapshot,
      begin,
      start,
      tick,
      countRepetition,
      countCameraRepetition,
      switchToManualCounting,
      pause,
      resume,
      clear,
    ],
  );

  return (
    <ActiveSessionContext.Provider value={value}>
      {children}
    </ActiveSessionContext.Provider>
  );
}

/**
 * Active session controls. With `clientSessionId`, `session` is `null` unless
 * the session in memory is the one named by the route.
 */
export function useActiveSession(
  clientSessionId?: UUID,
): ActiveSessionContextValue {
  const value = useContext(ActiveSessionContext);
  if (!value) {
    throw new Error(
      'useActiveSession precisa estar dentro de ActiveSessionProvider.',
    );
  }
  if (
    clientSessionId !== undefined &&
    value.session?.draft.client_session_id !== clientSessionId
  ) {
    return { ...value, session: null };
  }
  return value;
}

/** Prescribed item under execution (the last one once the plan is done). */
export function currentWorkoutItem({ snapshot, workout }: ActiveSession) {
  const progress = snapshot.items[snapshot.current_item_index];
  return (
    workout.items.find(entry => entry.id === progress?.workout_item_id) ??
    workout.items[0]
  );
}
