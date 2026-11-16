import type { SessionExecutionSnapshot } from './SessionExecution';

/**
 * System feedback for a change in the execution (plan of 2026-11-15, Q-P2).
 * It only reports what the session already decided (a repetition counted, a
 * set closed, the next item started); it never describes or corrects the
 * movement (RN18).
 */
export interface ExecutionFeedback {
  /** Read by the screen reader as one message, so none cuts the other. */
  announcement: string;
  /** Visible messages that stay on screen until the next repetition. */
  notices: string[];
  /** A repetition was counted: short vibration. */
  repetition: boolean;
}

/**
 * Compares two snapshots of the same session. Returns `null` when nothing
 * worth telling happened, and always while paused or stopped (RN20).
 */
export function executionFeedback(
  previous: SessionExecutionSnapshot | null,
  next: SessionExecutionSnapshot,
  itemName: (index: number) => string,
): ExecutionFeedback | null {
  if (
    !previous ||
    next.status === 'paused' ||
    next.status === 'interrupted' ||
    next.status === 'ready'
  ) {
    return null;
  }
  const parts: string[] = [];
  const notices: string[] = [];
  let repetition = false;

  const index = previous.current_item_index;
  const before = previous.items[index];
  const after = next.items[index];
  if (
    before &&
    after &&
    after.completed_repetitions > before.completed_repetitions
  ) {
    repetition = true;
    const setClosed = after.completed_sets > before.completed_sets;
    // A closed set resets the counter to zero: the last one is the goal.
    const counted = setClosed
      ? after.repetitions
      : after.repetitions_in_current_set;
    parts.push(`Repetição ${counted} de ${after.repetitions}`);
    if (setClosed) {
      const notice = `Série ${after.completed_sets} de ${after.sets} concluída`;
      parts.push(notice);
      notices.push(notice);
    }
  }

  if (
    next.current_item_index > previous.current_item_index &&
    next.status !== 'completed'
  ) {
    const notice = `Próximo exercício: ${itemName(next.current_item_index)}`;
    parts.push(notice);
    notices.push(notice);
  }

  if (!parts.length) {
    return null;
  }
  return { announcement: `${parts.join('. ')}.`, notices, repetition };
}
