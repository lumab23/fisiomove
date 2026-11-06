import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { appDependencies } from '../src/app/dependencies';
import {
  SessionSyncProvider,
  useSessionSync,
} from '../src/sync/SessionSyncContext';
import type { SessionCompletion } from '../src/sync/types';

jest.mock('../src/app/dependencies', () => ({
  appDependencies: {
    sessionSync: {
      list: jest.fn(),
      sync: jest.fn(),
      cancel: jest.fn(),
      finishDraft: jest.fn(),
    },
  },
}));
jest.mock('../src/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'patient-user', role: 'patient' } }),
}));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn(() => jest.fn()) },
}));

const sessionSync = appDependencies.sessionSync as unknown as {
  list: jest.Mock;
  sync: jest.Mock;
  cancel: jest.Mock;
  finishDraft: jest.Mock;
};

const completion: SessionCompletion = {
  status: 'interrupted',
  finished_at: '2026-11-06T12:10:00.000Z',
  active_duration_ms: 0,
  low_confidence_summary: null,
  feedback_summary: null,
  items: [],
};

let context: ReturnType<typeof useSessionSync>;
function Probe() {
  context = useSessionSync();
  return null;
}

let app: ReactTestRenderer.ReactTestRenderer;
afterEach(async () => {
  await act(async () => app.unmount());
  jest.clearAllMocks();
});

test('finishDraft resolves once saved even if reading the queue fails', async () => {
  const saved = { state: 'pending' };
  sessionSync.list.mockResolvedValue([]);
  sessionSync.finishDraft.mockResolvedValue(saved);
  sessionSync.sync.mockResolvedValue({
    sent: 0,
    remaining: 1,
    blocked: 0,
    sent_client_session_ids: [],
  });
  await act(async () => {
    app = ReactTestRenderer.create(
      <SessionSyncProvider>
        <Probe />
      </SessionSyncProvider>,
    );
  });

  const storageError = new Error('storage');
  sessionSync.list.mockRejectedValueOnce(storageError);
  let result: unknown;
  await act(async () => {
    result = await context.finishDraft('client-1', completion);
  });

  expect(result).toBe(saved);
  expect(sessionSync.finishDraft).toHaveBeenCalledWith(
    'patient-user',
    'client-1',
    completion,
  );
  // Sending still starts, and the follow-up sync reads the queue successfully,
  // which supersedes the earlier load failure.
  expect(sessionSync.sync).toHaveBeenCalledWith('patient-user');
  expect(sessionSync.list).toHaveBeenCalledTimes(3);
  expect(context.loadError).toBeNull();
});
