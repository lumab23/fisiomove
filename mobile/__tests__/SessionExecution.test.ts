import type { SessionDraft } from '../src/sync/types';
import { SessionExecution } from '../src/features/session/SessionExecution';
import { executionFeedback } from '../src/features/session/executionFeedback';

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

// DEC-013: item with the demonstration rule. Test values only.
const countedPlan = [
  {
    ...plan[0],
    sets: 1,
    repetitions: 3,
    counting_rule: 'demo-elbow-flexion:v1' as const,
  },
];

test('item sem regra só conta por toque e fica manual', () => {
  const execution = new SessionExecution(draft, plan, () => 1000);
  execution.start();
  expect(execution.snapshot().items[0].manual_counting).toBe(true);
  expect(execution.completeRepetition('camera').items[0]).toMatchObject({
    completed_repetitions: 0,
  });
  execution.completeRepetition();
  expect(execution.interrupt().items[0].counting_mode).toBe('manual');
});

test('com regra, só o motor conta até o toque em "Contar manualmente"', () => {
  const execution = new SessionExecution(draft, countedPlan, () => 1000);
  execution.start();
  // A touch never adds to the engine's count (no double counting).
  expect(execution.completeRepetition().items[0].completed_repetitions).toBe(0);
  expect(
    execution.completeRepetition('camera').items[0].completed_repetitions,
  ).toBe(1);
  const switched = execution.switchToManualCounting().items[0];
  expect(switched).toMatchObject({
    manual_counting: true,
    counting_mode: 'mixed',
  });
  // From now on the engine is off and touches count.
  expect(
    execution.completeRepetition('camera').items[0].completed_repetitions,
  ).toBe(1);
  execution.completeRepetition();
  execution.completeRepetition();
  // RN19: the prescription is the ceiling.
  expect(execution.completeRepetition().status).toBe('completed');
  expect(execution.completion().items[0]).toMatchObject({
    completed_repetitions: 3,
    counting_mode: 'mixed',
  });
});

test('só o motor contou: automatic; trocar antes de contar: manual', () => {
  const automatic = new SessionExecution(draft, countedPlan, () => 1000);
  automatic.start();
  for (let i = 0; i < 4; i += 1) {
    automatic.completeRepetition('camera');
  }
  expect(automatic.completion().items[0]).toMatchObject({
    completed_repetitions: 3,
    counting_mode: 'automatic',
  });

  const manual = new SessionExecution(draft, countedPlan, () => 1000);
  manual.start();
  manual.switchToManualCounting();
  manual.completeRepetition();
  expect(manual.interrupt().items[0].counting_mode).toBe('manual');
});

test('pausa congela o motor e impede trocar a origem (RN20)', () => {
  const execution = new SessionExecution(draft, countedPlan, () => 1000);
  execution.start();
  execution.pause();
  expect(
    execution.completeRepetition('camera').items[0].completed_repetitions,
  ).toBe(0);
  expect(execution.switchToManualCounting().items[0].manual_counting).toBe(
    false,
  );
});

// Plan of 2026-11-15 (Q-P2): system feedback derived from two snapshots.
describe('executionFeedback', () => {
  const names = (index: number) => ['Primeiro teste', 'Segundo teste'][index];
  const twoItems = [
    { ...plan[0], sets: 2, repetitions: 2, rest_duration_ms: 0 },
    {
      ...plan[0],
      workout_item_id: '66666666-6666-4666-8666-666666666666',
      position: 2,
      sets: 1,
      repetitions: 1,
      rest_duration_ms: 0,
    },
  ];

  test('repetição, série concluída e próximo exercício', () => {
    let now = 0;
    const execution = new SessionExecution(draft, twoItems, () => now);
    let previous = execution.start();
    const step = (next: ReturnType<SessionExecution['snapshot']>) => {
      const feedback = executionFeedback(previous, next, names);
      previous = next;
      return feedback;
    };
    now = 100;
    expect(step(execution.completeRepetition())).toEqual({
      announcement: 'Repetição 1 de 2.',
      notices: [],
      repetition: true,
    });
    now = 200;
    expect(step(execution.completeRepetition())).toEqual({
      announcement: 'Repetição 2 de 2. Série 1 de 2 concluída.',
      notices: ['Série 1 de 2 concluída'],
      repetition: true,
    });
    now = 300;
    step(execution.completeRepetition());
    now = 400;
    // No rest: the set closes and the next item starts at once.
    expect(step(execution.completeRepetition())).toEqual({
      announcement:
        'Repetição 2 de 2. Série 2 de 2 concluída. Próximo exercício: Segundo teste.',
      notices: ['Série 2 de 2 concluída', 'Próximo exercício: Segundo teste'],
      repetition: true,
    });
    now = 500;
    // Last set of the plan: no "next exercise".
    expect(step(execution.completeRepetition())).toEqual({
      announcement: 'Repetição 1 de 1. Série 1 de 1 concluída.',
      notices: ['Série 1 de 1 concluída'],
      repetition: true,
    });
  });

  test('tempo, pausa e retomada não geram aviso (RN20)', () => {
    let now = 0;
    const execution = new SessionExecution(draft, twoItems, () => now);
    const started = execution.start();
    now = 1000;
    const ticked = execution.tick();
    expect(executionFeedback(started, ticked, names)).toBeNull();
    const paused = execution.pause();
    expect(executionFeedback(ticked, paused, names)).toBeNull();
    // A touch while paused does not count, so nothing is told.
    const touched = execution.completeRepetition();
    expect(executionFeedback(paused, touched, names)).toBeNull();
    now = 2000;
    expect(executionFeedback(touched, execution.resume(), names)).toBeNull();
    expect(executionFeedback(null, execution.snapshot(), names)).toBeNull();
  });

  test('nunca anuncia além do prescrito (RN19)', () => {
    let now = 0;
    const execution = new SessionExecution(
      draft,
      [{ ...plan[0], sets: 1, repetitions: 1 }],
      () => now,
    );
    execution.start();
    now = 100;
    const completed = execution.completeRepetition();
    expect(completed.status).toBe('completed');
    now = 200;
    expect(
      executionFeedback(completed, execution.completeRepetition(), names),
    ).toBeNull();
  });
});
