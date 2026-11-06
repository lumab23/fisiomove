# Contratos de domínio

> `User` e `RefreshToken` são implementados por B02; paciente e vínculo por B03;
> exercícios, treinos e observações por B04–B06; sessões por B07; histórico e
> progresso por B08. Conquistas (B09) foram removidas do produto (DEC-007).

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
- `approval_status: pending | approved | revoked`;
- `approved_rule_version: string | null`;
- evidência interna: profissional, data e referência documental da última
  aprovação válida;
- proveniência interna (`source`, `source_external_id`, `source_url`,
  `source_license`): todas nulas para exercício criado no FisioMove, ou todas
  preenchidas para item adicionado da biblioteca de referência (DEC-006); o par
  `(source, source_external_id)` é único.
- tradução pt-BR opcional (DEC-011, migração `20261106_0014`): `name_pt_br`
  (até 200), `instructions_pt_br` (passos no formato `"n. passo"`, um por
  linha), `translated_by_id` (usuário fisioterapeuta) e `translated_at`; todas
  nulas ou todas preenchidas (`ck_exercises_localization_complete`). `name` e
  `instructions` originais nunca são alterados.
- imagens copiadas da biblioteca (DEC-010, migração `20261106_0013`) na tabela
  `exercise_images`: `exercise_id`, `position` (1–6), `content_type`
  (`image/png | image/jpeg | image/webp`), `sha256`, `source_url`, `data`
  (bytes), `byte_size` (1 B – 2 MiB), `created_at`; `(exercise_id, position)`
  é único.

`ExerciseResponse` expõe os campos acima (sem a evidência interna) e:

- `source: ExerciseSourceResponse | null`, que traz a atribuição: `source`
  (nome da fonte), `external_id`, `source_url`, `license`, `license_url` e
  `attribution` (texto de atribuição). É `null` para exercícios sem
  proveniência. Sem tradução, `attribution` é
  `"Name and instructions from <fonte>, licensed under <licença>. Text is kept in the original language without edits."`;
  com tradução, indica a alteração exigida pela CC BY-NC:
  `"Adapted from <fonte>, licensed under <licença>. Name and instructions translated into Portuguese by <tradutor> on <AAAA-MM-DD>; the original English text is preserved."`
  (data em UTC; `<tradutor>` é o mesmo valor de `translated_by_name`).
- `images: ExerciseImageResponse[]` (`{ position: int, url: string }`), em
  ordem de `position`; `url` é relativa à raiz do servidor
  (`/api/v1/exercises/{id}/images/{position}`, prefixo padrão) e exige o
  mesmo `Authorization: Bearer` das demais rotas. Lista vazia quando não há
  imagem.
- `localization: ExerciseLocalizationResponse | null`:
  `{ language: "pt-BR", name, instructions, translated_by_name, translated_at }`.
  `instructions` usa o mesmo formato de texto do original (`"1. ...\n2. ..."`);
  `translated_by_name` é o nome do perfil do fisioterapeuta
  (`physiotherapist_profiles.full_name`) ou, sem perfil, o texto neutro "fisioterapeuta do FisioMove" — nunca o e-mail (DEC-005).
  `null` sem tradução: o cliente mostra o original com o selo de idioma.

O `exercise_snapshot` guarda o `ExerciseResponse` do momento em que os itens do
treino são definidos (criação ou `PATCH` com `items`); `publish` copia os itens
da revisão em rascunho. Snapshots anteriores à proveniência não têm `source`;
anteriores a 0013/0014 não têm `images` nem `localization`, e não mudam quando
o exercício recebe imagens ou tradução depois (Q-P6): a novidade só chega numa
nova revisão com os itens redefinidos e publicada.

`ExerciseApprovalEvent` registra, de forma append-only, exercício, versão da
regra, decisão `approved | revoked`, profissional responsável, data e referência
documental. O registro técnico da evidência não substitui a validação clínica.
Uma mudança de `rule_version` invalida a aprovação anterior até nova evidência.
Somente exercício ativo, aprovado e com versão coincidente aparece no catálogo
e pode entrar em nova prescrição. Item adicionado da biblioteca é aprovado em
nome do fisioterapeuta para uso acadêmico (DEC-006), com
`supported_parameters = {}` e `rule_version = "library-reference-no-camera-rule:v1"`.

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
- `items: SessionItemResult[]`;
- `score: integer >= 0`, calculado exclusivamente pelo servidor.

`SessionItemResult`: `workout_item_id`, `position`, `completed_sets: integer >= 0`, `completed_repetitions: integer >= 0`, `active_duration_ms: integer >= 0`, `interrupted: boolean`.

O cliente não envia `score`. A regra B10 concede um ponto por repetição aceita,
limitada a `sets × repetitions` para cada item do snapshot. Sessão interrompida
recebe somente os pontos do resultado parcial; sessão concluída já precisa
conter a prescrição completa. Repetição adicional é rejeitada, não pontuada.

Idempotência usa a chave única `(patient_id, client_session_id)`. Mesmo conteúdo retorna o resultado existente; conteúdo divergente retorna `409 idempotency_conflict`. Retry não duplica sessão. Apenas dados derivados são aceitos; mídia não é enviada.

O corpo recebido não contém `patient_id` nem `workout_snapshot`: a identidade
vem do usuário autenticado, e o snapshot é obtido no servidor da revisão
publicada autorizada. Uma sessão `completed` contém todos os itens e metas da
prescrição; `interrupted` pode conter apenas os resultados parciais observados.

### Sessão pendente após edição ou arquivamento

O servidor valida `started_at` contra a janela histórica da revisão. A janela
começa em `published_at` (inclusive) e termina na criação da revisão seguinte
ou no arquivamento do treino (limite exclusivo). Assim, um resultado iniciado
enquanto aquela prescrição estava vigente pode chegar depois de uma queda de
conexão, edição ou arquivamento e ainda será conferido contra seu snapshot.
Uma revisão antiga escolhida para uma sessão iniciada depois desse limite é
recusada com `409 session_revision_not_active_at_start`.

O cliente deve persistir antes da execução `client_session_id`, `workout_id`,
`workout_revision_id` e `started_at`, e reutilizar exatamente esses valores no
retry. Esta versão do contrato usa o horário informado pelo dispositivo e exige
UTC/fuso explícito; um comprovante de início assinado pelo servidor seria uma
evolução incompatível de protocolo e não está implementado.

Exemplo:

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
  "items": []
}
```

## Progresso (B08)

`ProgressSummary`: `patient_id`, `period_start`, `period_end`, `completed_sessions`, `interrupted_sessions`, `active_duration_ms`, `prescribed_repetitions`, `performed_repetitions`, `score`, `generated_at`.

Progresso é derivado de sessões persistidas e não representa conclusão de recuperação clínica. Estado vazio retorna zeros coerentes.

## Calibração individual (M06, mobile)

Não existe entidade ou endpoint de calibração no backend do MVP. A calibração é
uma referência computacional local, vinculada no dispositivo a paciente,
exercício, item/revisão do treino e `rule_version`. O backend fornece o snapshot
imutável e rejeita `calibration_result` no payload da sessão. Imagens, vídeos,
landmarks e referências arbitrárias não são persistidos no servidor.
