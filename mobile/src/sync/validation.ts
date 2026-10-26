import { ApiError } from '../api/errors';
import type {
  SessionItemResultInput,
  SessionResultInput,
} from '../contracts/domain';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIMEZONE_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;

export function sanitizeSessionResult(
  payload: SessionResultInput,
): SessionResultInput {
  const sanitized: SessionResultInput = {
    client_session_id: payload.client_session_id,
    workout_id: payload.workout_id,
    workout_revision_id: payload.workout_revision_id,
    status: payload.status,
    started_at: payload.started_at,
    finished_at: payload.finished_at,
    active_duration_ms: payload.active_duration_ms,
    low_confidence_summary: payload.low_confidence_summary,
    feedback_summary: payload.feedback_summary,
    items: payload.items.map(sanitizeItem),
  };
  validateSessionResult(sanitized);
  return sanitized;
}

function sanitizeItem(item: SessionItemResultInput): SessionItemResultInput {
  return {
    workout_item_id: item.workout_item_id,
    position: item.position,
    completed_sets: item.completed_sets,
    completed_repetitions: item.completed_repetitions,
    active_duration_ms: item.active_duration_ms,
    interrupted: item.interrupted,
  };
}

function validateSessionResult(payload: SessionResultInput): void {
  [
    payload.client_session_id,
    payload.workout_id,
    payload.workout_revision_id,
  ].forEach(value =>
    assert(UUID_PATTERN.test(value), 'session_identifier_invalid'),
  );
  assert(
    payload.status === 'completed' || payload.status === 'interrupted',
    'session_status_invalid',
  );
  const startedAt = parseDate(payload.started_at);
  const finishedAt = parseDate(payload.finished_at);
  assert(finishedAt >= startedAt, 'session_dates_invalid');
  assertNonnegativeInteger(
    payload.active_duration_ms,
    'active_duration_invalid',
  );

  const ids = new Set<string>();
  const positions = new Set<number>();
  let itemDuration = 0;
  payload.items.forEach(item => {
    assert(
      UUID_PATTERN.test(item.workout_item_id),
      'session_item_identifier_invalid',
    );
    assert(!ids.has(item.workout_item_id), 'session_item_duplicated');
    assert(!positions.has(item.position), 'session_position_duplicated');
    ids.add(item.workout_item_id);
    positions.add(item.position);
    assertPositiveInteger(item.position, 'session_position_invalid');
    assertNonnegativeInteger(item.completed_sets, 'completed_sets_invalid');
    assertNonnegativeInteger(
      item.completed_repetitions,
      'completed_repetitions_invalid',
    );
    assertNonnegativeInteger(item.active_duration_ms, 'item_duration_invalid');
    itemDuration += item.active_duration_ms;
  });
  assert(
    itemDuration <= payload.active_duration_ms,
    'item_duration_exceeds_session',
  );
}

function parseDate(value: string): number {
  assert(TIMEZONE_PATTERN.test(value), 'session_timezone_required');
  const parsed = Date.parse(value);
  assert(Number.isFinite(parsed), 'session_date_invalid');
  return parsed;
}

function assertPositiveInteger(value: number, code: string): void {
  assert(Number.isInteger(value) && value > 0, code);
}

function assertNonnegativeInteger(value: number, code: string): void {
  assert(Number.isInteger(value) && value >= 0, code);
}

function assert(condition: boolean, code: string): asserts condition {
  if (!condition) {
    throw new ApiError(
      'validation',
      'O resultado local da sessão não segue o contrato da API.',
      422,
      code,
    );
  }
}
