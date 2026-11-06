import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

export type ScreenMessageTone = 'info' | 'error';
export type ScreenMessage = { text: string; tone: ScreenMessageTone };

type ScreenMessageContextValue = {
  message: ScreenMessage | null;
  show(text: string, tone?: ScreenMessageTone): void;
  clear(): void;
};

const ScreenMessageContext = createContext<ScreenMessageContextValue | null>(
  null,
);

/** Short confirmation shown by `Screen` (toast). Independent of the demo. */
export function ScreenMessageProvider({ children }: PropsWithChildren) {
  const [message, setMessage] = useState<ScreenMessage | null>(null);
  const show = useCallback(
    (text: string, tone: ScreenMessageTone = 'info') =>
      setMessage(text ? { text, tone } : null),
    [],
  );
  const clear = useCallback(() => setMessage(null), []);
  const value = useMemo(
    () => ({ message, show, clear }),
    [message, show, clear],
  );
  return (
    <ScreenMessageContext.Provider value={value}>
      {children}
    </ScreenMessageContext.Provider>
  );
}

export function useScreenMessage() {
  const context = useContext(ScreenMessageContext);
  if (!context) {
    throw new Error('ScreenMessageProvider is required.');
  }
  return context;
}
