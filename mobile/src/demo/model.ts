/** Fictional UI data only. No API contracts or clinical calculations. */
export type Repetitions = 8 | 10;
export type DemoPatient = {
  id: string;
  name: string;
  identification: string;
  contact: string;
  repetitions: Repetitions;
  published: boolean;
  note: string;
};
export type DemoSession = {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  repetitions: Repetitions;
  total: number;
  completed: boolean;
};
export type ActiveSession = {
  id: string;
  series: 1 | 2;
  count: number;
  goal: Repetitions;
  patientId: string;
};
export type DemoState = {
  patients: DemoPatient[];
  selectedId: string;
  sessions: DemoSession[];
  active: ActiveSession;
  voice: boolean;
  message: string;
};
export const seedState: DemoState = {
  patients: [
    {
      id: 'maria',
      name: 'Maria Oliveira',
      identification: 'Paciente 001',
      contact: '(85) 90000-0000',
      repetitions: 8,
      published: true,
      note: '',
    },
  ],
  selectedId: 'maria',
  sessions: [],
  active: { id: 'demo-1', series: 1, count: 0, goal: 8, patientId: 'maria' },
  voice: false,
  message: '',
};
export type DemoAction =
  | { type: 'select'; id: string }
  | { type: 'create'; patient: DemoPatient }
  | {
      type: 'workout';
      id: string;
      repetitions: Repetitions;
      published: boolean;
    }
  | { type: 'note'; id: string; note: string }
  | { type: 'voice'; enabled: boolean }
  | { type: 'start' | 'repeat' | 'completeSeries' | 'next' }
  | { type: 'finish'; completed: boolean; id: string; date: string }
  | { type: 'message'; value: string };
export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'select':
      return state.patients.some(p => p.id === action.id)
        ? { ...state, selectedId: action.id }
        : state;
    case 'create':
      return {
        ...state,
        patients: [...state.patients, action.patient],
        selectedId: action.patient.id,
        message: 'Paciente cadastrado nesta demonstração.',
      };
    case 'workout':
      return {
        ...state,
        patients: state.patients.map(p =>
          p.id === action.id
            ? {
                ...p,
                repetitions: action.repetitions,
                published: action.published,
              }
            : p,
        ),
        message: action.published
          ? 'Treino publicado na demonstração.'
          : 'Rascunho salvo. Publique para disponibilizar ao paciente.',
      };
    case 'note':
      return {
        ...state,
        patients: state.patients.map(p =>
          p.id === action.id ? { ...p, note: action.note } : p,
        ),
        message: 'Observação salva na demonstração.',
      };
    case 'voice':
      return { ...state, voice: action.enabled };
    case 'message':
      return { ...state, message: action.value };
    case 'start': {
      const patient = state.patients.find(p => p.id === state.selectedId);
      return patient?.published
        ? {
            ...state,
            active: {
              id: `demo-${state.sessions.length + 1}`,
              patientId: patient.id,
              series: 1,
              count: 0,
              goal: patient.repetitions,
            },
          }
        : state;
    }
    case 'repeat':
      return {
        ...state,
        active: {
          ...state.active,
          count: Math.min(state.active.goal, state.active.count + 1),
        },
      };
    case 'completeSeries':
      return {
        ...state,
        active: { ...state.active, count: state.active.goal },
      };
    case 'next':
      return state.active.series === 1 &&
        state.active.count === state.active.goal
        ? { ...state, active: { ...state.active, series: 2, count: 0 } }
        : state;
    case 'finish': {
      if (state.sessions.some(s => s.id === action.id)) {
        return state;
      }
      const { active } = state;
      if (
        action.completed &&
        (active.series !== 2 || active.count !== active.goal)
      ) {
        return state;
      }
      const patient = state.patients.find(p => p.id === active.patientId);
      const session: DemoSession = {
        id: action.id,
        patientId: active.patientId,
        patientName: patient?.name ?? 'Paciente',
        date: action.date,
        repetitions: active.goal,
        total: (active.series - 1) * active.goal + active.count,
        completed: action.completed,
      };
      return { ...state, sessions: [session, ...state.sessions] };
    }
  }
}
export function validatePatient(
  name: string,
  identification: string,
  contact: string,
  patients: DemoPatient[],
) {
  const errors: { name?: string; identification?: string; contact?: string } =
    {};
  if (name.trim().length < 3) {
    errors.name = 'Informe o nome com pelo menos 3 caracteres.';
  }
  if (!identification.trim()) {
    errors.identification = 'Informe uma identificação.';
  } else if (
    patients.some(
      p =>
        p.identification.toLocaleLowerCase() ===
        identification.trim().toLocaleLowerCase(),
    )
  ) {
    errors.identification = 'Esta identificação já está cadastrada.';
  }
  if (contact.replace(/\D/g, '').length < 10) {
    errors.contact = 'Informe um telefone com DDD.';
  }
  return errors;
}
