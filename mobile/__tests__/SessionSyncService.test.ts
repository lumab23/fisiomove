import { ApiError } from '../src/api/errors';
import type { SessionResultInput } from '../src/contracts/domain';
import type { SessionService } from '../src/services/sessions';
import { SessionSyncService } from '../src/sync/SessionSyncService';
import { SessionSyncStore } from '../src/sync/SessionSyncStore';
import { memoryStorage } from '../test-utils/helpers';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER_OWNER = '22222222-2222-4222-8222-222222222222';
const CLIENT = '33333333-3333-4333-8333-333333333333';
const WORKOUT = '44444444-4444-4444-8444-444444444444';
const REVISION = '55555555-5555-4555-8555-555555555555';
const ITEM = '66666666-6666-4666-8666-666666666666';

const payload: SessionResultInput = {
  client_session_id: CLIENT,
  workout_id: WORKOUT,
  workout_revision_id: REVISION,
  status: 'interrupted',
  started_at: '2026-10-25T12:00:00Z',
  finished_at: '2026-10-25T12:05:00Z',
  active_duration_ms: 120_000,
  low_confidence_summary: null,
  feedback_summary: null,
  items: [
    {
      workout_item_id: ITEM,
      position: 1,
      completed_sets: 1,
      completed_repetitions: 4,
      active_duration_ms: 100_000,
      interrupted: true,
    },
  ],
};

function setup() {
  let instant = new Date('2026-10-25T12:06:00Z');
  const storage = memoryStorage();
  const api = { create: jest.fn().mockResolvedValue({ id: 'result' }) };
  const store = new SessionSyncStore(storage);
  const service = new SessionSyncService(
    api as unknown as SessionService,
    store,
    () => instant,
    () => CLIENT,
  );
  return {
    api,
    store,
    service,
    advance(ms: number) {
      instant = new Date(instant.getTime() + ms);
    },
  };
}

test('preserva identificadores antes da execução e monta o resultado sem substituí-los', async () => {
  const { service } = setup();
  const draft = await service.prepare(OWNER, WORKOUT, REVISION);
  expect(draft).toMatchObject({
    owner_user_id: OWNER,
    client_session_id: CLIENT,
    workout_id: WORKOUT,
    workout_revision_id: REVISION,
  });

  const pending = await service.finishDraft(OWNER, CLIENT, {
    status: 'interrupted',
    finished_at: '2026-10-25T12:07:00Z',
    active_duration_ms: 0,
    low_confidence_summary: null,
    feedback_summary: null,
    items: [],
  });
  expect(pending.payload.client_session_id).toBe(CLIENT);
  expect(pending.payload.started_at).toBe(draft.started_at);
});

test('recupera o rascunho somente no namespace do proprietário', async () => {
  const { service } = setup();
  const draft = await service.prepare(OWNER, WORKOUT, REVISION);

  await expect(service.getDraft(OWNER, CLIENT)).resolves.toEqual(draft);
  await expect(service.getDraft(OTHER_OWNER, CLIENT)).resolves.toBeNull();
});

test('mantém resultado offline e reenvia o mesmo conteúdo após reinicialização', async () => {
  const { api, store, service, advance } = setup();
  api.create.mockRejectedValueOnce(new ApiError('network', 'offline'));
  await service.enqueue(OWNER, payload);

  await expect(service.sync(OWNER)).resolves.toMatchObject({
    sent: 0,
    remaining: 1,
  });
  const afterFailure = await service.list(OWNER);
  expect(afterFailure[0]).toMatchObject({ attempts: 1, state: 'pending' });

  advance(5_000);
  const restarted = new SessionSyncService(
    api as unknown as SessionService,
    store,
    () => new Date('2026-10-25T12:06:05Z'),
  );
  await expect(restarted.sync(OWNER)).resolves.toMatchObject({
    sent: 1,
    remaining: 0,
  });
  expect(api.create).toHaveBeenNthCalledWith(1, payload, {
    signal: expect.any(AbortSignal),
  });
  expect(api.create).toHaveBeenNthCalledWith(2, payload, {
    signal: expect.any(AbortSignal),
  });
});

