# Catálogo proposto de endpoints

> Estado: somente `GET /health` está implementado em B01. Todas as rotas `/api/v1` abaixo são contratos para tarefas futuras e não aparecem no OpenAPI atual.

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
| B07-B08 | `GET /api/v1/me/sessions` | período/paginação | `Page[SessionSummary]` |
| B07 | `GET /api/v1/me/sessions/{id}` | UUID no caminho | `SessionResultResponse` |
| B07-B08 | `GET /api/v1/patients/{id}/sessions` | período/paginação | `Page[SessionSummary]` |
| B07 | `GET /api/v1/patients/{id}/sessions/{session_id}` | UUIDs no caminho | `SessionResultResponse` |
| B08 | `GET /api/v1/me/progress` | período | `ProgressSummary` |
| B08 | `GET /api/v1/patients/{id}/progress` | período | `ProgressSummary` |
| B09 | `GET /api/v1/me/achievements` | paginação | `Page[AchievementResponse]` |

## DTOs de autenticação propostos

- `LoginRequest`: `email: string`, `password: string`.
- `RefreshRequest` e `LogoutRequest`: `refresh_token: string`.
- `TokenPairResponse`: `access_token: string`, `refresh_token: string`, `token_type: bearer`, `expires_in: integer > 0`.
- `ChangePasswordRequest`: `current_password: string`, `new_password: string` conforme política definida em B02.

Tokens e senhas nunca são persistidos ou registrados em texto puro. Política de expiração, hash, rotação e revogação pertence a B02.

## DTOs de escrita propostos

- `PatientCreate`: `full_name`, `email?`, `phone?`.
- `PatientUpdate`: subconjunto de `full_name`, `email`, `phone`, `is_active`; não aceita `role` nem profissional arbitrário.
- `PatientAccessRequest`: operação `activate | reset_temporary_password`; detalhes finais em B03.
- `WorkoutCreate`/`WorkoutUpdate`: instruções e lista ordenada de itens conforme `domain-contracts.md`.
- `NoteCreate`/`NoteUpdate`: conteúdo e visibilidade conforme `domain-contracts.md`.
- `SessionResultCreate`: resultado derivado conforme `domain-contracts.md`, sem imagens, vídeo ou áudio.

Todos os DTOs de escrita rejeitam campos desconhecidos. As tarefas donas devem materializar e testar os schemas sem mudar silenciosamente este contrato.
