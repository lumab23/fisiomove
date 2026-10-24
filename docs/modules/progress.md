# B08 — Histórico e progresso

## Rotas

- `GET /api/v1/me/sessions` e `/me/sessions/{session_id}` para o próprio paciente.
- `GET /api/v1/patients/{patient_id}/sessions` e
  `/patients/{patient_id}/sessions/{session_id}` para profissional com vínculo
  ativo.
- `GET /api/v1/me/progress` e `/api/v1/patients/{patient_id}/progress` para
  paciente e profissional autorizado, respectivamente.

As listas aceitam `period_start`, `period_end`, `page` e `page_size`.
`period_start` e `period_end` são opcionais no histórico; quando enviados,
precisam incluir fuso horário. O período compara `started_at` com limites
inclusivos. Ordenação é da sessão mais recente para a mais antiga, com UUID
como desempate. O detalhe reutiliza a sessão e seu snapshot persistidos por B07.

As rotas de progresso exigem `period_start` e `period_end`, ambos com fuso
horário. São normalizados para UTC e o fim deve ser igual ou posterior ao
início. A resposta devolve esses limites normalizados.

## Agregação

Cada linha persistida de `session_results` conta uma vez. Retry com o mesmo
`client_session_id` é idempotente em B07 e não cria outra linha. Sessões reais
distintas continuam contando como tentativas distintas.

- `completed_sessions` conta somente status `completed`.
- `interrupted_sessions` conta somente status `interrupted`.
- `active_duration_ms` soma a duração ativa da sessão, completada ou interrompida.
- `prescribed_repetitions` soma `sets × repetitions` de cada item no snapshot
  imutável de cada sessão incluída no período.
- `performed_repetitions` soma as repetições realizadas informadas nos itens
  persistidos. Uma sessão interrompida contribui com seu resultado parcial.

O período seleciona sessões pela data `started_at`; uma sessão iniciada dentro
dele contribui com toda a sua duração registrada. Períodos sem sessões retornam
contagens e durações iguais a zero. Esses números descrevem atividade registrada
e não representam conclusão de recuperação clínica.
