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

const sessionEnded = 'Sua sessão terminou. Entre novamente.';
const unexpected = 'Ocorreu um erro inesperado. Tente novamente.';
const serverUnavailable =
  'O servidor está indisponível no momento. Tente novamente em instantes.';

/**
 * pt-BR text for every `code` the backend can return (DEC-014). The backend
 * `message` stays in English for developers and is never shown. A new `code`
 * in `docs/contracts/api-conventions.md` needs a line here (checked in
 * `__tests__/ApiErrorMessages.test.ts`).
 */
export const apiErrorMessages: Readonly<Record<string, string>> = {
  bad_request:
    'Não foi possível concluir a solicitação. Confira os dados e tente novamente.',
  current_password_invalid:
    'A senha atual está incorreta. Confira e tente novamente.',
  password_reuse: 'A nova senha precisa ser diferente da senha atual.',
  authentication_required: sessionEnded,
  invalid_access_token: sessionEnded,
  access_token_expired: sessionEnded,
  access_token_invalidated: sessionEnded,
  invalid_credentials: 'E-mail ou senha incorretos. Confira e tente novamente.',
  invalid_refresh_token: sessionEnded,
  refresh_token_revoked: sessionEnded,
  refresh_token_expired: sessionEnded,
  account_inactive: 'Esta conta está desativada.',
  password_change_required: 'Troque sua senha temporária para continuar.',
  insufficient_role: 'Esta conta não tem acesso a esta área.',
  clinical_approval_forbidden:
    'Só um fisioterapeuta com a conta ativa pode aprovar exercícios.',
  note_author_required: 'Só quem escreveu a observação pode editá-la.',
  forbidden: 'Você não tem permissão para realizar esta ação.',
  account_not_found: 'Não encontramos a conta deste paciente.',
  patient_not_found: 'Não encontramos este paciente.',
  physiotherapist_not_found:
    'Ainda não há um fisioterapeuta ligado a esta conta.',
  exercise_not_found: 'Este exercício não está disponível no catálogo.',
  exercise_image_not_found: 'Não encontramos a imagem deste exercício.',
  library_exercise_not_found:
    'Este exercício não está mais disponível na fonte.',
  workout_not_found: 'Não encontramos este treino.',
  revision_not_found: 'Não encontramos esta versão do treino.',
  note_not_found: 'Não encontramos esta observação.',
  session_not_found: 'Não encontramos esta sessão.',
  not_found: 'Não encontramos as informações solicitadas.',
  email_conflict: 'Este e-mail já é usado por outra conta.',
  initial_physiotherapist_exists:
    'O primeiro fisioterapeuta já foi cadastrado.',
  role_mismatch: 'Esta conta não é de paciente.',
  patient_inactive: 'Este cadastro está desativado.',
  patient_email_required: 'Cadastre um e-mail para liberar o acesso.',
  patient_email_required_for_access:
    'Este paciente já tem acesso, então o e-mail não pode ficar em branco.',
  patient_access_not_created:
    'Libere o acesso antes de gerar uma nova senha provisória.',
  patient_access_already_active: 'O acesso deste paciente já está ativo.',
  parameter_contract_pending:
    'Um dos exercícios ainda não pode entrar em treinos. Escolha outro exercício.',
  catalog_exercise_revoked:
    'Este exercício foi retirado do catálogo e não pode ser adicionado de novo.',
  workout_archived: 'Este treino foi arquivado e não pode mais ser editado.',
  workout_not_draft:
    'Só é possível publicar um treino em rascunho. Atualize a tela.',
  idempotency_conflict: 'Esta sessão já foi registrada com outros dados.',
  session_revision_not_active_at_start:
    'O treino foi atualizado pelo fisioterapeuta antes desta sessão começar.',
  conflict: 'Essas informações foram alteradas. Atualize e tente novamente.',
  validation_error: 'Confira os dados informados e tente novamente.',
  approval_document_reference_invalid:
    'A referência do documento de aprovação não é válida.',
  library_exercise_without_instructions:
    'A fonte não informa os passos deste exercício, por isso ele não pode entrar no catálogo.',
  library_exercise_too_long:
    'O texto deste exercício é longo demais para o catálogo.',
  unsupported_side: 'O lado escolhido não é permitido para este exercício.',
  unsupported_parameters: 'Este exercício não aceita parâmetros adicionais.',
  counting_rule_unsupported_side:
    'A contagem automática só pode ser usada em exercício de um lado só.',
  session_item_invalid: 'Esta sessão não corresponde ao treino publicado.',
  counting_mode_unavailable:
    'A contagem automática não está ativada para este exercício.',
  session_result_exceeds_plan:
    'O resultado tem mais séries ou repetições do que o prescrito.',
  session_item_duration_exceeds_total:
    'A duração dos exercícios passou da duração da sessão.',
  completed_session_incomplete: 'Faltam informações para concluir esta sessão.',
  invalid_datetime: 'A data informada não é válida.',
  invalid_period: 'A data final precisa ser depois da data inicial.',
  internal_error: unexpected,
  database_unavailable: serverUnavailable,
  database_not_ready: serverUnavailable,
  external_library_unavailable:
    'A biblioteca externa não respondeu. Tente de novo em alguns instantes.',
  http_error: unexpected,
};

const kindMessages: Record<ApiErrorKind, string> = {
  network: 'Sem conexão com o servidor. Verifique sua internet.',
  timeout: 'A conexão demorou mais que o esperado. Tente novamente.',
  session_expired: sessionEnded,
  access_denied: 'Você não tem permissão para realizar esta ação.',
  not_found: 'Não encontramos as informações solicitadas.',
  conflict: 'Essas informações foram alteradas. Atualize e tente novamente.',
  validation: 'Confira os dados informados e tente novamente.',
  server: unexpected,
  unexpected,
};

function hasText(map: Readonly<Record<string, string>>, code: string) {
  return Object.prototype.hasOwnProperty.call(map, code);
}

const genericMessage = 'Não foi possível concluir agora. Tente novamente.';

/**
 * pt-BR message for any failure: screen map → global map by `code` → text by
 * `kind` → generic text. `ApiError.message` is never shown.
 */
export function friendlyErrorMessage(
  error: unknown,
  byCode: Readonly<Record<string, string>> = {},
): string {
  if (!(error instanceof ApiError)) {
    return genericMessage;
  }
  const code = error.code;
  if (code && hasText(byCode, code)) {
    return byCode[code];
  }
  if (code && hasText(apiErrorMessages, code)) {
    return apiErrorMessages[code];
  }
  return kindMessages[error.kind] ?? genericMessage;
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
