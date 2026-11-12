import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';

/** One native dialog per action, with no custom view or modal styling. */
export function useNativeConfirmation() {
  const pending = useRef(false);
  return useCallback(
    ({
      title,
      message,
      onConfirm,
      onCancel,
      destructive = false,
      confirmLabel = 'Confirmar',
    }: {
      title: string;
      message: string;
      onConfirm: () => void | Promise<void>;
      onCancel?: () => void;
      destructive?: boolean;
      confirmLabel?: string;
    }) => {
      if (pending.current) return;
      pending.current = true;
      let answered = false;
      const cancel = () => {
        if (answered) return;
        answered = true;
        pending.current = false;
        onCancel?.();
      };
      Alert.alert(
        title,
        message,
        [
          { text: 'Cancelar', style: 'cancel', onPress: cancel },
          {
            text: confirmLabel,
            style: destructive ? 'destructive' : 'default',
            onPress: async () => {
              if (answered) return;
              answered = true;
              try {
                await onConfirm();
              } finally {
                pending.current = false;
              }
            },
          },
        ],
        { cancelable: true, onDismiss: cancel },
      );
    },
    [],
  );
}
