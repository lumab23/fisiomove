import { ApiError, friendlyErrorMessage } from '../api/errors';

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'empty'; data: T }
  | {
      status: 'failure';
      kind:
        | 'offline'
        | 'session_expired'
        | 'access_denied'
        | 'validation'
        | 'sync_conflict'
        | 'not_found'
        | 'unexpected';
      message: string;
      code?: string;
      cause: unknown;
    };

export function resolvedState<T>(
  data: T,
  isEmpty: (value: T) => boolean,
): AsyncState<T> {
  return isEmpty(data)
    ? { status: 'empty', data }
    : { status: 'success', data };
}

export function failureState<T>(cause: unknown): AsyncState<T> {
  const error = cause instanceof ApiError ? cause : null;
  let kind: Extract<AsyncState<T>, { status: 'failure' }>['kind'] =
    'unexpected';
  if (error?.kind === 'network' || error?.kind === 'timeout') {
    kind = 'offline';
  } else if (error?.kind === 'session_expired') {
    kind = 'session_expired';
  } else if (error?.kind === 'access_denied') {
    kind = 'access_denied';
  } else if (error?.kind === 'validation') {
    kind = 'validation';
  } else if (error?.kind === 'conflict') {
    kind = 'sync_conflict';
  } else if (error?.kind === 'not_found') {
    kind = 'not_found';
  }
  return {
    status: 'failure',
    kind,
    message: friendlyErrorMessage(cause),
    code: error?.code,
    cause,
  };
}
