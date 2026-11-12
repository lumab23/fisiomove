# Catálogo de endpoints implementados

> Estado: as rotas do backend do MVP estão implementadas e registradas no OpenAPI.

| Tarefa | Método e rota proposta | Entrada | Saída principal |
| --- | --- | --- | --- |
| B02 | `POST /api/v1/auth/login` | `LoginRequest` | `TokenPairResponse` |
| B02 | `POST /api/v1/auth/refresh` | `RefreshRequest` | `TokenPairResponse` rotacionado |
| B02 | `POST /api/v1/auth/logout` | `LogoutRequest` | `204` |
| B02 | `GET /api/v1/auth/me` | identidade autenticada | `UserResponse` |
| B02 | `POST /api/v1/auth/change-password` | `ChangePasswordRequest` | `204` |
| B03 | `POST /api/v1/patients` | `PatientCreate` | `PatientResponse` |
| B03 | `GET /api/v1/patients` | paginação/filtros | `Page[PatientResponse]` |
| B03 | `GET /api/v1/patients/{id}` | UUID no caminho | `PatientResponse` |
| B03 | `PATCH /api/v1/patients/{id}` | `PatientUpdate` | `PatientResponse` |
| B03 | `POST /api/v1/patients/{id}/access` | `PatientAccessRequest` | `PatientAccessResponse` sem credenciais internas |
| B03 | `GET /api/v1/me/profile` | identidade autenticada (`patient`) | `PatientSelfProfile` (`{ full_name }`) |
| Fase 7 | `GET /api/v1/me/physiotherapist-profile` | identidade autenticada (`physiotherapist`) | `PhysiotherapistProfileResponse` (`{ full_name: str \| null }`) |
| Fase 7 | `PUT /api/v1/me/physiotherapist-profile` | `PhysiotherapistProfileUpdate` (`{ full_name }`) | `PhysiotherapistProfileResponse` |
| Fase 7 | `GET /api/v1/me/physiotherapist` | identidade autenticada (`patient`) | `LinkedPhysiotherapistResponse` (`{ full_name: str \| null }`) |
| B04 | `GET /api/v1/exercises` | paginação/filtros | `Page[ExerciseResponse]` |
| B04 | `GET /api/v1/exercises/{id}` | UUID no caminho | `ExerciseResponse` (com `images` e `localization`) |
| DEC-010 | `GET /api/v1/exercises/{id}/images/{position}` | UUID e posição 1–6 (qualquer conta autenticada com senha trocada) | bytes da imagem (`image/png \| image/jpeg \| image/webp`), `Cache-Control: private, max-age=86400`, `ETag`; `404 exercise_image_not_found` |
| DEC-011 | `PUT /api/v1/exercises/{id}/localization` | `ExerciseLocalizationUpdate` (`{ name, instructions: string[] }`, `physiotherapist`) | `ExerciseResponse` com `localization`; não altera `rule_version` nem aprovação |
| Fase 8 | `GET /api/v1/exercise-library` | `query?`, `body_part?`, paginação (`physiotherapist`) | `LibraryExercisePage` com `attribution` |
| Fase 8 | `GET /api/v1/exercise-library/{external_id}` | id externo validado (`physiotherapist`) | `LibraryExerciseDetailResponse` com `attribution` e `catalog_exercise` |
| DEC-006 | `POST /api/v1/exercise-library/{external_id}/catalog` | `CatalogImportRequest` (`{ allowed_sides, name_pt_br?, instructions_pt_br? }`, `physiotherapist`) | `ExerciseResponse` (`201` criado, com imagens copiadas; `200` existente, sem sobrescrever) |
| B04-B05 | `POST /api/v1/patients/{id}/workouts` | `WorkoutCreate` | `WorkoutResponse` |
| B04-B05 | `GET /api/v1/patients/{id}/workouts` | paginação/filtros | `Page[WorkoutResponse]` |
| B05 | `GET /api/v1/workouts/{id}` | UUID no caminho | `WorkoutResponse` |
| B05 | `PATCH /api/v1/workouts/{id}` | `WorkoutUpdate` | `WorkoutResponse` com nova revisão quando aplicável |
| B05 | `POST /api/v1/workouts/{id}/publish` | sem corpo | `WorkoutResponse` publicado |
| B05 | `POST /api/v1/workouts/{id}/archive` | sem corpo | `WorkoutResponse` arquivado |
| B05 | `POST /api/v1/workouts/{id}/unarchive` | sem corpo, profissional com vínculo ativo | `WorkoutResponse` em rascunho com nova revisão, sem publicação automática |
| B05 | `DELETE /api/v1/workouts/{id}` | profissional com vínculo ativo; rascunho ou arquivado sem sessões registradas | `204` sem corpo; histórico de sessões bloqueia exclusão |
| B05 | `GET /api/v1/me/workouts` | paginação | `Page[WorkoutResponse]` publicado |
| B06 | `GET /api/v1/patients/{id}/notes` | paginação | `Page[NoteResponse]` filtrada por visibilidade |
| B06 | `POST /api/v1/patients/{id}/notes` | `NoteCreate` | `NoteResponse` |
| B06 | `PATCH /api/v1/notes/{id}` | `NoteUpdate` | `NoteResponse` |
| B06 | `DELETE /api/v1/notes/{id}` | fisioterapeuta autor com vínculo ativo ao paciente | `204` sem corpo; `403 note_author_required` para outro autor, `404` para nota ausente ou vínculo indisponível |
| DEC-015 | `GET /api/v1/me/notes` | identidade autenticada (`patient`), paginação | `Page[OwnNoteResponse]` (`{ id, content, created_at, updated_at }`), só `patient_visible` |
| B07 | `POST /api/v1/me/sessions` | `SessionResultCreate` | `SessionResultResponse` idempotente |
| B08 | `GET /api/v1/me/sessions` | período/paginação | `Page[SessionSummary]` |
| B08 | `GET /api/v1/me/sessions/{session_id}` | UUID no caminho | `SessionResultResponse` |
| B08 | `GET /api/v1/patients/{patient_id}/sessions` | período/paginação | `Page[SessionSummary]` |
| B08 | `GET /api/v1/patients/{patient_id}/sessions/{session_id}` | UUIDs no caminho | `SessionResultResponse` |
| B08 | `GET /api/v1/me/progress` | período | `ProgressSummary` |
| B08 | `GET /api/v1/patients/{patient_id}/progress` | período | `ProgressSummary` |