test('retry idêntico não duplica e conteúdo divergente gera conflito local', async () => {
  const { service } = setup();
  await service.enqueue(OWNER, payload);
  await service.enqueue(OWNER, { ...payload });
  expect(await service.list(OWNER)).toHaveLength(1);

  await expect(
    service.enqueue(OWNER, { ...payload, active_duration_ms: 120_001 }),
  ).rejects.toMatchObject({ code: 'local_idempotency_conflict' });
});

test('conflito 409 fica bloqueado e não é reenviado automaticamente', async () => {
  const { api, service } = setup();
  api.create.mockRejectedValue(
    new ApiError('conflict', 'different content', 409, 'idempotency_conflict'),
  );
  await service.enqueue(OWNER, payload);

  await service.sync(OWNER);
  await service.sync(OWNER);

  expect(api.create).toHaveBeenCalledTimes(1);
  expect((await service.list(OWNER))[0]).toMatchObject({
    state: 'blocked',
    last_error: { code: 'idempotency_conflict' },
  });
});

test('isola filas por usuário e nunca sincroniza com outra identidade', async () => {
  const { api, service } = setup();
  await service.enqueue(OWNER, payload);

  expect(await service.list(OTHER_OWNER)).toEqual([]);
  await service.sync(OTHER_OWNER);
  expect(api.create).not.toHaveBeenCalled();
  expect(await service.list(OWNER)).toHaveLength(1);
});

test('coordena gatilhos simultâneos em uma única sincronização', async () => {
  const { api, service } = setup();
  let release!: () => void;
  api.create.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        release = () => resolve({ id: 'result' });
      }),
  );
  await service.enqueue(OWNER, payload);

  const first = service.sync(OWNER);
  const second = service.sync(OWNER);
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  expect(api.create).toHaveBeenCalledTimes(1);
  release();

  await expect(Promise.all([first, second])).resolves.toEqual([
    expect.objectContaining({ sent: 1 }),
    expect.objectContaining({ sent: 1 }),
  ]);
  expect(api.create).toHaveBeenCalledTimes(1);
});

test('cancelamento por troca de identidade preserva a pendência sem consumir retry', async () => {
  const { api, service } = setup();
  api.create.mockImplementationOnce(
    (_payload, options: { signal?: AbortSignal } = {}) =>
      new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          reject(new Error('request aborted'));
        });
      }),
  );
  await service.enqueue(OWNER, payload);

  const syncing = service.sync(OWNER);
  await Promise.resolve();
  service.cancel(OWNER);

  await expect(syncing).resolves.toMatchObject({ sent: 0, remaining: 1 });
  expect((await service.list(OWNER))[0]).toMatchObject({
    state: 'pending',
    attempts: 0,
    last_error: null,
  });
});

test('remove campos extras e rejeita durações incompatíveis antes da fila', async () => {
  const { service } = setup();
  const unsafe = { ...payload, video: 'not-allowed' } as SessionResultInput;
  const sanitized = await service.enqueue(OWNER, unsafe);
  expect(sanitized.payload).not.toHaveProperty('video');

  await expect(
    service.enqueue(OWNER, {
      ...payload,
      client_session_id: '77777777-7777-4777-8777-777777777777',
      active_duration_ms: 10,
    }),
  ).rejects.toMatchObject({
    kind: 'validation',
    code: 'item_duration_exceeds_session',
  });
});

test.each([
  new ApiError('access_denied', 'forbidden', 403, 'account_inactive'),
  new ApiError('not_found', 'missing', 404, 'revision_not_found'),
  new ApiError('validation', 'invalid', 422, 'validation_error'),
])('bloqueia erro permanente sem novo envio automático', async error => {
  const { api, service } = setup();
  api.create.mockRejectedValue(error);
  await service.enqueue(OWNER, payload);

  await service.sync(OWNER);
  await service.sync(OWNER);

  expect(api.create).toHaveBeenCalledTimes(1);
  expect((await service.list(OWNER))[0]).toMatchObject({ state: 'blocked' });
});

test('mantém erro 5xx como retryable com backoff', async () => {
  const { api, service } = setup();
  api.create.mockRejectedValue(new ApiError('server', 'unavailable', 503));
  await service.enqueue(OWNER, payload);

  await service.sync(OWNER);

  expect((await service.list(OWNER))[0]).toMatchObject({
    state: 'pending',
    attempts: 1,
  });
});
