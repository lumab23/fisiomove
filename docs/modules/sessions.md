# B07 — Registro de sessões

## Contrato

O paciente autenticado registra resultados derivados em
`POST /api/v1/me/sessions`. A API não aceita arquivos, imagens, áudio ou vídeo.
O paciente é identificado pela conta autenticada; não existe `patient_id` no
corpo da requisição.

`score` é campo de resposta calculado no servidor e é rejeitado quando enviado
no corpo. `calibration_result`, imagens, vídeo, áudio e landmarks também não
fazem parte de `SessionResultCreate`. `low_confidence_summary` e
`feedback_summary` são resumos derivados; não constituem prova clínica.

O treino precisa pertencer ao paciente e a revisão precisa ser publicada e
pertencer ao treino informado. A sessão grava o snapshot retornado pela
interface pública de B05, sem reconstruí-lo a partir do catálogo atual.
Resultados de itens precisam referenciar itens dessa revisão, respeitar
posição e não superar séries e repetições prescritas. A sessão `completed` precisa registrar
a prescrição completa; `interrupted` preserva os resultados parciais enviados.

Uma sessão iniciada antes de uma edição ou arquivamento pode ser enviada depois:
o backend usa a revisão informada e o snapshot histórico, desde que `started_at`
esteja entre a publicação dessa revisão e a próxima edição/arquivamento. Revisão
antiga fora dessa janela retorna `409 session_revision_not_active_at_start`.
O mobile deve persistir os identificadores e horários antes de iniciar e não
substituí-los pela prescrição atual ao reenviar.

`active_duration_ms` e duração dos itens são inteiros não negativos. A soma das
durações dos itens não pode exceder a duração ativa total. Datas precisam conter
fuso horário; são normalizadas para UTC e `finished_at` não pode anteceder
`started_at`.

## Idempotência

A chave `(patient_id, client_session_id)` é única. A API calcula SHA-256 de uma
serialização JSON canônica do conteúdo recebido. Reenvio idêntico retorna a
sessão já persistida; conteúdo diferente para a mesma chave retorna HTTP 409
com `idempotency_conflict`. A restrição no banco também protege contra retries
concorrentes.

Os resultados são persistidos uma vez em `session_results`. B08 implementa
histórico, paginação, detalhe e progresso derivados desses registros.

## Erros que o mobile deve tratar

- `401`: renovar a sessão ou solicitar novo login;
- `403 password_change_required`: abrir o fluxo obrigatório de troca de senha;
- `403 account_inactive`: interromper o uso da conta;
- `404 workout_not_found`/`revision_not_found`: não reenviar contra outro treino;
- `409 idempotency_conflict`: conservar o resultado local para diagnóstico e não
  gerar novo conteúdo com o mesmo `client_session_id`;
- `409 session_revision_not_active_at_start`: sincronizar as prescrições; o
  resultado não corresponde a uma revisão vigente no horário informado;
- `422 completed_session_incomplete` e `session_result_exceeds_plan`: corrigir a
  montagem local do resultado, sem truncar silenciosamente.