B10 reutiliza as rotas B07/B08: `SessionResultResponse`, `SessionSummary` e
`ProgressSummary` incluem `score`. Não há ranking nem endpoint redundante de
pontuação. B11 não cria rota: calibração e visão computacional permanecem no
mobile. B12 não cria rota genérica de aprovação; as consultas de catálogo
retornam apenas exercícios ativos com aprovação válida para a `rule_version`.
A única rota que registra aprovação é a adição de item da biblioteca ao
catálogo (DEC-006). As rotas de conquistas (B09) foram removidas (DEC-007).

## DTOs de autenticação implementados

- `LoginRequest`: `email: string` válido, `password: string` entre 12 e 128 caracteres.
- `RefreshRequest` e `LogoutRequest`: `refresh_token: string` opaco.
- `TokenPairResponse`: `access_token: string`, `refresh_token: string`, `token_type: bearer`, `expires_in: integer > 0`.
- `ChangePasswordRequest`: `current_password: string`, `new_password: string` entre 12 e 128 caracteres e diferente da atual.

Tokens e senhas nunca são persistidos ou registrados em texto puro. O comportamento de expiração, hash, rotação e revogação está em `authentication.md`.

## DTOs de pacientes implementados

- `PatientCreate`: `full_name`, `email?`, `phone?`.
- `PatientUpdate`: subconjunto de `full_name`, `email`, `phone`, `is_active`; não aceita `role` nem profissional arbitrário.
- `PatientAccessRequest`: operação `activate | reset_temporary_password`.
- `PatientResponse`: dados básicos, estado do registro e indicadores de acesso; nunca inclui hashes ou tokens.
- `PatientAccessResponse`: identifica paciente/conta, ação executada e senha temporária exibida uma única vez.

## DTOs de perfil do fisioterapeuta implementados

- `PhysiotherapistProfileUpdate`: `full_name` (2–200 caracteres após `strip`); rejeita campos desconhecidos.
- `PhysiotherapistProfileResponse` e `LinkedPhysiotherapistResponse`: apenas `full_name: string | null`; nunca e-mail, IDs ou flags da conta.

Detalhes em `physiotherapist-profile.md`.

## Biblioteca externa de referência

`/exercise-library` é material de referência do OpenExerciseBase (CC BY-NC 4.0),
só para fisioterapeuta. Consultar não grava nada. `POST
/exercise-library/{external_id}/catalog` adiciona o item a `/exercises` para uso
acadêmico (DEC-006): aprovação em nome do fisioterapeuta, proveniência e
atribuição, sem parâmetro clínico; idempotente por `(source, external_id)`.
Falha do provedor retorna `503 external_library_unavailable`. Detalhes, campos
proibidos e atribuição obrigatória em `exercise-library.md`.

## DTOs de escrita implementados

- `WorkoutCreate`/`WorkoutUpdate`: instruções e lista ordenada de itens conforme
  `domain-contracts.md`; cada item aceita `counting_rule` opcional (DEC-013).
- `NoteCreate`/`NoteUpdate`: conteúdo e visibilidade conforme `domain-contracts.md`.
- `SessionResultCreate`: resultado derivado conforme `domain-contracts.md`, sem
  `score`, calibração, imagens, vídeo ou áudio; cada item aceita `counting_mode`
  opcional (padrão `manual`, ver `session-result.md`).

`GET /me/notes` exige papel `patient` com senha trocada: fisioterapeuta recebe
`403 insufficient_role`, senha temporária `403 password_change_required` e conta
sem registro de paciente ativo `404 patient_not_found`. Paginação igual à de
`GET /patients/{id}/notes` (`page >= 1`, `1 <= page_size <= 100`, padrão 20);
`total` e `pages` contam só as notas visíveis ao paciente.

- `CatalogImportRequest`: `allowed_sides` com 1 a 3 lados distintos, sem padrão.

Todos os DTOs de escrita rejeitam campos desconhecidos. Nenhuma migração ou seed
cadastra exercício; o catálogo só recebe itens adicionados pelo fisioterapeuta
a partir da biblioteca (DEC-006).
