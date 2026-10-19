# Contratos de domínio

> `User` e `RefreshToken` são implementados por B02. Paciente e vínculo são implementados por B03. Os demais domínios permanecem propostos para suas tarefas responsáveis.

Campos comuns de entidades persistidas: `id: UUID`, `created_at: datetime UTC` e `updated_at: datetime UTC`.

## Identidade e paciente (B02-B03)

`User`:

- `id: UUID`;
- `email: string`, normalizado e único;
- `role: patient | physiotherapist`, imutável pelo cliente;
- `is_active: boolean`;
- `must_change_password: boolean`;
- `auth_version: integer >= 1`, incrementado ao invalidar credenciais existentes;
- `created_at`, `updated_at`.

Hashes de senha e de renovação nunca fazem parte de DTOs de resposta.

`RefreshToken` é interno e nunca é serializado como entidade: `id`, `user_id`, `token_hash: SHA-256`, `family_id`, `expires_at`, `created_at`, `revoked_at`, `replaced_by_id`. O token opaco completo só existe no cliente e na resposta que o emitiu.

`Patient`:

- `id: UUID`;
- `user_id: UUID | null`, único, referência opcional à conta B02;
- `full_name: string`, obrigatório, sem exigir CPF;
- `email: string | null`;
- `phone: string | null`;
- `is_active: boolean`;
- `created_at`, `updated_at`.

`ProfessionalPatientLink`: `id`, `physiotherapist_id`, `patient_id`, `is_active`, `created_at`, `updated_at`. O par profissional/paciente é único. As FKs usam `RESTRICT`; desativação não remove paciente, vínculo nem recursos futuros.

## Catálogo de exercícios (B04)

`Exercise`:

- `id: UUID` estável;
- `code: string` único e estável;
- `name: string`;
- `instructions: string`;
- `allowed_sides: left | right | bilateral[]`;
- `rule_version: string`;
- `supported_parameters: object` versionado;
- `is_active: boolean`.

Nenhum limiar clínico ou parâmetro angular padrão é definido em B01.

## Treinos e revisões (B04-B05)

`Workout` identifica o agregado: `id`, `patient_id`, `created_by`, `status`, `current_revision_id`, timestamps.

Estados: `draft`, `published`, `archived`.

- `draft` pode ser editado pelo profissional vinculado.
- Publicar cria uma `WorkoutRevision` imutável e identificável.
- Edição posterior cria nova revisão; nunca altera a revisão usada por sessão passada.
- `archived` deixa de ser oferecido como novo treino, mas permanece referenciável no histórico.

`WorkoutRevision`: `id`, `workout_id`, `revision_number: integer >= 1`, `instructions: string | null`, `published_at: datetime UTC | null`, `created_at`.

`WorkoutItem`: `id`, `revision_id`, `position: integer >= 1`, `exercise_id`, `side`, `sets: integer > 0`, `repetitions: integer > 0`, `rest_duration_ms: integer >= 0`, `professional_guidance: string | null`, `parameters: object` validado pelo contrato versionado do exercício.

## Observações (B06)

`Note`: `id`, `patient_id`, `author_id`, `content: string não vazio`, `visibility: patient_visible | professional_only`, `created_at`, `updated_at`.

Somente o autor profissional, ainda autorizado pelo vínculo, pode editar. Notas `professional_only` nunca são retornadas ao paciente.

## Sessões e idempotência (B07)

`SessionResult`:

- `id: UUID` gerado pelo servidor;
- `client_session_id: UUID` gerado uma vez pelo cliente;
- `patient_id: UUID` obtido da identidade, não do corpo do paciente;
- `workout_id: UUID` e `workout_revision_id: UUID`;
- `status: completed | interrupted`;
- `started_at`, `finished_at: datetime UTC`, com fim não anterior ao início;
- `active_duration_ms: integer >= 0`;
- `low_confidence_summary: object | null`;
- `feedback_summary: object | null`;
- `workout_snapshot: object` imutável;
- `items: SessionItemResult[]`.

`SessionItemResult`: `workout_item_id`, `position`, `completed_sets: integer >= 0`, `completed_repetitions: integer >= 0`, `active_duration_ms: integer >= 0`, `interrupted: boolean`.

Idempotência usa a chave única `(patient_id, client_session_id)`. Mesmo conteúdo retorna o resultado existente; conteúdo divergente retorna `409 idempotency_conflict`. Retry não duplica sessão nem conquista. Apenas dados derivados são aceitos; mídia não é enviada.

Exemplo proposto:

```json
{
  "client_session_id": "22222222-2222-4222-8222-222222222222",
  "workout_id": "33333333-3333-4333-8333-333333333333",
  "workout_revision_id": "44444444-4444-4444-8444-444444444444",
  "status": "interrupted",
  "started_at": "2026-10-19T14:00:00Z",
  "finished_at": "2026-10-19T14:05:00Z",
  "active_duration_ms": 180000,
  "low_confidence_summary": null,
  "feedback_summary": null,
  "workout_snapshot": {},
  "items": []
}
```

## Progresso e conquistas (B08-B09)

`ProgressSummary`: `patient_id`, `period_start`, `period_end`, `completed_sessions`, `interrupted_sessions`, `active_duration_ms`, `prescribed_repetitions`, `performed_repetitions`, `generated_at`.

Progresso é derivado de sessões persistidas e não representa conclusão de recuperação clínica. Estado vazio retorna zeros coerentes.

`Achievement`: `id`, `patient_id`, `code`, `session_id`, `earned_at`. O par `(patient_id, code, session_id)` deve ser único. A regra proposta recompensa atingir a meta da sessão, nunca exceder a prescrição.
