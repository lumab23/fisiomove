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
| B04 | `GET /api/v1/exercises` | paginação/filtros | `Page[ExerciseResponse]` |
| B04 | `GET /api/v1/exercises/{id}` | UUID no caminho | `ExerciseResponse` |
| B04-B05 | `POST /api/v1/patients/{id}/workouts` | `WorkoutCreate` | `WorkoutResponse` |
| B04-B05 | `GET /api/v1/patients/{id}/workouts` | paginação/filtros | `Page[WorkoutResponse]` |
| B05 | `GET /api/v1/workouts/{id}` | UUID no caminho | `WorkoutResponse` |
| B05 | `PATCH /api/v1/workouts/{id}` | `WorkoutUpdate` | `WorkoutResponse` com nova revisão quando aplicável |
| B05 | `POST /api/v1/workouts/{id}/publish` | sem corpo | `WorkoutResponse` publicado |
| B05 | `POST /api/v1/workouts/{id}/archive` | sem corpo | `WorkoutResponse` arquivado |
| B05 | `GET /api/v1/me/workouts` | paginação | `Page[WorkoutResponse]` publicado |
| B06 | `GET /api/v1/patients/{id}/notes` | paginação | `Page[NoteResponse]` filtrada por visibilidade |
| B06 | `POST /api/v1/patients/{id}/notes` | `NoteCreate` | `NoteResponse` |
| B06 | `PATCH /api/v1/notes/{id}` | `NoteUpdate` | `NoteResponse` |
| B07 | `POST /api/v1/me/sessions` | `SessionResultCreate` | `SessionResultResponse` idempotente |
| B08 | `GET /api/v1/me/sessions` | período/paginação | `Page[SessionSummary]` |
| B08 | `GET /api/v1/me/sessions/{session_id}` | UUID no caminho | `SessionResultResponse` |
| B08 | `GET /api/v1/patients/{patient_id}/sessions` | período/paginação | `Page[SessionSummary]` |
| B08 | `GET /api/v1/patients/{patient_id}/sessions/{session_id}` | UUIDs no caminho | `SessionResultResponse` |
| B08 | `GET /api/v1/me/progress` | período | `ProgressSummary` |
| B08 | `GET /api/v1/patients/{patient_id}/progress` | período | `ProgressSummary` |
| B09 | `GET /api/v1/me/achievements` | identidade autenticada | `list[AchievementResponse]` |
| B09 | `GET /api/v1/patients/{patient_id}/achievements` | UUID de paciente vinculado | `list[AchievementResponse]` |

B10 reutiliza as rotas B07/B08: `SessionResultResponse`, `SessionSummary` e
`ProgressSummary` incluem `score`. Não há ranking nem endpoint redundante de
pontuação. B11 não cria rota: calibração e visão computacional permanecem no
mobile. B12 não cria rota pública de aprovação; as consultas de catálogo
retornam apenas exercícios ativos com aprovação válida para a `rule_version`.

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

## DTOs de escrita implementados

- `WorkoutCreate`/`WorkoutUpdate`: instruções e lista ordenada de itens conforme `domain-contracts.md`.
- `NoteCreate`/`NoteUpdate`: conteúdo e visibilidade conforme `domain-contracts.md`.
- `SessionResultCreate`: resultado derivado conforme `domain-contracts.md`, sem
  `score`, calibração, imagens, vídeo ou áudio.

Todos os DTOs de escrita rejeitam campos desconhecidos. O catálogo permanece
sem registros de produção enquanto não existir exercício clinicamente aprovado.
