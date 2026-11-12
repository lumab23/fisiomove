import { ApiClient } from '../src/api/ApiClient';
import { AuthenticationSession } from '../src/auth/AuthenticationSession';
import type { AppConfig } from '../src/config/environment';
import type { SessionResultInput } from '../src/contracts/domain';
import { SessionService } from '../src/services/sessions';
import { SessionSyncService } from '../src/sync/SessionSyncService';
import { SessionSyncStore } from '../src/sync/SessionSyncStore';
import { memoryStorage, response } from '../test-utils/helpers';

const config: AppConfig = {
  apiOrigin: 'http://api.test',
  apiPrefix: '/api/v1',
  environment: 'test',
  requestTimeoutMs: 1_000,
};
const owner = '11111111-1111-4111-8111-111111111111';
const payload: SessionResultInput = {
  client_session_id: '22222222-2222-4222-8222-222222222222',
  workout_id: '33333333-3333-4333-8333-333333333333',
  workout_revision_id: '44444444-4444-4444-8444-444444444444',
  status: 'interrupted',
  started_at: '2026-10-30T12:00:00Z',
  finished_at: '2026-10-30T12:01:00Z',
  active_duration_ms: 1,
  low_confidence_summary: null,
  feedback_summary: null,
  items: [],
};

test('renova a autenticação antes de reenviar a mesma sessão pendente', async () => {
  const storage = memoryStorage();
  const rotated = {
    access_token: 'fresh-access',
    refresh_token: 'rotated-refresh-token-with-more-than-thirty-two-characters',
    token_type: 'bearer' as const,
    expires_in: 900,
  };
  const fetcher = jest
    .fn()
    .mockResolvedValueOnce(response(401, { code: 'access_token_expired' }))
    .mockResolvedValueOnce(response(200, rotated))
    .mockResolvedValueOnce(response(201, { id: 'session-result' }));
  const authentication = new AuthenticationSession(config, storage, fetcher);
  await authentication.save({
    access_token: 'expired-access',
    refresh_token: 'refresh-token-with-more-than-thirty-two-characters',
    token_type: 'bearer',
    expires_in: 1,
  });
  const sync = new SessionSyncService(
    new SessionService(new ApiClient(config, authentication, fetcher)),
    new SessionSyncStore(storage),
  );
  await sync.enqueue(owner, payload);

  await expect(sync.sync(owner)).resolves.toMatchObject({
    sent: 1,
    remaining: 0,
    sent_client_session_ids: [payload.client_session_id],
  });
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(fetcher.mock.calls[0][0]).toBe('http://api.test/api/v1/me/sessions');
  expect(fetcher.mock.calls[1][0]).toBe('http://api.test/api/v1/auth/refresh');
  expect(fetcher.mock.calls[2][1].headers.Authorization).toBe(
    'Bearer fresh-access',
  );
  expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual(payload);
});
