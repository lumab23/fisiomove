import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Toast } from './Toast';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

export type ScreenMessageTone = 'success' | 'error' | 'warning' | 'info';
export type ScreenMessage = {
  text: string;
  tone: ScreenMessageTone;
  id: number;
};

type ScreenMessageContextValue = {
  message: ScreenMessage | null;
  show(text: string, tone?: ScreenMessageTone): void;
  clear(): void;
};

const ScreenMessageContext = createContext<ScreenMessageContextValue | null>(
  null,
);

/** Global feedback survives navigation and authentication changes. */
export function ScreenMessageProvider({ children }: PropsWithChildren) {
  const sequence = useRef(0);
  const [message, setMessage] = useState<ScreenMessage | null>(null);
  const show = useCallback(
    (text: string, tone: ScreenMessageTone = 'info') =>
      setMessage(text ? { text, tone, id: ++sequence.current } : null),
    [],
  );
  const clear = useCallback(() => setMessage(null), []);
  const value = useMemo(
    () => ({ message, show, clear }),
    [message, show, clear],
  );
  return (
    <ScreenMessageContext.Provider value={value}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.fill}>{children}</View>
        <View pointerEvents="box-none" style={styles.overlay}>
          {message ? (
            <Toast key={message.id} message={message} onDismiss={clear} />
          ) : null}
        </View>
      </KeyboardAvoidingView>
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

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    elevation: 99,
  },
});
