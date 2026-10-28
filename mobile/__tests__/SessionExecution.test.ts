import type { SessionDraft } from '../src/sync/types';
import { SessionExecution } from '../src/features/session/SessionExecution';

const draft: SessionDraft = {
  owner_user_id: '11111111-1111-4111-8111-111111111111',
  client_session_id: '22222222-2222-4222-8222-222222222222',
  workout_id: '33333333-3333-4333-8333-333333333333',
  workout_revision_id: '44444444-4444-4444-8444-444444444444',
  started_at: '2026-10-28T12:00:00.000Z',
};

const plan = [
  {
    workout_item_id: '55555555-5555-4555-8555-555555555555',
    position: 1,
    sets: 2,
    repetitions: 1,
    rest_duration_ms: 10_000,
  },
];

test('pausa e descanso não somam duração ativa; conclusão respeita a meta', () => {
  let now = 1000;
  const execution = new SessionExecution(draft, plan, () => now);
  execution.start();
  now = 2000;
  execution.tick();
  now = 2500;
  expect(execution.completeRepetition().status).toBe('resting');
  now = 5000;
  execution.pause();
  now = 20_000;
  expect(execution.resume().status).toBe('resting');
  now = 28_000;
  expect(execution.tick().status).toBe('active');
  now = 28_500;
  expect(execution.completeRepetition().status).toBe('completed');
  expect(execution.completion()).toMatchObject({
    status: 'completed',
    active_duration_ms: 2500,
    items: [
      {
        completed_sets: 2,
        completed_repetitions: 2,
        active_duration_ms: 2500,
      },
    ],
  });
});

test('interrupção mantém repetições parciais e marca o item interrompido', () => {
  let now = 0;
  const execution = new SessionExecution(
    draft,
    [{ ...plan[0], repetitions: 3 }],
    () => now,
  );
  execution.start();
  now = 1000;
  execution.completeRepetition();
  now = 1500;
  const partial = execution.interrupt();
  expect(partial).toMatchObject({
    status: 'interrupted',
    items: [
      {
        completed_sets: 0,
        completed_repetitions: 1,
        interrupted: true,
      },
    ],
  });
});

test('movimento recebido durante pausa não altera a máquina de sessão', () => {
  let now = 0;
  const execution = new SessionExecution(draft, plan, () => now);
  execution.start();
  execution.pause();
  now = 10_000;
  expect(execution.completeRepetition().items[0].completed_repetitions).toBe(0);
  expect(execution.snapshot().active_duration_ms).toBe(0);
});
