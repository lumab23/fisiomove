import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import type { Workout } from '../src/contracts/domain';
import {
  ActiveSessionProvider,
  countedRepetitions,
  sessionPlanFrom,
  useActiveSession,
} from '../src/features/session/ActiveSession';
import { useSessionResult } from '../src/features/session/useSessionResult';
import type { SessionDraft } from '../src/sync/types';

const mockFinishDraft = jest.fn();
jest.mock('../src/sync/SessionSyncContext', () => ({
  useSessionSync: () => ({ finishDraft: mockFinishDraft }),
}));

// Test values only; they differ from any default on purpose.
const workout: Workout = {
  id: 'workout-1',
  patient_id: 'patient-1',
  created_by: 'professional-1',
  status: 'published',
  current_revision_id: 'revision-1',
  revision_number: 3,
  instructions: null,
  published_at: '2026-11-06T12:00:00Z',
  created_at: '2026-11-06T12:00:00Z',
  updated_at: '2026-11-06T12:00:00Z',
  items: [
    {
      id: 'item-2',
      position: 2,
      exercise_id: 'exercise-2',
      side: 'bilateral',
      sets: 1,
      repetitions: 1,
      rest_duration_ms: 0,
      rule_version: 'library-reference-no-camera-rule:v1',
      professional_guidance: null,
      parameters: {},
      exercise_snapshot: { name: 'Second' },
    },
    {
      id: 'item-1',
      position: 1,
      exercise_id: 'exercise-1',
      side: 'left',
      sets: 2,
      repetitions: 3,
      rest_duration_ms: 7000,
      rule_version: 'library-reference-no-camera-rule:v1',
      professional_guidance: null,
      parameters: {},
      exercise_snapshot: { name: 'First' },
    },
  ],
};
const draft: SessionDraft = {
  owner_user_id: 'patient-user',
  client_session_id: 'client-1',
  workout_id: 'workout-1',
  workout_revision_id: 'revision-1',
  started_at: '2026-11-06T12:00:00.000Z',
};

let now = 0;
let control: ReturnType<typeof useActiveSession>;
let result: ReturnType<typeof useSessionResult> | null;
let app: ReactTestRenderer.ReactTestRenderer | null = null;

function Probe({ clientSessionId }: { clientSessionId?: string }) {
  control = useActiveSession(clientSessionId);
  return control.session ? (
    <Finisher execution={control.session.execution} />
  ) : null;
}

function Finisher({
  execution,
}: {
  execution: NonNullable<typeof control.session>['execution'];
}) {
  result = useSessionResult(execution, { client_session_id: 'client-1' });
  return null;
}

async function render(clientSessionId?: string) {
  await act(async () => {
    app = ReactTestRenderer.create(
      <ActiveSessionProvider now={() => now}>
        <Probe clientSessionId={clientSessionId} />
      </ActiveSessionProvider>,
    );
  });
}

beforeEach(() => {
  now = 1_000;
  result = null;
  mockFinishDraft.mockResolvedValue({ state: 'pending' });
});

afterEach(async () => {
  jest.clearAllMocks();
  await act(async () => app?.unmount());
  app = null;
});

test('monta o plano com séries, repetições e descanso do WorkoutItem, na ordem', () => {
  expect(sessionPlanFrom(workout)).toEqual([
    {
      workout_item_id: 'item-1',
      position: 1,
      sets: 2,
      repetitions: 3,
      rest_duration_ms: 7000,
      counting_rule: null,
    },
    {
      workout_item_id: 'item-2',
      position: 2,
      sets: 1,
      repetitions: 1,
      rest_duration_ms: 0,
      counting_rule: null,
    },
  ]);
});

test('recusa treino de outra revisão ou não publicado', async () => {
  await render();
  expect(() =>
    control.begin({ ...workout, current_revision_id: 'revision-2' }, draft),
  ).toThrow('não corresponde');
  expect(() => control.begin({ ...workout, status: 'draft' }, draft)).toThrow(
    'não corresponde',
  );
  expect(control.session).toBeNull();
});

test('o toque conta repetições, descanso é automático e pausa congela (RN20)', async () => {
  await render('client-1');
  expect(control.session).toBeNull();
  await act(async () => {
    control.begin(workout, draft);
  });
  await act(async () => control.start());
  expect(control.session?.snapshot.status).toBe('active');

  for (const step of [1, 2, 3]) {
    now += 1_000;
    await act(async () => control.countRepetition());
    expect(control.session?.snapshot.items[0].completed_repetitions).toBe(step);
  }
  expect(control.session?.snapshot.status).toBe('resting');
  expect(control.session?.snapshot.rest_remaining_ms).toBe(7000);

  // Touch during rest is ignored; pause keeps the remaining rest.
  await act(async () => control.countRepetition());
  now += 2_000;
  await act(async () => control.pause());
  now += 60_000;
  await act(async () => control.countRepetition());
  await act(async () => control.tick());
  expect(control.session?.snapshot).toMatchObject({
    status: 'paused',
    rest_remaining_ms: 5000,
  });
  expect(countedRepetitions(control.session!.snapshot)).toBe(3);

  await act(async () => control.resume());
  now += 5_000;
  await act(async () => control.tick());
  expect(control.session?.snapshot).toMatchObject({
    status: 'active',
    items: [{ completed_sets: 1 }, { completed_sets: 0 }],
  });
  expect(control.session?.snapshot.active_duration_ms).toBe(3_000);
});

test('não conta além do prescrito e envia o resultado sem pontuação (RN19)', async () => {
  await render();
  await act(async () => {
    control.begin(workout, draft);
  });
  await act(async () => control.start());
  for (let i = 0; i < 6; i += 1) {
    await act(async () => control.countRepetition());
    now += 7_000;
    await act(async () => control.tick());
  }
  await act(async () => control.countRepetition());
  expect(control.session?.snapshot.status).toBe('completed');
  await act(async () => control.countRepetition());
  expect(control.session?.snapshot.items).toMatchObject([
    { completed_sets: 2, completed_repetitions: 6 },
    { completed_sets: 1, completed_repetitions: 1 },
  ]);

  await act(async () => {
    await result!.complete();
  });
  expect(mockFinishDraft).toHaveBeenCalledTimes(1);
  const [clientSessionId, completion] = mockFinishDraft.mock.calls[0];
  expect(clientSessionId).toBe('client-1');
  expect(completion).toMatchObject({
    status: 'completed',
    items: [
      { workout_item_id: 'item-1', completed_repetitions: 6 },
      { workout_item_id: 'item-2', completed_repetitions: 1 },
    ],
  });
  expect(JSON.stringify(completion)).not.toMatch(/score|landmark|image/);

  await act(async () => control.clear());
  expect(control.session).toBeNull();
});
