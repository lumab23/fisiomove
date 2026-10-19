# Contratos de domínio propostos

> Nenhuma entidade, tabela ou rota descrita aqui é implementada por B01. Os campos abaixo estabilizam a integração e ainda exigem revisão das responsáveis pelos módulos.

Campos comuns de entidades persistidas: `id: UUID`, `created_at: datetime UTC` e `updated_at: datetime UTC`.

## Identidade e paciente (B02-B03)

`User`:

- `id: UUID`;
- `email: string`, normalizado e único;
- `role: patient | physiotherapist`, imutável pelo cliente;
- `is_active: boolean`;
- `must_change_password: boolean`;
- `created_at`, `updated_at`.

Hashes de senha e de renovação nunca fazem parte de DTOs de resposta.

`Patient`:

- `id: UUID`;
- `full_name: string`, obrigatório, sem exigir CPF;
- `email: string | null`;
- `phone: string | null`;
- `is_active: boolean`;
- `created_at`, `updated_at`.

`ProfessionalPatientLink`: `id`, `physiotherapist_id`, `patient_id`, `is_active`, `created_at`, `updated_at`. O par profissional/paciente deve ser único. Desativação não remove histórico.

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
