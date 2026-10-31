import {
  demoReducer,
  seedState,
  validatePatient,
  type DemoState,
} from '../src/demo/model';
const finish = (state: DemoState, id: string) =>
  demoReducer(
    demoReducer(
      demoReducer(demoReducer(state, { type: 'completeSeries' }), {
        type: 'next',
      }),
      { type: 'completeSeries' },
    ),
    { type: 'finish', id, date: '2026-10-30T12:00:00Z', completed: true },
  );
test('retains the session prescription after a professional changes the current workout', () => {
  const completed = finish(demoReducer(seedState, { type: 'start' }), 's1');
  const updated = demoReducer(completed, {
    type: 'workout',
    id: 'maria',
    repetitions: 10,
    published: true,
  });
  expect(updated.patients[0].repetitions).toBe(10);
  expect(updated.sessions[0]).toMatchObject({
    repetitions: 8,
    total: 16,
    completed: true,
  });
  const nextSession = demoReducer(updated, { type: 'start' });
  expect(nextSession.active.goal).toBe(10);
});
test('caps manual counts and does not finish a partial session or duplicate results', () => {
  let state = seedState;
  for (let i = 0; i < 20; i++) {
    state = demoReducer(state, { type: 'repeat' });
  }
  expect(state.active.count).toBe(8);
  expect(
    demoReducer(state, { type: 'finish', id: 's1', date: '', completed: true })
      .sessions,
  ).toHaveLength(0);
  const interrupted = demoReducer(state, {
    type: 'finish',
    id: 's1',
    date: '',
    completed: false,
  });
  expect(interrupted.sessions[0]).toMatchObject({ total: 8, completed: false });
  expect(
    demoReducer(interrupted, {
      type: 'finish',
      id: 's1',
      date: '',
      completed: false,
    }).sessions,
  ).toHaveLength(1);
});
test('patient-specific observations stay isolated and drafts cannot start', () => {
  const created = demoReducer(seedState, {
    type: 'create',
    patient: {
      ...seedState.patients[0],
      id: 'ana',
      name: 'Ana Santos',
      identification: 'Paciente 002',
      note: '',
      published: false,
    },
  });
  const updated = demoReducer(created, {
    type: 'note',
    id: 'ana',
    note: 'Texto fictício.',
  });
  expect(updated.patients[0].note).toBe('');
  expect(updated.patients[1].note).toBe('Texto fictício.');
  expect(demoReducer(updated, { type: 'start' }).active.patientId).toBe(
    'maria',
  );
});
test('requires valid registration fields and rejects duplicate identification', () => {
  expect(validatePatient('', '', '', seedState.patients)).toHaveProperty(
    'name',
  );
  expect(
    validatePatient(
      'Ana Santos',
      'Paciente 001',
      '(85) 90000-0000',
      seedState.patients,
    ),
  ).toHaveProperty('identification');
  expect(
    validatePatient(
      'Ana Santos',
      'Paciente 002',
      '(85) 90000-0000',
      seedState.patients,
    ),
  ).toEqual({});
});
