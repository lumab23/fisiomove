import { useScreenMessage } from './ScreenMessage';
import { useNativeConfirmation } from './useNativeConfirmation';

/** Every sign-out entry point shares the same native confirmation. */
export function useSignOutConfirmation(onSignOut?: () => void | Promise<void>) {
  const confirm = useNativeConfirmation();
  const { show, clear } = useScreenMessage();
  const requestSignOut = () => {
    if (!onSignOut) return;
    confirm({
      title: 'Sair da conta?',
      message: 'Tem certeza de que deseja sair?',
      destructive: true,
      onConfirm: async () => {
        clear();
        try {
          await onSignOut();
          show('Você saiu da conta.', 'success');
        } catch {
          show(
            'Não foi possível confirmar a saída no servidor. Confira sua conexão.',
            'error',
          );
        }
      },
    });
  };
  return { requestSignOut };
}
