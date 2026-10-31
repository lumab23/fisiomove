import { initialSession, sessionReducer, totalRepetitions } from '../src/flow';
const repeat = (count: number, state = initialSession) => {
  for (let i = 0; i < count; i++) {
    state = sessionReducer(state, { type: 'repeat' });
  }
  return state;
};
test('partial series cannot advance or finish', () => {
  const partial = repeat(3);
  expect(sessionReducer(partial, { type: 'nextSeries' })).toEqual(partial);
  expect(sessionReducer(partial, { type: 'finish' }).finished).toBe(false);
});
test('caps counters, completes both series and resets', () => {
  const first = repeat(12);
  expect(first.repetitions).toBe(8);
  expect(sessionReducer(first, { type: 'finish' }).finished).toBe(false);
  const second = sessionReducer(first, { type: 'nextSeries' });
  expect(second).toEqual({ repetitions: 0, series: 2, finished: false });
  const finished = sessionReducer(repeat(8, second), { type: 'finish' });
  expect(finished.finished).toBe(true);
  expect(totalRepetitions(finished)).toBe(16);
  expect(sessionReducer(finished, { type: 'repeat' })).toEqual(finished);
  expect(sessionReducer(finished, { type: 'nextSeries' })).toEqual(finished);
  expect(sessionReducer(finished, { type: 'reset' })).toEqual(initialSession);
});
