import { useCallback, useRef, useState } from 'react';

import { useSessionSync } from '../../sync/SessionSyncContext';
import type { PendingSession, SessionDraft } from '../../sync/types';
import type { SessionController } from './SessionController';

export function useSessionResult(
  controller: SessionController,
  draft: SessionDraft,
  stopCamera: () => Promise<void>,
) {
  const { finishDraft } = useSessionSync();
  const [saving, setSaving] = useState(false);
  const finalizing = useRef(false);
  const finalized = useRef(false);

  const save = useCallback(
    async (completion: ReturnType<SessionController['completion']>) => {
      if (finalizing.current || finalized.current) {
        throw new Error('O resultado desta sessão já está sendo finalizado.');
      }
      finalizing.current = true;
      setSaving(true);
      let pending: PendingSession | null = null;
      let saveError: unknown;
      let cameraError: unknown;
      try {
        pending = await finishDraft(draft.client_session_id, completion);
        finalized.current = true;
      } catch (error) {
        saveError = error;
      }
      try {
        await stopCamera();
      } catch (error) {
        cameraError = error;
      } finally {
        finalizing.current = false;
        setSaving(false);
      }
      if (saveError) {
        throw saveError;
      }
      if (cameraError) {
        throw cameraError;
      }
      if (!pending) {
        throw new Error('Não foi possível salvar o resultado da sessão.');
      }
      return pending;
    },
    [draft.client_session_id, finishDraft, stopCamera],
  );

  const complete = useCallback(
    () => save(controller.completion()),
    [controller, save],
  );
  const interrupt = useCallback(
    () => save(controller.interrupt()),
    [controller, save],
  );

  return { saving, complete, interrupt };
}
