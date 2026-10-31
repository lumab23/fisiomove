/** Navigation and counters for the local prototype. Never sent to the API. */
export type Screen =
  | 'home'
  | 'workout'
  | 'preparation'
  | 'camera'
  | 'denied'
  | 'voice'
  | 'calibration'
  | 'exercise'
  | 'adjust'
  | 'pause'
  | 'rest'
  | 'exit'
  | 'interrupted'
  | 'complete'
  | 'progress'
  | 'about';
export type Session = { repetitions: number; series: 1 | 2; finished: boolean };
export const initialSession: Session = {
  repetitions: 0,
  series: 1,
  finished: false,
};
export type SessionAction = {
  type: 'repeat' | 'nextSeries' | 'finish' | 'reset';
};
export function sessionReducer(state: Session, action: SessionAction): Session {
  switch (action.type) {
    case 'reset':
      return { ...initialSession };
    case 'repeat':
      return state.finished
        ? state
        : { ...state, repetitions: Math.min(8, state.repetitions + 1) };
    case 'nextSeries':
      return state.series === 1 && state.repetitions === 8
        ? { repetitions: 0, series: 2, finished: false }
        : state;
    case 'finish':
      return state.series === 2 && state.repetitions === 8
        ? { ...state, finished: true }
        : state;
  }
}
export function totalRepetitions(session: Session) {
  return (session.series - 1) * 8 + session.repetitions;
}
