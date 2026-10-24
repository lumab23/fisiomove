# B07 — Registro de sessões

## Contrato

O paciente autenticado registra resultados derivados em
`POST /api/v1/me/sessions`. A API não aceita arquivos, imagens, áudio ou vídeo.
O paciente é identificado pela conta autenticada; não existe `patient_id` no
corpo da requisição.

O treino precisa pertencer ao paciente e a revisão precisa ser publicada e
pertencer ao treino informado. A sessão grava o snapshot retornado pela
interface pública de B05, sem reconstruí-lo a partir do catálogo atual.
Resultados de itens precisam referenciar itens dessa revisão, respeitar
posição e não superar séries e repetições prescritas. A sessão `completed` precisa registrar
a prescrição completa; `interrupted` preserva os resultados parciais enviados.

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
