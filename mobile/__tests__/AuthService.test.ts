import { ApiError } from '../src/api/errors';
import type { ApiClient } from '../src/api/ApiClient';
import { AuthService } from '../src/auth/AuthService';
import type { AuthenticationSession } from '../src/auth/AuthenticationSession';
import type {
  AuthenticatedUser,
  StoredSession,
  TokenPair,
} from '../src/contracts/auth';

const pair: TokenPair = {
  access_token: 'access',
  refresh_token: 'refresh-token-with-more-than-thirty-two-characters',
  token_type: 'bearer',
  expires_in: 900,
};

const user: AuthenticatedUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'maria@example.com',
  role: 'patient',
  is_active: true,
  must_change_password: false,
  created_at: '2026-10-25T00:00:00Z',
  updated_at: '2026-10-25T00:00:00Z',
};

function dependencies() {
  const api = {
    get: jest.fn().mockResolvedValue(user),
    post: jest.fn().mockResolvedValue(pair),
  } as unknown as ApiClient;
  const session = {
    save: jest.fn().mockResolvedValue(pair as StoredSession),
    clear: jest.fn().mockResolvedValue(undefined),
    load: jest.fn().mockResolvedValue(pair as StoredSession),
  } as unknown as AuthenticationSession;
  return { api, session, service: new AuthService(api, session) };
}

test('login válido persiste tokens e consulta a identidade real', async () => {
  const { api, session, service } = dependencies();

  await expect(
    service.login({
      email: 'maria@example.com',
      password: 'temporary-password',
    }),
  ).resolves.toEqual(user);
  expect(api.post).toHaveBeenCalledWith(
    '/auth/login',
    { email: 'maria@example.com', password: 'temporary-password' },
    { authenticated: false, retryAuthentication: false },
  );
  expect(session.save).toHaveBeenCalledWith(pair);
  expect(api.get).toHaveBeenCalledWith('/auth/me');
});

test('login inválido não persiste credenciais', async () => {
  const { api, session, service } = dependencies();
  (api.post as jest.Mock).mockRejectedValueOnce(
    new ApiError(
      'session_expired',
      'Invalid credentials',
      401,
      'invalid_credentials',
    ),
  );

  await expect(
    service.login({
      email: 'maria@example.com',
      password: 'incorrect-password',
    }),
  ).rejects.toMatchObject({ code: 'invalid_credentials' });
  expect(session.save).not.toHaveBeenCalled();
});

test('logout limpa a sessão mesmo se o servidor estiver indisponível', async () => {
  const { api, session, service } = dependencies();
  (api.post as jest.Mock).mockRejectedValueOnce(
    new ApiError('network', 'offline'),
  );

  await expect(service.logout()).rejects.toMatchObject({ kind: 'network' });
  expect(session.clear).toHaveBeenCalledTimes(1);
});

test('troca de senha invalida tokens antigos e autentica novamente', async () => {
  const { api, session, service } = dependencies();
  (api.post as jest.Mock)
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(pair);

  await expect(
    service.changePassword(
      { ...user, must_change_password: true },
      {
        current_password: 'temporary-password',
        new_password: 'new-secure-password',
      },
    ),
  ).resolves.toEqual(user);
  expect(session.clear).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenNthCalledWith(
    2,
    '/auth/login',
    { email: user.email, password: 'new-secure-password' },
    { authenticated: false, retryAuthentication: false },
  );
});
