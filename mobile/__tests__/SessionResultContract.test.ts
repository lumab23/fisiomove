import type { SessionDraft } from '../src/sync/types';
import type { SessionService } from '../src/services/sessions';
import { SessionExecution } from '../src/features/session/SessionExecution';
import { SessionSyncService } from '../src/sync/SessionSyncService';
import { SessionSyncStore } from '../src/sync/SessionSyncStore';
import { memoryStorage } from '../test-utils/helpers';

const draft: SessionDraft = {
  owner_user_id: '11111111-1111-4111-8111-111111111111',
  client_session_id: '22222222-2222-4222-8222-222222222222',
  workout_id: '33333333-3333-4333-8333-333333333333',
  workout_revision_id: '44444444-4444-4444-8444-444444444444',
  started_at: '2026-10-30T12:00:00.000Z',
};
const item = {
  workout_item_id: '55555555-5555-4555-8555-555555555555',
  position: 1,
  sets: 1,
  repetitions: 1,
  rest_duration_ms: 0,
};

test('aceita a conclusão pública de M07 sem alterar identificadores de M02', async () => {
  const deterministic = new SessionSyncService(
    { create: jest.fn() } as unknown as SessionService,
    new SessionSyncStore(memoryStorage()),
    () => new Date(draft.started_at),
    () => draft.client_session_id,
  );
  await deterministic.prepare(
    draft.owner_user_id,
    draft.workout_id,
    draft.workout_revision_id,
  );
  let now = Date.parse(draft.started_at);
  const execution = new SessionExecution(draft, [item], () => now);
  execution.start();
  now += 1_000;
  execution.completeRepetition();

  const pending = await deterministic.finishDraft(
    draft.owner_user_id,
    draft.client_session_id,
    execution.completion(now),
  );
  expect(pending.payload).toEqual({
    client_session_id: draft.client_session_id,
    workout_id: draft.workout_id,
    workout_revision_id: draft.workout_revision_id,
    status: 'completed',
    started_at: draft.started_at,
    finished_at: '2026-10-30T12:00:01.000Z',
    active_duration_ms: 1000,
    low_confidence_summary: null,
    feedback_summary: null,
    items: [
      {
        workout_item_id: item.workout_item_id,
        position: 1,
        completed_sets: 1,
        completed_repetitions: 1,
        active_duration_ms: 1000,
        interrupted: false,
      },
    ],
  });
});

test('preserva status e resultado parcial de sessão interrompida', async () => {
  const deterministic = new SessionSyncService(
    { create: jest.fn() } as unknown as SessionService,
    new SessionSyncStore(memoryStorage()),
    () => new Date(draft.started_at),
    () => draft.client_session_id,
  );
  await deterministic.prepare(
    draft.owner_user_id,
    draft.workout_id,
    draft.workout_revision_id,
  );
  let now = Date.parse(draft.started_at);
  const execution = new SessionExecution(
    draft,
    [{ ...item, repetitions: 2 }],
    () => now,
  );
  execution.start();
  now += 500;
  execution.completeRepetition();
  const pending = await deterministic.finishDraft(
    draft.owner_user_id,
    draft.client_session_id,
    execution.interrupt(),
  );

  expect(pending.payload).toMatchObject({
    status: 'interrupted',
    client_session_id: draft.client_session_id,
    workout_revision_id: draft.workout_revision_id,
    items: [
      {
        completed_sets: 0,
        completed_repetitions: 1,
        interrupted: true,
      },
    ],
  });
});
