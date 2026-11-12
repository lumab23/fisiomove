import { selectSessionSyncStatus } from '../src/sync/status';
import type { PendingSession, SyncReport } from '../src/sync/types';

const CLIENT = '33333333-3333-4333-8333-333333333333';

function pending(
  state: PendingSession['state'],
  withError = false,
): PendingSession {
  return {
    owner_user_id: '11111111-1111-4111-8111-111111111111',
    payload: {
      client_session_id: CLIENT,
      workout_id: '44444444-4444-4444-8444-444444444444',
      workout_revision_id: '55555555-5555-4555-8555-555555555555',
      status: 'interrupted',
      started_at: '2026-10-30T12:00:00Z',
      finished_at: '2026-10-30T12:01:00Z',
      active_duration_ms: 1,
      low_confidence_summary: null,
      feedback_summary: null,
      items: [],
    },
    state,
    attempts: withError ? 1 : 0,
    next_attempt_at: null,
    last_error: withError
      ? {
          kind: 'network',
          message: 'offline',
          occurred_at: '2026-10-30T12:01:01Z',
        }
      : null,
    created_at: '2026-10-30T12:01:00Z',
    updated_at: '2026-10-30T12:01:01Z',
  };
}

test('traduz estados internos sem esconder erros', () => {
  expect(selectSessionSyncStatus(CLIENT, pending('pending'))).toBe('pending');
  expect(selectSessionSyncStatus(CLIENT, pending('syncing'))).toBe('syncing');
  expect(selectSessionSyncStatus(CLIENT, pending('pending', true))).toBe(
    'retryable_error',
  );
  expect(selectSessionSyncStatus(CLIENT, pending('paused', true))).toBe(
    'retryable_error',
  );
  expect(selectSessionSyncStatus(CLIENT, pending('blocked', true))).toBe(
    'permanent_error',
  );
});

test('considera sincronizado somente o UUID confirmado no relatório', () => {
  const report: SyncReport = {
    sent: 1,
    remaining: 0,
    blocked: 0,
    sent_client_session_ids: [CLIENT],
  };
  expect(selectSessionSyncStatus(CLIENT, undefined, report)).toBe('synced');
  expect(
    selectSessionSyncStatus(
      '77777777-7777-4777-8777-777777777777',
      undefined,
      report,
    ),
  ).toBeNull();
});
