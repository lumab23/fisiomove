import { AuthenticationSession } from '../src/auth/AuthenticationSession';
import type { AppConfig } from '../src/config/environment';
import { memoryStorage, response } from '../test-utils/helpers';

const config: AppConfig = {
  apiOrigin: 'http://api.test',
  apiPrefix: '/api/v1',
  environment: 'test',
  requestTimeoutMs: 1_000,
};

const tokenPair = {
  access_token: 'access-token',
  refresh_token: 'refresh-token-with-more-than-thirty-two-characters',
  token_type: 'bearer' as const,
  expires_in: 900,
};

test('persiste e restaura a sessão sem armazenar senha', async () => {
  const storage = memoryStorage();
  const first = new AuthenticationSession(config, storage);
  await first.save(tokenPair);

  const restored = await new AuthenticationSession(config, storage).load();
  expect(restored?.access_token).toBe(tokenPair.access_token);
  expect(JSON.stringify(restored)).not.toContain('password');
});

test('faz apenas um refresh para chamadas simultâneas e salva a rotação', async () => {
  const storage = memoryStorage();
  const rotated = {
    ...tokenPair,
    access_token: 'rotated-access',
    refresh_token: 'rotated-refresh-token-with-thirty-two-chars',
  };
  const fetcher = jest.fn().mockResolvedValue(response(200, rotated));
  const session = new AuthenticationSession(config, storage, fetcher);
  await session.save(tokenPair);

  const [left, right] = await Promise.all([
    session.refresh(),
    session.refresh(),
  ]);

  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(left.access_token).toBe('rotated-access');
  expect(right.refresh_token).toBe(rotated.refresh_token);
  expect((await session.load())?.access_token).toBe('rotated-access');
});

test('remove a sessão quando o refresh foi revogado', async () => {
  const storage = memoryStorage();
  const fetcher = jest
    .fn()
    .mockResolvedValue(
      response(401, { code: 'refresh_token_revoked', message: 'revoked' }),
    );
  const session = new AuthenticationSession(config, storage, fetcher);
  await session.save(tokenPair);

  await expect(session.refresh()).rejects.toMatchObject({
    kind: 'session_expired',
  });
  expect(session.hasSession).toBe(false);
  expect(await session.load()).toBeNull();
});
