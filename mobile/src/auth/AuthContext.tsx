import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { ApiError } from '../api/errors';
import { appDependencies, type AppDependencies } from '../app/dependencies';
import type { AuthenticatedUser, LoginRequest } from '../contracts/auth';

export type AuthStatus =
  'booting' | 'unauthenticated' | 'authenticated' | 'error';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  busy: boolean;
  bootstrapError: unknown;
  login(payload: LoginRequest): Promise<void>;
  logout(): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  retryBootstrap(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps extends PropsWithChildren {
  dependencies?: AppDependencies;
}

export function AuthProvider({
  children,
  dependencies = appDependencies,
}: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>('booting');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<unknown>(null);
  const ignoreSessionClear = useRef(false);

  const bootstrap = useCallback(async () => {
    setStatus('booting');
    setBootstrapError(null);
    try {
      const stored = await dependencies.authenticationSession.load();
      if (!stored) {
        setUser(null);
        setStatus('unauthenticated');
        return;
      }
      const restoredUser = await dependencies.auth.me();
      setUser(restoredUser);
      setStatus('authenticated');
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.kind === 'session_expired' || error.code === 'account_inactive')
      ) {
        await dependencies.authenticationSession.clear();
        setUser(null);
        setStatus('unauthenticated');
        return;
      }
      setBootstrapError(error);
      setStatus('error');
    }
  }, [dependencies]);

  useEffect(() => {
    bootstrap();
    return dependencies.authenticationSession.subscribe(session => {
      if (!session && !ignoreSessionClear.current) {
        setUser(null);
        setStatus('unauthenticated');
      }
    });
  }, [bootstrap, dependencies]);

  const login = useCallback(
    async (payload: LoginRequest) => {
      setBusy(true);
      try {
        const authenticated = await dependencies.auth.login(payload);
        setUser(authenticated);
        setStatus('authenticated');
      } finally {
        setBusy(false);
      }
    },
    [dependencies],
  );

  const logout = useCallback(async () => {
    setBusy(true);
    try {
      await dependencies.auth.logout();
    } finally {
      setUser(null);
      setStatus('unauthenticated');
      setBusy(false);
    }
  }, [dependencies]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!user) {
        throw new ApiError('session_expired', 'Não há usuário autenticado.');
      }
      setBusy(true);
      ignoreSessionClear.current = true;
      try {
        const authenticated = await dependencies.auth.changePassword(user, {
          current_password: currentPassword,
          new_password: newPassword,
        });
        setUser(authenticated);
        setStatus('authenticated');
      } catch (error) {
        if (!dependencies.authenticationSession.hasSession) {
          setUser(null);
          setStatus('unauthenticated');
        }
        throw error;
      } finally {
        ignoreSessionClear.current = false;
        setBusy(false);
      }
    },
    [dependencies, user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      busy,
      bootstrapError,
      login,
      logout,
      changePassword,
      retryBootstrap: bootstrap,
    }),
    [
      status,
      user,
      busy,
      bootstrapError,
      login,
      logout,
      changePassword,
      bootstrap,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth precisa estar dentro de AuthProvider.');
  }
  return value;
}
