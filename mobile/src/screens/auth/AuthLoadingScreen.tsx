import { friendlyErrorMessage } from '../../api/errors';
import { useAuth } from '../../auth/AuthContext';
import { AuthLayout } from '../../components/AuthLayout';
import { ErrorState, LoadingState } from '../../components/ScreenStates';

export function AuthLoadingScreen() {
  const { status, bootstrapError, retryBootstrap } = useAuth();
  const failed = status === 'error';
  return (
    <AuthLayout>
      {failed ? (
        <ErrorState
          title="A conexão falhou"
          message={friendlyErrorMessage(bootstrapError)}
          onRetry={retryBootstrap}
        />
      ) : (
        <LoadingState label="Verificando seu acesso com segurança" />
      )}
    </AuthLayout>
  );
}
