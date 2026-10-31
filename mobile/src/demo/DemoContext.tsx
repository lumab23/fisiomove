import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type PropsWithChildren,
} from 'react';
import {
  demoReducer,
  seedState,
  type DemoAction,
  type DemoState,
} from './model';
const DemoContext = createContext<{
  state: DemoState;
  dispatch: Dispatch<DemoAction>;
} | null>(null);
export function DemoProvider({
  children,
  initialState = seedState,
}: PropsWithChildren<{ initialState?: DemoState }>) {
  const [state, dispatch] = useReducer(demoReducer, initialState);
  return (
    <DemoContext.Provider value={{ state, dispatch }}>
      {children}
    </DemoContext.Provider>
  );
}
export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('DemoProvider is required.');
  }
  return context;
}
export function useDemoPatient() {
  const { state } = useDemo();
  return (
    state.patients.find(p => p.id === state.selectedId) ?? state.patients[0]
  );
}
