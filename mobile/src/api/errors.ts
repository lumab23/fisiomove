export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'session_expired'
  | 'access_denied'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'server'
  | 'unexpected';

export interface ApiErrorBody {
  code?: string;
  message?: string;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isTransient(): boolean {
    return (
      this.kind === 'network' ||
      this.kind === 'timeout' ||
      this.kind === 'server'
    );
  }
}

export function friendlyErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Não foi possível concluir agora. Tente novamente.';
  }

  switch (error.kind) {
    case 'network':
      return 'Sem conexão com o servidor. Verifique sua internet.';
    case 'timeout':
      return 'A conexão demorou mais que o esperado. Tente novamente.';
    case 'session_expired':
      return 'Sua sessão terminou. Entre novamente.';
    case 'access_denied':
      return error.code === 'password_change_required'
        ? 'Troque sua senha temporária para continuar.'
        : 'Você não tem permissão para realizar esta ação.';
    case 'not_found':
      return 'Não encontramos as informações solicitadas.';
    case 'conflict':
      return 'Essas informações foram alteradas. Atualize e tente novamente.';
    case 'validation':
      return 'Confira os dados informados e tente novamente.';
    case 'server':
    case 'unexpected':
      return 'Ocorreu um erro inesperado. Tente novamente.';
  }
}

export function apiErrorFromResponse(status: number, body: unknown): ApiError {
  const parsed = body && typeof body === 'object' ? (body as ApiErrorBody) : {};
  const message =
    parsed.message ?? 'A API não conseguiu concluir a solicitação.';
  const common = [message, status, parsed.code, parsed.details] as const;

  if (status === 401) {
    return new ApiError('session_expired', ...common);
  }
  if (status === 403) {
    return new ApiError('access_denied', ...common);
  }
  if (status === 404) {
    return new ApiError('not_found', ...common);
  }
  if (status === 409) {
    return new ApiError('conflict', ...common);
  }
  if (status === 422) {
    return new ApiError('validation', ...common);
  }
  if (status >= 500) {
    return new ApiError('server', ...common);
  }
  return new ApiError('unexpected', ...common);
}
