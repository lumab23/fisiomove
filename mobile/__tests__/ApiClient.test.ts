import { ApiClient } from '../src/api/ApiClient';
import { AuthenticationSession } from '../src/auth/AuthenticationSession';
import type { AppConfig } from '../src/config/environment';
import { memoryStorage, response } from '../test-utils/helpers';

const config: AppConfig = {
  apiOrigin: 'http://api.test',
  apiPrefix: '/api/v1',
  environment: 'test',
  requestTimeoutMs: 1_000,
};

test('renova o token após 401 e repete a chamada uma vez', async () => {
  const pair = {
    access_token: 'expired',
    refresh_token: 'refresh-token-with-more-than-thirty-two-characters',
    token_type: 'bearer' as const,
    expires_in: 1,
  };
  const rotated = {
    ...pair,
    access_token: 'fresh',
    refresh_token: 'rotated-refresh-token-with-thirty-two-chars',
  };
  const fetcher = jest
    .fn()
    .mockResolvedValueOnce(response(401, { code: 'access_token_expired' }))
    .mockResolvedValueOnce(response(200, rotated))
    .mockResolvedValueOnce(response(200, { id: 'user-id' }));
  const session = new AuthenticationSession(config, memoryStorage(), fetcher);
  await session.save(pair);

  const result = await new ApiClient(config, session, fetcher).get<{
    id: string;
  }>('/auth/me');

  expect(result.id).toBe('user-id');
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(fetcher.mock.calls[2][1].headers.Authorization).toBe('Bearer fresh');
});

test('classifica falha de rede sem expor detalhes técnicos', async () => {
  const fetcher = jest
    .fn()
    .mockRejectedValue(new Error('socket secret detail'));
  const session = new AuthenticationSession(config, memoryStorage(), fetcher);

  await expect(
    new ApiClient(config, session, fetcher).get('/health', {
      authenticated: false,
    }),
  ).rejects.toMatchObject({
    kind: 'network',
    message: 'Não foi possível acessar o servidor.',
  });
});
